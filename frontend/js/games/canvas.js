// Shared helpers for canvas games: fixed logical resolution, crisp on HiDPI, pointer mapping.
export function setupCanvas(canvas, W, H) {
  const ctx = canvas.getContext("2d");
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || W;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round((cssW * H / W) * dpr);
    canvas.style.height = (cssW * H) / W + "px";
    const k = (cssW * dpr) / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
  };
  fit();
  window.addEventListener("resize", fit);
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  return { ctx, toLocal, dispose: () => window.removeEventListener("resize", fit) };
}

export function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// Waste item sprites (vector, offline)
export function drawItem(c, kind, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  switch (kind) {
    case "bottle":
      c.fillStyle = "#56A0FF"; roundRect(c, -11, -18, 22, 40, 8); c.fill();
      c.fillRect(-6, -28, 12, 12); c.fillStyle = "#E5484D"; c.fillRect(-7, -33, 14, 7);
      c.fillStyle = "rgba(255,255,255,.75)"; c.fillRect(-7, -12, 4, 26); break;
    case "cup":
      c.fillStyle = "#E5484D"; c.beginPath(); c.moveTo(-14, -18); c.lineTo(14, -18); c.lineTo(9, 20); c.lineTo(-9, 20); c.closePath(); c.fill();
      c.fillStyle = "#fff"; c.fillRect(-16, -21, 32, 4); c.fillStyle = "rgba(255,255,255,.6)"; c.fillRect(-9, -12, 3, 22); break;
    case "container":
      c.fillStyle = "#F5C518"; roundRect(c, -18, -12, 36, 26, 6); c.fill();
      c.fillStyle = "#FFE27A"; roundRect(c, -20, -17, 40, 7, 3); c.fill(); break;
    case "bag":
      c.fillStyle = "#9AE6B4"; c.beginPath(); c.moveTo(-15, -8); c.lineTo(15, -8); c.lineTo(18, 20); c.lineTo(-18, 20); c.closePath(); c.fill();
      c.strokeStyle = "#9AE6B4"; c.lineWidth = 3; c.beginPath(); c.arc(-6, -10, 6, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(6, -10, 6, Math.PI, 0); c.stroke(); break;
    case "newspaper":
      c.fillStyle = "#ECEBE6"; c.fillRect(-18, -22, 36, 44); c.fillStyle = "#555"; c.fillRect(-14, -18, 28, 5);
      c.fillStyle = "#999"; for (let i = 0; i < 6; i++) { c.fillRect(-14, -9 + i * 5, 12, 2); c.fillRect(2, -9 + i * 5, 12, 2); } break;
    case "box":
      c.fillStyle = "#B5895A"; c.fillRect(-18, -14, 36, 30); c.fillStyle = "#C49A6C"; c.beginPath(); c.moveTo(-18, -14); c.lineTo(-10, -22); c.lineTo(24, -22); c.lineTo(18, -14); c.fill();
      c.fillStyle = "#8A6236"; c.fillRect(-3, -14, 6, 30); break;
    case "paperball":
      c.fillStyle = "#F4F1EA"; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
      c.strokeStyle = "#BDB8AC"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-10, -4); c.lineTo(-2, 2); c.lineTo(8, -6); c.moveTo(-6, 8); c.lineTo(4, 4); c.lineTo(10, 9); c.stroke(); break;
    case "carton":
      c.fillStyle = "#2F80ED"; c.fillRect(-12, -10, 24, 32); c.fillStyle = "#E8F1FF"; c.beginPath(); c.moveTo(-12, -10); c.lineTo(0, -22); c.lineTo(12, -10); c.fill();
      c.fillStyle = "#fff"; c.fillRect(-8, 0, 16, 10); break;
  }
  c.restore();
}

export const ITEMS = {
  plastic: [["bottle", "PET bottle"], ["cup", "Plastic cup"], ["container", "Food tub"], ["bag", "Plastic bag"]],
  paper: [["newspaper", "Newspaper"], ["box", "Cardboard box"], ["paperball", "Paper sheet"], ["carton", "Paper bag"]],
};

export function drawBin(c, x, y, w, h, color, label, glow = 0) {
  if (glow) { c.fillStyle = `rgba(32,184,121,${0.35 * glow})`; roundRect(c, x - 10, y - 14, w + 20, h + 24, 18); c.fill(); }
  c.fillStyle = color;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w * 0.88, y + h); c.lineTo(x + w * 0.12, y + h); c.closePath(); c.fill();
  c.fillStyle = "rgba(0,0,0,.15)"; c.fillRect(x + w * 0.1, y + 4, w * 0.8, 6);
  c.fillStyle = "#071D2B"; c.font = `800 ${Math.max(11, w * 0.13)}px Sora, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(label, x + w / 2, y + h * 0.55);
}
