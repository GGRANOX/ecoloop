// Canvas renderer for the A* warehouse grid (used by Sorting page and Lab).
import { reducedMotion } from "./common.js";

const C = {
  bg: "#0B2A3D", cell: "#10384F", line: "#0B2A3D", wall: "#4A6575", wallTop: "#6B8798",
  open: "rgba(154,230,180,.35)", closed: "rgba(8,126,139,.55)", path: "#20B879",
  plastic: "#F5C518", paper: "#2F80ED", robot: "#F0FAF5",
};

export class GridView {
  constructor(canvas, { width = 12, height = 8 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = width; this.h = height;
    this.state = { obstacles: [], start: [0, 0], bins: {}, open: [], closed: [], path: [], target: null };
    this.robotPos = null;
    this.visibleClosed = Infinity;
    this.visiblePath = Infinity;
    this.anim = null;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const cssW = this.canvas.clientWidth || 600;
    const dpr = window.devicePixelRatio || 1;
    this.cs = cssW / this.w;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(this.cs * this.h * dpr);
    this.canvas.style.height = this.cs * this.h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  setSize(w, h) { this.w = w; this.h = h; this.resize(); }

  set(partial) { Object.assign(this.state, partial); this.draw(); }

  cellAt(evt) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor((evt.clientX - r.left) / (r.width / this.w));
    const y = Math.floor((evt.clientY - r.top) / (r.height / this.h));
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return [x, y];
  }

  rr(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  draw() {
    const { ctx: c, cs, w, h } = this;
    const S = this.state;
    c.clearRect(0, 0, w * cs, h * cs);
    c.fillStyle = C.bg; c.fillRect(0, 0, w * cs, h * cs);
    const pad = Math.max(1.5, cs * 0.05);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      c.fillStyle = C.cell; this.rr(x * cs + pad, y * cs + pad, cs - 2 * pad, cs - 2 * pad, cs * 0.18); c.fill();
    }
    const fillCells = (cells, color, limit = Infinity) => {
      c.fillStyle = color;
      cells.slice(0, limit).forEach(([x, y]) => { this.rr(x * cs + pad, y * cs + pad, cs - 2 * pad, cs - 2 * pad, cs * 0.18); c.fill(); });
    };
    const done = this.visibleClosed >= S.closed.length;
    if (done) fillCells(S.open, C.open);
    fillCells(S.closed, C.closed, this.visibleClosed);

    // path line
    const p = S.path.slice(0, this.visiblePath);
    if (p.length > 1) {
      c.strokeStyle = C.path; c.lineWidth = cs * 0.16; c.lineCap = "round"; c.lineJoin = "round";
      c.shadowColor = "rgba(32,184,121,.8)"; c.shadowBlur = 10;
      c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo : c.moveTo).call(c, x * cs + cs / 2, y * cs + cs / 2)); c.stroke();
      c.shadowBlur = 0;
    }
    // obstacles (pseudo-3D blocks)
    S.obstacles.forEach(([x, y]) => {
      c.fillStyle = "#2B4555"; this.rr(x * cs + pad, y * cs + pad + cs * 0.08, cs - 2 * pad, cs - 2 * pad - cs * 0.04, cs * 0.16); c.fill();
      c.fillStyle = C.wall; this.rr(x * cs + pad, y * cs + pad, cs - 2 * pad, cs - 2 * pad - cs * 0.1, cs * 0.16); c.fill();
      c.fillStyle = C.wallTop; this.rr(x * cs + pad * 2.5, y * cs + pad * 2.5, cs - 5 * pad, cs * 0.18, cs * 0.08); c.fill();
    });
    // bins
    Object.entries(S.bins).forEach(([name, [x, y]]) => this.drawBin(x, y, name, S.target === name));
    // robot
    const rp = this.robotPos || S.start;
    if (rp) this.drawRobot(rp[0], rp[1]);
  }

  drawBin(x, y, name, active) {
    const { ctx: c, cs } = this;
    const col = C[name] || "#ccc";
    const cx = x * cs + cs / 2, top = y * cs + cs * 0.2;
    if (active) { c.fillStyle = "rgba(32,184,121,.25)"; c.beginPath(); c.arc(cx, y * cs + cs / 2, cs * 0.55, 0, 7); c.fill(); }
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(cx - cs * 0.3, top + cs * 0.12); c.lineTo(cx + cs * 0.3, top + cs * 0.12);
    c.lineTo(cx + cs * 0.24, top + cs * 0.64); c.lineTo(cx - cs * 0.24, top + cs * 0.64); c.closePath(); c.fill();
    c.globalAlpha = 0.85; this.rr(cx - cs * 0.35, top, cs * 0.7, cs * 0.14, cs * 0.05); c.fill(); c.globalAlpha = 1;
    c.fillStyle = "#071D2B"; c.font = `800 ${Math.max(7, cs * 0.17)}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(name === "plastic" ? "PL" : "PA", cx, top + cs * 0.4);
  }

  drawRobot(x, y) {
    const { ctx: c, cs } = this;
    const cx = x * cs + cs / 2, cy = y * cs + cs / 2, r = cs * 0.32;
    c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(cx, cy + r * 0.9, r * 0.9, r * 0.3, 0, 0, 7); c.fill();
    c.fillStyle = C.robot; this.rr(cx - r, cy - r * 0.9, 2 * r, 1.7 * r, r * 0.45); c.fill();
    c.fillStyle = "#071D2B"; this.rr(cx - r * 0.7, cy - r * 0.55, 1.4 * r, 0.7 * r, r * 0.3); c.fill();
    c.fillStyle = "#20B879"; c.beginPath(); c.arc(cx - r * 0.32, cy - r * 0.2, r * 0.16, 0, 7); c.arc(cx + r * 0.32, cy - r * 0.2, r * 0.16, 0, 7); c.fill();
    c.strokeStyle = C.robot; c.lineWidth = Math.max(1.5, cs * 0.04); c.beginPath(); c.moveTo(cx, cy - r * 0.9); c.lineTo(cx, cy - r * 1.3); c.stroke();
    c.fillStyle = "#F5C518"; c.beginPath(); c.arc(cx, cy - r * 1.35, r * 0.14, 0, 7); c.fill();
  }

  stop() { if (this.anim) cancelAnimationFrame(this.anim); this.anim = null; }

  /** Animate: expand closed cells, then draw path, then move robot. Resolves when done. */
  animate(result, { exploreMs = 18, moveMs = 160, onStep } = {}) {
    this.stop();
    this.set({ open: result.open || [], closed: result.closed || [], path: result.path || [] });
    if (reducedMotion()) {
      this.visibleClosed = Infinity; this.visiblePath = Infinity;
      this.robotPos = result.path?.length ? result.path[result.path.length - 1] : null;
      onStep?.(Math.max(0, (result.path?.length || 1) - 1)); this.draw(); return Promise.resolve();
    }
    this.visibleClosed = 0; this.visiblePath = 0; this.robotPos = null;
    return new Promise((resolve) => {
      let t0 = performance.now(); let phase = 0;
      const nC = result.closed.length, path = result.path || [];
      const tick = (t) => {
        if (phase === 0) {
          this.visibleClosed = Math.min(nC, Math.floor((t - t0) / exploreMs));
          if (this.visibleClosed >= nC) { phase = path.length ? 1 : 3; t0 = t; this.visibleClosed = Infinity; }
        } else if (phase === 1) {
          this.visiblePath = path.length; phase = 2; t0 = t;
        } else if (phase === 2) {
          const k = (t - t0) / moveMs; const i = Math.floor(k);
          if (i >= path.length - 1) { this.robotPos = path[path.length - 1]; onStep?.(path.length - 1); phase = 3; }
          else {
            const f = k - i, [ax, ay] = path[i], [bx, by] = path[i + 1];
            this.robotPos = [ax + (bx - ax) * f, ay + (by - ay) * f]; onStep?.(i);
          }
        }
        this.draw();
        if (phase === 3) { this.anim = null; resolve(); return; }
        this.anim = requestAnimationFrame(tick);
      };
      this.anim = requestAnimationFrame(tick);
    });
  }

  clearSearch() { this.stop(); this.visibleClosed = Infinity; this.visiblePath = Infinity; this.robotPos = null; this.set({ open: [], closed: [], path: [] }); }
}
