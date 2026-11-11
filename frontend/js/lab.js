import { api, fmt, pct } from "./common.js";
import { GridView } from "./gridview.js";

const $ = (id) => document.getElementById(id);
const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ================= tabs (ARIA, keyboard, hash) =================
const tabs = [...document.querySelectorAll('[role="tab"]')];
const initialized = {};
function selectTab(tab, focus = false) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
  const key = tab.id.replace("tab-", "");
  history.replaceState(null, "", "#" + key);
  if (!initialized[key]) { initialized[key] = true; INIT[key](); }
  if (key === "astar") grid.resize();
  if (key === "mdp" && lastMdp) drawChart(lastMdp.deltas);
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") selectTab(tabs[(i + 1) % tabs.length], true);
    if (e.key === "ArrowLeft") selectTab(tabs[(i - 1 + tabs.length) % tabs.length], true);
  });
});

function lastDecision() {
  try { return JSON.parse(localStorage.getItem("ecoloop.lastDecision")); } catch { return null; }
}

// ================= A* =================
const grid = new GridView($("astar-canvas"));
let layout = null;
let editMode = "wall";
let targetMode = "plastic";
let wallSet = new Set();
const key = ([x, y]) => `${x},${y}`;

async function initAstar() {
  try {
    layout = await api("/api/astar/default");
  } catch (e) {
    $("astar-msg").className = "alert"; $("astar-msg").textContent = e.message; return;
  }
  resetLayout();
}
function resetLayout() {
  wallSet = new Set(layout.obstacles.map(key));
  grid.setSize(layout.width, layout.height);
  grid.set({ start: [...layout.start], bins: layout.bins, obstacles: layout.obstacles.map((c) => [...c]) });
  grid.clearSearch();
  updateTarget();
  resetKpis();
}
function resetKpis() { ["a-steps", "a-exp", "a-open"].forEach((id) => ($(id).textContent = "–")); }
function syncWalls() { grid.set({ obstacles: [...wallSet].map((s) => s.split(",").map(Number)) }); }
function isBinOrStart([x, y]) {
  const s = grid.state.start;
  return (s[0] === x && s[1] === y) || Object.values(layout.bins).some(([bx, by]) => bx === x && by === y);
}
function resolveTarget() {
  if (targetMode !== "auto") return targetMode;
  const d = lastDecision();
  return d ? d.material : null;
}
function updateTarget() {
  const t = resolveTarget();
  $("a-target").textContent = targetMode === "auto"
    ? (t ? `${t} (from your last AI analysis${lastDecision()?.action === "Inspect_Again" ? ", MDP asked to re-inspect" : ""})` : "none yet — analyse a photo on the Sorting page first")
    : t;
  grid.set({ target: t });
}

let painting = null;
$("astar-canvas").addEventListener("pointerdown", (e) => {
  const c = grid.cellAt(e); if (!c || !layout) return;
  grid.clearSearch(); resetKpis();
  if (editMode === "start") {
    if (wallSet.has(key(c)) || Object.values(layout.bins).some(([x, y]) => x === c[0] && y === c[1])) return;
    grid.set({ start: c });
    return;
  }
  if (isBinOrStart(c)) return;
  painting = wallSet.has(key(c)) ? "erase" : "draw";
  painting === "draw" ? wallSet.add(key(c)) : wallSet.delete(key(c));
  syncWalls();
  e.target.setPointerCapture?.(e.pointerId);
});
$("astar-canvas").addEventListener("pointermove", (e) => {
  if (!painting) return;
  const c = grid.cellAt(e); if (!c || isBinOrStart(c)) return;
  painting === "draw" ? wallSet.add(key(c)) : wallSet.delete(key(c));
  syncWalls();
});
window.addEventListener("pointerup", () => (painting = null));

