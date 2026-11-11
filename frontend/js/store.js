// Player profile persisted in localStorage.
const KEY = "ecoloop.profile.v1";

export const GAME_NAMES = {
  tictactoe: "Eco Tic-Tac-Toe",
  bottle: "Bottle Toss",
  sortit: "Sort It!",
  quiz: "Eco Quiz",
  sorting: "AI Smart Sorting",
};

export const ACHIEVEMENTS = [
  { id: "first_scan", title: "First Scan", desc: "Analyse your first photo with the AI", icon: "camera", test: (p) => p.analyses >= 1 },
  { id: "scanner", title: "Eagle Eye", desc: "Analyse 10 photos", icon: "target", test: (p) => p.analyses >= 10 },
  { id: "first_game", title: "Player One", desc: "Finish any mini game", icon: "game", test: (p) => p.gamesPlayed >= 1 },
  { id: "all_games", title: "Explorer", desc: "Play all four mini games", icon: "globe", test: (p) => ["tictactoe", "bottle", "sortit", "quiz"].every((g) => p.games[g]?.played) },
  { id: "ttt_win", title: "Leaf Strategist", desc: "Beat the computer in Tic-Tac-Toe", icon: "leaf", test: (p) => (p.games.tictactoe?.wins || 0) >= 1 },
  { id: "ttt_hard", title: "Minimax Tamer", desc: "Draw or win against the Hard bot", icon: "brain", test: (p) => p.flags?.tttHardNoLoss },
  { id: "bottle_10", title: "Sharp Shooter", desc: "Score 10 hits in one Bottle Toss round", icon: "bottle", test: (p) => (p.games.bottle?.best || 0) >= 10 },
  { id: "sort_150", title: "Sorting Machine", desc: "Score 150+ in Sort It!", icon: "recycle", test: (p) => (p.games.sortit?.best || 0) >= 150 },
  { id: "quiz_perfect", title: "Eco Scholar", desc: "Answer 10/10 in the Eco Quiz", icon: "star", test: (p) => (p.games.quiz?.best || 0) >= 10 },
  { id: "pts_500", title: "Green Champion", desc: "Collect 500 eco points", icon: "trophy", test: (p) => p.score >= 500 },
  { id: "pts_1500", title: "Planet Guardian", desc: "Collect 1500 eco points", icon: "shield", test: (p) => p.score >= 1500 },
  { id: "correct_50", title: "Streak of Good", desc: "Give 50 correct answers across games", icon: "fire", test: (p) => p.correct >= 50 },
];

const fresh = () => ({
  name: "Eco Hero",
  score: 0,
  gamesPlayed: 0,
  correct: 0,
  analyses: 0,
  games: {},
  achievements: [],
  history: [],
  flags: {},
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    return fresh();
  }
}

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: keep in memory only */ }
}

// Level thresholds grow quadratically: level n needs 100 * n * (n - 1) / 2 points
export function levelInfo(score) {
  let level = 1;
  while (score >= (100 * level * (level + 1)) / 2) level++;
  const prev = (100 * (level - 1) * level) / 2;
  const next = (100 * level * (level + 1)) / 2;
  return { level, prev, next, progress: (score - prev) / (next - prev) };
}

function checkAchievements(p) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!p.achievements.includes(a.id) && a.test(p)) {
      p.achievements.push(a.id);
      unlocked.push(a);
    }
  }
  return unlocked;
}

/**
 * Record a finished game.
 * @param {string} game  key from GAME_NAMES
 * @param {{score:number, points:number, correct?:number, win?:boolean, loss?:boolean, draw?:boolean, detail?:string}} r
 * @returns {{profile, unlocked: Array}}
 */
export function recordGame(game, r) {
  const p = load();
  const g = (p.games[game] ||= { played: 0, best: 0, wins: 0, losses: 0, draws: 0, total: 0 });
  g.played++;
  g.best = Math.max(g.best, r.score || 0);
  g.total += r.score || 0;
  if (r.win) g.wins++;
  if (r.loss) g.losses++;
  if (r.draw) g.draws++;
  p.gamesPlayed++;
  p.score += Math.max(0, Math.round(r.points || 0));
  p.correct += r.correct || 0;
  if (r.flag) p.flags[r.flag] = true;
  p.history.unshift({ game, score: r.score || 0, points: Math.round(r.points || 0), detail: r.detail || "", at: Date.now() });
  p.history = p.history.slice(0, 50);
  const unlocked = checkAchievements(p);
  save(p);
  notify(p, unlocked, r.points);
  return { profile: p, unlocked };
}

export function recordAnalysis(correctGuess) {
  const p = load();
  p.analyses++;
  p.score += 10;
  if (correctGuess) p.correct++;
  const unlocked = checkAchievements(p);
  save(p);
  notify(p, unlocked, 10);
  return { profile: p, unlocked };
}

export function setName(name) {
  const p = load();
  p.name = (name || "").trim().slice(0, 24) || "Eco Hero";
  save(p);
  return p;
}

export function reset() {
  save(fresh());
  notify(fresh(), [], 0);
}

function notify(p, unlocked, points) {
  window.dispatchEvent(new CustomEvent("ecoloop:profile", { detail: { profile: p, unlocked, points } }));
}
