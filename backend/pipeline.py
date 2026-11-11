"""CNN -> Bayes -> MDP -> A*  : the full decision chain for one photo."""
from __future__ import annotations

import time

from .algorithms import astar, bayes, mdp
from .ml import classifier

BIN_INFO = {
    "plastic": {"bin": "Yellow container — PLASTIC", "color": "#F5C518"},
    "paper": {"bin": "Blue container — PAPER", "color": "#2F80ED"},
}


def explain(material: str, confidence: float, action: str, mode: str) -> str:
    src = "the trained CNN" if mode == "model" else "the DEMO colour/texture analyser"
    if action == "Inspect_Again":
        return (f"{src.capitalize()} leans towards {material}, but after Bayes the confidence is only "
                f"{confidence:.0%}. The MDP finds that a wrong sort (−10) is too risky, so the robot asks for "
                f"another look (−1) before sorting. Try a clearer photo of a single item.")
    hint = ("Glossy highlights, vivid colours or a moulded shape are typical for plastic."
            if material == "plastic" else
            "Matte surface, fibrous texture and white/brown tones are typical for paper and cardboard.")
    return (f"{src.capitalize()} and the Bayesian update agree on {material.upper()} with {confidence:.0%} confidence. "
            f"{hint} The MDP chooses to sort now, and A* plans the robot route to the {material} bin.")


def analyze(image_bytes: bytes, gamma: float = 0.9, prior_plastic: float | None = None) -> dict:
    t0 = time.perf_counter()
    pred = classifier.predict(image_bytes)
    probs = {"plastic": pred["plastic"], "paper": pred["paper"]}

    prior = (bayes.DEFAULT_PRIOR if prior_plastic is None
             else {"plastic": prior_plastic, "paper": 1.0 - prior_plastic})
    meta = classifier.model_meta() if pred["mode"] == "model" else {}
    bayes_res = bayes.analyze_evidence(probs, prior, meta.get("confusion"))

    mdp_res = mdp.decide(bayes_res["posterior"], bayes_res["prior"], gamma=gamma)
    action = mdp_res["action"]
    material = bayes_res["decision"]
    if action == "Sort_Plastic":
        target = "plastic"
    elif action == "Sort_Paper":
        target = "paper"
    else:
        target = None

    path = astar.route_to_bin(target) if target else None
    raw_label = max(probs, key=probs.get)
    return {
        "mode": pred["mode"],
        "classification": {
            "label": raw_label,
            "probabilities": probs,
            "confidence": probs[raw_label],
            "details": pred["details"],
        },
        "bayes": bayes_res,
        "mdp": mdp_res,
        "path": path,
        "decision": {
            "material": material,
            "action": action,
            "confidence": bayes_res["confidence"],
            "bin": BIN_INFO[target]["bin"] if target else "Hold — re-inspect the item",
            "bin_color": BIN_INFO[target]["color"] if target else "#94A3B8",
            "explanation": explain(material, bayes_res["confidence"], action, pred["mode"]),
        },
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
    }
