// =============================================================================
// YTSTÖD — gemensamma byggstenar för B4-ytorna i 3KHV-dragningen
// =============================================================================
//
// Används av faktasteg.js, landning.js, lage.js, bostadsytor.js och
// brpspridning.js. Samma formspråk som banor.js och kontroller.js: Inter för
// text, IBM Plex Mono för tal, temats bläckskala, de fem i fasta färger.
//
//   ram({ temaNamn, width, height, klass, stil })  → { rot, T, ink, farg, botten, tonad }
//     rotnod med font-size/line-height satta (Revealduken har 40 px grundgrad)
//     och modulens stil injicerad en gång (stil: css-text, .klass-prefix)
//   tipsruta(rot, ink, botten) → { visa(html, ev), visaVid(html, x, y), dolj() }
//   fragmentsteg(rot, antal, vidSteg, { steg })
//     osynliga Reveal-fragment på bilden (samma mönster som kontroller.flikar):
//     vidSteg(n) anropas med antalet visade fragment 0..antal. Utan Reveal, i
//     utskriftsläget eller med steg = false visas allt direkt (n = antal).
//     Rev 1: bilden får automatiskt kontroller.stegmarkor() ("Steg 2 av 3" + prickar
//     uppe till höger). Användarna behöver inte göra något.
//   stegmarkor(nod) — återexporterad från kontroller.js
//   f — svenska talformat (mellanslag som tusentalsavgränsare, − som minus)
//   el(tagg, attr, html)
// =============================================================================

import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { STADER } from "./jamforelse.js";
import { BANFARGER } from "./banor.js";
import { stegmarkor } from "./kontroller.js";
export { stegmarkor };

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const SANS = "Inter, system-ui, sans-serif";
export const RIKET = "0000";
export { STADER };
export const STADKODER = STADER.map(s => s.kod);
export const STADNAMN = Object.fromEntries(STADER.map(s => [s.kod, s.namn]));

export function fargerFor(T) {
  const f = T.mork ? BANFARGER.mork : BANFARGER.ljus;
  return Object.fromEntries(STADER.map((s, i) => [s.kod, f[i]]));
}

