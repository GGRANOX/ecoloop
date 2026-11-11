# Vercel serverless entrypoint: exposes the same FastAPI app.
# vercel.json rewrites /api/<x>, /docs and /openapi.json to /api/index?__path=<original path>;
# this wrapper restores the original path so FastAPI routing works unchanged.
from urllib.parse import parse_qsl, urlencode

from backend.main import app as fastapi_app


async def app(scope, receive, send):
    if scope["type"] == "http":
        params = parse_qsl(scope.get("query_string", b"").decode(), keep_blank_values=True)
        original = next((v for k, v in params if k == "__path"), None)
        if original:
            rest = [(k, v) for k, v in params if k != "__path"]
            path = "/" + original.lstrip("/")
            scope = dict(scope, path=path, raw_path=path.encode(), query_string=urlencode(rest).encode())
    await fastapi_app(scope, receive, send)