document.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
  editMode = b.dataset.edit;
  document.querySelectorAll("[data-edit]").forEach((x) => x.setAttribute("aria-pressed", x === b));
}));
document.querySelectorAll("[data-target]").forEach((b) => b.addEventListener("click", () => {
  targetMode = b.dataset.target;
  document.querySelectorAll("[data-target]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  grid.clearSearch(); resetKpis(); updateTarget();
}));

$("astar-run").addEventListener("click", async () => {
  if (!layout) return;
  const target = resolveTarget();
  const msg = $("astar-msg");
  if (!target) { msg.className = "alert warn"; msg.textContent = "Auto mode needs a classification. Analyse a photo on the AI Sorting page first, or pick a target manually."; return; }
  $("astar-run").disabled = true;
  try {
    const res = await api("/api/astar", { method: "POST", body: {
      width: layout.width, height: layout.height, start: grid.state.start, goal: layout.bins[target],
      obstacles: [...wallSet].map((s) => s.split(",").map(Number)),
    } });
    $("a-exp").textContent = res.expanded;
    $("a-open").textContent = res.open.length;
    $("a-steps").textContent = "0";
    msg.className = "alert info"; msg.textContent = "Searching… cells turn teal as they move to the closed list.";
    await grid.animate(res, { onStep: (i) => ($("a-steps").textContent = i) });
    if (res.found) {
      $("a-steps").textContent = res.steps;
      msg.className = "alert info";
      msg.innerHTML = `Path found: <b>${res.steps} steps</b> to the ${target} bin, ${res.expanded} nodes expanded. Optimal because h is admissible.`;
    } else {
      $("a-steps").textContent = "—";
      msg.className = "alert";
      msg.innerHTML = `<b>No path found.</b> The open list became empty after expanding ${res.expanded} reachable cells — the bin is walled off. Remove an obstacle and try again.`;
    }
  } catch (e) {
    msg.className = "alert"; msg.textContent = e.message;
  } finally {
    $("astar-run").disabled = false;
  }
});
$("astar-reset").addEventListener("click", () => layout && resetLayout());
$("astar-clear").addEventListener("click", () => { wallSet.clear(); syncWalls(); grid.clearSearch(); resetKpis(); });
$("astar-random").addEventListener("click", () => {
  if (!layout) return;
  wallSet.clear();
  const n = Math.round(layout.width * layout.height * 0.22);
  for (let i = 0; i < n * 3 && wallSet.size < n; i++) {
    const c = [Math.floor(Math.random() * layout.width), Math.floor(Math.random() * layout.height)];
    if (!isBinOrStart(c)) wallSet.add(key(c));
  }
  syncWalls(); grid.clearSearch(); resetKpis();
});

// ================= BAYES =================
const bIn = { prior: $("b-prior"), lp: $("b-lp"), lq: $("b-lq") };
function vbars(host, items) {
  host.innerHTML = items.map(([label, v, color]) =>
    `<div class="vb"><span>${fmt(v, 2)}</span><i style="height:${Math.max(2, v * 100)}%;background:${color}"></i><span>${label}</span></div>`).join("");
}
const runBayes = debounce(async () => {
  const body = { prior_plastic: +bIn.prior.value, likelihood_plastic: +bIn.lp.value, likelihood_paper: +bIn.lq.value };
  $("b-prior-out").textContent = body.prior_plastic.toFixed(2);
  $("b-prior-paper").textContent = (1 - body.prior_plastic).toFixed(2);
  $("b-lp-out").textContent = body.likelihood_plastic.toFixed(2);
  $("b-lq-out").textContent = body.likelihood_paper.toFixed(2);
  try {
    const r = await api("/api/bayes", { method: "POST", body });
    $("bayes-err").hidden = true;
    $("bayes-steps").innerHTML = r.steps.map((s) => `<li>${s}</li>`).join("");
    const sum = r.posterior.plastic + r.posterior.paper;
    $("bayes-check").innerHTML = `✔ Check: posterior sums to <b>${sum.toFixed(6)}</b>. Decision: <b>${r.decision.toUpperCase()}</b> with ${pct(r.confidence)} confidence.`;
    vbars($("vb-prior"), [["plastic", r.prior.plastic, "#F5C518"], ["paper", r.prior.paper, "#2F80ED"]]);
    vbars($("vb-lik"), [["plastic", r.likelihood.plastic, "#F5C518"], ["paper", r.likelihood.paper, "#2F80ED"]]);
    vbars($("vb-post"), [["plastic", r.posterior.plastic, "#F5C518"], ["paper", r.posterior.paper, "#2F80ED"]]);
    $("b-pe").textContent = fmt(r.evidence, 3);
    $("b-pp").textContent = fmt(r.posterior.plastic, 3);
    $("b-pq").textContent = fmt(r.posterior.paper, 3);
  } catch (e) {
    $("bayes-err").hidden = false; $("bayes-err").textContent = e.message;
  }
}, 120);
function initBayes() {
  Object.values(bIn).forEach((el) => el.addEventListener("input", runBayes));
  runBayes();
}
$("b-last").addEventListener("click", () => {
  const d = lastDecision();
  if (!d) { $("bayes-err").hidden = false; $("bayes-err").textContent = "No photo analysed yet — go to AI Sorting first."; return; }
  bIn.prior.value = d.prior; bIn.lp.value = d.likelihood.plastic; bIn.lq.value = d.likelihood.paper;
  runBayes();
});

// ================= MDP =================
const mIn = { post: $("m-post"), gamma: $("m-gamma"), succ: $("m-succ"), acc: $("m-acc") };
let lastMdp = null;
const NODES = {
  ItemDetected: [90, 180], MaterialIdentified: [320, 80], LowConfidence: [320, 285], ReadyToSort: [540, 285], Sorted: [680, 120],
};
const SHORT = { Sort_Plastic: "Sort Plastic", Sort_Paper: "Sort Paper", Inspect_Again: "Inspect Again" };

function drawGraph(r) {
  const svg = $("mdp-graph");
  const pol = r.policy;
  const edges = [];
  for (const s of r.states) {
    if (s === "Sorted") continue;
    const nexts = new Map();
    for (const a of r.actions) for (const [p, s2] of r.transitions[s][a]) {
      if (!nexts.has(s2)) nexts.set(s2, []);
      nexts.get(s2).push({ a, p, chosen: pol[s] === a });
    }
    for (const [s2, list] of nexts) edges.push({ s, s2, list });
  }
  const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#6B8798"/></marker>
    <marker id="ahg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#20B879"/></marker></defs>`;
  let out = defs;
  for (const e of edges) {
    const chosen = e.list.some((x) => x.chosen);
    const label = e.list.map((x) => `${SHORT[x.a]}${x.p < 1 ? ` (${x.p.toFixed(2)})` : ""}`).join(" / ");
    const [x1, y1] = NODES[e.s], [x2, y2] = NODES[e.s2];
    const col = chosen ? "#20B879" : "#3D5A6B";
    if (e.s === e.s2) {
      out += `<path d="M${x1 - 18} ${y1 - 34} C ${x1 - 50} ${y1 - 100}, ${x1 + 50} ${y1 - 100}, ${x1 + 18} ${y1 - 34}" fill="none" stroke="${col}" stroke-width="${chosen ? 3 : 1.5}" marker-end="url(#${chosen ? "ahg" : "ah"})"/>`;
      if (chosen) out += `<text x="${x1}" y="${y1 - 92}" fill="#9AE6B4" font-size="11" text-anchor="middle" font-weight="700">${label}</text>`;
      continue;
    }
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const sx = x1 + ux * 52, sy = y1 + uy * 34, ex = x2 - ux * 52, ey = y2 - uy * 34;
    const mx = (sx + ex) / 2 - uy * 24, my = (sy + ey) / 2 + ux * 24;
    out += `<path d="M${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}" fill="none" stroke="${col}" stroke-width="${chosen ? 3 : 1.5}" marker-end="url(#${chosen ? "ahg" : "ah"})" ${chosen ? "" : 'stroke-dasharray="5 5"'}/>`;
    if (chosen) out += `<text x="${mx}" y="${my - 6}" fill="#9AE6B4" font-size="11" text-anchor="middle" font-weight="700">${e.list.filter((x) => x.chosen).map((x) => SHORT[x.a]).join("")}</text>`;
  }
  for (const [s, [x, y]] of Object.entries(NODES)) {
    const cur = s === r.current_state;
    const label = s.replace(/([a-z])([A-Z])/g, "$1 $2");
    out += `<g><rect x="${x - 58}" y="${y - 32}" width="116" height="64" rx="16" fill="${cur ? "#20B879" : "#10384F"}" stroke="${cur ? "#9AE6B4" : "#2B4F63"}" stroke-width="2"/>
      <text x="${x}" y="${y - 6}" text-anchor="middle" fill="${cur ? "#071D2B" : "#F0FAF5"}" font-size="11.5" font-weight="700" font-family="Sora,sans-serif">${label}</text>
      <text x="${x}" y="${y + 14}" text-anchor="middle" fill="${cur ? "#071D2B" : "#9AE6B4"}" font-size="11" font-family="Consolas,monospace">V=${fmt(r.V[s], 2)}</text></g>`;
  }
  out += `<text x="20" y="340" fill="#6B8798" font-size="11">green = optimal action from each state · highlighted node = current state of the item</text>`;
  svg.innerHTML = out;
}

