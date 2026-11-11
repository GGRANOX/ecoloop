// SORT IT! — drag falling waste into the right bin within 60 seconds (mouse + touch).
import { recordGame } from "../store.js";
import { drawBin, drawItem, ITEMS, setupCanvas } from "./canvas.js";

const W = 900, H = 540, DURATION = 60;
let S, raf, cv;

export function mount(root) {
  root.innerHTML = `
  <div class="game-stage">
    <div class="card">
      <div class="toolbar" style="justify-content:space-between"><h3 style="margin:0">Sort It!</h3><span class="badge badge-model" id="si-timer">60 s</span></div>
      <canvas class="game-canvas" id="si-canvas" aria-label="Sort It game field. Drag items into the plastic or paper bin."></canvas>
      <p class="muted" style="margin:12px 0 0;font-size:.9rem">Grab a falling item and drop it into the correct bin before it hits the ground.</p>
      <div class="toolbar" style="margin-top:14px"><button class="btn" id="si-start"><span data-icon="play"></span> Start</button></div>
    </div>
    <div class="hud">
      <div class="kpi"><span>Score</span><b id="si-score">0</b></div>
      <div class="kpi"><span>Correct</span><b id="si-ok">0</b></div>
      <div class="kpi"><span>Mistakes</span><b id="si-bad">0</b></div>
      <div class="kpi"><span>Missed</span><b id="si-miss">0</b></div>
      <div class="card" style="padding:18px;font-size:.9rem"><b>Scoring</b><p class="muted" style="margin:6px 0 0">Correct <b>+10</b> · wrong bin <b>−5</b> · item hits the ground <b>−2</b>. Items fall faster over time.</p></div>
    </div>
  </div>`;
  cv = root.querySelector("#si-canvas");
  const { ctx, toLocal, dispose } = setupCanvas(cv, W, H);
  S = { ctx, toLocal, dispose, root, state: "ready", items: [], pops: [] };
  S.bins = [
    { type: "plastic", x: 150, y: H - 130, w: 200, h: 120, color: "#F5C518", label: "PLASTIC" },
    { type: "paper", x: 550, y: H - 130, w: 200, h: 120, color: "#2F80ED", label: "PAPER" },
  ];
  root.querySelector("#si-start").addEventListener("click", start);
  bindInput();
  reset();
  let last = performance.now();
  const loop = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; update(dt); draw(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

export function unmount() { cancelAnimationFrame(raf); S?.dispose(); window.removeEventListener("pointerup", onUp); }

const $ = (s) => S.root.querySelector(s);

function reset() {
  Object.assign(S, { score: 0, ok: 0, bad: 0, miss: 0, time: DURATION, items: [], spawn: 0, drag: null, pops: [] });
  hud();
}

function start() { reset(); S.state = "playing"; $("#si-start").innerHTML = "Restart"; }

function hud() {
  $("#si-score").textContent = S.score; $("#si-ok").textContent = S.ok; $("#si-bad").textContent = S.bad; $("#si-miss").textContent = S.miss;
  $("#si-timer").textContent = Math.ceil(S.time) + " s";
}

function spawn() {
  const type = Math.random() < 0.5 ? "plastic" : "paper";
  const [kind, name] = ITEMS[type][Math.floor(Math.random() * ITEMS[type].length)];
  const elapsed = DURATION - S.time;
  S.items.push({ type, kind, name, x: 60 + Math.random() * (W - 120), y: -30, vy: 45 + elapsed * 1.6 + Math.random() * 25, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2 });
}

function bindInput() {
  cv.addEventListener("pointerdown", (e) => {
    if (S.state !== "playing") { start(); return; }
    const p = S.toLocal(e);
    let best = null, bd = 48;
    for (const it of S.items) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } }
    if (best) { S.drag = { it: best, dx: best.x - p.x, dy: best.y - p.y }; cv.setPointerCapture?.(e.pointerId); e.preventDefault(); }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!S.drag) return;
    const p = S.toLocal(e);
    S.drag.it.x = p.x + S.drag.dx; S.drag.it.y = p.y + S.drag.dy;
  });
  window.addEventListener("pointerup", onUp);
}

function binAt(x, y) { return S.bins.find((b) => x > b.x - 10 && x < b.x + b.w + 10 && y > b.y - 40 && y < b.y + b.h); }

function onUp() {
  if (!S?.drag) return;
  const it = S.drag.it; S.drag = null;
  const bin = binAt(it.x, it.y);
  if (!bin) return;
  S.items = S.items.filter((x) => x !== it);
  if (bin.type === it.type) { S.score += 10; S.ok++; pop(it.x, it.y, "+10", "#20B879"); bin.glow = 1; }
  else { S.score -= 5; S.bad++; pop(it.x, it.y, `−5 ${it.name} is ${it.type}`, "#E5484D"); }
  hud();
}

