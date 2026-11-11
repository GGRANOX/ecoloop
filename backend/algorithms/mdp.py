"""Markov Decision Process that decides what the sorting robot does next.

States : ItemDetected, MaterialIdentified, LowConfidence, ReadyToSort, Sorted (terminal)
Actions: Sort_Plastic, Sort_Paper, Inspect_Again

Rewards: correct sort +10, wrong sort -10, inspect again -1.
Sorting is uncertain, so its reward is an expectation:
    R(s, Sort_X) = 10 * P(X correct | s) - 10 * (1 - P(X correct | s))

Beliefs used in each state
  ItemDetected        - only the prior is known (nothing analysed yet)
  MaterialIdentified  - posterior from Bayes (confidence >= threshold)
  LowConfidence       - posterior from Bayes (confidence <  threshold)
  ReadyToSort         - after a closer re-inspection the predicted class is
                        correct with probability `verified_accuracy`

Inspect_Again from MaterialIdentified / LowConfidence leads to ReadyToSort with
probability `inspect_success`, otherwise the item stays where it is.

Value iteration:  V_{k+1}(s) = max_a  sum_s' T(s,a,s') [ R(s,a,s') + gamma * V_k(s') ]
"""
from __future__ import annotations

STATES = ["ItemDetected", "MaterialIdentified", "LowConfidence", "ReadyToSort", "Sorted"]
ACTIONS = ["Sort_Plastic", "Sort_Paper", "Inspect_Again"]
R_CORRECT, R_WRONG, R_INSPECT = 10.0, -10.0, -1.0


def build_mdp(
    posterior: dict,
    prior: dict,
    inspect_success: float = 0.8,
    verified_accuracy: float = 0.95,
) -> tuple[dict, dict, dict]:
    """Return (transitions, rewards, beliefs).

    transitions[s][a] = list of (probability, next_state)
    rewards[s][a]     = expected immediate reward
    """
    predicted = max(posterior, key=posterior.get)
    other = "paper" if predicted == "plastic" else "plastic"
    beliefs = {
        "ItemDetected": dict(prior),
        "MaterialIdentified": dict(posterior),
        "LowConfidence": dict(posterior),
        "ReadyToSort": {predicted: verified_accuracy, other: 1 - verified_accuracy},
    }

    def sort_reward(belief: dict, material: str) -> float:
        p = belief[material]
        return R_CORRECT * p + R_WRONG * (1 - p)

    T: dict = {s: {} for s in STATES}
    R: dict = {s: {} for s in STATES}
    for s in STATES:
        for a in ACTIONS:
            if s == "Sorted":
                T[s][a], R[s][a] = [(1.0, "Sorted")], 0.0
            elif a == "Sort_Plastic":
                T[s][a], R[s][a] = [(1.0, "Sorted")], sort_reward(beliefs[s], "plastic")
            elif a == "Sort_Paper":
                T[s][a], R[s][a] = [(1.0, "Sorted")], sort_reward(beliefs[s], "paper")
            else:  # Inspect_Again
                R[s][a] = R_INSPECT
                if s == "ItemDetected":
                    conf = max(posterior.values())
                    T[s][a] = [(1.0, "MaterialIdentified" if conf >= 0.8 else "LowConfidence")]
                elif s in ("MaterialIdentified", "LowConfidence"):
                    T[s][a] = [(inspect_success, "ReadyToSort"), (1 - inspect_success, s)]
                else:  # ReadyToSort: looking again gives nothing new
                    T[s][a] = [(1.0, "ReadyToSort")]
    return T, R, beliefs


def value_iteration(T: dict, R: dict, gamma: float, theta: float = 1e-6, max_iter: int = 1000) -> dict:
    if not 0 <= gamma < 1:
        raise ValueError("gamma must be in [0, 1)")
    V = {s: 0.0 for s in STATES}
    history = [dict(V)]
    deltas = []
    converged = False
    for _ in range(max_iter):
        new_V = {}
        for s in STATES:
            new_V[s] = max(
                R[s][a] + gamma * sum(p * V[s2] for p, s2 in T[s][a]) for a in ACTIONS
            )
        delta = max(abs(new_V[s] - V[s]) for s in STATES)
        V = new_V
        history.append(dict(V))
        deltas.append(delta)
        if delta < theta:
            converged = True
            break

    Q = {
        s: {a: R[s][a] + gamma * sum(p * V[s2] for p, s2 in T[s][a]) for a in ACTIONS}
        for s in STATES
    }
    policy = {s: max(ACTIONS, key=lambda a, s=s: Q[s][a]) for s in STATES if s != "Sorted"}
    return {
        "V": V,
        "Q": Q,
        "policy": policy,
        "iterations": len(deltas),
        "converged": converged,
        "deltas": deltas,
        "history": history,
    }


def decide(
    posterior: dict,
    prior: dict,
    gamma: float = 0.9,
    inspect_success: float = 0.8,
    verified_accuracy: float = 0.95,
    confidence_threshold: float = 0.8,
) -> dict:
    """Solve the MDP and choose the action for the current item."""
    T, R, beliefs = build_mdp(posterior, prior, inspect_success, verified_accuracy)
    vi = value_iteration(T, R, gamma)
    confidence = max(posterior.values())
    current = "MaterialIdentified" if confidence >= confidence_threshold else "LowConfidence"
    action = vi["policy"][current]
    # keep the response compact: only the first iterations + the last one
    hist = vi["history"]
    shown = hist[:12] + ([hist[-1]] if len(hist) > 12 else [])
    return {
        "states": STATES,
        "actions": ACTIONS,
        "gamma": gamma,
        "inspect_success": inspect_success,
        "verified_accuracy": verified_accuracy,
        "confidence": confidence,
        "current_state": current,
        "action": action,
        "expected_reward": vi["Q"][current][action],
        "V": vi["V"],
        "Q": vi["Q"],
        "policy": vi["policy"],
        "rewards": R,
        "transitions": {s: {a: [[p, s2] for p, s2 in T[s][a]] for a in ACTIONS} for s in STATES},
        "beliefs": beliefs,
        "iterations": vi["iterations"],
        "converged": vi["converged"],
        "deltas": vi["deltas"],
        "history": shown,
    }