function drawChart(deltas) {
  const cv = $("mdp-chart"), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 300, H = cv.clientHeight || 180;
  if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const vals = deltas.map((d) => Math.log10(Math.max(d, 1e-9)));
  const lo = Math.min(...vals, -6.5), hi = Math.max(...vals, 1.5);
  const px = (i) => 36 + (i / Math.max(1, vals.length - 1)) * (W - 50);
  const py = (v) => 12 + (1 - (v - lo) / (hi - lo)) * (H - 34);
  c.strokeStyle = "#D6EADF"; c.fillStyle = "#6B8291"; c.font = "10px Inter, sans-serif";
  for (let e = Math.ceil(lo); e <= hi; e += 2) { c.beginPath(); c.moveTo(36, py(e)); c.lineTo(W - 10, py(e)); c.stroke(); c.fillText("1e" + e, 2, py(e) + 3); }
  c.strokeStyle = "#E5484D"; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(36, py(-6)); c.lineTo(W - 10, py(-6)); c.stroke(); c.setLineDash([]);
  c.strokeStyle = "#20B879"; c.lineWidth = 2.5; c.beginPath();
  vals.forEach((v, i) => (i ? c.lineTo(px(i), py(v)) : c.moveTo(px(i), py(v)))); c.stroke();
  c.fillStyle = "#6B8291"; c.fillText(`iteration → (${vals.length})`, W - 110, H - 6); c.fillText("θ = 1e-6", W - 60, py(-6) - 4);
}

