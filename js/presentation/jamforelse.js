// =============================================================================
// JÄMFÖRELSE — presentationsgrafer för 3KHV-dragningen (bild 3–11)
// =============================================================================
//
// Samma formspråk som banor.js: temats bläckskala, IBM Plex Mono för siffror,
// tooltips i en ruta, och de fem kommunerna i fasta färger genom hela dragningen.
// Varje funktion är graf(data, opts) → DOM-nod.
//
//   spar(rader, opts)         spårdiagram i banbildens formspråk: alla kommuner
//                             som punkter, de fem med spår år för år, kvadratisk
//                             yta och panel med tid och värden (utan tid: vanligt
//                             spridningsdiagram)
//   radmoln(rader, opts)      en rad per kategori: alla kommuner som prickar,
//                             de fem kommunerna i färg, riket som streck
//   svarm(rader, opts)        bisvärm per rad (t.ex. tätorter per län), en punkt
//                             per enhet, yta efter storlek
//   rangordning(rader, opts)  många enheter sorterade, ring = start, prick = nu
//   bredvid(noder)            grafer sida vid sida
//   staplar(rader, opts)      delar som staplas åt höger (+) och vänster (−)
//   linjer(rader, opts)       linjer, eller små multiplar med `facet`
//   profilmatris(rader, opts) mått × städer, placering bland alla kommuner
//   stegvis(steg, opts)       flera grafer i en bild — varje steg är ett
//                             Reveal-fragment, så → bläddrar
//
// Data byggs av presentationer/dragning_3khv/bearbeta/bearbeta-presentation.R.
// =============================================================================

import { d3 } from "../lib/d3.js";
import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { BANFARGER } from "./banor.js";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

// De fem städerna i fast ordning och färg — samma i alla bilder
export const STADER = [
  { kod: "1380", namn: "Halmstad", lan: "0013" },
  { kod: "0880", namn: "Kalmar", lan: "0008" },
  { kod: "1080", namn: "Karlskrona", lan: "0010" },
  { kod: "1290", namn: "Kristianstad", lan: "0012" },
  { kod: "0780", namn: "Växjö", lan: "0007" }
];
export const STADKODER = STADER.map(s => s.kod);
const LAN_TILL_STAD = Object.fromEntries(STADER.map(s => [s.lan, s.kod]));
export const stadForLan = lan => LAN_TILL_STAD[lan] ?? null;

