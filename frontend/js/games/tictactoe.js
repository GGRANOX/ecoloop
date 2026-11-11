// ECO TIC-TAC-TOE — player = leaf (X), computer = water drop (O). Minimax with alpha-beta.
import { recordGame } from "../store.js";

const LEAF = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M30 56C16 56 8 46 8 34 8 18 22 8 56 8c0 32-10 48-26 48z" fill="#20B879"/><path d="M12 58c10-14 20-24 34-34" stroke="#9AE6B4" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
const DROP = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6C24 20 12 32 12 42a20 20 0 0 0 40 0C52 32 40 20 32 6z" fill="#2F80ED"/><ellipse cx="24" cy="42" rx="5" ry="8" fill="#9BD0FF" opacity=".7"/></svg>`;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const POINTS = { easy: 20, medium: 35, hard: 60 };

export function winner(b) {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { who: b[l[0]], line: l };
  return b.every(Boolean) ? { who: "draw", line: [] } : null;
}

// Returns score from O's perspective: +10 - depth (O wins fast), -10 + depth (X wins), 0 draw
export function minimax(b, player, depth = 0, alpha = -Infinity, beta = Infinity) {
  const w = winner(b);
  if (w) return { score: w.who === "O" ? 10 - depth : w.who === "X" ? depth - 10 : 0 };
  let best = { score: player === "O" ? -Infinity : Infinity, move: -1 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const r = minimax(b, player === "O" ? "X" : "O", depth + 1, alpha, beta);
    b[i] = null;
    if (player === "O" ? r.score > best.score : r.score < best.score) best = { score: r.score, move: i };
    if (player === "O") alpha = Math.max(alpha, r.score); else beta = Math.min(beta, r.score);
    if (beta <= alpha) break;
  }
  return best;
}

function botMove(b, level) {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const optimalChance = { easy: 0.35, medium: 0.75, hard: 1 }[level];
  if (Math.random() > optimalChance) return free[Math.floor(Math.random() * free.length)];
  return minimax([...b], "O").move;
}

let state;

export function mount(root) {
  const saved = JSON.parse(sessionStorage.getItem("ttt.session") || '{"w":0,"l":0,"d":0}');
  state = { board: Array(9).fill(null), level: "medium", over: false, playerFirst: true, busy: false, tally: saved, timer: null };
  root.innerHTML = `
  <div class="game-stage">
    <div class="card">
      <div class="toolbar" style="justify-content:space-between">
        <h3 style="margin:0">Eco Tic-Tac-Toe</h3>
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">Difficulty
          <select id="ttt-level"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard (perfect minimax)</option></select></label>
      </div>
      <p id="ttt-status" class="alert info" role="status" style="margin-bottom:16px">Your turn — you play the leaf.</p>
      <div class="ttt-board" id="ttt-board" role="grid" aria-label="Tic-tac-toe board"></div>
      <div class="toolbar" style="justify-content:center;margin-top:18px"><button class="btn" id="ttt-new"><span data-icon="reset"></span> New Game</button></div>
    </div>
    <div class="hud">
      <div class="kpi"><span>Wins</span><b id="ttt-w">0</b></div>
      <div class="kpi"><span>Losses</span><b id="ttt-l">0</b></div>
      <div class="kpi"><span>Draws</span><b id="ttt-d">0</b></div>
      <div class="card" style="padding:18px;font-size:.9rem"><b>How the bot thinks</b><p class="muted" style="margin:6px 0 0">Minimax explores every future move and assumes you play perfectly; alpha-beta pruning skips branches that cannot change the result. On Hard you can at best draw — unless you find a mistake!</p></div>
    </div>
  </div>`;
  const boardEl = root.querySelector("#ttt-board");
  for (let i = 0; i < 9; i++) {
    const c = document.createElement("button");
    c.className = "ttt-cell"; c.dataset.i = i; c.setAttribute("aria-label", `Cell ${i + 1}, empty`);
    c.addEventListener("click", () => play(i));
    boardEl.appendChild(c);
  }
  root.querySelector("#ttt-new").addEventListener("click", newGame);
  root.querySelector("#ttt-level").addEventListener("change", (e) => { state.level = e.target.value; newGame(); });
  state.root = root;
  renderTally();
  newGame();
}

export function unmount() { clearTimeout(state?.timer); }

function $(sel) { return state.root.querySelector(sel); }

function render(winLine = []) {
  state.root.querySelectorAll(".ttt-cell").forEach((c, i) => {
    const v = state.board[i];
    if (c.dataset.v !== String(v)) { c.innerHTML = v === "X" ? LEAF : v === "O" ? DROP : ""; c.dataset.v = String(v); }
    c.disabled = !!v || state.over || state.busy;
    c.classList.toggle("win", winLine.includes(i));
    c.setAttribute("aria-label", `Cell ${i + 1}, ${v === "X" ? "leaf" : v === "O" ? "drop" : "empty"}`);
  });
}

function renderTally() {
  $("#ttt-w").textContent = state.tally.w; $("#ttt-l").textContent = state.tally.l; $("#ttt-d").textContent = state.tally.d;
  sessionStorage.setItem("ttt.session", JSON.stringify(state.tally));
}

function status(text, cls = "info") { const s = $("#ttt-status"); s.className = "alert " + cls; s.textContent = text; }

function newGame() {
  clearTimeout(state.timer);
  state.board = Array(9).fill(null); state.over = false; state.busy = false;
  state.root.querySelectorAll(".ttt-cell").forEach((c) => (c.dataset.v = ""));
  render();
  if (state.playerFirst) status("Your turn — you play the leaf.");
  else { status("The computer starts this round…"); botTurn(); }
  state.playerFirst = !state.playerFirst;
}

function play(i) {
  if (state.over || state.busy || state.board[i]) return;
  state.board[i] = "X";
  render();
  if (!finish()) botTurn();
}

function botTurn() {
  state.busy = true; render(); status("Computer is thinking…");
  state.timer = setTimeout(() => {
    state.board[botMove(state.board, state.level)] = "O";
    state.busy = false;
    render();
    if (!finish()) status("Your turn — you play the leaf.");
  }, 450);
}

function finish() {
  const w = winner(state.board);
  if (!w) return false;
  state.over = true;
  render(w.line);
  const lvl = state.level;
  if (w.who === "X") {
    state.tally.w++; status(`You win! +${POINTS[lvl]} eco points`, "info");
    recordGame("tictactoe", { score: 1, points: POINTS[lvl], win: true, correct: 1, detail: `win · ${lvl}`, flag: lvl === "hard" ? "tttHardNoLoss" : undefined });
  } else if (w.who === "O") {
    state.tally.l++; status("The computer wins this time. Try again!", "alert");
    $("#ttt-status").className = "alert";
    recordGame("tictactoe", { score: 0, points: 2, loss: true, detail: `loss · ${lvl}` });
  } else {
    state.tally.d++; status(`Draw — well defended! +${Math.round(POINTS[lvl] / 3)} eco points`, "warn");
    recordGame("tictactoe", { score: 0, points: POINTS[lvl] / 3, draw: true, detail: `draw · ${lvl}`, flag: lvl === "hard" ? "tttHardNoLoss" : undefined });
  }
  renderTally();
  return true;
}
