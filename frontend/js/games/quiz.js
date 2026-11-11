// ECO QUIZ — 22 questions, a random set of 10, explanation after each answer.
import { recordGame } from "../store.js";

export const QUESTIONS = [
  { q: "Which bin should a clean PET water bottle go into?", a: ["Plastic", "Paper", "Glass", "Organic"], c: 0, e: "PET (#1) bottles are one of the most widely recycled plastics. Empty them and put the cap back on if your local rules allow." },
  { q: "Roughly what share of all plastic waste worldwide is recycled?", a: ["About 9%", "About 35%", "About 60%", "About 85%"], c: 0, e: "According to the OECD Global Plastics Outlook (2022), only about 9% of plastic waste is recycled; most is landfilled, incinerated or leaked." },
  { q: "Why should a greasy pizza box often NOT go in paper recycling?", a: ["Oil contaminates paper fibres", "Cardboard is not recyclable", "It is too heavy", "Boxes melt in recycling"], c: 0, e: "Grease and food soak into fibres and cannot be separated in the pulping process. Clean parts of the box can be torn off and recycled." },
  { q: "How many times can paper fibres typically be recycled?", a: ["5–7 times", "Once", "Infinitely", "100 times"], c: 0, e: "Each cycle shortens the fibres; after about 5–7 rounds they are too short to bind into new paper." },
  { q: "What does the number inside the recycling triangle on plastics mean?", a: ["Resin (plastic) type", "How many times it was recycled", "Recycling year", "Bin number"], c: 0, e: "The Resin Identification Code (1–7) tells the type of polymer, e.g. 1 = PET, 2 = HDPE, 5 = PP. It does not guarantee recyclability." },
  { q: "Which of these is a paper product that IS usually recyclable?", a: ["Newspaper", "Used paper towel", "Wax-coated paper cup", "Receipt (thermal paper)"], c: 0, e: "Newspaper is ideal for recycling. Tissues are contaminated, wax/plastic-lined cups need special facilities, thermal receipts contain chemicals like BPA/BPS." },
  { q: "What is 'wish-cycling'?", a: ["Putting non-recyclables in the recycling bin hoping they get recycled", "Recycling only on holidays", "Buying recycled products", "Composting paper"], c: 0, e: "Wish-cycling contaminates recycling streams and can cause whole loads to be rejected — exactly the problem ECOLOOP tries to reduce." },
  { q: "How long can a plastic bottle take to decompose in nature?", a: ["Around 450 years", "About 1 year", "About 10 years", "About 50 days"], c: 0, e: "Estimates are commonly around 450 years; plastics fragment into microplastics rather than truly disappearing." },
  { q: "Recycling one tonne of paper saves roughly how many trees?", a: ["About 17", "About 1", "About 200", "None"], c: 0, e: "A frequently cited estimate is about 17 mature trees per tonne of recycled paper, plus large savings of water and energy." },
  { q: "What are microplastics?", a: ["Plastic pieces smaller than 5 mm", "Plastic for microchips", "Biodegradable plastic", "Very thin bags only"], c: 0, e: "Microplastics are fragments under 5 mm, from broken-down litter, synthetic fibres or microbeads. They are found in oceans, soil and even food." },
  { q: "Which plastic item is hardest to recycle in most curbside programmes?", a: ["Thin plastic bags / film", "PET bottles", "HDPE milk jugs", "Rigid PP tubs"], c: 0, e: "Film and bags tangle sorting machines; many cities ask to return them to store drop-off points instead." },
  { q: "What should you do with a plastic bottle before recycling it?", a: ["Empty it (and ideally rinse)", "Fill it with water", "Burn it", "Wrap it in paper"], c: 0, e: "Leftover liquid and food add contamination and weight. Empty and quickly rinse." },
  { q: "Shredded paper is problematic for recycling because…", a: ["Short pieces fall through sorting screens", "It is toxic", "It is always plastic-coated", "It is too clean"], c: 0, e: "Small shreds slip through machinery and reduce fibre quality — many programmes ask to bag it separately or compost it." },
  { q: "Which is the best order of the waste hierarchy?", a: ["Reduce → Reuse → Recycle", "Recycle → Reuse → Reduce", "Reuse → Recycle → Reduce", "Landfill → Recycle → Reduce"], c: 0, e: "Avoiding waste is best, reusing comes next, recycling is the third option; disposal is the last resort." },
  { q: "A Tetra Pak-style drink carton is made of…", a: ["Paper, plastic and aluminium layers", "Only paper", "Only plastic", "Glass"], c: 0, e: "Cartons are multi-layer packaging; they need special facilities to separate the layers, so local rules vary." },
  { q: "Which gas is released when paper rots in a landfill without oxygen?", a: ["Methane", "Oxygen", "Helium", "Nitrogen"], c: 0, e: "Anaerobic decomposition produces methane, a greenhouse gas many times stronger than CO₂ — another reason to recycle paper." },
  { q: "Recycling aluminium saves about how much energy versus making new metal?", a: ["About 95%", "About 5%", "About 30%", "No energy"], c: 0, e: "Aluminium recycling needs ~5% of the energy of primary production, making cans one of the most valuable recyclables." },
  { q: "How does ECOLOOP's Bayes step help the image classifier?", a: ["Combines prior knowledge with the CNN evidence", "Makes the photo sharper", "Chooses the robot route", "Trains the CNN"], c: 0, e: "Bayes' theorem multiplies the prior by the likelihood of the evidence and normalises — producing a calibrated posterior probability." },
  { q: "In ECOLOOP, what does the MDP do when confidence is low?", a: ["Chooses Inspect Again", "Always sorts as plastic", "Stops the program", "Deletes the photo"], c: 0, e: "A wrong sort costs −10, another look costs only −1. With low confidence the expected value of inspecting again is higher." },
  { q: "What heuristic does ECOLOOP's A* use on the grid?", a: ["Manhattan distance", "Random guess", "Number of obstacles", "Euclidean squared"], c: 0, e: "With 4-directional moves, Manhattan distance |Δx|+|Δy| never overestimates the real cost, so A* finds an optimal path." },
  { q: "Which item belongs in PAPER recycling?", a: ["Flattened cardboard box", "Yoghurt cup", "Plastic straw", "Chip bag"], c: 0, e: "Clean, flattened cardboard is excellent paper recycling material. Flattening saves space in bins and trucks." },
  { q: "Why are black plastic trays often not recycled?", a: ["Optical sorters cannot detect the black pigment", "They are made of paper", "They are too light", "They are radioactive"], c: 0, e: "Carbon-black pigment absorbs the near-infrared light that sorting machines use to identify plastic types." },
];