function pop(x, y, text, color) { S.pops.push({ x, y, text, color, t: 1.2 }); }

function update(dt) {
  S.pops.forEach((p) => { p.t -= dt; p.y -= 30 * dt; });
  S.pops = S.pops.filter((p) => p.t > 0);
  if (S.state !== "playing") return;
  S.time -= dt;
  if (S.time <= 0) { S.time = 0; return finish(); }
  S.spawn -= dt;
  if (S.spawn <= 0) { spawn(); S.spawn = Math.max(0.55, 1.4 - (DURATION - S.time) * 0.014); }
  for (const it of S.items) {
    if (S.drag?.it === it) continue;
    it.y += it.vy * dt; it.rot += it.spin * dt;
  }
  const ground = H - 10;
  const fallen = S.items.filter((it) => it.y > ground && S.drag?.it !== it);
  if (fallen.length) {
    fallen.forEach((it) => {
      // an item that falls straight into a bin still counts
      const bin = binAt(it.x, it.y - 20);
      if (bin && bin.type === it.type) { S.score += 10; S.ok++; pop(it.x, ground - 40, "+10", "#20B879"); }
      else { S.score -= 2; S.miss++; pop(it.x, ground - 40, "−2 missed", "#F59E0B"); }
    });
    S.items = S.items.filter((it) => !fallen.includes(it));
    hud();
  }
  hud();
}

function finish() {
  S.state = "over"; S.drag = null; S.items = [];
  const acc = S.ok + S.bad ? Math.round((S.ok / (S.ok + S.bad)) * 100) : 0;
  S.result = { acc };
  recordGame("sortit", { score: Math.max(0, S.score), points: Math.max(0, S.score), correct: S.ok, detail: `${S.ok} correct · ${S.bad} wrong · ${acc}% accuracy` });
  $("#si-start").innerHTML = "Play again";
  hud();
}

function draw() {
  const c = S.ctx;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0B2A3D"); g.addColorStop(1, "#071D2B");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = "#10384F"; c.fillRect(0, H - 10, W, 10);
  for (const b of S.bins) { drawBin(c, b.x, b.y, b.w, b.h, b.color, b.label, b.glow || 0); if (b.glow) b.glow = Math.max(0, b.glow - 0.03); }
  for (const it of S.items) {
    const dragging = S.drag?.it === it;
    if (dragging) { c.fillStyle = "rgba(154,230,180,.25)"; c.beginPath(); c.arc(it.x, it.y, 38, 0, 7); c.fill(); }
    drawItem(c, it.kind, it.x, it.y, dragging ? 1.5 : 1.3, dragging ? 0 : Math.sin(it.rot) * 0.4);
    c.fillStyle = "#CFE8EA"; c.font = "600 12px Inter, sans-serif"; c.textAlign = "center"; c.fillText(it.name, it.x, it.y + 42);
  }
  for (const p of S.pops) { c.globalAlpha = Math.min(1, p.t * 1.5); c.fillStyle = p.color; c.font = "800 20px Sora, sans-serif"; c.textAlign = "center"; c.fillText(p.text, p.x, p.y); c.globalAlpha = 1; }
  // timer bar
  c.fillStyle = "#10384F"; c.fillRect(0, 0, W, 6);
  c.fillStyle = S.time < 10 ? "#E5484D" : "#20B879"; c.fillRect(0, 0, (S.time / DURATION) * W, 6);
  if (S.state !== "playing") {
    c.fillStyle = "rgba(7,29,43,.8)"; c.fillRect(0, 0, W, H);
    c.textAlign = "center"; c.fillStyle = "#F0FAF5";
    if (S.state === "over") {
      c.font = "800 26px Sora, sans-serif"; c.fillText("Time's up!", W / 2, H / 2 - 80);
      c.font = "800 64px Sora, sans-serif"; c.fillStyle = "#9AE6B4"; c.fillText(String(S.score), W / 2, H / 2 - 10);
      c.font = "600 20px Inter, sans-serif"; c.fillStyle = "#F0FAF5";
      c.fillText(`${S.ok} correct · ${S.bad} wrong · ${S.miss} missed · accuracy ${S.result.acc}%`, W / 2, H / 2 + 36);
      c.fillText("Tap or press Play again", W / 2, H / 2 + 76);
    } else {
      c.font = "800 44px Sora, sans-serif"; c.fillText("Sort It!", W / 2, H / 2 - 20);
      c.font = "600 20px Inter, sans-serif"; c.fillStyle = "#9AE6B4"; c.fillText("60 seconds · drag every item into the right bin", W / 2, H / 2 + 20);
      c.fillStyle = "#F0FAF5"; c.fillText("Tap or press Start", W / 2, H / 2 + 60);
    }
  }
}
