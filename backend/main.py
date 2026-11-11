"""ECOLOOP API + static frontend.

Run:  uvicorn backend.main:app --reload     ->  http://127.0.0.1:8000
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import pipeline
from .algorithms import astar, bayes, mdp
from .ml import classifier
from .schemas import AStarRequest, BayesRequest, HealthResponse, MDPRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ecoloop")

app = FastAPI(
    title="ECOLOOP API",
    description="AI Smart Waste Sorting: CNN → Bayes → MDP → A*",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(classifier.ImageError)
async def image_error_handler(_: Request, exc: classifier.ImageError):
    return error(400 if exc.code != "file_too_large" else 413, exc.code, str(exc))


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return error(422, "invalid_value", str(exc))


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    msg = first.get("msg", "Invalid request")
    return error(422, "validation_error", f"{loc}: {msg}" if loc else msg)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException):
    return error(exc.status_code, "http_error", str(exc.detail))


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return error(500, "internal_error", "Something went wrong on the server. Please try again.")


@app.get("/api/health", response_model=HealthResponse)
def health():
    mode = classifier.current_mode()
    meta = classifier.model_meta() if mode == "model" else None
    return {"status": "ok", "mode": mode, "model": meta}


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(..., description="JPG / PNG / WEBP, max 5 MB"),
    gamma: float = Form(0.9, ge=0.0, le=0.99),
    prior_plastic: float | None = Form(None, ge=0.01, le=0.99),
):
    if file.content_type and not file.content_type.startswith("image/"):
        return error(415, "unsupported_type", f"Expected an image, got {file.content_type}.")
    data = await file.read(classifier.MAX_BYTES + 1)
    result = pipeline.analyze(data, gamma=gamma, prior_plastic=prior_plastic)
    log.info("analyze %s: mode=%s decision=%s action=%s",
             file.filename, result["mode"], result["decision"]["material"], result["decision"]["action"])
    return result


@app.post("/api/bayes")
def bayes_endpoint(req: BayesRequest):
    prior = {"plastic": req.prior_plastic, "paper": 1 - req.prior_plastic}
    lik = {"plastic": req.likelihood_plastic, "paper": req.likelihood_paper}
    return bayes.bayes_update(prior, lik)


@app.post("/api/mdp")
def mdp_endpoint(req: MDPRequest):
    post = {"plastic": req.posterior_plastic, "paper": 1 - req.posterior_plastic}
    prior = {"plastic": req.prior_plastic, "paper": 1 - req.prior_plastic}
    return mdp.decide(post, prior, gamma=req.gamma,
                      inspect_success=req.inspect_success, verified_accuracy=req.verified_accuracy)


@app.post("/api/astar")
def astar_endpoint(req: AStarRequest):
    res = astar.astar(req.width, req.height, tuple(req.start), tuple(req.goal),
                      [tuple(o) for o in req.obstacles if len(o) == 2])
    return res


@app.get("/api/astar/default")
def astar_default():
    return {
        "width": astar.DEFAULT_WIDTH,
        "height": astar.DEFAULT_HEIGHT,
        "start": list(astar.DEFAULT_START),
        "bins": {k: list(v) for k, v in astar.DEFAULT_BINS.items()},
        "obstacles": [list(c) for c in astar.DEFAULT_OBSTACLES],
    }


FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
