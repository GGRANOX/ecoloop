// Inline SVG icon set (stroke icons, currentColor) — works offline.
const s = (body, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  logo: `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#087E8B"/><stop offset="1" stop-color="#20B879"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#lg)"/><path d="M13 25c0-7 5-12 15-12-1 9-5 14-11 14-2 0-3-.5-4-2z" fill="#F0FAF5"/><path d="M13 27c3-4 6-7 10-9" stroke="#087E8B" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  leaf: s('<path d="M11 20A7 7 0 0 1 4 13c0-6 5-10 16-10 0 11-4 17-9 17z"/><path d="M4 21c3-5 7-9 12-12"/>'),
  recycle: s('<path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L6.6 10"/><path d="M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2"/><path d="m14 16-3 3 3 3"/><path d="M8.3 13.4 6.6 10 3.2 11.7"/><path d="m9.3 5.6 1.1-1.8a1.8 1.8 0 0 1 3.1 0l3.9 6.6"/><path d="m13.4 9.4 3.5 1 1-3.5"/>'),
  camera: s('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>'),
  upload: s('<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  brain: s('<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/>'),
  route: s('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
  sigma: s('<path d="M18 7V4H6l6 8-6 8h12v-3"/>'),
  network: s('<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7 7.5l3.5 8.5M17 7.5 13.5 16M7.5 6h9"/>'),
  game: s('<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/>'),
  trophy: s('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>'),
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  info: s('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  alert: s('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  play: s('<path d="m6 3 14 9-14 9V3z"/>'),
  reset: s('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  sparkle: s('<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>'),
  target: s('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  bottle: s('<path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3V2z"/><path d="M8 12h8"/>'),
  paper: s('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>'),
  quiz: s('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
  grid: s('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  globe: s('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
  bolt: s('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
  shield: s('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  star: s('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  fire: s('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.4 1.3 2.6 2.5 2.8z"/>'),
};

// Recycling bins drawn inline (used on sorting result + games)
export function binSVG(color, label) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 18h36l-4 40H18z" fill="${color}"/><rect x="10" y="12" width="44" height="8" rx="3" fill="${color}" opacity=".85"/><rect x="26" y="7" width="12" height="6" rx="2" fill="${color}" opacity=".7"/><path d="M24 28v22M32 28v22M40 28v22" stroke="rgba(0,0,0,.18)" stroke-width="3" stroke-linecap="round"/><text x="32" y="44" text-anchor="middle" font-size="7" font-weight="800" fill="#071D2B" font-family="Sora,sans-serif">${label}</text></svg>`;
}
