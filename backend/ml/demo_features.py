"""DEMO classifier: a transparent, hand-crafted colour/texture model.

Used only while no trained CNN weights exist (or PyTorch is not installed).
It really looks at the pixels — no random numbers, no fixed answers — but it is a
simple heuristic, so its accuracy is far below the trained MobileNetV2.

The object is first separated from a plain background (pixels that differ from the median
colour of the image border). Features are shares of the object's pixels (128x128, HSV):
  highlight  - specular highlights: near-white, colourless pixels much brighter than their
               neighbourhood (glossy plastic reflects light)
  vivid      - strongly saturated, non-brown pixels (coloured bottles, caps, packaging)
  kraft      - brown / beige pixels (cardboard, kraft paper)
  matte      - bright, neutral, smooth pixels (white / grey paper)
  edges      - mean luminance gradient on the object (glossy objects have sharp contrast)
Score  z = 0.3 + 3.0*min(25*highlight, 1) + 3.5*vivid - 4.0*kraft - 3.0*matte + 1.0*edges
P(plastic) = sigmoid(z)
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image

WEIGHTS = {"bias": 0.3, "highlight": 3.0, "vivid": 3.5, "kraft": -4.0, "matte": -3.0, "edges": 1.0}


def _box_blur(a: np.ndarray, k: int = 7) -> np.ndarray:
    pad = k // 2
    p = np.pad(a, pad, mode="edge")
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    h, w = a.shape
    s = c[k:k + h, k:k + w] - c[0:h, k:k + w] - c[k:k + h, 0:w] + c[0:h, 0:w]
    return s / (k * k)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    """Separate the item from a plain background: pixels that differ from the
    median colour of the image border are treated as the object."""
    h, w, _ = rgb.shape
    b = max(2, int(min(h, w) * 0.06))
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3),
                             rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    mask = np.linalg.norm(rgb - bg, axis=2) > 0.12
    frac = mask.mean()
    if frac < 0.05 or frac > 0.97:  # no clear background -> use the whole frame
        return np.ones((h, w), dtype=bool)
    return mask


def extract_features(img: Image.Image) -> dict:
    small = img.convert("RGB").resize((128, 128))
    rgb = np.asarray(small, dtype=np.float32) / 255.0
    hsv = np.asarray(small.convert("HSV"), dtype=np.float32) / 255.0
    h, s, v = hsv[..., 0] * 360.0, hsv[..., 1], hsv[..., 2]
    luma = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    fg = foreground_mask(rgb)

    def share(cond: np.ndarray) -> float:
        return float((cond & fg).sum() / fg.sum())

    local_luma = _box_blur(luma, 9)
    # specular highlight: near-white, colourless, much brighter than its surroundings
    highlight = share((luma > 0.88) & (s < 0.2) & (luma - local_luma > 0.18))
    brownish = (h >= 18) & (h <= 50)
    kraft = share(brownish & (s > 0.18) & (s < 0.7) & (v > 0.3) & (v < 0.92))
    # vivid colours, excluding the brown/beige band that belongs to cardboard
    vivid = share((s > 0.45) & (v > 0.3) & ~(brownish & (s < 0.7)))
    local_v = _box_blur(v, 9)
    matte = share((s < 0.15) & (v > 0.55) & (v < 0.97) & (np.abs(v - local_v) < 0.06))
    gx = np.abs(np.diff(luma, axis=1))[fg[:, 1:]].mean()
    gy = np.abs(np.diff(luma, axis=0))[fg[1:, :]].mean()
    edges = float(min((gx + gy) * 5.0, 1.0))
    return {
        "highlight": highlight,
        "vivid": vivid,
        "kraft": kraft,
        "matte": matte,
        "edges": edges,
        "foreground": float(fg.mean()),
        "brightness": float(v[fg].mean()),
        "saturation": float(s[fg].mean()),
    }


def demo_predict(img: Image.Image) -> tuple[dict, dict]:
    f = extract_features(img)
    z = (
        WEIGHTS["bias"]
        + WEIGHTS["highlight"] * min(25 * f["highlight"], 1.0)
        + WEIGHTS["vivid"] * f["vivid"]
        + WEIGHTS["kraft"] * f["kraft"]
        + WEIGHTS["matte"] * f["matte"]
        + WEIGHTS["edges"] * f["edges"]
    )
    p_plastic = float(1.0 / (1.0 + np.exp(-z)))
    return {"plastic": p_plastic, "paper": 1.0 - p_plastic}, {"features": f, "score": float(z)}


def demo_predict_bytes(data: bytes) -> tuple[dict, dict]:
    return demo_predict(Image.open(io.BytesIO(data)))
