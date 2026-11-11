import { api, fillIcons, fmt, pct, toast } from "./common.js";
import { GridView } from "./gridview.js";
import { binSVG } from "./icons.js";
import { recordAnalysis } from "./store.js";

const $ = (id) => document.getElementById(id);
const MAX = 5 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/gif"];
let file = null;
let lastResult = null;
const grid = new GridView($("route-canvas"));

// ---------- AI mode ----------
api("/api/health").then((h) => {
  const chip = $("mode-chip");
  chip.innerHTML = h.mode === "model"
    ? `<i></i>MODEL mode · trained MobileNetV2 (val. accuracy ${pct(h.model?.val_accuracy || 0)})`
    : `<i style="background:#F5C518"></i>DEMO mode · colour/texture analyser (no trained weights yet)`;
}).catch(() => { $("mode-chip").innerHTML = `<i style="background:#E5484D"></i>Server not reachable`; });

// ---------- states ----------
function show(state) {
  ["empty", "loading", "error", "result"].forEach((s) => ($("state-" + s).hidden = s !== state));
}
function uploadError(msg) {
  const el = $("upload-error");
  el.hidden = !msg;
  el.textContent = msg || "";
}

// ---------- file selection ----------
function setFile(f) {
  uploadError("");
  if (!f) return;
  if (!OK_TYPES.includes(f.type)) return uploadError(`"${f.name}" is not a supported image (JPG, PNG, WEBP).`);
  if (f.size > MAX) return uploadError(`"${f.name}" is ${(f.size / 1e6).toFixed(1)} MB — the limit is 5 MB.`);
  file = f;
  const img = $("preview");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(f);
  img.hidden = false;
  $("drop-empty").hidden = true;
  $("analyze").disabled = false;
  $("clear").disabled = false;
}

const dz = $("dropzone");
$("file").addEventListener("change", (e) => setFile(e.target.files[0]));
dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

$("clear").addEventListener("click", () => {
  file = null;
  $("file").value = "";
  $("preview").hidden = true;
  $("drop-empty").hidden = false;
  $("analyze").disabled = true;
  $("clear").disabled = true;
  $("chain-wrap").hidden = true;
  uploadError("");
  show("empty");
});

["prior", "gamma"].forEach((id) => $(id).addEventListener("input", () => ($(id + "-out").textContent = (+$(id).value).toFixed(2))));

