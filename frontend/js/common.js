// Shared layout: navigation, footer, scroll reveal, counters, toasts, API helper.
import { icons } from "./icons.js";
import { load, levelInfo } from "./store.js";

const PAGES = [
  ["index.html", "Home"],
  ["sorting.html", "AI Sorting"],
  ["lab.html", "Algorithms Lab"],
  ["games.html", "Mini Games"],
  ["profile.html", "Profile"],
  ["about.html", "About"],
];

function currentPage() {
  const f = location.pathname.split("/").pop();
  return f && f.includes(".html") ? f : "index.html";
}

function renderNav() {
  const host = document.getElementById("nav");
  if (!host) return;
  const cur = currentPage();
  const p = load();
  host.innerHTML = `
  <nav class="nav" aria-label="Main">
    <div class="container">
      <a class="logo" href="index.html" aria-label="ECOLOOP home">${icons.logo}<span>ECOLOOP</span></a>
      <ul class="nav-links" id="nav-links">
        ${PAGES.map(([href, label]) => `<li><a href="${href}" ${href === cur ? 'aria-current="page"' : ""}>${label}</a></li>`).join("")}
      </ul>
      <a class="nav-score" href="profile.html" title="Your eco points">${icons.leaf.replace("<svg", '<svg width="18" height="18"')}<span id="nav-points">${p.score}</span> pts · Lv <span id="nav-level">${levelInfo(p.score).level}</span></a>
      <button class="burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links"><span></span></button>
    </div>
  </nav>`;
  const nav = host.querySelector(".nav");
  const burger = host.querySelector(".burger");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  host.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); burger.focus(); }
  });
}

function renderFooter() {
  const host = document.getElementById("footer");
  if (!host) return;
  host.innerHTML = `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html">${icons.logo}<span>ECOLOOP</span></a>
          <p style="margin-top:14px;max-width:340px">Small Actions. Big Impact. AI Smart Waste Sorting — a student project for the Artificial Intelligence course.</p>
        </div>
        <div><h4>Explore</h4><ul>${PAGES.slice(0, 4).map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul></div>
        <div><h4>Algorithms</h4><ul>
          <li><a href="lab.html#astar">A* Search</a></li><li><a href="lab.html#bayes">Bayes' Theorem</a></li>
          <li><a href="lab.html#mdp">Markov Decision Process</a></li><li><a href="/docs">API docs</a></li></ul></div>
      </div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} ECOLOOP</span><span>CNN → Bayes → MDP → A*</span></div>
    </div>
  </footer>`;
}

export function initReveal(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((e) => io.observe(e));
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function animateCount(el, to, { duration = 1600, decimals = 0, suffix = "" } = {}) {
  el.textContent = to.toFixed(decimals) + suffix; // final value even if animation frames never run
  if (reducedMotion()) return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = (to * e).toFixed(decimals) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const els = document.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      animateCount(el, parseFloat(el.dataset.count), { decimals: +(el.dataset.decimals || 0), suffix: el.dataset.suffix || "" });
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach((e) => io.observe(e));
}

function initTilt() {
  if (reducedMotion() || matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

export function toast(html, ms = 3800) {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = html;
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Unified API call: returns JSON or throws Error with a readable message.
export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new Error("Cannot reach the ECOLOOP server. Is uvicorn running?");
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

export const fmt = (x, d = 3) => Number(x).toFixed(d);
export const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

window.addEventListener("ecoloop:profile", (e) => {
  const { profile, unlocked, points } = e.detail;
  const np = document.getElementById("nav-points");
  const nl = document.getElementById("nav-level");
  if (np) np.textContent = profile.score;
  if (nl) nl.textContent = levelInfo(profile.score).level;
  if (points > 0) toast(`${icons.leaf.replace("<svg", '<svg width="20" height="20"')} <span><b>+${Math.round(points)}</b> eco points</span>`, 2200);
  unlocked.forEach((a) => toast(`${icons.trophy.replace("<svg", '<svg width="22" height="22"')}<span>Achievement unlocked: <b>${a.title}</b></span>`, 4500));
});

export function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.firstElementChild) el.innerHTML = icons[el.dataset.icon] || "";
  });
}

renderNav();
renderFooter();
fillIcons();
initReveal();
initCounters();
initTilt();
