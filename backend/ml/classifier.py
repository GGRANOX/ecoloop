"""Image classifier: plastic vs paper.

mode "model": a fine-tuned MobileNetV2 (backend/ml/model/ecoloop_mobilenetv2.pt) is used.
mode "demo" : weights (or PyTorch) are missing -> transparent colour/texture heuristic.
The mode is re-checked on every call, so dropping trained weights into the folder
switches the API to "model" without code changes.
"""
from __future__ import annotations

import io
import json
import logging
import threading
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from .demo_features import demo_predict

log = logging.getLogger("ecoloop.classifier")

MODEL_DIR = Path(__file__).resolve().parent / "model"
WEIGHTS_PATH = MODEL_DIR / "ecoloop_mobilenetv2.pt"
META_PATH = MODEL_DIR / "meta.json"
MAX_BYTES = 5 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "BMP", "GIF"}
CLASSES = ["paper", "plastic"]  # alphabetical, same order as train.py


class ImageError(ValueError):
    """Raised for invalid user images (wrong type, too large, corrupted)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def load_image(data: bytes) -> Image.Image:
    if not data:
        raise ImageError("empty_file", "The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise ImageError("file_too_large", f"Image is {len(data) / 1e6:.1f} MB; the limit is 5 MB.")
    try:
        probe = Image.open(io.BytesIO(data))
        fmt = probe.format
        probe.verify()  # detects truncated / corrupted files
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ImageError("invalid_image", "The file is not a readable image (corrupted or unsupported).") from exc
    if fmt not in ALLOWED_FORMATS:
        raise ImageError("unsupported_type", f"Unsupported image type {fmt}. Use JPG, PNG or WEBP.")
    if img.width < 16 or img.height < 16:
        raise ImageError("image_too_small", "Image is too small to analyse (min 16x16 px).")
    return img.convert("RGB")


class _ModelHolder:
    def __init__(self):
        self.lock = threading.Lock()
        self.model = None
        self.meta: dict = {}
        self.mtime = None
        self.transform = None

    def available(self) -> bool:
        if not WEIGHTS_PATH.exists():
            return False
        try:
            import torch  # noqa: F401
            import torchvision  # noqa: F401
        except ImportError:
            return False
        return True

    def get(self):
        mtime = WEIGHTS_PATH.stat().st_mtime
        with self.lock:
            if self.model is None or self.mtime != mtime:
                import torch
                from torchvision import models, transforms

                model = models.mobilenet_v2(weights=None)
                model.classifier[1] = torch.nn.Linear(model.last_channel, 2)
                state = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=True)
                model.load_state_dict(state)
                model.eval()
                self.model = model
                self.meta = json.loads(META_PATH.read_text()) if META_PATH.exists() else {}
                self.transform = transforms.Compose([
                    transforms.Resize(256),
                    transforms.CenterCrop(224),
                    transforms.ToTensor(),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
                ])
                self.mtime = mtime
                log.info("Loaded CNN weights from %s", WEIGHTS_PATH)
            return self.model, self.transform, self.meta


_holder = _ModelHolder()


def current_mode() -> str:
    return "model" if _holder.available() else "demo"


def model_meta() -> dict:
    if current_mode() != "model":
        return {}
    _, _, meta = _holder.get()
    return meta


def predict(image_bytes: bytes) -> dict:
    """predict(image_bytes) -> {"plastic": p1, "paper": p2, "mode": ..., "details": ...}"""
    img = load_image(image_bytes)
    if current_mode() == "model":
        try:
            import torch

            model, tf, meta = _holder.get()
            with torch.no_grad():
                logits = model(tf(img).unsqueeze(0))
                probs = torch.softmax(logits, dim=1)[0].tolist()
            classes = meta.get("classes", CLASSES)
            out = {c: float(p) for c, p in zip(classes, probs)}
            return {
                "plastic": out["plastic"],
                "paper": out["paper"],
                "mode": "model",
                "details": {
                    "architecture": "MobileNetV2 (transfer learning)",
                    "val_accuracy": meta.get("val_accuracy"),
                },
            }
        except Exception:  # never crash the request because of a bad weight file
            log.exception("CNN inference failed, falling back to demo mode")
    probs, details = demo_predict(img)
    details["architecture"] = "Colour/texture heuristic (DEMO)"
    return {"plastic": probs["plastic"], "paper": probs["paper"], "mode": "demo", "details": details}
