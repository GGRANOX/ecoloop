// BOTTLE TOSS — pull back & release (mouse or touch). Projectile physics, two bins.
import { recordGame } from "../store.js";
import { drawBin, drawItem, ITEMS, roundRect, setupCanvas } from "./canvas.js";

const W = 900, H = 500, G = 900; // px/s^2
const THROWS = 10;
const ORIGIN = { x: 130, y: 380 };
const LEVELS = {
  easy: { binW: 130, speed: 0, wind: 0, label: "Easy — bins stand still" },
  medium: { binW: 110, speed: 45, wind: 0, label: "Medium — bins move" },
  hard: { binW: 84, speed: 85, wind: 60, label: "Hard — smaller, faster bins + wind" },
};
let S, raf, cv;

export function mount(root) {
  root.innerHTML = `
  <div class="game-stage">
    <div class="card">
      <div class="toolbar" style="justify-content:space-between">
        <h3 style="margin:0">Bottle Toss</h3>
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">Level
          <select id="bt-level"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
      </div>
      <canvas class="game-canvas" id="bt-canvas" aria-label="Bottle toss field. Drag from the item backwards and release to throw."></canvas>
      <p class="muted" style="margin:12px 0 0;font-size:.9rem">Drag <b>backwards</b> from the item (like a slingshot) and release. Longer pull = stronger throw. Throw plastic into the <b style="color:#B88A00">yellow</b> bin and paper into the <b style="color:#2F80ED">blue</b> bin.</p>
      <div class="toolbar" style="margin-top:14px"><button class="btn" id="bt-start"><span data-icon="play"></span> New Round</button></div>
    </div>
    <div class="hud">
      <div class="kpi"><span>Score</span><b id="bt-score">0</b></div>
      <div class="kpi"><span>Hits</span><b id="bt-hits">0</b></div>
      <div class="kpi"><span>Throws left</span><b id="bt-left">${THROWS}</b></div>
      <div class="kpi"><span>Best hits</span><b id="bt-best">0</b></div>
      <div class="card" style="padding:18px;font-size:.9rem"><b>Scoring</b><p class="muted" style="margin:6px 0 0">Correct bin <b>+10</b> · wrong bin <b>−5</b> · miss 0. 10 throws per round.</p></div>
    </div>
  </div>`;
  cv = root.querySelector("#bt-canvas");
  const { ctx, toLocal, dispose } = setupCanvas(cv, W, H);
  S = { ctx, toLocal, dispose, root, level: "easy", running: false, t: 0 };
  root.querySelector("#bt-start").addEventListener("click", start);
  root.querySelector("#bt-level").addEventListener("change", (e) => { S.level = e.target.value; start(); });
  bindInput();
  resetRound(false);
  let last = performance.now();
  const loop = (t) => { const dt = Math.min(0.033, (t - last) / 1000); last = t; update(dt); draw(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}

export function unmount() { cancelAnimationFrame(raf); S?.dispose(); window.removeEventListener("pointerup", onUp); }

const $ = (s) => S.root.querySelector(s);

function resetRound(running) {
  const L = LEVELS[S.level];
  S.score = 0; S.hits = 0; S.left = THROWS; S.running = running; S.flash = null; S.finished = false;
  S.bins = [
    { type: "plastic", x: 520, y: 330, w: L.binW, h: 120, color: "#F5C518", label: "PLASTIC", dir: 1, phase: 0 },
    { type: "paper", x: 720, y: 330, w: L.binW, h: 120, color: "#2F80ED", label: "PAPER", dir: -1, phase: 1.7 },
  ];
  S.wind = L.wind ? (Math.random() * 2 - 1) * L.wind : 0;
  nextItem();
  hud();
}

function start() { resetRound(true); }

function nextItem() {
  const type = Math.random() < 0.5 ? "plastic" : "paper";
  const [kind, name] = ITEMS[type][Math.floor(Math.random() * ITEMS[type].length)];
  S.item = { type, kind, name, x: ORIGIN.x, y: ORIGIN.y, vx: 0, vy: 0, rot: 0, flying: false };
  if (LEVELS[S.level].wind) S.wind = (Math.random() * 2 - 1) * LEVELS[S.level].wind;
}

function hud() {
  $("#bt-score").textContent = S.score; $("#bt-hits").textContent = S.hits; $("#bt-left").textContent = S.left;
  const best = JSON.parse(localStorage.getItem("ecoloop.profile.v1") || "{}")?.games?.bottle?.best || 0;
  $("#bt-best").textContent = best;
}

function bindInput() {
  cv.addEventListener("pointerdown", (e) => {
    if (!S.running || S.item.flying || S.finished) { if (!S.running) start(); return; }
    const p = S.toLocal(e);
    if (Math.hypot(p.x - S.item.x, p.y - S.item.y) > 90) return;
    S.drag = p; S.aim = p;
    cv.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => { if (S.drag) S.aim = S.toLocal(e); });
  window.addEventListener("pointerup", onUp);
}

function launchVector() {
  const dx = ORIGIN.x - S.aim.x, dy = ORIGIN.y - S.aim.y;
  const len = Math.min(170, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  const power = len * 6.2;
  return { vx: Math.cos(ang) * power, vy: Math.sin(ang) * power, len };
}

function onUp() {
  if (!S?.drag) return;
  const v = launchVector();
  S.drag = null;
  if (v.len < 15) return;
  Object.assign(S.item, { vx: v.vx, vy: v.vy, flying: true, spin: (v.vx > 0 ? 1 : -1) * (6 + v.len / 20) });
}

function update(dt) {
  S.t += dt;
  const L = LEVELS[S.level];
  if (S.running && L.speed) {
    for (const b of S.bins) {
      b.x += b.dir * L.speed * dt;
      const min = b.type === "plastic" ? 380 : 600, max = b.type === "plastic" ? 600 - b.w : W - 20 - b.w;
      if (b.x < min) { b.x = min; b.dir = 1; }
      if (b.x > max) { b.x = max; b.dir = -1; }
    }
  }
  const it = S.item;
  if (it.flying) {
    const py = it.y;
    it.vy += G * dt; it.vx += S.wind * dt;
    it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.spin * dt;
    for (const b of S.bins) {
      const inner = b.x + 8, outer = b.x + b.w - 8;
      // enters through the opening while falling
      if (it.vy > 0 && py <= b.y && it.y >= b.y && it.x > inner && it.x < outer) return land(b);
      // bounce off the bin walls
      if (it.y > b.y && it.y < b.y + b.h && ((it.x > b.x - 6 && it.x < b.x + 4) || (it.x > b.x + b.w - 4 && it.x < b.x + b.w + 6))) {
        it.vx *= -0.45; it.x += it.vx > 0 ? 8 : -8;
      }
    }
    if (it.y > H - 30 || it.x > W + 40 || it.x < -40) land(null);
  }
  if (S.flash) S.flash.t -= dt;
}

function land(bin) {
  let msg, color;
  if (!bin) { msg = "Miss!"; color = "#94A3B8"; }
  else if (bin.type === S.item.type) { S.score += 10; S.hits++; msg = `+10 ${S.item.name} → ${bin.label}`; color = "#20B879"; bin.glow = 1; }
  else { S.score -= 5; msg = `−5 Wrong bin! ${S.item.name} is ${S.item.type}`; color = "#E5484D"; }
  S.flash = { msg, color, t: 1.6 };
  S.left--;
  hud();
  if (S.left <= 0) finish();
  else nextItem();
}

function finish() {
  S.finished = true; S.running = false;
  S.item.flying = false;
  const points = Math.max(0, S.score) + S.hits * 2;
  recordGame("bottle", { score: S.hits, points, correct: S.hits, detail: `${S.hits}/${THROWS} hits · ${S.score} pts · ${S.level}` });
  hud();
}

function draw() {
  const c = S.ctx;
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#0B2A3D"); sky.addColorStop(1, "#071D2B");
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = "#10384F"; c.fillRect(0, H - 50, W, 50);
  c.fillStyle = "#20B879"; c.fillRect(0, H - 50, W, 4);
  // wind indicator
  if (S.wind) {
    c.fillStyle = "#9AE6B4"; c.font = "600 14px Inter, sans-serif"; c.textAlign = "left";
    c.fillText(`Wind ${S.wind > 0 ? "→" : "←"} ${Math.abs(S.wind).toFixed(0)}`, 20, 30);
  }
  for (const b of S.bins) { drawBin(c, b.x, b.y, b.w, b.h, b.color, b.label, b.glow || 0); if (b.glow) b.glow = Math.max(0, b.glow - 0.02); }
  // launcher pad
  c.fillStyle = "#2B4F63"; roundRect(c, ORIGIN.x - 40, ORIGIN.y + 30, 80, 14, 7); c.fill();
  // aim guide
  if (S.drag && S.aim) {
    const v = launchVector();
    c.fillStyle = "rgba(154,230,180,.85)";
    let x = ORIGIN.x, y = ORIGIN.y, vx = v.vx, vy = v.vy;
    for (let i = 0; i < 26; i++) { const dt = 0.035; vy += G * dt; vx += S.wind * dt; x += vx * dt; y += vy * dt; c.beginPath(); c.arc(x, y, 3.2 - i * 0.1, 0, 7); c.fill(); }
    c.strokeStyle = "#9AE6B4"; c.lineWidth = 3; c.beginPath(); c.moveTo(ORIGIN.x, ORIGIN.y); c.lineTo(S.aim.x, S.aim.y); c.stroke();
    c.fillStyle = "#F0FAF5"; c.font = "700 13px Inter"; c.textAlign = "center"; c.fillText(`power ${Math.round((v.len / 170) * 100)}%`, ORIGIN.x, ORIGIN.y - 50);
  }
  const it = S.item;
  if (!S.finished) {
    drawItem(c, it.kind, it.x, it.y, 1.3, it.rot);
    if (!it.flying) { c.fillStyle = "#F0FAF5"; c.font = "700 14px Inter"; c.textAlign = "center"; c.fillText(it.name, ORIGIN.x, ORIGIN.y + 64); }
  }
  if (S.flash && S.flash.t > 0) {
    c.globalAlpha = Math.min(1, S.flash.t); c.fillStyle = S.flash.color; c.font = "800 26px Sora, sans-serif"; c.textAlign = "center";
    c.fillText(S.flash.msg, W / 2, 80); c.globalAlpha = 1;
  }
  if (!S.running) {
    c.fillStyle = "rgba(7,29,43,.78)"; c.fillRect(0, 0, W, H);
    c.textAlign = "center"; c.fillStyle = "#F0FAF5";
    if (S.finished) {
      c.font = "800 44px Sora, sans-serif"; c.fillText(`${S.hits} / ${THROWS} hits`, W / 2, H / 2 - 30);
      c.font = "600 20px Inter, sans-serif"; c.fillStyle = "#9AE6B4"; c.fillText(`Score ${S.score} · saved to your profile`, W / 2, H / 2 + 10);
      c.fillStyle = "#F0FAF5"; c.fillText("Tap or press New Round to play again", W / 2, H / 2 + 50);
    } else {
      c.font = "800 40px Sora, sans-serif"; c.fillText("Bottle Toss", W / 2, H / 2 - 30);
      c.font = "600 20px Inter, sans-serif"; c.fillStyle = "#9AE6B4"; c.fillText(LEVELS[S.level].label, W / 2, H / 2 + 8);
      c.fillStyle = "#F0FAF5"; c.fillText("Tap or press New Round to start", W / 2, H / 2 + 48);
    }
  }
}