function renderTables(r) {
  const states = r.states.filter((s) => s !== "Sorted");
  $("q-table").innerHTML = `<thead><tr><th>State</th>${r.actions.map((a) => `<th>${SHORT[a]}</th>`).join("")}<th>V(s)</th><th>π(s)</th></tr></thead><tbody>${
    states.map((s) => `<tr${s === r.current_state ? ' style="outline:2px solid #20B879;outline-offset:-2px"' : ""}><td><b>${s}</b></td>${
      r.actions.map((a) => `<td class="num ${r.policy[s] === a ? "best" : ""}">${fmt(r.Q[s][a], 3)}</td>`).join("")}<td class="num">${fmt(r.V[s], 3)}</td><td>${SHORT[r.policy[s]]}</td></tr>`).join("")}</tbody>`;
  $("t-table").innerHTML = `<thead><tr><th>State</th><th>Action</th><th>Next state (probability)</th><th>R(s,a)</th></tr></thead><tbody>${
    states.flatMap((s) => r.actions.map((a) => `<tr><td>${s}</td><td>${SHORT[a]}</td><td>${r.transitions[s][a].map(([p, s2]) => `${s2} (${fmt(p, 2)})`).join(", ")}</td><td class="num">${fmt(r.rewards[s][a], 2)}</td></tr>`)).join("")}</tbody>`;
  const h = r.history;
  const labels = h.map((_, i) => (i === h.length - 1 && r.iterations + 1 > h.length ? `k=${r.iterations}` : `k=${i}`));
  $("v-table").innerHTML = `<thead><tr><th>Iter.</th>${states.map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${
    h.map((row, i) => `<tr><td>${labels[i]}</td>${states.map((s) => `<td class="num">${fmt(row[s], 3)}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

const runMdp = debounce(async () => {
  const body = { posterior_plastic: +mIn.post.value, gamma: +mIn.gamma.value, inspect_success: +mIn.succ.value, verified_accuracy: +mIn.acc.value };
  $("m-post-out").textContent = body.posterior_plastic.toFixed(2);
  $("m-gamma-out").textContent = body.gamma.toFixed(2);
  $("m-succ-out").textContent = body.inspect_success.toFixed(2);
  $("m-acc-out").textContent = body.verified_accuracy.toFixed(2);
  try {
    const r = await api("/api/mdp", { method: "POST", body });
    lastMdp = r;
    $("mdp-err").hidden = true;
    const sort = r.action !== "Inspect_Again";
    $("mdp-decision").className = sort ? "alert info" : "alert warn";
    $("mdp-decision").innerHTML = `Current state: <b>${r.current_state}</b> (confidence ${pct(r.confidence)}). Optimal action: <b>${SHORT[r.action]}</b>. ${
      sort ? "Confidence is high enough — sorting now has the best expected reward." : "Too uncertain — paying −1 to look again beats risking −10."}`;
    $("m-iter").textContent = r.iterations;
    $("m-er").textContent = fmt(r.expected_reward, 2);
    $("m-conf").textContent = pct(r.confidence, 0);
    drawGraph(r); renderTables(r); drawChart(r.deltas);
  } catch (e) {
    $("mdp-err").hidden = false; $("mdp-err").textContent = e.message;
  }
}, 120);
function initMdp() {
  const d = lastDecision();
  if (d) mIn.post.value = d.posterior;
  Object.values(mIn).forEach((el) => el.addEventListener("input", runMdp));
  runMdp();
}
window.addEventListener("resize", debounce(() => lastMdp && !$("panel-mdp").hidden && drawChart(lastMdp.deltas), 200));

const INIT = { astar: initAstar, bayes: initBayes, mdp: initMdp };
const fromHash = tabs.find((t) => t.id === "tab-" + location.hash.slice(1));
selectTab(fromHash || tabs[0]);
