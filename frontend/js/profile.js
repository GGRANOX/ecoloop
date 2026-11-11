import { animateCount } from "./common.js";
import { icons } from "./icons.js";
import { ACHIEVEMENTS, GAME_NAMES, levelInfo, load, reset, setName } from "./store.js";

const $ = (id) => document.getElementById(id);

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "EH";
}

function render() {
  const p = load();
  const L = levelInfo(p.score);
  $("p-name").textContent = p.name;
  $("p-avatar").textContent = initials(p.name);
  $("p-level").textContent = L.level;
  $("p-next").textContent = `${p.score} / ${L.next} points to level ${L.level + 1}`;
  $("p-bar-wrap").setAttribute("aria-valuenow", Math.round(L.progress * 100));
  requestAnimationFrame(() => ($("p-bar").style.width = L.progress * 100 + "%"));
  animateCount($("s-score"), p.score, { duration: 900 });
  animateCount($("s-level"), L.level, { duration: 600 });
  animateCount($("s-games"), p.gamesPlayed, { duration: 700 });
  animateCount($("s-correct"), p.correct, { duration: 800 });

  $("ach-count").textContent = `${p.achievements.length} / ${ACHIEVEMENTS.length} unlocked`;
  $("ach-grid").innerHTML = ACHIEVEMENTS.map((a) => {
    const on = p.achievements.includes(a.id);
    return `<div class="card ach ${on ? "" : "locked"}" aria-label="${a.title}: ${on ? "unlocked" : "locked"}">
      <div class="icon-tile">${icons[a.icon]}</div><div><h4>${a.title}</h4><p>${a.desc}</p></div></div>`;
  }).join("");

  const rows = ["tictactoe", "bottle", "sortit", "quiz"].map((g) => {
    const s = p.games[g] || {};
    const best = g === "tictactoe" ? `${s.wins || 0}W / ${s.losses || 0}L / ${s.draws || 0}D` : g === "bottle" ? `${s.best || 0} hits` : g === "quiz" ? `${s.best || 0}/10` : `${s.best || 0} pts`;
    return `<tr><td><b>${GAME_NAMES[g]}</b></td><td class="num">${s.played || 0}</td><td>${best}</td></tr>`;
  });
  rows.push(`<tr><td><b>AI photo analyses</b></td><td class="num">${p.analyses}</td><td>—</td></tr>`);
  $("records").innerHTML = `<thead><tr><th>Game</th><th>Played</th><th>Best</th></tr></thead><tbody>${rows.join("")}</tbody>`;

  $("history").innerHTML = p.history.length
    ? `<thead><tr><th>Game</th><th>Result</th><th>Points</th><th>When</th></tr></thead><tbody>${p.history.slice(0, 10).map((h) =>
        `<tr><td>${GAME_NAMES[h.game] || h.game}</td><td>${h.detail}</td><td class="num">+${h.points}</td><td>${new Date(h.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td></tr>`).join("")}</tbody>`
    : `<tbody><tr><td style="white-space:normal;padding:28px;text-align:center" class="muted">No games played yet. Your results will appear here.</td></tr></tbody>`;
}

$("p-rename").addEventListener("click", () => {
  const name = prompt("Your player name:", load().name);
  if (name !== null) { setName(name); render(); }
});
$("p-reset").addEventListener("click", () => {
  if (confirm("Reset all eco points, achievements and records on this device?")) { reset(); render(); }
});
window.addEventListener("ecoloop:profile", render);
render();
