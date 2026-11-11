"""Bayes' theorem for the plastic / paper decision.

    P(C | E) = P(E | C) * P(C) / P(E),     P(E) = sum_i P(E | C_i) * P(C_i)

C  - true material class (plastic or paper)
E  - evidence: the output of the image classifier for this photo
"""
from __future__ import annotations

CLASSES = ("plastic", "paper")

# Prior: share of plastic vs. paper items in a typical household recycling bin
# (by item count). It is a configurable assumption, shown in the UI.
DEFAULT_PRIOR = {"plastic": 0.45, "paper": 0.55}

# Default reliability of the classifier, P(model says k | true class c).
# Replaced by the real validation confusion matrix after training.
DEFAULT_CONFUSION = {
    "plastic": {"plastic": 0.90, "paper": 0.10},
    "paper": {"plastic": 0.10, "paper": 0.90},
}


def _check_distribution(d: dict, name: str) -> None:
    for k, v in d.items():
        if v < 0:
            raise ValueError(f"{name}[{k}] must be non-negative")
    total = sum(d.values())
    if total <= 0:
        raise ValueError(f"{name} must have a positive sum")


def bayes_update(prior: dict, likelihood: dict) -> dict:
    """Generic Bayes update. Returns every intermediate value."""
    classes = list(prior.keys())
    _check_distribution(prior, "prior")
    p_sum = sum(prior.values())
    prior = {c: prior[c] / p_sum for c in classes}  # normalise defensively
    for c in classes:
        if not 0 <= likelihood[c] <= 1:
            raise ValueError(f"likelihood[{c}] must be in [0, 1]")

    joint = {c: likelihood[c] * prior[c] for c in classes}  # P(E|C) * P(C)
    evidence = sum(joint.values())  # P(E)
    if evidence <= 0:
        raise ValueError("P(E) = 0: the evidence is impossible under every class")
    posterior = {c: joint[c] / evidence for c in classes}
    winner = max(posterior, key=posterior.get)

    steps = [
        "P(E) = " + " + ".join(f"P(E|{c})·P({c})" for c in classes),
        "P(E) = " + " + ".join(f"{likelihood[c]:.4f}·{prior[c]:.4f}" for c in classes)
        + f" = {evidence:.4f}",
    ]
    steps += [
        f"P({c}|E) = {likelihood[c]:.4f}·{prior[c]:.4f} / {evidence:.4f} = {posterior[c]:.4f}"
        for c in classes
    ]
    steps.append("Σ posterior = " + " + ".join(f"{posterior[c]:.4f}" for c in classes)
                 + f" = {sum(posterior.values()):.4f}")

    return {
        "prior": prior,
        "likelihood": dict(likelihood),
        "joint": joint,
        "evidence": evidence,
        "posterior": posterior,
        "decision": winner,
        "confidence": posterior[winner],
        "steps": steps,
    }


def likelihood_from_classifier(probs: dict, confusion: dict | None = None) -> dict:
    """Turn soft classifier output into P(E | C).

    The classifier says "plastic" with probability q_plastic and "paper" with q_paper.
    Knowing how often the classifier is right for each true class (confusion matrix
    M[c][k] = P(says k | true c)) gives

        P(E | C=c) = sum_k q_k * M[c][k]

    so a confident prediction from a reliable model is strong evidence, while an
    unsure prediction (q ~ 0.5) is weak evidence.
    """
    m = confusion or DEFAULT_CONFUSION
    q_sum = sum(probs[k] for k in CLASSES)
    q = {k: probs[k] / q_sum for k in CLASSES}
    return {c: sum(q[k] * m[c][k] for k in CLASSES) for c in CLASSES}


def analyze_evidence(probs: dict, prior: dict | None = None, confusion: dict | None = None) -> dict:
    prior = prior or DEFAULT_PRIOR
    lik = likelihood_from_classifier(probs, confusion)
    result = bayes_update(prior, lik)
    result["classifier_probs"] = {k: probs[k] for k in CLASSES}
    result["confusion"] = confusion or DEFAULT_CONFUSION
    return result