const LETTERS = ["A", "B", "C", "D"];
let S;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(root) {
  S = { root };
  root.innerHTML = `
  <div class="game-stage">
    <div class="card" id="qz-card"></div>
    <div class="hud">
      <div class="kpi"><span>Question</span><b id="qz-n">–</b></div>
      <div class="kpi"><span>Correct</span><b id="qz-ok">0</b></div>
      <div class="card" style="padding:18px;font-size:.9rem"><b>Rules</b><p class="muted" style="margin:6px 0 0">10 random questions out of ${QUESTIONS.length}. Each correct answer gives <b>+15</b> points, a perfect 10/10 gives a <b>+50</b> bonus.</p></div>
    </div>
  </div>`;
  intro();
}
export function unmount() {}

function intro() {
  S.root.querySelector("#qz-card").innerHTML = `<div class="overlay-card"><div class="icon-tile" data-icon="quiz" style="margin:0 auto 16px">${""}</div>
    <h3 style="font-size:1.8rem">Eco Quiz</h3><p class="muted">Ecology, recycling, plastic, paper — and the AI inside ECOLOOP.</p>
    <button class="btn" id="qz-start">Start quiz</button></div>`;
  S.root.querySelector("#qz-card .icon-tile").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>';
  S.root.querySelector("#qz-start").addEventListener("click", start);
}

function start() {
  S.set = shuffle([...QUESTIONS]).slice(0, 10).map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    return { q: q.q, e: q.e, a: order.map((i) => q.a[i]), c: order.indexOf(q.c) };
  });
  S.i = 0; S.ok = 0; S.marks = [];
  show();
}

function show() {
  const item = S.set[S.i];
  S.root.querySelector("#qz-n").textContent = `${S.i + 1}/10`;
  S.root.querySelector("#qz-ok").textContent = S.ok;
  const card = S.root.querySelector("#qz-card");
  card.innerHTML = `
    <div class="progress-dots" aria-hidden="true">${S.set.map((_, k) => `<i class="${k < S.i ? (S.marks[k] ? "ok" : "bad") : k === S.i ? "cur" : ""}"></i>`).join("")}</div>
    <div class="quiz-q" id="qz-q">${item.q}</div>
    <div class="quiz-opts" role="group" aria-labelledby="qz-q">${item.a.map((t, k) => `<button class="quiz-opt" data-k="${k}"><span class="l">${LETTERS[k]}</span>${t}</button>`).join("")}</div>
    <div id="qz-exp" style="margin-top:18px" aria-live="polite"></div>`;
  card.querySelectorAll(".quiz-opt").forEach((b) => b.addEventListener("click", () => answer(+b.dataset.k)));
  card.querySelector(".quiz-opt").focus({ preventScroll: true });
}

function answer(k) {
  const item = S.set[S.i];
  const right = k === item.c;
  S.marks[S.i] = right;
  if (right) S.ok++;
  const card = S.root.querySelector("#qz-card");
  card.querySelectorAll(".quiz-opt").forEach((b, idx) => {
    b.disabled = true;
    if (idx === item.c) b.classList.add("correct");
    else if (idx === k) b.classList.add("wrong");
  });
  S.root.querySelector("#qz-ok").textContent = S.ok;
  const last = S.i === S.set.length - 1;
  card.querySelector("#qz-exp").innerHTML = `<div class="alert ${right ? "info" : ""}"><span><b>${right ? "Correct!" : "Not quite."}</b> ${item.e}</span></div>
    <div class="toolbar" style="margin-top:14px"><button class="btn" id="qz-next">${last ? "See result" : "Next question"}</button></div>`;
  const next = card.querySelector("#qz-next");
  next.addEventListener("click", () => { if (last) finish(); else { S.i++; show(); } });
  next.focus({ preventScroll: true });
}

function finish() {
  const points = S.ok * 15 + (S.ok === 10 ? 50 : 0);
  recordGame("quiz", { score: S.ok, points, correct: S.ok, detail: `${S.ok}/10 correct` });
  const msg = S.ok === 10 ? "Perfect! You are an Eco Scholar." : S.ok >= 7 ? "Great job — you really know your recycling." : S.ok >= 4 ? "Good start — read the explanations and try again." : "Keep learning — every right answer helps the planet.";
  S.root.querySelector("#qz-card").innerHTML = `<div class="overlay-card">
    <div class="muted" style="font-weight:700">Your result</div>
    <div class="big grad-text">${S.ok} / 10</div>
    <p>${msg}</p><p class="muted">+${points} eco points saved to your profile.</p>
    <div class="progress-dots" style="justify-content:center">${S.marks.map((m) => `<i class="${m ? "ok" : "bad"}"></i>`).join("")}</div>
    <button class="btn" id="qz-again">Play again</button></div>`;
  S.root.querySelector("#qz-again").addEventListener("click", start);
}