const t0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const t1 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const t2 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tkn = (v, s) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s}`;
export const f = {
  tal: v => (v == null || !Number.isFinite(v) ? "–" : t0.format(v)),
  dec1: v => (v == null || !Number.isFinite(v) ? "–" : t1.format(v)),
  dec2: v => (v == null || !Number.isFinite(v) ? "–" : t2.format(v)),
  pct: v => (v == null || !Number.isFinite(v) ? "–" : `${t0.format(v)} %`),
  pct1: v => (v == null || !Number.isFinite(v) ? "–" : `${t1.format(v)} %`),
  plus: v => tkn(Math.round(v), t0.format(Math.abs(Math.round(v)))),
  plusPct: v => `${tkn(Math.round(v), t0.format(Math.abs(Math.round(v))))} %`,
  plusPct1: v => `${tkn(Math.round(v * 10) / 10, t1.format(Math.abs(v)))} %`,
  // Tal i tusental med ett ord: 1 420 000 → "1,42 milj."
  kort: v => (v >= 1e6 ? `${t2.format(v / 1e6)} milj.` : t0.format(v))
};

export function el(tagg, attr = {}, html = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) if (v != null && v !== false) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  return e;
}

export function svgEl(tagg, attr = {}, text = null) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tagg);
  for (const [k, v] of Object.entries(attr)) if (v != null) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

// Reveal skalar duken med transform — räkna om skärm-px till duk-px
export function skala(nod) {
  const r = nod.getBoundingClientRect();
  return r.width / (nod.offsetWidth || r.width) || 1;
}

const injicerade = new Set();
export function ram({ temaNamn = aktivtTema(), width = 960, height = 540, klass, stil = "" } = {}) {
  const T = hamtaTema(temaNamn), ink = T.ink;
  const farg = fargerFor(T);
  const botten = T.mork ? "#16211D" : "#FFFFFF";
  const tonad = T.mork ? "rgba(255,255,255,.05)" : "rgba(10,20,15,.035)";
  if (stil && typeof document !== "undefined" && !injicerade.has(klass)) {
    injicerade.add(klass);
    const s = document.createElement("style");
    s.id = `ys-${klass}`;
    s.textContent = stil;
    document.head.appendChild(s);
  }
  const rot = el("div", { class: `ys-rot ${klass}` });
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  rot.style.setProperty("--ink", ink.stark);
  rot.style.setProperty("--ink-mjuk", ink.mjuk);
  rot.style.setProperty("--ink-svag", ink.svag);
  rot.style.setProperty("--ink-linje", ink.linje);
  rot.style.setProperty("--ink-rutnat", ink.rutnat);
  rot.style.setProperty("--botten", botten);
  rot.style.setProperty("--tonad", tonad);
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", height: height ? `${height}px` : null, position: "relative",
    color: ink.stark, fontFamily: SANS, fontSize: "12px", lineHeight: "1.35", textAlign: "left",
    boxSizing: "border-box"
  });
  return { rot, T, ink, farg, botten, tonad };
}

// Tipsruta i rotnodens koordinater
const TIPS_STIL = `
.ys-tips { position:absolute; left:0; top:0; pointer-events:none; opacity:0; transition:opacity .1s; background:var(--botten); border:1px solid var(--ink-rutnat); box-shadow:0 10px 28px -14px rgba(0,0,0,.4); border-radius:6px; padding:7px 10px; color:var(--ink); white-space:nowrap; z-index:20; font:11.5px/1.45 ${SANS}; }
.ys-tips b { font-weight:600; }
.ys-tips .m { font-family:${MONO}; font-variant-numeric:tabular-nums; }
.ys-tips .s { color:var(--ink-svag); font-size:10.5px; }
.ys-tips i.p { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:0; }
`;
export function tipsruta(rot) {
  if (!document.getElementById("ys-tipsstil")) {
    const s = document.createElement("style"); s.id = "ys-tipsstil"; s.textContent = TIPS_STIL; document.head.appendChild(s);
  }
  const tips = el("div", { class: "ys-tips" });
  rot.appendChild(tips);
  function placera(px, py) {
    const tw = tips.offsetWidth || 160, th = tips.offsetHeight || 50, W = rot.offsetWidth;
    const lx = px + 14 + tw > W ? px - 14 - tw : px + 14;
    const ly = py - th - 10 < 0 ? py + 14 : py - th - 10;
    tips.style.transform = `translate(${Math.max(0, lx)}px, ${Math.max(0, ly)}px)`;
    tips.style.opacity = 1;
  }
  return {
    // ev: muspekarhändelse
    visa(html, ev) {
      tips.innerHTML = html;
      const r = rot.getBoundingClientRect(), s = skala(rot);
      placera((ev.clientX - r.left) / s, (ev.clientY - r.top) / s);
    },
    // nod + x/y i nodens egna (oskalade) px
    visaVid(html, nod, x, y) {
      tips.innerHTML = html;
      const r = rot.getBoundingClientRect(), n = nod.getBoundingClientRect(), s = skala(rot);
      placera((n.left - r.left) / s + x, (n.top - r.top) / s + y);
    },
    dolj() { tips.style.opacity = 0; }
  };
}

// Osynliga Reveal-fragment som driver stegen i en bild
export function fragmentsteg(rot, antal, vidSteg, { steg = true } = {}) {
  const Rv = () => (typeof window !== "undefined" ? window.Reveal : null);
  const utskrift = () => typeof location !== "undefined" && (/print-pdf|view=print/i.test(location.search) || !!Rv()?.isPrintView?.());
  let nu = -1;
  const satt = n => { if (n === nu) return; nu = n; vidSteg(n); };
  if (!steg || antal < 1 || !Rv()?.on || utskrift()) { satt(antal); return { satt }; }
  satt(0);
  let spann = [];
  const iBild = () => { const s = Rv()?.getCurrentSlide?.(); return !!s && s.contains(rot); };
  function koppla() {
    const R = Rv();
    if (spann.length) return;
    spann = Array.from({ length: antal }, (_, i) => {
      const s = el("span", { class: "fragment ys-steg", "data-fragment-index": i, "aria-hidden": "true", style: "display:none" });
      rot.appendChild(s);
      return s;
    });
    const las = () => {
      if (!rot.isConnected) { R.off("fragmentshown", las); R.off("fragmenthidden", las); R.off("slidechanged", las); return; }
      satt(spann.filter(s => s.classList.contains("visible")).length);
    };
    R.on("fragmentshown", las); R.on("fragmenthidden", las); R.on("slidechanged", las);
    if (iBild()) R.syncFragments?.();
    las();
    stegmarkor(rot);
  }
  const forsok = (n = 0) => { if (rot.isConnected) koppla(); else if (n < 80) setTimeout(() => forsok(n + 1), 60); };
  setTimeout(() => forsok(), 0);
  return { satt };
}

// Rangtal med kolon-ändelse på svenska: 1:a, 2:a, 3:e …
export function ordning(n) {
  if (n == null) return "–";
  const s = n % 100;
  return `${n}:${(s === 11 || s === 12) ? "e" : (n % 10 === 1 || n % 10 === 2) ? "a" : "e"}`;
}
