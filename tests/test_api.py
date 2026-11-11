import io
import math

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app

client = TestClient(app)


def png_bytes(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr.astype(np.uint8)).save(buf, format="PNG")
    return buf.getvalue()


def cardboard_image():
    rng = np.random.default_rng(0)
    base = np.array([176, 132, 84], dtype=np.float32)  # kraft brown, matte
    img = base + rng.normal(0, 3, (200, 200, 3))
    return png_bytes(np.clip(img, 0, 255))


def glossy_bottle_image():
    img = np.zeros((200, 200, 3), dtype=np.float32)
    img[:] = [20, 90, 210]  # vivid blue plastic
    img[40:160, 60:70] = 255  # sharp specular highlight stripes
    img[50:60, 120:180] = 255
    return png_bytes(img)


def post(data: bytes, name="x.png", ctype="image/png", **form):
    return client.post("/api/analyze", files={"file": (name, data, ctype)}, data=form)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["mode"] in ("demo", "model")


def test_analyze_returns_full_pipeline():
    r = post(glossy_bottle_image())
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("mode", "classification", "bayes", "mdp", "path", "decision"):
        assert key in body
    probs = body["classification"]["probabilities"]
    assert math.isclose(probs["plastic"] + probs["paper"], 1.0, rel_tol=1e-6)
    assert math.isclose(sum(body["bayes"]["posterior"].values()), 1.0, rel_tol=1e-9)
    assert set(body["mdp"]["Q"]["LowConfidence"]) == {"Sort_Plastic", "Sort_Paper", "Inspect_Again"}


def test_result_depends_on_image_content():
    plastic = post(glossy_bottle_image()).json()
    paper = post(cardboard_image()).json()
    assert plastic["classification"]["label"] == "plastic"
    assert paper["classification"]["label"] == "paper"
    assert plastic["classification"]["probabilities"] != paper["classification"]["probabilities"]


def test_sort_action_produces_path_to_matching_bin():
    body = post(cardboard_image()).json()
    if body["mdp"]["action"] == "Inspect_Again":
        assert body["path"] is None
    else:
        target = "plastic" if body["mdp"]["action"] == "Sort_Plastic" else "paper"
        assert body["path"]["found"] and body["path"]["target"] == target
        assert body["path"]["path"][-1] == body["path"]["bins"][target]


def test_corrupted_image():
    r = post(b"\x89PNG\r\n\x1a\nthis is not really a png")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_image"


def test_not_an_image():
    r = post(b"hello", name="a.txt", ctype="text/plain")
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_type"


def test_too_large():
    r = post(b"\x00" * (5 * 1024 * 1024 + 10))
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "file_too_large"


def test_bayes_endpoint():
    r = client.post("/api/bayes", json={"prior_plastic": 0.3, "likelihood_plastic": 0.8, "likelihood_paper": 0.25})
    assert r.status_code == 200
    assert math.isclose(r.json()["evidence"], 0.415)


def test_bayes_endpoint_validation():
    r = client.post("/api/bayes", json={"prior_plastic": 1.5})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_mdp_endpoint():
    low = client.post("/api/mdp", json={"posterior_plastic": 0.55, "gamma": 0.9}).json()
    high = client.post("/api/mdp", json={"posterior_plastic": 0.98, "gamma": 0.9}).json()
    assert low["action"] == "Inspect_Again"
    assert high["action"] == "Sort_Plastic"


def test_astar_endpoint_no_path():
    wall = [[2, y] for y in range(5)]
    r = client.post("/api/astar", json={"width": 5, "height": 5, "start": [0, 0], "goal": [4, 4], "obstacles": wall})
    assert r.status_code == 200 and r.json()["found"] is False


def test_frontend_served():
    r = client.get("/")
    assert r.status_code == 200 and "ECOLOOP" in r.text
