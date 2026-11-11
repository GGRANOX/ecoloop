import math

import pytest

from backend.algorithms.astar import astar, manhattan, route_to_bin
from backend.algorithms.bayes import analyze_evidence, bayes_update, likelihood_from_classifier
from backend.algorithms.mdp import decide


# ---------------------------------------------------------------- A*
def _bfs_len(w, h, start, goal, obstacles):
    from collections import deque
    blocked = {tuple(o) for o in obstacles}
    q, seen = deque([(tuple(start), 0)]), {tuple(start)}
    while q:
        (x, y), d = q.popleft()
        if (x, y) == tuple(goal):
            return d
        for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nb[0] < w and 0 <= nb[1] < h and nb not in blocked and nb not in seen:
                seen.add(nb)
                q.append((nb, d + 1))
    return None


def test_astar_open_grid_is_manhattan():
    r = astar(12, 8, (0, 0), (11, 7), [])
    assert r["found"]
    assert r["steps"] == manhattan((0, 0), (11, 7)) == 18
    assert r["path"][0] == [0, 0] and r["path"][-1] == [11, 7]


def test_astar_optimal_around_wall():
    wall = [(5, y) for y in range(0, 7)]  # gap only at y = 7
    r = astar(12, 8, (0, 0), (11, 0), wall)
    assert r["found"]
    assert r["steps"] == _bfs_len(12, 8, (0, 0), (11, 0), wall)
    # path is contiguous and avoids obstacles
    for a, b in zip(r["path"], r["path"][1:]):
        assert manhattan(tuple(a), tuple(b)) == 1
    assert not {tuple(c) for c in r["path"]} & set(wall)


def test_astar_no_path():
    wall = [(5, y) for y in range(8)]
    r = astar(12, 8, (0, 0), (11, 0), wall)
    assert not r["found"]
    assert r["path"] == [] and r["expanded"] > 0


def test_astar_rejects_outside_grid():
    with pytest.raises(ValueError):
        astar(5, 5, (0, 0), (9, 9), [])


@pytest.mark.parametrize("material", ["plastic", "paper"])
def test_default_layout_routes_are_optimal(material):
    r = route_to_bin(material)
    assert r["found"]
    assert r["steps"] == _bfs_len(r["width"], r["height"], r["start"], r["goal"], r["obstacles"])


# ---------------------------------------------------------------- Bayes
def test_bayes_posterior_sums_to_one():
    r = bayes_update({"plastic": 0.3, "paper": 0.7}, {"plastic": 0.8, "paper": 0.25})
    assert math.isclose(sum(r["posterior"].values()), 1.0)


def test_bayes_known_example():
    # P(E) = 0.8*0.3 + 0.25*0.7 = 0.415 ; P(plastic|E) = 0.24/0.415
    r = bayes_update({"plastic": 0.3, "paper": 0.7}, {"plastic": 0.8, "paper": 0.25})
    assert math.isclose(r["evidence"], 0.415)
    assert math.isclose(r["posterior"]["plastic"], 0.24 / 0.415)
    assert r["decision"] == "plastic"


def test_bayes_uniform_prior_keeps_likelihood_ratio():
    r = bayes_update({"plastic": 0.5, "paper": 0.5}, {"plastic": 0.6, "paper": 0.2})
    assert math.isclose(r["posterior"]["plastic"], 0.75)


def test_bayes_invalid_evidence():
    with pytest.raises(ValueError):
        bayes_update({"plastic": 0.5, "paper": 0.5}, {"plastic": 0.0, "paper": 0.0})


def test_likelihood_from_classifier():
    lik = likelihood_from_classifier({"plastic": 0.8, "paper": 0.2})
    assert math.isclose(lik["plastic"], 0.8 * 0.9 + 0.2 * 0.1)
    assert math.isclose(lik["paper"], 0.8 * 0.1 + 0.2 * 0.9)


def test_analyze_evidence_follows_classifier():
    assert analyze_evidence({"plastic": 0.95, "paper": 0.05})["decision"] == "plastic"
    assert analyze_evidence({"plastic": 0.05, "paper": 0.95})["decision"] == "paper"


# ---------------------------------------------------------------- MDP
PRIOR = {"plastic": 0.45, "paper": 0.55}


def test_mdp_converges():
    r = decide({"plastic": 0.9, "paper": 0.1}, PRIOR, gamma=0.9)
    assert r["converged"]
    assert r["deltas"][-1] < 1e-6
    assert all(b <= a + 1e-12 for a, b in zip(r["deltas"], r["deltas"][1:]))  # contraction


def test_mdp_high_confidence_sorts():
    r = decide({"plastic": 0.97, "paper": 0.03}, PRIOR, gamma=0.9)
    assert r["action"] == "Sort_Plastic"
    r = decide({"plastic": 0.04, "paper": 0.96}, PRIOR, gamma=0.9)
    assert r["action"] == "Sort_Paper"


def test_mdp_low_confidence_inspects():
    r = decide({"plastic": 0.58, "paper": 0.42}, PRIOR, gamma=0.9)
    assert r["current_state"] == "LowConfidence"
    assert r["action"] == "Inspect_Again"


def test_mdp_ready_to_sort_policy_sorts_predicted_class():
    r = decide({"plastic": 0.6, "paper": 0.4}, PRIOR, gamma=0.9)
    assert r["policy"]["ReadyToSort"] == "Sort_Plastic"


def test_mdp_low_gamma_is_impatient():
    # with a small discount, the future reward of inspecting is worth less
    post = {"plastic": 0.75, "paper": 0.25}
    assert decide(post, PRIOR, gamma=0.95)["action"] == "Inspect_Again"
    assert decide(post, PRIOR, gamma=0.3)["action"] == "Sort_Plastic"


def test_mdp_rejects_bad_gamma():
    with pytest.raises(ValueError):
        decide({"plastic": 0.9, "paper": 0.1}, PRIOR, gamma=1.0)