// ---------- samples (drawn on canvas -> real PNG upload) ----------
const SAMPLES = {
  "Blue bottle": (c, w, h) => {
    c.fillStyle = "#e9eef2"; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(w * 0.35, 0, w * 0.65, 0);
    g.addColorStop(0, "#0d47a1"); g.addColorStop(0.5, "#2f80ed"); g.addColorStop(1, "#0d47a1");
    c.fillStyle = g; c.beginPath(); c.roundRect(w * 0.35, h * 0.3, w * 0.3, h * 0.62, 30); c.fill();
    c.beginPath(); c.moveTo(w * 0.38, h * 0.32); c.lineTo(w * 0.45, h * 0.15); c.lineTo(w * 0.55, h * 0.15); c.lineTo(w * 0.62, h * 0.32); c.fill();
    c.fillStyle = "#e5484d"; c.fillRect(w * 0.44, h * 0.07, w * 0.12, h * 0.09);
    c.fillStyle = "#fff"; c.fillRect(w * 0.41, h * 0.36, w * 0.035, h * 0.45); c.fillRect(w * 0.56, h * 0.5, w * 0.02, h * 0.2);
  },
  "Cardboard box": (c, w, h) => {
    c.fillStyle = "#d9d4cc"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#b5895a"; c.fillRect(w * 0.15, h * 0.3, w * 0.7, h * 0.55);
    c.fillStyle = "#c49a6c"; c.beginPath(); c.moveTo(w * 0.15, h * 0.3); c.lineTo(w * 0.3, h * 0.15); c.lineTo(w * 0.95, h * 0.15); c.lineTo(w * 0.85, h * 0.3); c.fill();
    c.fillStyle = "#a07848"; c.fillRect(w * 0.47, h * 0.3, w * 0.06, h * 0.55);
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(90,60,30,${Math.random() * 0.08})`; c.fillRect(w * 0.15 + Math.random() * w * 0.7, h * 0.3 + Math.random() * h * 0.55, 2, 2); }
  },
  "Newspaper": (c, w, h) => {
    c.fillStyle = "#cfcfcf"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#ecebe6"; c.fillRect(w * 0.12, h * 0.1, w * 0.76, h * 0.8);
    c.fillStyle = "#8d8d8d";
    for (let y = h * 0.2; y < h * 0.85; y += 9) { c.fillRect(w * 0.16, y, w * 0.32, 3); c.fillRect(w * 0.52, y, w * 0.32, 3); }
    c.fillStyle = "#555"; c.fillRect(w * 0.16, h * 0.13, w * 0.68, 10);
  },
  "Plastic cup": (c, w, h) => {
    c.fillStyle = "#1c2b36"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#e5484d"; c.beginPath(); c.moveTo(w * 0.28, h * 0.2); c.lineTo(w * 0.72, h * 0.2); c.lineTo(w * 0.64, h * 0.85); c.lineTo(w * 0.36, h * 0.85); c.fill();
    c.fillStyle = "#fff"; c.fillRect(w * 0.36, h * 0.25, w * 0.03, h * 0.5); c.fillRect(w * 0.27, h * 0.18, w * 0.46, h * 0.03);
  },
};
const sampleHost = $("samples");
Object.entries(SAMPLES).forEach(([name, draw]) => {
  const b = document.createElement("button");
  b.className = "sample"; b.type = "button";
  const thumb = document.createElement("canvas"); thumb.width = 80; thumb.height = 80;
  draw(thumb.getContext("2d"), 80, 80);
  b.append(thumb, document.createTextNode(name));
  b.addEventListener("click", () => {
    const cv = document.createElement("canvas"); cv.width = 320; cv.height = 320;
    draw(cv.getContext("2d"), 320, 320);
    cv.toBlob((blob) => setFile(new File([blob], name.toLowerCase().replace(/\s/g, "-") + ".png", { type: "image/png" })), "image/png");
  });
  sampleHost.appendChild(b);
});

// ---------- analyze ----------
async function analyze() {
  if (!file) return;
  show("loading");
  $("analyze").disabled = true;
  const steps = ["Running the image classifier…", "Bayes: updating prior with evidence…", "MDP: value iteration…", "A*: planning the robot route…"];
  let i = 0;
  const timer = setInterval(() => ($("loading-step").textContent = steps[i++ % steps.length]), 450);
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("gamma", $("gamma").value);
    form.append("prior_plastic", $("prior").value);
    const r = await api("/api/analyze", { method: "POST", form });
    lastResult = r;
    try {
      localStorage.setItem("ecoloop.lastDecision", JSON.stringify({
        material: r.bayes.decision, posterior: r.bayes.posterior.plastic, prior: r.bayes.prior.plastic,
        likelihood: r.bayes.likelihood, action: r.mdp.action, at: Date.now(),
      }));
    } catch { /* ignore */ }
    renderResult(r);
    show("result");
    renderChain(r);
  } catch (err) {
    $("error-text").textContent = err.message;
    show("error");
  } finally {
    clearInterval(timer);
    $("analyze").disabled = false;
  }
}
$("analyze").addEventListener("click", analyze);
$("retry").addEventListener("click", analyze);

function gauge(value, color) {
  const r = 50, C = 2 * Math.PI * r;
  return `<div class="gauge"><svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="${r}" stroke="#E3F1EA" stroke-width="12" fill="none"/>
  <circle cx="60" cy="60" r="${r}" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-target="${C * (1 - value)}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/></svg><div class="val">${Math.round(value * 100)}%</div></div>`;
}

function renderResult(r) {
  const d = r.decision, cls = r.classification;
  const hold = d.action === "Inspect_Again";
  const badgeCls = hold ? "badge-hold" : "badge-" + d.material;
  $("state-result").innerHTML = `
    <div class="result-head">
      <span class="badge ${r.mode === "model" ? "badge-model" : "badge-demo"}">${r.mode === "model" ? "MODEL" : "DEMO"}</span>
      <span class="muted" style="font-size:.85rem">${cls.details.architecture} · ${r.elapsed_ms} ms</span>
    </div>
    <div class="material">
      ${gauge(d.confidence, hold ? "#94A3B8" : "#20B879")}
      <div>
        <div class="muted" style="font-weight:600">Detected material</div>
        <div class="big">${d.material.toUpperCase()}</div>
        <span class="badge ${badgeCls}" style="margin-top:8px">${hold ? "Low confidence → Inspect again" : "Confidence " + pct(d.confidence)}</span>
      </div>
    </div>
    <h4 style="margin:22px 0 4px">Classifier probabilities</h4>
    <div class="prob-row"><span>PLASTIC</span><div class="bar plastic"><span data-w="${cls.probabilities.plastic}"></span></div><span class="v">${pct(cls.probabilities.plastic)}</span></div>
    <div class="prob-row"><span>PAPER</span><div class="bar paper"><span data-w="${cls.probabilities.paper}"></span></div><span class="v">${pct(cls.probabilities.paper)}</span></div>
    <div class="bin-card">${binSVG(d.bin_color, hold ? "?" : d.material === "plastic" ? "PLASTIC" : "PAPER")}
      <div><div class="muted" style="font-size:.85rem;font-weight:600">Recommended container</div><strong style="font-size:1.1rem">${d.bin}</strong></div></div>
    <p style="margin:0 0 16px">${d.explanation}</p>
    ${r.mode === "demo" ? `<div class="alert warn" style="margin-bottom:14px"><span>DEMO mode: a simple colour/texture analyser is used because no trained CNN weights were found. Train the model (see README) for real accuracy.</span></div>` : ""}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span class="muted" style="font-size:.9rem;font-weight:600">Was the AI right?</span>
      <button class="btn btn-sm" data-fb="1">Yes</button><button class="btn btn-outline btn-sm" data-fb="0">No</button>
    </div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("state-result").querySelectorAll("[data-w]").forEach((s) => (s.style.width = s.dataset.w * 100 + "%"));
    $("state-result").querySelectorAll("[data-target]").forEach((c) => (c.style.strokeDashoffset = c.dataset.target));
  }));
  $("state-result").querySelectorAll("[data-fb]").forEach((b) => b.addEventListener("click", () => {
    recordAnalysis(b.dataset.fb === "1");
    $("state-result").querySelectorAll("[data-fb]").forEach((x) => (x.disabled = true));
    toast(b.dataset.fb === "1" ? "Thanks! Feedback saved to your profile." : "Thanks — noted. Try a clearer photo or train the CNN.");
  }));
}

function renderChain(r) {
  const b = r.bayes, m = r.mdp, cls = r.classification;
  const q = m.Q[m.current_state];
  const qRows = Object.entries(q).map(([a, v]) => `${a}: ${fmt(v, 2)}${a === m.action ? " ◀" : ""}`).join("  ·  ");
  $("chain").innerHTML = `
    <div class="chain-step"><div class="k">CNN</div><div><h4>1 · Classification (${r.mode})</h4>
      <div class="mono">P(plastic) = ${fmt(cls.probabilities.plastic, 4)} · P(paper) = ${fmt(cls.probabilities.paper, 4)}</div>
      ${cls.details.features ? `<div class="mono muted" style="margin-top:6px">features: highlight ${fmt(cls.details.features.highlight, 3)}, vivid ${fmt(cls.details.features.vivid, 3)}, kraft ${fmt(cls.details.features.kraft, 3)}, matte ${fmt(cls.details.features.matte, 3)}, edges ${fmt(cls.details.features.edges, 3)} → score ${fmt(cls.details.score, 2)}</div>` : ""}
    </div></div>
    <div class="chain-step"><div class="k">P</div><div><h4>2 · Bayes update</h4>
      <div class="mono">prior: plastic ${fmt(b.prior.plastic)} · paper ${fmt(b.prior.paper)}</div>
      <div class="mono">likelihood P(E|C): plastic ${fmt(b.likelihood.plastic)} · paper ${fmt(b.likelihood.paper)}</div>
      <div class="mono">P(E) = ${fmt(b.evidence, 4)}</div>
      <div class="mono"><b>posterior: plastic ${fmt(b.posterior.plastic, 4)} · paper ${fmt(b.posterior.paper, 4)}</b></div>
    </div></div>
    <div class="chain-step"><div class="k">MDP</div><div><h4>3 · MDP decision (γ = ${m.gamma})</h4>
      <div class="mono">state: ${m.current_state} · ${m.iterations} iterations · converged: ${m.converged}</div>
      <div class="mono">Q: ${qRows}</div>
      <div class="mono"><b>action: ${m.action} · expected reward ${fmt(m.expected_reward, 2)}</b></div>
    </div></div>
    <div class="chain-step"><div class="k">A*</div><div><h4>4 · Route planning</h4>
      <div class="mono">${r.path ? `target: ${r.path.target} bin ${JSON.stringify(r.path.goal)} · ${r.path.steps} steps · ${r.path.expanded} nodes expanded` : "No route — the MDP chose Inspect_Again, the robot waits for a better look."}</div>
    </div></div>`;
  $("chain-wrap").hidden = false;
  fillIcons($("chain-wrap"));
  drawRoute(r);
}

async function drawRoute(r) {
  const base = r.path || (await api("/api/astar/default").catch(() => null));
  if (!base) return;
  grid.setSize(base.width, base.height);
  grid.set({ obstacles: base.obstacles, start: base.start, bins: base.bins, target: r.path?.target || null });
  $("k-ms").textContent = r.elapsed_ms;
  if (!r.path) {
    grid.clearSearch();
    $("route-text").textContent = "The robot stays at the start: confidence is too low, so the item goes back for re-inspection.";
    $("k-steps").textContent = "0"; $("k-exp").textContent = "0"; $("replay").disabled = true;
    return;
  }
  $("route-text").textContent = `Shortest path to the ${r.path.target.toUpperCase()} bin found by A* (f = g + h, Manhattan heuristic).`;
  $("k-exp").textContent = r.path.expanded;
  $("replay").disabled = false;
  await grid.animate(r.path, { onStep: (i) => ($("k-steps").textContent = i) });
  $("k-steps").textContent = r.path.steps;
}
$("replay").addEventListener("click", () => lastResult && drawRoute(lastResult));