const tal = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tecken = (v, f = dec1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${f.format(Math.abs(v))}`;
export const fmt = {
  tal: v => tal.format(v),
  pct: v => `${dec1.format(v)} %`,
  pct0: v => `${tal.format(v)} %`,
  dpct: v => `${tecken(v)} %`,
  dpe: v => `${tecken(v)} p.e.`,
  dec1: v => dec1.format(v),
  dec2: v => dec2.format(v),
  d1: v => tecken(v)
};

// ── Gemensam ram ──────────────────────────────────────────────────────────
let raknare = 0;

// De fem städernas färger i ett tema — samma som i alla grafer och kartor
export function stadFarger(temaNamn = aktivtTema()) {
  const farger = hamtaTema(temaNamn).mork ? BANFARGER.mork : BANFARGER.ljus;
  return Object.fromEntries(STADER.map((s, i) => [s.kod, farger[i]]));
}

// kompakt: inget huvud alls (varken titel, undertitel eller legend) — ytan går till grafen
function ram(temaNamn, width, height, { titel = null, undertitel = null, kalla = null, legend = true, kompakt = false } = {}) {
  const T = hamtaTema(temaNamn), ink = T.ink;
  const farg = stadFarger(temaNamn);
  const botten = T.mork ? "#16211D" : "#FFFFFF";
  const tonad = T.mork ? "rgba(255,255,255,.05)" : "rgba(10,20,15,.04)";
  const k_ = `jf-${++raknare}-${Math.random().toString(36).slice(2, 6)}`;
  const rot = document.createElement("div");
  rot.className = `graf-container jf ${k_}`;
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", position: "relative", background: "var(--graf-bakgrund)",
    color: ink.stark, fontFamily: "var(--graf-text-font)", fontSize: "12px", lineHeight: "1.35",
    textAlign: "left", boxSizing: "border-box"
  });
  const stil = document.createElement("style");
  stil.textContent = `
    .${k_} .jf-huvud { display:flex; align-items:baseline; gap:14px; min-height:22px; margin:0 0 4px; }
    .${k_} .jf-titel { font-size:14px; color:${ink.mjuk}; white-space:nowrap; }
    .${k_} .jf-under { font-size:12px; color:${ink.svag}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
    .${k_} .jf-legend { display:flex; gap:12px; font-size:11.5px; color:${ink.mjuk}; white-space:nowrap; }
    .${k_} .jf-legend i { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:5px; vertical-align:-0.5px; }
    .${k_} .jf-kalla { font-size:10.5px; line-height:1.45; color:${ink.svag}; margin-top:4px; }
    .${k_} .jf-tips { position:absolute; left:0; top:0; pointer-events:none; opacity:0; transition:opacity .1s; background:${botten}; border:1px solid ${ink.rutnat}; box-shadow:0 10px 28px -14px rgba(0,0,0,.4); border-radius:6px; padding:8px 10px; color:${ink.stark}; white-space:nowrap; z-index:10; font-size:11.5px; }
    .${k_} .jf-tips b { font-weight:600; }
    .${k_} .jf-tips .m { font-family:${MONO}; }
    .${k_} .jf-tips .s { color:${ink.svag}; font-size:10.5px; }
  `;
  rot.appendChild(stil);
  if (!kompakt) {
    const huvud = el("div", { class: "jf-huvud" });
    if (titel) huvud.appendChild(el("span", { class: "jf-titel" }, titel));
    huvud.appendChild(el("span", { class: "jf-under" }, undertitel ?? ""));
    if (legend) {
      const lg = el("span", { class: "jf-legend" });
      for (const s of STADER) { const sp = el("span"); sp.append(el("i", { style: `background:${farg[s.kod]}` }), document.createTextNode(s.namn)); lg.appendChild(sp); }
      huvud.appendChild(lg);
    }
    rot.appendChild(huvud);
  }
  const kallaH = kalla ? 32 : 0;
  const H = height - (kompakt ? 0 : 26) - kallaH;
  const svgNod = d3.create("svg").attr("viewBox", `0 0 ${width} ${H}`).attr("width", "100%").style("display", "block")
    .style("overflow", "visible").style("font-family", "var(--graf-text-font)");
  rot.appendChild(svgNod.node());
  if (kalla) rot.appendChild(el("div", { class: "jf-kalla" }, kalla));
  const tips = el("div", { class: "jf-tips" });
  rot.appendChild(tips);
  // Tips vid en punkt i SVG-koordinater (Reveal skalar bilden — räkna om)
  function visaTips(html, gx, gy) {
    tips.innerHTML = html;
    const rr = rot.getBoundingClientRect(), s = svgNod.node().getBoundingClientRect();
    const sk = rr.width / rot.offsetWidth || 1, svs = s.width / width;
    const px = ((s.left - rr.left) + gx * svs) / sk, py = ((s.top - rr.top) + gy * svs) / sk;
    const tw = tips.offsetWidth || 180, th = tips.offsetHeight || 60;
    const lx = px + 14 + tw > rot.offsetWidth ? px - 14 - tw : px + 14;
    const ly = py - th - 10 < 0 ? py + 12 : py - th - 10;
    tips.style.transform = `translate(${Math.max(0, lx)}px, ${Math.max(0, ly)}px)`;
    tips.style.opacity = 1;
  }
  const doljTips = () => { tips.style.opacity = 0; };
  const mono = sel => sel.attr("font-family", MONO).attr("font-size", 10.5).attr("fill", ink.svag);
  return { rot, T, ink, farg, botten, tonad, svg: svgNod, W: width, H, visaTips, doljTips, mono, k_ };
}

function el(tagg, attr = {}, text = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

// Etiketter som inte får krocka i höjdled: sortera och tryck isär
function sprid(poster, avst, lo, hi) {
  const p = [...poster].sort((a, b) => a.y - b.y);
  for (let i = 1; i < p.length; i++) p[i].y = Math.max(p[i].y, p[i - 1].y + avst);
  if (p.length && p[p.length - 1].y > hi) {
    p[p.length - 1].y = hi;
    for (let i = p.length - 2; i >= 0; i--) p[i].y = Math.min(p[i].y, p[i + 1].y - avst);
  }
  for (const q of p) q.y = Math.max(lo, q.y);
  return p;
}

// Närmaste punkt inom r pixlar (för hovring utan att varje prick behöver lyssna)
function narmast(punkter, mx, my, r = 14) {
  let bast = null, av = r;
  for (const p of punkter) { const s = Math.hypot(p.px - mx, p.py - my); if (s < av) { av = s; bast = p; } }
  return bast;
}

// Rutnät och tickvärden. På logaritmiska axlar ger formatet tom text för
// mellanstegen, så att bara 1-2-5-stegen får siffror.
function axel(G, sk, { lodrat = false, ticks = 5, format = v => tal.format(v), ink, mono, langd }) {
  for (const t of sk.ticks(ticks)) {
    const p = Math.round(sk(t)) + 0.5;
    if (lodrat) {
      G.append("line").attr("x1", 0).attr("x2", langd).attr("y1", p).attr("y2", p).attr("stroke", ink.rutnat).attr("shape-rendering", "crispEdges");
      mono(G.append("text").attr("x", -7).attr("y", p).attr("dy", "0.34em").attr("text-anchor", "end")).text(format(t));
    } else {
      G.append("line").attr("y1", 0).attr("y2", langd).attr("x1", p).attr("x2", p).attr("stroke", ink.rutnat).attr("shape-rendering", "crispEdges");
      mono(G.append("text").attr("y", langd + 15).attr("x", p).attr("text-anchor", "middle")).text(format(t));
    }
  }
}

// ═══ spar ═════════════════════════════════════════════════════════════════
// Spårdiagram i banbildens formspråk: alla kommuner som grå punkter ett visst
// år, de fem kommunerna med sitt spår från startåret (en prick per år, spets
// vid året som visas). Diagramytan är kvadratisk, och med lika = true har båda
// axlarna samma skala — då betyder diagonalen något. Utan `tid` blir det ett
// vanligt spridningsdiagram med ett värde per enhet.
// Till höger en panel: år, ▶ och reglage, och de fem kommunernas värden.
export function spar(rader, {
  temaNamn = aktivtTema(), width = 1010, height = 480,
  x, y, tid = null, namn = "namn", kod = "kod", storlek = null,
  lika = true, domain = null,
  xFormat = fmt.pct0, yFormat = fmt.pct0, xLabel = "", yLabel = "",
  diagonal = null,                  // { etikett } — linjen y = x
  refY = null, refX = null,         // { varde, etikett } — referenslinjer
  etikettera = [],                  // fler koder som får grått namn
  panel = true, panelBredd = 360,
  kolumner = [],                    // [{ etikett, varde: (d, d0) => text }] — panelens tabell
  panelNot = null,                  // text under tabellen
  titel = null, undertitel = null, kalla = null, tips = null
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla, legend: false });
  const { svg, ink, farg, mono, rot } = R;
  const giltig = v => v != null && Number.isFinite(v);
  const data = rader.filter(d => giltig(d[x]) && giltig(d[y]));
  const AR = tid ? [...new Set(data.map(d => d[tid]))].sort((a, b) => a - b) : [null];
  const A0 = AR[0], A1 = AR[AR.length - 1];
  const perEnhet = d3.group(data, d => d[kod]);
  const vid = (k, a) => (tid ? perEnhet.get(k)?.find(d => d[tid] === a) : perEnhet.get(k)?.[0]) ?? null;
  // Kvadratisk yta
  const M = { top: 10, right: 18, bottom: 44, left: 58 };
  const sida = Math.min(R.H - M.top - M.bottom, (panel ? R.W - panelBredd - 40 : R.W) - M.left - M.right);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const ext = f => d3.extent(data, d => d[f]);
  const [xa, xb] = ext(x), [ya, yb] = ext(y);
  const omf = (a, b) => [Math.min(0, a), b + (b - Math.min(0, a)) * 0.03];
  const gem = domain ?? omf(Math.min(xa, ya), Math.max(xb, yb));
  const sx = d3.scaleLinear().domain(lika ? gem : omf(xa, xb)).nice().range([0, sida]);
  const sy = d3.scaleLinear().domain(lika ? sx.domain() : omf(ya, yb)).nice().range([sida, 0]);
  axel(g, sx, { ink, mono, langd: sida, format: xFormat, ticks: 6 });
  axel(g, sy, { lodrat: true, ink, mono, langd: sida, format: yFormat, ticks: 6 });
  g.append("line").attr("x1", 0).attr("x2", sida).attr("y1", sida + 0.5).attr("y2", sida + 0.5).attr("stroke", ink.mjuk).attr("stroke-opacity", 0.6);
  g.append("line").attr("x1", 0.5).attr("x2", 0.5).attr("y1", 0).attr("y2", sida).attr("stroke", ink.mjuk).attr("stroke-opacity", 0.6);
  g.append("text").attr("x", sida).attr("y", sida + 36).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(`${xLabel} →`);
  g.append("text").attr("transform", `translate(${-M.left + 12},0) rotate(-90)`).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(`${yLabel} →`);
  if (diagonal) {
    const [a, b] = [Math.max(sx.domain()[0], sy.domain()[0]), Math.min(sx.domain()[1], sy.domain()[1])];
    g.append("line").attr("x1", sx(a)).attr("y1", sy(a)).attr("x2", sx(b)).attr("y2", sy(b)).attr("stroke", ink.mjuk).attr("stroke-dasharray", "3 3").attr("stroke-opacity", 0.8);
    if (diagonal.etikett) {
      const t = a + (b - a) * 0.97, vinkel = Math.atan2(sy(b) - sy(a), sx(b) - sx(a)) * 180 / Math.PI;
      g.append("text").attr("transform", `translate(${sx(t)},${sy(t)}) rotate(${vinkel})`).attr("text-anchor", "end").attr("dy", "1.2em")
        .attr("font-size", 10.5).attr("fill", ink.mjuk).attr("paint-order", "stroke").attr("stroke", R.botten).attr("stroke-width", 3).text(diagonal.etikett);
    }
  }
  for (const [r, lodrat] of [[refX, true], [refY, false]]) {
    if (!r) continue;
    const p = lodrat ? sx(r.varde) : sy(r.varde);
    g.append("line").attr("x1", lodrat ? p : 0).attr("x2", lodrat ? p : sida).attr("y1", lodrat ? 0 : p).attr("y2", lodrat ? sida : p).attr("stroke", ink.mjuk).attr("stroke-opacity", 0.55);
    if (r.etikett) g.append("text").attr("x", lodrat ? p + 4 : sida - 4).attr("y", lodrat ? 12 : p - 5).attr("text-anchor", lodrat ? "start" : "end").attr("font-size", 10.5).attr("fill", ink.mjuk).text(r.etikett);
  }
  const rs = storlek ? d3.scaleSqrt().domain([0, d3.max(data, d => d[storlek])]).range([1.4, 13]) : () => 3;
  const gGra = g.append("g"), gHov = g.append("g"), gSpar = g.append("g"), gEt = g.append("g").attr("pointer-events", "none");
  const ovriga = [...perEnhet.keys()].filter(k => !STADKODER.includes(k));
  const fokus = STADER.map(s => s.kod).filter(k => perEnhet.has(k));
  const ln = d3.line().x(d => sx(d[x])).y(d => sy(d[y])).curve(d3.curveMonotoneX);
  const lnSpar = d3.line().x(d => sx(d[x])).y(d => sy(d[y])).curve(d3.curveCatmullRom.alpha(0.5));
  let ar = A1, punkter = [], hovK = null;

  // ── Panel: tid och tabell ──
  let arText = null, reglage = null, knapp = null, tabell = null;
  if (panel) {
    const p = el("div", { style: `position:absolute;top:26px;left:${M.left + sida + M.right + 34}px;right:0;display:flex;flex-direction:column;gap:10px` });
    if (tid) {
      const rad1 = el("div", { style: "display:flex;align-items:center;gap:10px" });
      knapp = el("button", { type: "button", title: "Spela", style: `border:1px solid ${ink.rutnat};background:transparent;color:${ink.stark};border-radius:999px;width:30px;height:30px;cursor:pointer;font-size:12px` }, "▶");
      arText = el("span", { style: `font-family:${MONO};font-size:24px;color:${ink.stark};min-width:64px` }, String(ar));
      reglage = el("input", { type: "range", min: A0, max: A1, step: 1, value: ar, style: `flex:1;accent-color:${ink.stark}` });
      rad1.append(knapp, arText, reglage);
      p.appendChild(rad1);
      p.appendChild(el("div", { style: `font-size:10.5px;color:${ink.svag};margin-top:-6px` }, `Spåret visar ${A0}–året som visas. ▶ spelar ${A0}–${A1}.`));
    }
    tabell = el("div", { style: `display:grid;grid-template-columns:minmax(0,1fr) repeat(${kolumner.length},auto);column-gap:14px;row-gap:5px;align-items:baseline;font-size:12px` });
    p.appendChild(tabell);
    if (panelNot) p.appendChild(el("div", { style: `font-size:11px;line-height:1.45;color:${ink.mjuk};margin-top:4px` }, panelNot));
    rot.appendChild(p);
  }
  function malaTabell() {
    if (!tabell) return;
    tabell.replaceChildren(el("span"), ...kolumner.map(c => el("span", { style: `font-size:10px;color:${ink.svag};text-align:right;white-space:nowrap` }, c.etikett)));
    for (const k of fokus) {
      const d = vid(k, ar), d0 = tid ? vid(k, A0) : null;
      const n = el("span", { style: `font-weight:600;color:${farg[k]};white-space:nowrap` });
      n.append(el("span", { style: `display:inline-block;width:8px;height:8px;border-radius:50%;background:${farg[k]};margin-right:6px` }), document.createTextNode((d ?? perEnhet.get(k)[0])[namn]));
      tabell.append(n, ...kolumner.map(c => el("span", { style: `font-family:${MONO};font-size:11.5px;text-align:right;white-space:nowrap;color:${ink.stark}` }, d ? c.varde(d, d0) : "–")));
    }
  }

  function rita() {
    punkter = [];
    // Grå punkter: alla övriga det året, stora först
    const gra = ovriga.map(k => vid(k, ar)).filter(Boolean).sort((a, b) => (storlek ? b[storlek] - a[storlek] : 0));
    gGra.selectAll("circle").data(gra, d => d[kod]).join("circle")
      .attr("cx", d => sx(d[x])).attr("cy", d => sy(d[y])).attr("r", d => rs(d[storlek] ?? 0))
      .attr("fill", ink.svag).attr("fill-opacity", d => (d[kod] === hovK ? 0.9 : 0.32)).attr("stroke", R.botten).attr("stroke-width", storlek ? 0.6 : 0);
    for (const d of gra) punkter.push({ d, px: sx(d[x]), py: sy(d[y]) });
    // Hovrad grå kommun: dess spår
    const hovSpar = hovK && !STADKODER.includes(hovK) && tid ? (perEnhet.get(hovK) ?? []).filter(d => d[tid] <= ar) : [];
    gHov.selectAll("path").data(hovSpar.length > 1 ? [hovSpar] : []).join("path").attr("d", lnSpar).attr("fill", "none").attr("stroke", ink.mjuk).attr("stroke-width", 1.4);
    // Grå namn
    const et = [];
    for (const k of etikettera) { const d = vid(k, ar); if (d) et.push({ x: sx(d[x]) + rs(d[storlek] ?? 0) + 3, y: sy(d[y]), t: d[namn], c: ink.svag, w: 400, s: 10.5 }); }
    // De fem: spår med årsprickar, spets och namn
    const spar_ = fokus.map(k => ({ k, v: tid ? perEnhet.get(k).filter(d => d[tid] <= ar).sort((a, b) => a[tid] - b[tid]) : [vid(k, ar)] }));
    const grp = gSpar.selectAll("g.s").data(spar_, d => d.k).join(e => { const s = e.append("g").attr("class", "s"); s.append("path").attr("class", "halo"); s.append("path").attr("class", "ln"); s.append("g").attr("class", "pr"); s.append("circle").attr("class", "spets"); return s; });
    grp.select("path.halo").attr("d", d => (d.v.length > 1 ? lnSpar(d.v) : null)).attr("fill", "none").attr("stroke", R.botten).attr("stroke-width", 5).attr("stroke-linecap", "round");
    grp.select("path.ln").attr("d", d => (d.v.length > 1 ? lnSpar(d.v) : null)).attr("fill", "none").attr("stroke", d => farg[d.k]).attr("stroke-width", 2).attr("stroke-linecap", "round");
    grp.select("g.pr").selectAll("circle").data(d => d.v.slice(0, -1).map(q => ({ q, k: d.k }))).join("circle")
      .attr("cx", d => sx(d.q[x])).attr("cy", d => sy(d.q[y])).attr("r", 1.7).attr("fill", d => farg[d.k]);
    grp.select("circle.spets").each(function (d) {
      const s = d.v[d.v.length - 1];
      if (!s) return;
      d3.select(this).attr("cx", sx(s[x])).attr("cy", sy(s[y])).attr("r", 5.5).attr("fill", farg[d.k]).attr("stroke", R.botten).attr("stroke-width", 1.5);
      punkter.push({ d: s, px: sx(s[x]), py: sy(s[y]), fokus: true });
      et.push({ x: sx(s[x]) + 9, y: sy(s[y]), t: s[namn], c: farg[d.k], w: 600, s: 12.5 });
    });
    gEt.selectAll("text").data(sprid(et, 13, 4, sida - 4)).join("text").attr("x", d => d.x).attr("y", d => d.y).attr("dy", "0.34em")
      .attr("font-size", d => d.s).attr("font-weight", d => d.w).attr("fill", d => d.c)
      .attr("paint-order", "stroke").attr("stroke", R.botten).attr("stroke-width", 3).text(d => d.t);
    if (arText) { arText.textContent = String(ar); reglage.value = ar; }
    malaTabell();
  }
  rita();

  // ── Uppspelning ──
  let timer = null;
  const stoppa = () => { if (timer) { clearInterval(timer); timer = null; } if (knapp) knapp.textContent = "▶"; };
  if (knapp) {
    knapp.addEventListener("click", () => {
      if (timer) return stoppa();
      if (ar >= A1) ar = A0;
      knapp.textContent = "❚❚";
      timer = setInterval(() => { if (!rot.isConnected) return stoppa(); ar = Math.min(A1, ar + 1); rita(); if (ar >= A1) stoppa(); }, 230);
    });
    reglage.addEventListener("input", () => { stoppa(); ar = +reglage.value; rita(); });
  }

  // ── Hovring ──
  const ring = g.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.2).attr("opacity", 0);
  const tipsFn = tips ?? (d => `<b>${d[namn]}</b>${tid ? ` <span class="s">${d[tid]}</span>` : ""}<br><span class="s">${xLabel}</span> <span class="m">${xFormat(d[x])}</span><br><span class="s">${yLabel}</span> <span class="m">${yFormat(d[y])}</span>`);
  g.append("rect").attr("width", sida).attr("height", sida).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      const p = narmast(punkter, mx, my, 12);
      const ny = p ? p.d[kod] : null;
      if (ny !== hovK) { hovK = ny; rita(); }
      if (!p) { ring.attr("opacity", 0); return R.doljTips(); }
      ring.attr("cx", p.px).attr("cy", p.py).attr("r", 8).attr("opacity", 1);
      R.visaTips(tipsFn(p.d, tid ? vid(p.d[kod], A0) : null), p.px + M.left, p.py + M.top);
    })
    .on("pointerleave", () => { ring.attr("opacity", 0); R.doljTips(); if (hovK) { hovK = null; rita(); } });
  return rot;
}

// Två (eller fler) grafer bredvid varandra
export function bredvid(noder, { gap = 10 } = {}) {
  const d = el("div", { style: `display:flex;gap:${gap}px;align-items:flex-start` });
  for (const n of noder) d.appendChild(n);
  return d;
}

// ═══ radmoln ══════════════════════════════════════════════════════════════
// En rad per kategori. Alla kommuner som grå prickar (deterministiskt utspridda
// i höjdled), städerna i färg, riket som streck och länen som ringar.
export function radmoln(rader, {
  temaNamn = aktivtTema(), width = 1000, height = 520,
  rad = "block", radOrdning = null, x = "andel", namn = "namn", kod = "kod", typ = "typ",
  xFormat = fmt.pct0, tipsFormat = null, xLabel = "", logX = false, domain = null,
  lanRingar = false,               // länens värden som ringar i stadens färg
  etikett = null,                  // d => text | null — små namn ovanför utvalda prickar
  radEtikett = 190, titel = null, undertitel = null, kalla = null, radTips = null
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla });
  const { svg, ink, farg, mono } = R;
  const tf = tipsFormat ?? xFormat;
  const M = { top: 8, right: 24, bottom: 40, left: radEtikett };
  const iw = R.W - M.left - M.right, ih = R.H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const kat = radOrdning ?? [...new Set(rader.map(d => d[rad]))];
  const sy = d3.scaleBand().domain(kat).range([0, ih]).paddingInner(0.18);
  const v = rader.map(d => d[x]).filter(t => Number.isFinite(t) && (!logX || t > 0));
  const sx = (logX ? d3.scaleLog() : d3.scaleLinear()).domain(domain ?? (logX ? [d3.min(v) / 1.1, d3.max(v) * 1.1] : [Math.min(0, d3.min(v)), d3.max(v) * 1.03])).range([0, iw]);
  if (!logX && !domain) sx.nice();
  axel(g, sx, { ink, mono, langd: ih, format: xFormat, ticks: logX ? 6 : 7 });
  if (sx.domain()[0] < 0) g.append("line").attr("x1", sx(0)).attr("x2", sx(0)).attr("y1", 0).attr("y2", ih).attr("stroke", ink.mjuk).attr("stroke-opacity", 0.6);
  g.append("text").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(xLabel);
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h >>> 0) % 1000) / 1000; };
  const punkter = [];
  for (const k of kat) {
    const y0 = sy(k), bh = sy.bandwidth(), mid = y0 + bh / 2;
    g.append("rect").attr("x", -M.left + 4).attr("y", y0 - 2).attr("width", iw + M.left - 4).attr("height", bh + 4).attr("fill", R.tonad).attr("rx", 4);
    const et = g.append("text").attr("x", -12).attr("y", mid).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-size", 12.5).attr("fill", ink.stark).text(k);
    if (radTips) et.append("title").text(radTips(k));
    const i_rad = rader.filter(d => d[rad] === k && Number.isFinite(d[x]) && (!logX || d[x] > 0));
    for (const d of i_rad.filter(d => d[typ] === "kommun" && !STADKODER.includes(d[kod]))) {
      const px = sx(d[x]), py = mid + (hash(d[kod] + k) - 0.5) * bh * 0.7;
      g.append("circle").attr("cx", px).attr("cy", py).attr("r", 2.3).attr("fill", ink.svag).attr("fill-opacity", 0.35);
      punkter.push({ d, px, py });
    }
    for (const d of i_rad.filter(d => d[typ] === "riket")) {
      const px = sx(d[x]);
      g.append("line").attr("x1", px).attr("x2", px).attr("y1", y0 + 1).attr("y2", y0 + bh - 1).attr("stroke", ink.stark).attr("stroke-width", 2);
      punkter.push({ d, px, py: mid });
    }
    if (lanRingar) for (const d of i_rad.filter(d => d[typ] === "lan" && stadForLan(d[kod]))) {
      const px = sx(d[x]);
      g.append("circle").attr("cx", px).attr("cy", mid).attr("r", 5.5).attr("fill", "none").attr("stroke", farg[stadForLan(d[kod])]).attr("stroke-width", 1.6);
      punkter.push({ d, px, py: mid });
    }
    for (const d of i_rad.filter(d => STADKODER.includes(d[kod]))) {
      const px = sx(d[x]);
      g.append("circle").attr("cx", px).attr("cy", mid).attr("r", 6).attr("fill", farg[d[kod]]).attr("fill-opacity", 0.92).attr("stroke", R.botten).attr("stroke-width", 1.2);
      punkter.push({ d, px, py: mid });
    }
    const lagda = [];
    if (etikett) for (const p of punkter.filter(q => q.d[rad] === k && etikett(q.d))
      .sort((a, b) => (farg[b.d[kod]] ? 1 : 0) - (farg[a.d[kod]] ? 1 : 0) || b.d[x] - a.d[x])) {
      const t = etikett(p.d), c = farg[p.d[kod]];
      const bredd = t.length * (c ? 6.6 : 5.9) + 6, x0_ = p.px - bredd / 2, x1_ = p.px + bredd / 2;
      if (lagda.some(([a, b]) => x0_ < b && x1_ > a)) continue;
      lagda.push([x0_, x1_]);
      g.append("text").attr("x", p.px).attr("y", y0 + 3).attr("text-anchor", "middle").attr("font-size", c ? 11.5 : 10.5)
        .attr("font-weight", c ? 600 : 400).attr("fill", c ?? ink.mjuk).attr("paint-order", "stroke").attr("stroke", R.botten).attr("stroke-width", 3).text(t);
    }
  }
  // Riket får ett namn i första raden
  const forsta = rader.find(d => d[rad] === kat[0] && d[typ] === "riket");
  if (forsta) g.append("text").attr("x", sx(forsta[x])).attr("y", -1).attr("text-anchor", "middle").attr("font-size", 10.5).attr("fill", ink.stark).text(forsta[namn]);
  const ring = g.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.2).attr("opacity", 0);
  g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      const p = narmast(punkter, mx, my, 10);
      if (!p) { ring.attr("opacity", 0); return R.doljTips(); }
      ring.attr("cx", p.px).attr("cy", p.py).attr("r", 8).attr("opacity", 1);
      R.visaTips(`<b>${p.d[namn]}</b> <span class="s">${p.d[rad]}</span><br><span class="m">${tf(p.d[x])}</span>`, p.px + M.left, p.py + M.top);
    })
    .on("pointerleave", () => { ring.attr("opacity", 0); R.doljTips(); });
  return R.rot;
}

// ═══ svarm ════════════════════════════════════════════════════════════════
// En rad per grupp (t.ex. län), en punkt per enhet (t.ex. tätort) placerad
// efter värdet på logaritmisk axel och knuffad isär i höjdled så att ingen
// punkt döljs. Punktens yta motsvarar värdet. De fem kommunernas enheter i
// färg och med namn; övriga får namn när det finns plats (störst först).
//
// Tillägg för ortsstrukturbilden (alla bakåtkompatibla):
//   legend: false         ingen teckenförklaring (och utan titel/undertitel inget huvud alls)
//   etikettera            vilka enheter som får namn — ENDAST de: funktion d => bool (d = raden),
//                         eller lista med enhetsnamn (d[namn]). Utan: de i färg + `etikett`.
//   fargFor: d => färg    egen färg per enhet (t.ex. länets största ort), annars de fems färger
//   ren: true             renare yta: bara 1-2-5-rutnät, svagare band, ingen kantlinje runt prickar
//   rMax                  största prickradie (förval 16)
//   radNamn: k => text    visningsnamn för raden (nyckeln k används i övrigt)
//   radUnder: k => [text] mindre mono-rader under radnamnet
//   radNotBredd           bredd på notkolumnen till höger (förval 132)
//   radKlick: k => …      raderna blir klickbara; noden får .markeraRad(k | null)
export function svarm(rader, {
  temaNamn = aktivtTema(), width = 1010, height = 480, rad, radOrdning = null,
  x = "folkmangd", namn = "namn", kod = "kod", domain = null,
  vline = null,                     // { varde, etikett }
  etikett = () => true,             // vilka grå enheter som får försöka få namn
  etikettera = null, fargFor = null, legend = true, ren = false, rMax = 16,
  xFormat = v => tal.format(v), xLabel = "", radEtikett = 150,
  radNamn = null, radUnder = null, radKlick = null,
  radNot = null,                    // k => { tal, text } — kort not i högerkanten per rad
  radNotRubrik = null,              // rubrik ovanför notkolumnen
  radNotBredd = 132,
  titel = null, undertitel = null, kalla = null, tips = null
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla, legend, kompakt: !legend && !titel && !undertitel });
  const { svg, ink, farg, mono } = R;
  const farg_ = d => farg[d[kod]] ?? fargFor?.(d) ?? null;
  const behover = etikettera == null ? null
    : typeof etikettera === "function" ? etikettera
    : d => etikettera.includes(d[namn]);
  const M = { top: radNotRubrik ? 18 : 8, right: radNot ? radNotBredd : 24, bottom: ren ? 36 : 40, left: radEtikett };
  const iw = R.W - M.left - M.right, ih = R.H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const kat = radOrdning ?? [...new Set(rader.map(d => d[rad]))];
  const sy = d3.scaleBand().domain(kat).range([0, ih]).paddingInner(ren ? 0.06 : 0.1);
  const v = rader.map(d => d[x]).filter(t => t > 0);
  const sx = d3.scaleLog().domain(domain ?? [d3.min(v) / 1.15, d3.max(v) * 1.15]).range([0, iw]);
  const rs = d3.scaleSqrt().domain([0, d3.max(v)]).range([0, Math.min(rMax, sy.bandwidth() / 3)]);
  let sistaTick = null;
  for (const t of sx.ticks(10)) {
    const p = Math.round(sx(t)) + 0.5, visa = (ren ? /^[15]/ : /^[125]/).test(String(t));
    if (ren && !visa) continue;                       // ren: bara 1- och 5-stegen, rutnät och siffror
    g.append("line").attr("x1", p).attr("x2", p).attr("y1", 0).attr("y2", ih).attr("stroke", ink.rutnat).attr("stroke-opacity", ren ? 0.9 : visa ? 1 : 0.5);
    const len = xFormat(t).length;
    // ren: hoppa över siffror som skulle krocka med föregående
    if (visa && !(ren && sistaTick && p - sistaTick.p < (len + sistaTick.len) / 2 * 6 + 2)) {
      sistaTick = { p, len };
      mono(g.append("text").attr("x", p).attr("y", ih + 15).attr("text-anchor", "middle")).text(xFormat(t));
    }
  }
  g.append("text").attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(xLabel);
  if (radNotRubrik) g.append("text").attr("x", iw + 16).attr("y", -6).attr("font-size", 10.5).attr("fill", ink.mjuk).text(radNotRubrik);
  if (vline) {
    const p = sx(vline.varde);
    g.append("line").attr("x1", p).attr("x2", p).attr("y1", -2).attr("y2", ih).attr("stroke", ink.mjuk).attr("stroke-dasharray", "4 3");
    if (vline.etikett) g.append("text").attr("x", p + 4).attr("y", 6).attr("font-size", 10.5).attr("fill", ink.mjuk).text(vline.etikett);
  }
  const punkter = [];
  const band = new Map(), radText = new Map();
  const bandFarg = ren ? (R.T.mork ? "rgba(255,255,255,.035)" : "rgba(10,20,15,.028)") : R.tonad;
  const bandVald = R.T.mork ? "rgba(255,255,255,.10)" : "rgba(10,20,15,.075)";
  for (const k of kat) {
    const y0 = sy(k), bh = sy.bandwidth(), mid = y0 + bh / 2;
    band.set(k, g.append("rect").attr("x", -M.left + 4).attr("y", y0).attr("width", iw + M.left - 4 + (ren && radNot ? M.right - 6 : 0)).attr("height", bh).attr("fill", bandFarg).attr("rx", 4));
    const under = radUnder?.(k) ?? [];
    const namnY = under.length ? mid - 8 - (under.length - 1) * 7 : mid;
    const rt = g.append("text").attr("x", -12).attr("y", namnY).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-size", ren ? 13.5 : 12.5).attr("fill", ink.stark).text(radNamn?.(k) ?? k);
    radText.set(k, rt);
    const klick = radKlick ? "none" : null;          // klicket ska nå radens yta under texten
    if (klick) rt.style("pointer-events", klick);
    under.forEach((t, i) => mono(g.append("text").attr("x", -12).attr("y", namnY + 17 + i * 14).attr("dy", "0.34em").attr("text-anchor", "end")).attr("font-size", 10.5).attr("fill", ink.mjuk).style("pointer-events", klick).text(t));
    const not = radNot?.(k);
    if (not) {
      mono(g.append("text").attr("x", iw + 16).attr("y", mid - 3)).attr("font-size", ren ? 19 : 17).attr("font-weight", 600).attr("fill", ink.stark).style("pointer-events", klick).text(not.tal);
      g.append("text").attr("x", iw + 16).attr("y", mid + 14).attr("font-size", 10.5).attr("fill", ink.mjuk).style("pointer-events", klick).text(not.text);
    }
    // Kraftsimulering: x låst vid värdet, y dras mot radens mitt, ingen överlappning
    const noder = rader.filter(d => d[rad] === k && d[x] > 0).map(d => ({ d, x: sx(d[x]), y: mid, r: Math.max(2.2, rs(d[x])), fx: sx(d[x]) }));
    const sim = d3.forceSimulation(noder).force("y", d3.forceY(mid).strength(0.08)).force("kol", d3.forceCollide(n => n.r + 0.8)).stop();
    for (let i = 0; i < 220; i++) sim.tick();
    for (const n of noder) n.y = Math.max(y0 + n.r + 1, Math.min(y0 + bh - n.r - 1, n.y));
    for (const n of noder.sort((a, b) => b.r - a.r)) {
      const c = farg_(n.d);
      g.append("circle").attr("cx", n.x).attr("cy", n.y).attr("r", n.r).attr("fill", c ?? ink.svag).attr("fill-opacity", c ? 0.95 : ren ? 0.45 : 0.4)
        .attr("stroke", ren ? R.botten : R.botten).attr("stroke-width", ren ? 0.6 : 0.8);
      punkter.push({ d: n.d, px: n.x, py: n.y, r: n.r });
    }
    // Namn: de fem först, sedan störst — bara där de får plats
    const lagda = [];
    const kand = noder.filter(n => behover ? behover(n.d) : (farg[n.d[kod]] || etikett(n.d))).sort((a, b) => (farg_(b.d) ? 1 : 0) - (farg_(a.d) ? 1 : 0) || b.d[x] - a.d[x]);
    for (const n of kand) {
      const c = farg_(n.d), t = n.d[namn], b = t.length * (c ? 7 : 5.9) + 6;
      const x0_ = n.x - b / 2, x1_ = n.x + b / 2;
      const ledig = yy => !lagda.some(([a, bb, y_]) => x0_ < bb && x1_ > a && Math.abs(y_ - yy) < 12);
      const over = Math.max(y0 + 10, n.y - n.r - 4), under = Math.min(y0 + bh - 3, n.y + n.r + 11);
      const ty = ledig(over) ? over : ledig(under) ? under : null;
      if (ty == null) continue;
      lagda.push([x0_, x1_, ty]);
      g.append("text").attr("x", n.x).attr("y", ty).attr("text-anchor", "middle").attr("font-size", c ? (ren ? 13 : 12.5) : 10.5)
        .attr("font-weight", c ? 700 : 400).attr("fill", c ?? ink.mjuk).attr("paint-order", "stroke").attr("stroke", R.botten).attr("stroke-width", 3).text(t);
    }
  }
  const tipsFn = tips ?? (d => `<b>${d[namn]}</b> <span class="s">${d[rad]}</span><br><span class="m">${xFormat(d[x])}</span>`);
  const ring = g.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.2).attr("opacity", 0);
  const radVidY = my => kat.find(k => my >= sy(k) - 2 && my <= sy(k) + sy.bandwidth() + 2) ?? null;
  const yta = g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      const p = narmast(punkter, mx, my, 12);
      if (!p) { ring.attr("opacity", 0); return R.doljTips(); }
      ring.attr("cx", p.px).attr("cy", p.py).attr("r", p.r + 3).attr("opacity", 1);
      R.visaTips(tipsFn(p.d), p.px + M.left, p.py + M.top);
    })
    .on("pointerleave", () => { ring.attr("opacity", 0); R.doljTips(); });
  // Klickbara rader: hela bandet, även etikett- och notkolumnen
  let markerad = null;
  if (radKlick) {
    yta.style("cursor", "pointer").on("click", ev => { const k = radVidY(d3.pointer(ev)[1]); if (k != null) radKlick(k); });
    for (const k of kat) {
      band.get(k).style("cursor", "pointer").on("click", () => radKlick(k));
      if (radNot && !ren) g.append("rect").attr("x", iw + 2).attr("y", sy(k)).attr("width", M.right - 8).attr("height", sy.bandwidth())
        .attr("fill", "transparent").style("cursor", "pointer").on("click", () => radKlick(k));
    }
  }
  R.rot.markeraRad = k => {
    markerad = k;
    for (const [rk, b] of band) b.attr("fill", rk === k ? bandVald : bandFarg);
    for (const [rk, t] of radText) t.attr("fill", k == null || rk === k ? ink.stark : ink.mjuk);
  };
  return R.rot;
}

// ═══ rangordning ══════════════════════════════════════════════════════════
// Många enheter sorterade efter ett värde. Ring = startvärdet (x0), prick =
// slutvärdet (x). Städerna i färg med värdet utskrivet, övriga grå.
export function rangordning(rader, {
  temaNamn = aktivtTema(), width = 1000, height = 480, x, x0 = null, namn = "namn", kod = "kod",
  format = fmt.dec2, referens = null, referensEtikett = "", xLabel = "",
  titel = null, undertitel = null, kalla = null, tips = null
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla });
  const { svg, ink, farg, mono } = R;
  const data = [...rader].filter(d => Number.isFinite(d[x])).sort((a, b) => b[x] - a[x]);
  // Två kolumner om raderna är många — så att namnen förblir läsbara
  const kol = data.length > 24 ? 2 : 1, perKol = Math.ceil(data.length / kol);
  const M = { top: 22, right: 54, bottom: 34, left: 118 }, gap = 70;
  const pw = (R.W - M.left - M.right - (gap + M.left) * (kol - 1)) / kol, ih = R.H - M.top - M.bottom;
  const varden = data.flatMap(d => [d[x], x0 ? d[x0] : null]).filter(Number.isFinite);
  const [lo, hi] = d3.extent(referens != null ? [...varden, referens] : varden);
  const sx = d3.scaleLinear().domain([lo - (hi - lo) * 0.04, hi + (hi - lo) * 0.04]).nice().range([0, pw]);
  const punkter = [];
  for (let c = 0; c < kol; c++) {
    const del = data.slice(c * perKol, (c + 1) * perKol);
    const g = svg.append("g").attr("transform", `translate(${M.left + c * (pw + gap + M.left)},${M.top})`);
    const sy = d3.scaleBand().domain(d3.range(perKol)).range([0, ih]).paddingInner(0.2);
    axel(g, sx, { ink, mono, langd: ih, format, ticks: 5 });
    if (referens != null) {
      g.append("line").attr("x1", sx(referens)).attr("x2", sx(referens)).attr("y1", -4).attr("y2", ih).attr("stroke", ink.stark).attr("stroke-opacity", 0.55);
      g.append("text").attr("x", sx(referens)).attr("y", -8).attr("text-anchor", "middle").attr("font-size", 10.5).attr("fill", ink.mjuk).text(referensEtikett);
    }
    if (c === kol - 1 && xLabel) g.append("text").attr("x", pw).attr("y", ih + 30).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(xLabel);
    del.forEach((d, i) => {
      const yy = sy(i) + sy.bandwidth() / 2, fc = farg[d[kod]], rang = c * perKol + i + 1;
      if (fc) g.append("rect").attr("x", -M.left + 2).attr("y", sy(i) - 1).attr("width", pw + M.left + 50).attr("height", sy.bandwidth() + 2).attr("rx", 3).attr("fill", fc).attr("fill-opacity", 0.1);
      mono(g.append("text").attr("x", -M.left + 6).attr("y", yy).attr("dy", "0.34em")).attr("font-size", 9.5).text(rang);
      g.append("text").attr("x", -8).attr("y", yy).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-size", fc ? 11.5 : 10.5)
        .attr("font-weight", fc ? 600 : 400).attr("fill", fc ?? ink.mjuk).text(d[namn]);
      const c_ = fc ?? ink.svag;
      if (x0 && Number.isFinite(d[x0])) {
        g.append("line").attr("x1", sx(d[x0])).attr("x2", sx(d[x])).attr("y1", yy).attr("y2", yy).attr("stroke", c_).attr("stroke-width", 2).attr("stroke-opacity", 0.4);
        g.append("circle").attr("cx", sx(d[x0])).attr("cy", yy).attr("r", fc ? 3.6 : 2.8).attr("fill", R.botten).attr("stroke", c_).attr("stroke-width", 1.3);
      }
      g.append("circle").attr("cx", sx(d[x])).attr("cy", yy).attr("r", fc ? 5 : 3.4).attr("fill", c_);
      if (fc) mono(g.append("text").attr("x", pw + 6).attr("y", yy).attr("dy", "0.34em")).attr("fill", fc).attr("font-weight", 600).attr("font-size", 11).text(format(d[x]));
      punkter.push({ d, px: M.left + c * (pw + gap + M.left) + sx(d[x]), py: M.top + yy, rang });
    });
  }
  const tipsFn = tips ?? (d => `<b>${d[namn]}</b><br><span class="m">${x0 ? `${format(d[x0])} → ` : ""}${format(d[x])}</span>`);
  svg.append("rect").attr("width", R.W).attr("height", R.H).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      // Hela raden räknas: närmast i höjdled inom kolumnen
      const p = punkter.filter(q => Math.abs(q.px - mx) < pw + M.left).sort((a, b) => Math.abs(a.py - my) - Math.abs(b.py - my))[0];
      if (!p || Math.abs(p.py - my) > 8) return R.doljTips();
      R.visaTips(`<span class="s">${p.rang}.</span> ${tipsFn(p.d)}`, p.px, p.py);
    })
    .on("pointerleave", () => R.doljTips());
  return R.rot;
}

// ═══ staplar ══════════════════════════════════════════════════════════════
// Delar staplas åt höger (positiva) och vänster (negativa) från noll. En
// markör visar summan. Rader i given ordning.
export function staplar(rader, {
  temaNamn = aktivtTema(), width = 1000, height = 420, rad = "namn", kod = "kod",
  delar = [],                        // [{ falt, etikett, farg, legend }] — legend: false = utan förklaring
  total = null, totalEtikett = "Summa", format = fmt.d1, xLabel = "",
  sidor = null,                      // { vanster, hoger } — rubriker på var sida om nollan
  radEtikett = 150, ticks = 8,
  titel = null, undertitel = null, kalla = null, grupp = null   // grupp: fält som delar raderna i block (t.ex. period)
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla, legend: false });
  const { svg, ink, farg, mono } = R;
  const M = { top: sidor ? 52 : 30, right: 70, bottom: 38, left: radEtikett };
  const iw = R.W - M.left - M.right, ih = R.H - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const nycklar = rader.map((d, i) => `${i}`);
  const sy = d3.scaleBand().domain(nycklar).range([0, ih]).paddingInner(0.28);
  let lo = 0, hi = 0;
  for (const d of rader) {
    const pos = d3.sum(delar, p => Math.max(0, d[p.falt] ?? 0)), neg = d3.sum(delar, p => Math.min(0, d[p.falt] ?? 0));
    hi = Math.max(hi, pos, total ? d[total] ?? 0 : 0); lo = Math.min(lo, neg, total ? d[total] ?? 0 : 0);
  }
  const sx = d3.scaleLinear().domain([lo, hi]).nice().range([0, iw]);
  axel(g, sx, { ink, mono, langd: ih, format: lo < 0 ? v => tecken(v, tal) : v => tal.format(v), ticks });
  g.append("line").attr("x1", sx(0)).attr("x2", sx(0)).attr("y1", -4).attr("y2", ih).attr("stroke", ink.stark).attr("stroke-width", 1.2);
  g.append("text").attr("x", iw).attr("y", ih + 32).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(xLabel);
  // Teckenförklaring
  const lg = svg.append("g").attr("transform", `translate(${M.left},12)`);
  let lx = 0;
  if (sidor) {
    if (sidor.vanster) g.append("text").attr("x", sx(0) - 8).attr("y", -10).attr("text-anchor", "end").attr("font-size", 12).attr("font-weight", 600).attr("fill", ink.mjuk).text(sidor.vanster);
    if (sidor.hoger) g.append("text").attr("x", sx(0) + 8).attr("y", -10).attr("font-size", 12).attr("font-weight", 600).attr("fill", ink.mjuk).text(sidor.hoger);
  }
  for (const p of delar) {
    if (p.legend === false) continue;
    lg.append("rect").attr("x", lx).attr("y", -6).attr("width", 11).attr("height", 11).attr("rx", 2).attr("fill", p.farg);
    const t = lg.append("text").attr("x", lx + 16).attr("y", 0).attr("dy", "0.34em").attr("font-size", 11.5).attr("fill", ink.mjuk).text(p.etikett);
    lx += 16 + p.etikett.length * 6.6 + 22;        // texten är inte mätbar innan noden sitter i sidan
  }
  if (total) {
    lg.append("path").attr("d", d3.symbol(d3.symbolDiamond, 60)()).attr("transform", `translate(${lx + 5},0)`).attr("fill", ink.stark);
    lg.append("text").attr("x", lx + 16).attr("y", 0).attr("dy", "0.34em").attr("font-size", 11.5).attr("fill", ink.mjuk).text(totalEtikett);
  }
  const ytor = [];
  rader.forEach((d, i) => {
    const y0 = sy(`${i}`), bh = sy.bandwidth(), mid = y0 + bh / 2;
    if (grupp && (i === 0 || rader[i - 1][grupp] !== d[grupp]))
      g.append("text").attr("x", -M.left + 6).attr("y", y0 - 4).attr("font-size", 10.5).attr("font-weight", 600).attr("fill", ink.svag).attr("letter-spacing", ".06em").text(String(d[grupp]).toUpperCase());
    const c = farg[d[kod]];
    const et = g.append("text").attr("x", -10).attr("y", mid).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-size", 12.5).attr("fill", c ?? ink.stark)
      .attr("font-weight", c ? 600 : 400).text(d[rad]);
    if (!c) et.attr("font-style", "italic");
    let p0 = 0, n0 = 0;
    for (const p of delar) {
      const v = d[p.falt];
      if (!Number.isFinite(v) || v === 0) continue;
      const fr = v > 0 ? p0 : n0 + v, till = v > 0 ? p0 + v : n0;
      g.append("rect").attr("x", sx(fr)).attr("width", Math.max(0.5, sx(till) - sx(fr))).attr("y", y0).attr("height", bh).attr("fill", p.farg);
      ytor.push({ d, p, v, x0: sx(fr), x1: sx(till), y0, y1: y0 + bh });
      if (v > 0) p0 += v; else n0 += v;
    }
    if (total && Number.isFinite(d[total])) {
      g.append("path").attr("d", d3.symbol(d3.symbolDiamond, 70)()).attr("transform", `translate(${sx(d[total])},${mid})`).attr("fill", ink.stark).attr("stroke", R.botten).attr("stroke-width", 1.2);
      const xt = Math.max(sx(p0), sx(d[total])) + 8;
      mono(g.append("text").attr("x", xt).attr("y", mid).attr("dy", "0.34em")).attr("fill", ink.stark).attr("font-size", 11.5).text(format(d[total]));
    }
  });
  g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      const y = ytor.find(q => mx >= q.x0 - 1 && mx <= q.x1 + 1 && my >= q.y0 && my <= q.y1);
      if (!y) return R.doljTips();
      R.visaTips(`<b>${y.d[rad]}</b>${grupp ? ` <span class="s">${y.d[grupp]}</span>` : ""}<br>${y.p.etikett} <span class="m">${format(y.v)}</span>${total ? `<br><span class="s">${totalEtikett}</span> <span class="m">${format(y.d[total])}</span>` : ""}`, (y.x0 + y.x1) / 2 + M.left, y.y0 + M.top);
    })
    .on("pointerleave", () => R.doljTips());
  return R.rot;
}

// ═══ linjer ═══════════════════════════════════════════════════════════════
// Linjer per serie. Städerna i sina färger, riket prickat, övriga grå. Med
// `facet` blir det små multiplar (en panel per facett, egen y-skala om
// delaY = false).
export function linjer(rader, {
  temaNamn = aktivtTema(), width = 1000, height = 500, x = "ar", y, serie = "kod", namn = "namn",
  facet = null, facetOrdning = null, kolumner = 4, delaY = false,
  yFormat = v => tal.format(v), xTicks = null, nollinje = null, referensKod = "0000",
  brott = [],                       // [{ ar, etikett }] — lodräta prickade linjer
  bakgrund = null,                  // d => true för serier som ritas grått i bakgrunden
  markera = null,                   // [{ kod, etikett }] — namn på bakgrundsserier
  titel = null, undertitel = null, kalla = null, yLabel = null, slutEtiketter = true, legend = true
} = {}) {
  const R = ram(temaNamn, width, height, { titel, undertitel, kalla, legend });
  const { svg, ink, farg, mono } = R;
  const fasetter = facet ? (facetOrdning ?? [...new Set(rader.map(d => d[facet]))]) : [null];
  const rad_ = Math.ceil(fasetter.length / (facet ? kolumner : 1)), kol = facet ? Math.min(kolumner, fasetter.length) : 1;
  const M = { top: facet ? 22 : 12, right: facet ? 14 : (slutEtiketter ? 120 : 20), bottom: 30, left: yLabel ? 68 : 50 };
  const gapX = facet ? 48 : 0, gapY = facet ? 38 : 0;
  const pw = (R.W - M.left - M.right - gapX * (kol - 1)) / kol, ph = (R.H - M.top - M.bottom - gapY * (rad_ - 1)) / rad_;
  const xs = rader.map(d => d[x]);
  const sx = d3.scaleLinear().domain(d3.extent(xs)).range([0, pw]);
  const yAlla = rader.map(d => d[y]).filter(Number.isFinite);
  const yDom = v => { const [a, b] = d3.extent(nollinje != null ? [...v, nollinje] : v); const p = (b - a) * 0.06; return [a - p, b + p]; };
  const allaPunkter = [];
  fasetter.forEach((f, i) => {
    const gx = M.left + (i % kol) * (pw + gapX), gy = M.top + Math.floor(i / kol) * (ph + gapY);
    const g = svg.append("g").attr("transform", `translate(${gx},${gy})`);
    const data = facet ? rader.filter(d => d[facet] === f) : rader;
    const sy = d3.scaleLinear().domain(yDom(delaY || !facet ? yAlla : data.map(d => d[y]).filter(Number.isFinite))).nice(4).range([ph, 0]);
    if (facet) g.append("text").attr("x", 0).attr("y", -9).attr("font-size", 12.5).attr("font-weight", 600).attr("fill", ink.stark).text(f);
    for (const t of sy.ticks(facet ? 4 : 6)) {
      const p = Math.round(sy(t)) + 0.5;
      g.append("line").attr("x1", 0).attr("x2", pw).attr("y1", p).attr("y2", p).attr("stroke", t === nollinje ? ink.mjuk : ink.rutnat).attr("stroke-opacity", t === nollinje ? 0.7 : 1);
      if (i % kol === 0 || !delaY) mono(g.append("text").attr("x", -6).attr("y", p).attr("dy", "0.34em").attr("text-anchor", "end")).text(yFormat(t));
    }
    const xt = xTicks ?? sx.ticks(facet ? 4 : 8).filter(Number.isInteger);
    for (const t of xt) mono(g.append("text").attr("x", sx(t)).attr("y", ph + 15)
      .attr("text-anchor", facet && t === sx.domain()[0] ? "start" : facet && t === sx.domain()[1] ? "end" : "middle")).text(t);
    for (const b of brott) {
      if (b.ar < sx.domain()[0] || b.ar > sx.domain()[1]) continue;
      g.append("line").attr("x1", sx(b.ar)).attr("x2", sx(b.ar)).attr("y1", 0).attr("y2", ph).attr("stroke", ink.svag).attr("stroke-dasharray", "1 2.5");
      if (i === 0 && b.etikett) mono(g.append("text").attr("x", sx(b.ar) + 3).attr("y", 9)).attr("font-size", 9.5).text(b.etikett);
    }
    if (!facet && yLabel) g.append("text").attr("transform", `translate(${-M.left + 12},0) rotate(-90)`).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(yLabel);
    const grupper = d3.groups(data.filter(d => Number.isFinite(d[y])), d => d[serie]);
    const ln = d3.line().x(d => sx(d[x])).y(d => sy(d[y])).curve(d3.curveMonotoneX);
    const ordnad = [...grupper].sort(([a], [b]) => (farg[a] ? 2 : a === referensKod ? 1 : 0) - (farg[b] ? 2 : b === referensKod ? 1 : 0));
    const etik = [];
    for (const [s, v] of ordnad) {
      const vv = v.sort((a, b) => a[x] - b[x]);
      const bg = bakgrund?.(vv[0]) && !farg[s] && s !== referensKod;
      const c = farg[s] ?? (s === referensKod ? ink.stark : ink.svag);
      g.append("path").attr("d", ln(vv)).attr("fill", "none").attr("stroke", c).attr("stroke-linecap", "round")
        .attr("stroke-width", farg[s] ? 2.2 : s === referensKod ? 1.8 : 1).attr("stroke-opacity", bg ? 0.35 : 1)
        .attr("stroke-dasharray", s === referensKod ? "0.1 3.4" : null);
      for (const d of vv) allaPunkter.push({ d, px: gx + sx(d[x]), py: gy + sy(d[y]) });
      const sista = vv[vv.length - 1];
      const mk = markera?.find(m => m.kod === s);
      if (!facet && slutEtiketter && (farg[s] || s === referensKod || mk))
        etik.push({ y: sy(sista[y]), x: sx(sista[x]) + 8, t: `${mk?.etikett ?? sista[namn]} ${yFormat(sista[y])}`, c: mk ? ink.svag : c, w: farg[s] ? 600 : 400 });
      if (farg[s] || s === referensKod) g.append("circle").attr("cx", sx(sista[x])).attr("cy", sy(sista[y])).attr("r", facet ? 2.6 : 3.4).attr("fill", c);
    }
    for (const e of sprid(etik, 14, 0, ph))
      g.append("text").attr("x", e.x).attr("y", e.y).attr("dy", "0.34em").attr("font-size", 12).attr("font-weight", e.w).attr("fill", e.c).text(e.t);
  });
  // Hovring: närmaste punkt
  const ring = svg.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.2).attr("opacity", 0);
  svg.append("rect").attr("width", R.W).attr("height", R.H).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev);
      const p = narmast(allaPunkter, mx, my, 10);
      if (!p) { ring.attr("opacity", 0); return R.doljTips(); }
      ring.attr("cx", p.px).attr("cy", p.py).attr("r", 6).attr("opacity", 1);
      R.visaTips(`<b>${p.d[namn]}</b>${facet ? ` <span class="s">${p.d[facet]}</span>` : ""}<br><span class="s">${p.d[x]}</span> <span class="m">${yFormat(p.d[y])}</span>`, p.px, p.py);
    })
    .on("pointerleave", () => { ring.attr("opacity", 0); R.doljTips(); });
  return R.rot;
}

// ═══ profilmatris ═════════════════════════════════════════════════════════
// Rader = mått (grupperade per område), kolumner = de fem städerna. Varje
// cell: värdet och en skena 0–100 med stadens placering bland alla kommuner.
export function profilmatris(rader, {
  temaNamn = aktivtTema(), width = 1000, titel = null, undertitel = null, kalla = null,
  roller = {}                       // { kod: "kort rollbeskrivning" } — under stadens namn
} = {}) {
  const R = ram(temaNamn, width, 100, { titel, undertitel, kalla, legend: false });
  const { ink, farg, rot } = R;
  rot.querySelector("svg").remove();
  const k = R.k_;
  const st = document.createElement("style");
  st.textContent = `
    .${k} .pm { display:grid; grid-template-columns: 250px repeat(5, minmax(0,1fr)) 78px; column-gap:10px; align-items:center; }
    .${k} .pm > div { padding:1.5px 0; }
    .${k} .pm .hd { font-size:13px; font-weight:600; text-align:center; padding-bottom:6px; border-bottom:1px solid ${ink.linje}; }
    .${k} .pm .md { font-size:10px; color:${ink.svag}; text-align:right; padding-bottom:6px; border-bottom:1px solid ${ink.linje}; }
    .${k} .pm .om { grid-column:1/-1; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:${ink.svag}; padding-top:5px !important; }
    .${k} .pm .et { font-size:12px; color:${ink.stark}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k} .pm .cell { display:flex; align-items:center; gap:7px; }
    .${k} .pm .v { font-family:${MONO}; font-size:11.5px; color:${ink.stark}; min-width:58px; text-align:right; }
    .${k} .pm .sk { position:relative; flex:1; height:8px; border-radius:4px; background:${R.tonad}; border:1px solid ${ink.rutnat}; }
    .${k} .pm .sk i { position:absolute; top:50%; width:10px; height:10px; border-radius:50%; transform:translate(-50%,-50%); border:1.5px solid ${R.botten}; }
    .${k} .pm .sk b { position:absolute; left:50%; top:-2px; bottom:-2px; width:1px; background:${ink.svag}; }
    .${k} .pm .mv { font-family:${MONO}; font-size:10.5px; color:${ink.svag}; text-align:right; }
    .${k} .pm .hd .roll { font-size:10.5px; font-weight:400; line-height:1.3; color:${ink.mjuk}; margin-top:2px; white-space:normal; }
  `;
  rot.appendChild(st);
  const fv = (v, enhet) => (v == null ? "–" : enhet === "%" ? `${(Math.abs(v) >= 100 ? tal : dec1).format(v)} %` : enhet === "p.e." ? `${tecken(v)} p.e.` : Math.abs(v) < 3 ? dec2.format(v) : dec1.format(v));
  const nat = el("div", { class: "pm" });
  nat.appendChild(el("div", { class: "md" }));
  for (const s of STADER) {
    const h = el("div", { class: "hd", style: `color:${farg[s.kod]}` }, s.namn);
    if (roller[s.kod]) h.appendChild(el("div", { class: "roll" }, roller[s.kod]));
    nat.appendChild(h);
  }
  nat.appendChild(el("div", { class: "md" }, "Median"));
  const matt = [...new Set(rader.map(d => d.matt))];
  let omr = null;
  for (const m of matt) {
    const r = rader.filter(d => d.matt === m);
    if (r[0].omrade !== omr) { omr = r[0].omrade; nat.appendChild(el("div", { class: "om" }, omr)); }
    nat.appendChild(el("div", { class: "et", title: m }, m));
    for (const s of STADER) {
      const d = r.find(q => q.kod === s.kod);
      const c = el("div", { class: "cell" });
      c.title = d ? `${s.namn}: ${fv(d.varde, d.enhet)} — högre än ${d.percentil} % av kommunerna` : "";
      c.appendChild(el("span", { class: "v" }, d ? fv(d.varde, d.enhet) : "–"));
      const sk = el("span", { class: "sk" });
      sk.appendChild(el("b"));
      if (d && d.percentil != null) sk.appendChild(el("i", { style: `left:${d.percentil}%;background:${farg[s.kod]}` }));
      c.appendChild(sk);
      nat.appendChild(c);
    }
    nat.appendChild(el("div", { class: "mv" }, fv(r[0].median, r[0].enhet)));
  }
  rot.insertBefore(nat, rot.querySelector(".jf-kalla") ?? R.rot.lastChild);
  return rot;
}

// ═══ stegvis ══════════════════════════════════════════════════════════════
// Flera grafer i samma bild. Flikarna går att klicka på, och varje steg efter
// det första är ett osynligt Reveal-fragment — → och ← bläddrar som vanligt.
export function stegvis(steg, { temaNamn = aktivtTema() } = {}) {
  const T = hamtaTema(temaNamn), ink = T.ink;
  const k_ = `jfs-${++raknare}`;
  const rot = el("div", { class: `jf-steg ${k_}`, style: "position:relative" });
  const stil = document.createElement("style");
  stil.textContent = `
    .${k_} .flikar { position:absolute; right:0; top:-34px; display:inline-flex; border:1px solid ${ink.rutnat}; border-radius:999px; padding:1px; gap:1px; z-index:5; }
    .${k_} .flikar button { border:0; background:transparent; color:${ink.mjuk}; font:11.5px var(--graf-text-font, sans-serif); padding:3px 11px; border-radius:999px; cursor:pointer; white-space:nowrap; }
    .${k_} .flikar button:hover { color:${ink.stark}; }
    .${k_} .flikar button.pa { background:${T.mork ? "rgba(255,255,255,.13)" : "#E3F4E2"}; color:${T.mork ? ink.stark : "#00664D"}; font-weight:600; }
  `;
  rot.appendChild(stil);
  const flikar = el("div", { class: "flikar" });
  const ytor = steg.map(s => { const y = el("div", { style: "display:none" }); y.appendChild(s.nod); return y; });
  const knappar = steg.map((s, i) => {
    const b = el("button", { type: "button" }, `${i + 1} ${s.etikett}`);
    b.addEventListener("click", () => { visa(i); synka(i); b.blur(); });
    return b;
  });
  flikar.append(...knappar);
  rot.append(flikar, ...ytor);
  let aktiv = 0;
  function visa(i) {
    aktiv = i;
    ytor.forEach((y, j) => { y.style.display = j === i ? "block" : "none"; });
    knappar.forEach((b, j) => b.classList.toggle("pa", j === i));
  }
  visa(0);
  // Reveal: ett fragment per steg efter det första
  const Rv = () => (typeof window !== "undefined" ? window.Reveal : null);
  const utskrift = () => /print-pdf|view=print/i.test(location.search);
  const spann = utskrift() ? [] : steg.slice(1).map((_, i) => { const s = el("span", { class: "fragment jf-fragment", "data-fragment-index": i, "aria-hidden": "true", style: "display:none" }); rot.appendChild(s); return s; });
  let synkar = false;
  function synka(i) {
    const R = Rv(); if (!R || !spann.length) return;
    const s = R.getCurrentSlide?.(); if (!s || !s.contains(rot)) return;
    synkar = true; try { R.navigateFragment(i - 1); } finally { synkar = false; }
  }
  const koppla = () => {
    const R = Rv(); if (!R?.on || !spann.length) return;
    const pa = (ev, visas) => {
      if (synkar) return;
      if (!rot.isConnected) { R.off("fragmentshown", v_); R.off("fragmenthidden", d_); return; }
      const egna = (ev.fragments ?? [ev.fragment]).map(f => spann.indexOf(f)).filter(i => i >= 0);
      if (!egna.length) return;
      visa(visas ? Math.max(...egna) + 1 : Math.min(...egna));
    };
    const v_ = ev => pa(ev, true), d_ = ev => pa(ev, false);
    R.on("fragmentshown", v_); R.on("fragmenthidden", d_);
    const s = R.getCurrentSlide?.();
    if (s && s.contains(rot)) R.syncFragments?.();
  };
  requestAnimationFrame(koppla);
  return rot;
}
