"""A* search on a 4-connected grid.

f(n) = g(n) + h(n)
  g(n) - exact cost of the path from start to n (each move costs 1)
  h(n) - Manhattan distance |dx| + |dy| to the goal (admissible and consistent
         for 4-connected movement, so A* returns an optimal path).
"""
from __future__ import annotations

import heapq
from typing import Iterable

Cell = tuple[int, int]

# Default warehouse layout used by the sorting pipeline (12 x 8 grid).
DEFAULT_WIDTH = 12
DEFAULT_HEIGHT = 8
DEFAULT_START: Cell = (0, 4)
DEFAULT_BINS: dict[str, Cell] = {"plastic": (11, 1), "paper": (11, 6)}
DEFAULT_OBSTACLES: list[Cell] = [
    (3, 1), (3, 2), (3, 3), (3, 4), (3, 5),
    (6, 3), (6, 4), (6, 5), (6, 6), (6, 7),
    (9, 0), (9, 1), (9, 2), (9, 3),
    (9, 6),
]


def manhattan(a: Cell, b: Cell) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def astar(
    width: int,
    height: int,
    start: Cell,
    goal: Cell,
    obstacles: Iterable[Cell] = (),
) -> dict:
    """Run A* and return the path plus the full search trace.

    Returns a dict with:
      found      - whether a path exists
      path       - list of [x, y] from start to goal (empty if not found)
      steps      - number of moves (len(path) - 1), or 0
      closed     - cells in the order they were expanded (closed list)
      open       - cells still in the open list when the search ended
      expanded   - number of expanded nodes
    """
    start, goal = tuple(start), tuple(goal)
    blocked = {tuple(c) for c in obstacles}

    def inside(c: Cell) -> bool:
        return 0 <= c[0] < width and 0 <= c[1] < height

    for name, c in (("start", start), ("goal", goal)):
        if not inside(c):
            raise ValueError(f"{name} {list(c)} is outside the {width}x{height} grid")
    blocked.discard(start)
    blocked.discard(goal)

    counter = 0  # tie-breaker keeps heap ordering deterministic (FIFO among equal f, h)
    open_heap: list[tuple[int, int, int, Cell]] = [(manhattan(start, goal), manhattan(start, goal), counter, start)]
    g_score: dict[Cell, int] = {start: 0}
    came_from: dict[Cell, Cell] = {}
    closed: list[Cell] = []
    closed_set: set[Cell] = set()

    while open_heap:
        _, _, _, current = heapq.heappop(open_heap)
        if current in closed_set:
            continue  # stale heap entry
        closed.append(current)
        closed_set.add(current)

        if current == goal:
            path = [current]
            while path[-1] in came_from:
                path.append(came_from[path[-1]])
            path.reverse()
            open_cells = sorted({c for *_, c in open_heap} - closed_set)
            return {
                "found": True,
                "path": [list(c) for c in path],
                "steps": len(path) - 1,
                "closed": [list(c) for c in closed],
                "open": [list(c) for c in open_cells],
                "expanded": len(closed),
            }

        x, y = current
        for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if not inside(nb) or nb in blocked or nb in closed_set:
                continue
            tentative_g = g_score[current] + 1
            if tentative_g < g_score.get(nb, 1 << 30):
                g_score[nb] = tentative_g
                came_from[nb] = current
                h = manhattan(nb, goal)
                counter += 1
                heapq.heappush(open_heap, (tentative_g + h, h, counter, nb))

    return {
        "found": False,
        "path": [],
        "steps": 0,
        "closed": [list(c) for c in closed],
        "open": [],
        "expanded": len(closed),
    }


def route_to_bin(material: str) -> dict:
    """Route the robot on the default layout to the bin for `material`."""
    goal = DEFAULT_BINS[material]
    result = astar(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_START, goal, DEFAULT_OBSTACLES)
    result.update({
        "width": DEFAULT_WIDTH,
        "height": DEFAULT_HEIGHT,
        "start": list(DEFAULT_START),
        "goal": list(goal),
        "target": material,
        "obstacles": [list(c) for c in DEFAULT_OBSTACLES],
        "bins": {k: list(v) for k, v in DEFAULT_BINS.items()},
    })
    return result
