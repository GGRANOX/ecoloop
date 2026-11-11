import { fillIcons } from "./common.js";
import * as tictactoe from "./games/tictactoe.js";
import * as bottle from "./games/bottle.js";
import * as sortit from "./games/sortit.js";
import * as quiz from "./games/quiz.js";

const GAMES = { tictactoe, bottle, sortit, quiz };
const root = document.getElementById("game-root");
const tiles = [...document.querySelectorAll("[data-game]")];
let current = null;

function open(name, focus = false) {
  if (!GAMES[name]) name = "tictactoe";
  current?.unmount?.();
  root.innerHTML = "";
  tiles.forEach((t) => {
    t.setAttribute("aria-selected", t.dataset.game === name);
    t.tabIndex = t.dataset.game === name ? 0 : -1;
  });
  current = GAMES[name];
  current.mount(root);
  fillIcons(root);
  history.replaceState(null, "", "#" + name);
  if (focus) root.scrollIntoView({ behavior: "smooth", block: "start" });
}

tiles.forEach((t, i) => {
  t.addEventListener("click", () => open(t.dataset.game, true));
  t.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) { const n = tiles[(i + d + tiles.length) % tiles.length]; n.focus(); open(n.dataset.game); }
  });
});

open(location.hash.slice(1));
