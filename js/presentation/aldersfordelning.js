// =============================================================================
// ÅLDERSFÖRDELNING — befolkningen per ettårsklass (3KHV-dragningen, inflygning)
// =============================================================================
//
//   aldersfordelning(data, {
//     temaNamn, width = 960, height = 560,
//     forval = ["0000"],                // koder som är påslagna från start
//     kalla,                            // källraden (förval "Källa: " + data.kalla)
//     matt = "andel",                   // "andel" (procent av kommunens invånare) | "antal"
//     utjamnad = false,                 // glidande medel över fem ettårsklasser (tillval)
//     farger: { kod: färg }             // ersätter färgen för enskilda enheter
//   }) → DOM-nod · nod.satt({ valda, matt, utjamnad }) · nod.tillstand()
//
// Data: `3khv-alder` = { ar, referensdag, kalla, enheter: [{ kod, namn, grupp }],
// rader: [{ kod, alder, antal }] }, ålder 0–100 där 100 = 100 år och äldre.
//
// Formen, i de stora linjegrafernas formspråk (banor.js linjeläget):
//   • x = ålder 0–99 som linje. 100+ är en öppen klass och ritas som en
//     fristående ring en bit till höger (x = 102), så att den inte ser ut som
//     en topp. y = andel av enhetens invånare i ettårsklassen (standard) eller
//     antal. Andelen räknas mot summan av ettårsklasserna (CKM-störda celler
//     summerar inte exakt till totalen).
//   • Två x-axlar: ålder (0, 10 … 90, 100+) och födelseår (jämna decennier där
//     de hamnar: 2020 = 5 år … 1930 = 95 år). Folkmängden avser 31 december,
//     då alla har fyllt år: ålder = år − födelseår, exakt (född 1990 = 35 år).
//   • Åldersgrupperna 0–19, 20–64, 65–79, 80+ som ljusa band med gruppnamn och
//     födelseår ovanför. Tabellen till höger: varje vald enhets andel i de fyra
//     grupperna (med mätarstapel, skalad mot kolumnens största värde) och
//     medianålder (interpolerad inom ettårsklassen).
//   • Val: en knapp per enhet (kryss ur kontroller.js) i fasta färger: riket
//     mörkgrå prickad, de fem i sina färger (stadFarger), jämförelsekommunerna
//     i egna lugna färger. Snabbval "3KHV" slår på/av de fem, "Bara riket"
//     återställer. Ingen legend: knapparna och tabellen bär färgerna.
//   • Hovring: ett lodrätt streck snäpper till närmaste ettårsklass, prickar på
//     linjerna, ålder och födelseår markeras på båda axlarna och tipsrutan
//     visar ålder, födelseår, åldersgrupp och varje vald enhets andel och antal
//     (alltid de faktiska talen, även när linjerna är utjämnade). Den hovrade
//     åldersgruppens kolumn lyfts i tabellen; en hovrad tabellrad lyfter linjen.
//   • Byten (urval, andel/antal, utjämning) glider över på 420 ms.
// =============================================================================

import { d3 } from "../lib/d3.js";
import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { segment, kryss } from "./kontroller.js";
import { textbredd } from "./etiketter.js";
import { stadFarger, STADKODER } from "./jamforelse.js";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const OVERGANG_MS = 420;
const OPPEN = 100;       // ettårsklassen 100 = 100 år och äldre
const X_OPPEN = 102;     // där 100+ ritas, fristående från linjen
const X_MAX = 103.5;
const GRUPPER = [
  { id: 0, namn: "0–19 år", kort: "0–19", fran: 0, till: 19 },
  { id: 1, namn: "20–64 år", kort: "20–64", fran: 20, till: 64 },
  { id: 2, namn: "65–79 år", kort: "65–79", fran: 65, till: 79 },
  { id: 3, namn: "80+ år", kort: "80+", fran: 80, till: OPPEN }
];
// Knapparnas ordning: riket, de fem (störst först), jämförelsekommunerna
const ORDNING = ["0000", "1262", "1281", "0180", "1315", "0885", "1380", "0780", "1290", "0880", "1080"];
// Jämförelsekommunerna: tydligt skilda från de fem men lugna
const JAMFORFARGER = {
  ljus: { "0180": "#433C9D", "1281": "#895B42", "1262": "#2F7F7A", "1315": "#B88A00", "0885": "#A8508F" },
  mork: { "0180": "#9C8CFF", "1281": "#C69675", "1262": "#7FD1C9", "1315": "#FFD939", "0885": "#E59AC8" }
};
const OVRIGA = { ljus: ["#6473D9", "#59392E", "#0C8C7E"], mork: ["#C0C6FF", "#EFCDB6", "#8FE3C8"] };

const tal = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const nfC = new Map();
const nf = d => { if (!nfC.has(d)) nfC.set(d, new Intl.NumberFormat("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d })); return nfC.get(d); };
const ok = Number.isFinite;

function el(tagg, attr = {}, html = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) if (v != null) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  return e;
}

export function aldersfordelning(data, opts = {}) {
  const {
    temaNamn = aktivtTema(),
    width = 960, height = 560,
    forval = ["0000"],
    kalla = null,
    matt: matt0 = "andel",
    utjamnad: utj0 = false,
    farger = {}
  } = opts;

  // ── Tema ──────────────────────────────────────────────────────────────────
  const T = hamtaTema(temaNamn), ink = T.ink, MORK = !!T.mork;
  const bakgrund = T.yta.bakgrund && T.yta.bakgrund !== "transparent" ? T.yta.bakgrund : ink.yta;
  const botten = MORK ? "#16211D" : "#FFFFFF";
  const tonad = MORK ? "rgba(255,255,255,.05)" : "rgba(10,20,15,.04)";
  const rikeFarg = MORK ? "#C9D3CD" : "#3F4743";
  const bandFyll = MORK
    ? ["rgba(255,255,255,.045)", "rgba(255,255,255,0)", "rgba(255,255,255,.045)", "rgba(255,255,255,.075)"]
    : ["rgba(0,60,40,.045)", "rgba(0,60,40,0)", "rgba(0,60,40,.045)", "rgba(0,60,40,.075)"];
  const stadF = stadFarger(temaNamn);
  const jamfF = JAMFORFARGER[MORK ? "mork" : "ljus"], ovrF = OVRIGA[MORK ? "mork" : "ljus"];

  // ── Data ──────────────────────────────────────────────────────────────────
  const AR = +data.ar || 2025;
  const radMap = d3.group(data.rader ?? [], d => String(d.kod));
  const rang = k => { const i = ORDNING.indexOf(k); return i < 0 ? 99 : i; };
  let ovrigaI = 0;
  const ENH = (data.enheter ?? [])
    .map(e => ({ ...e, kod: String(e.kod) }))
    .filter(e => radMap.has(e.kod))
    .sort((a, b) => rang(a.kod) - rang(b.kod))
    .map(e => {
      const antal = new Float64Array(OPPEN + 1);
      for (const r of radMap.get(e.kod)) { const a = Math.min(OPPEN, Math.round(+r.alder)); if (a >= 0 && ok(+r.antal)) antal[a] += +r.antal; }
      const summa = d3.sum(antal);
      const andel = antal.map(v => (summa > 0 ? (100 * v) / summa : NaN));
      const grp = GRUPPER.map(g => { let s = 0; for (let a = g.fran; a <= g.till; a++) s += andel[a]; return s; });
      // Medianålder: ettårsklassen a täcker åldern [a, a + 1); interpolerat inom klassen
      let median = NaN, kum = 0;
      for (let a = 0; a <= OPPEN; a++) {
        if (kum + antal[a] >= summa / 2 && antal[a] > 0) { median = a + (summa / 2 - kum) / antal[a]; break; }
        kum += antal[a];
      }
      const rike = e.grupp === "riket" || e.kod === "0000";
      const farg = farger[e.kod] ?? (rike ? rikeFarg : stadF[e.kod] ?? jamfF[e.kod] ?? ovrF[ovrigaI++ % ovrF.length]);
      return { kod: e.kod, namn: e.namn, grupp: e.grupp, rike, stad: STADKODER.includes(e.kod), antal, andel, summa, grp, median, farg, cache: new Map() };
    });
  const enhMap = new Map(ENH.map(e => [e.kod, e]));
  const FEM = ENH.filter(e => e.stad).map(e => e.kod);

  // Glidande medel över fem ettårsklasser (ålder ± 2, avkortat vid kanterna).
  // 100+ utjämnas inte och tar inte del i medlet.
  function utjamna(V) {
    const U = new Float64Array(V.length);
    for (let a = 0; a < OPPEN; a++) {
      let s = 0, n = 0;
      for (let b = Math.max(0, a - 2); b <= Math.min(OPPEN - 1, a + 2); b++) { s += V[b]; n++; }
      U[a] = s / n;
    }
    U[OPPEN] = V[OPPEN];
    return U;
  }
  function varden(e, m = st.matt, u = st.utjamnad) {
    const nyckel = `${m}|${u}`;
    if (!e.cache.has(nyckel)) {
      const V = Float64Array.from(m === "antal" ? e.antal : e.andel);
      e.cache.set(nyckel, u ? utjamna(V) : V);
    }
    return e.cache.get(nyckel);
  }

  // ── Tillstånd ─────────────────────────────────────────────────────────────
  const st = {
    valda: ENH.map(e => e.kod).filter(k => forval.map(String).includes(k)),
    matt: matt0 === "antal" ? "antal" : "andel",
    utjamnad: !!utj0
  };
  if (!st.valda.length && ENH.length) st.valda = [ENH[0].kod];
  let lyft = null;           // tabellraden som hovras
  let hovA = null, hovMy = 0; // ettårsklassen under pekaren och pekarens höjd

  // ── Format ────────────────────────────────────────────────────────────────
  const pct1 = v => (ok(v) ? nf(1).format(v) : "–");
  const pct2 = v => (ok(v) ? `${nf(2).format(v)} %` : "–");
  const alderTxt = a => (a >= OPPEN ? "100 år och äldre" : `${a} år`);
  const alderKort = a => (a >= OPPEN ? "100+" : `${a}`);
  const fodd = a => (a >= OPPEN ? `född ${AR - OPPEN} eller tidigare` : `född ${AR - a}`);
  const foddKort = a => (a >= OPPEN ? `≤ ${AR - OPPEN}` : `${AR - a}`);
  const gruppFor = a => GRUPPER.find(g => a >= g.fran && a <= g.till);
  const foddGrupp = g => (g.till >= OPPEN ? `född ${AR - g.fran} och tidigare` : `född ${AR - g.till}–${AR - g.fran}`);

  // ── DOM ───────────────────────────────────────────────────────────────────
  const k_ = `alder-${Math.random().toString(36).slice(2, 8)}`;
  const rot = el("div", { class: `graf-container aldersfordelning ${k_}` });
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", position: "relative", background: "var(--graf-bakgrund)",
    color: ink.stark, fontFamily: "var(--graf-text-font)", boxSizing: "border-box",
    fontSize: "12px", lineHeight: "1.35", textAlign: "left", userSelect: "none"
  });
  const stil = el("style");
  stil.textContent = `
    .${k_} .ad-huvud { display:flex; align-items:center; gap:14px; height:28px; margin:0 0 4px; }
    .${k_} .ad-rubrik { flex:1; min-width:0; font-size:14px; color:${ink.mjuk}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .ad-rubrik small { font-size:12px; color:${ink.svag}; margin-left:8px; }
    .${k_} .ad-val { display:flex; align-items:center; gap:10px; height:28px; margin:0 0 6px; }
    .${k_} .ad-val .kt-kryss button { font-size:11.5px; padding:4px 10px 4px 7px; }
    .${k_} .ad-snabb button.pa { background:${MORK ? "rgba(255,255,255,.13)" : "rgba(10,20,15,.09)"}; color:${ink.stark}; }
    .${k_} .ad-tab { display:grid; grid-template-columns:minmax(0,1fr) repeat(4, 43px) 46px; column-gap:5px; align-content:start; }
    .${k_} .ad-tab > div { min-width:0; }
    .${k_} .ad-th { font-size:11.5px; font-weight:600; color:${ink.mjuk}; text-align:right; padding:3px 3px 1px; border-radius:4px 4px 0 0; white-space:nowrap; }
    .${k_} .ad-th small { display:block; font-size:9px; font-weight:400; color:${ink.svag}; letter-spacing:.02em; }
    .${k_} .ad-th.ad-namn { text-align:left; }
    .${k_} .ad-over { grid-column:1/-1; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:${ink.svag}; padding:0 3px 4px; border-bottom:1px solid ${ink.rutnat}; margin-bottom:2px; order:-1; }
    .${k_} .ad-c { padding:5px 3px 4px; border-top:1px solid ${ink.rutnat}; text-align:right; font-family:${MONO}; font-variant-numeric:tabular-nums; font-size:13px; line-height:1.2; color:${ink.stark}; white-space:nowrap; }
    .${k_} .ad-c i { display:block; height:4px; margin:4px 0 0 auto; border-radius:2px; }
    .${k_} .ad-c.ad-namn { text-align:left; font-family:var(--graf-text-font); font-size:12.5px; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .ad-c.ad-namn small { display:block; font-family:${MONO}; font-size:9.5px; color:${ink.svag}; margin-top:3px; }
    .${k_} .ad-c.ad-namn svg { vertical-align:middle; margin-right:6px; }
    .${k_} .ad-c.ad-med { color:${ink.mjuk}; }
    .${k_} .ad-tab .hg { background:${tonad}; }
    .${k_} .ad-tab .hr { background:${tonad}; }
    .${k_} .ad-kalla { font-size:10.5px; line-height:1.45; color:${ink.svag}; margin-top:6px; }
    ${MORK ? `
    .${k_} .kt-par, .${k_} .kt-kryss button { border-color:rgba(255,255,255,.16); }
    .${k_} .kt-par button, .${k_} .kt-kryss button { color:${ink.mjuk}; }
    .${k_} .kt-par button:hover, .${k_} .kt-kryss button:hover { color:${ink.stark}; }
    .${k_} .kt-par button.pa { background:rgba(255,255,255,.13); color:${ink.stark}; }
    .${k_} .kt-kryss button.pa { color:${ink.stark}; border-color:rgba(255,255,255,.34); background:rgba(255,255,255,.05); }` : ""}
  `;
  rot.appendChild(stil);

  // Rubrikraden: vad y-axeln visar (byts med måttet) och visningens val
  const huvud = el("div", { class: "ad-huvud" });
  const rubrik = el("div", { class: "ad-rubrik" });
  const mattSeg = segment({
    val: [{ id: "andel", etikett: "Andel", titel: "Andel av enhetens invånare i varje ettårsklass, procent" },
          { id: "antal", etikett: "Antal", titel: "Antal invånare i varje ettårsklass" }],
    varde: st.matt, vidByte: v => { st.matt = v; uppdatera(); }
  });
  const utjSeg = segment({
    val: [{ id: "nej", etikett: "Ettårsklasser", titel: "De faktiska talen för varje ettårsklass" },
          { id: "ja", etikett: "Utjämnad", titel: "Glidande medelvärde över fem ettårsklasser (ålder ± 2 år). Tipsrutan visar alltid de faktiska talen." }],
    varde: st.utjamnad ? "ja" : "nej", vidByte: v => { st.utjamnad = v === "ja"; uppdatera(); }
  });
  rot.appendChild(huvud);

  // Valraden: en knapp per enhet och snabbval
  const valRad = el("div", { class: "ad-val" });
  const krysset = kryss({
    val: ENH.map(e => ({ id: e.kod, etikett: e.namn, farg: e.farg, pa: st.valda.includes(e.kod) })),
    vidByte: v => { st.valda = ENH.map(e => e.kod).filter(k => v.includes(k)); uppdatera(); }
  });
  // Luft mellan riket, de fem och jämförelsekommunerna
  const knappar = [...krysset.querySelectorAll(".kt-kryss button")];
  ENH.forEach((e, i) => {
    const forra = ENH[i - 1];
    if (forra && (forra.rike !== e.rike || forra.stad !== e.stad)) knappar[i].style.marginLeft = "10px";
  });
  const snabb = el("span", { class: "kt-par ad-snabb", title: "Snabbval" });
  const kHV = el("button", { type: "button", title: "Slå på eller av de fem städerna" }, "3KHV");
  const kRiket = el("button", { type: "button", title: "Visa bara riket" }, "Bara riket");
  // 3KHV-snabbvalet bara när städerna finns i datan
  if (ENH.some(e => FEM.includes(e.kod))) snabb.append(kHV, kRiket); else snabb.append(kRiket);
  kHV.addEventListener("click", () => {
    const alla = FEM.every(k => st.valda.includes(k));
    let ny = alla ? st.valda.filter(k => !FEM.includes(k)) : [...new Set([...st.valda, ...FEM])];
    if (!ny.length) ny = ENH.some(e => e.rike) ? [ENH.find(e => e.rike).kod] : [FEM[0]];
    krysset.satt(ny);
  });
  kRiket.addEventListener("click", () => { const r = ENH.find(e => e.rike); if (r) krysset.satt([r.kod]); });
  valRad.append(krysset);
  rot.appendChild(valRad);
  huvud.append(rubrik, snabb, mattSeg, utjSeg);
  // Knappar ska inte behålla fokus (mellanslag bläddrar i presentationen)
  rot.addEventListener("click", ev => { const b = ev.target.closest?.("button"); if (b) b.blur(); });

  const kallText = kalla ?? (data.kalla ? `Källa: ${data.kalla}` : null);
  const KALLA_H = 36, TAB_B = 356, GAP = 20;
  const H = Math.max(300, height - 34 - 34 - KALLA_H);
  const W = width - TAB_B - GAP;
  const M = { top: 40, right: 12, bottom: 50, left: 58 };
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const rad = el("div", { style: `display:flex;gap:${GAP}px;height:${H}px` });
  const kol = el("div", { style: `flex:${W} 1 0;min-width:0;position:relative` });
  const tabYta = el("div", { style: `flex:${TAB_B} 1 0;min-width:0;padding-top:4px` });
  rad.append(kol, tabYta);
  rot.appendChild(rad);
  const not = `Ålder vid årets slut (31 december ${AR}), så födelseår = ${AR} − ålder: född 1990 = ${AR - 1990} år. 100+ är en öppen klass (100 år och äldre) och visas som fristående ring.`;
  rot.appendChild(el("div", { class: "ad-kalla" }, `${kallText ? `${kallText} ` : ""}${not}`));
  const tips = el("div", { style: `position:absolute;left:0;top:0;pointer-events:none;opacity:0;transition:opacity .1s;background:${botten};border:1px solid ${ink.rutnat};box-shadow:0 10px 28px -14px rgba(0,0,0,.4);border-radius:6px;padding:9px 11px;color:${ink.stark};white-space:nowrap;z-index:10;min-width:200px;font-size:12px` });
  rot.appendChild(tips);

  // ── Grafen ────────────────────────────────────────────────────────────────
  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img")
    .attr("aria-label", "Befolkningen efter ålder").style("display", "block").style("overflow", "visible")
    .style("font-family", "var(--graf-text-font)").style("text-rendering", "geometricPrecision");
  kol.appendChild(svg.node());
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const sx = d3.scaleLinear().domain([-0.5, X_MAX]).range([0, iw]);
  const sy = d3.scaleLinear().range([ih, 0]);
  const xFor = a => sx(a >= OPPEN ? X_OPPEN : a);
  const lager = n => g.append("g").attr("class", n);
  const gBand = lager("band"), gRut = lager("rut").attr("shape-rendering", "crispEdges"), gAx = lager("ax");
  const gLin = lager("lin").attr("pointer-events", "none"), gOpp = lager("opp").attr("pointer-events", "none");
  const gHov = lager("hov").attr("pointer-events", "none");

  // Åldersgruppernas band, gruppnamn och födelseår ovanför ritytan
  const BAND = [[-0.5, 19.5], [19.5, 64.5], [64.5, 79.5], [79.5, X_MAX]];
  const bandTopp = -M.top + 4;
  GRUPPER.forEach((gr, i) => {
    const [a, b] = BAND[i], x0 = sx(a), x1 = sx(b), xm = (x0 + x1) / 2;
    gBand.append("rect").attr("x", x0).attr("y", bandTopp).attr("width", x1 - x0).attr("height", ih - bandTopp).attr("fill", bandFyll[i]);
    if (i > 0) gBand.append("line").attr("x1", Math.round(x0) + 0.5).attr("x2", Math.round(x0) + 0.5).attr("y1", bandTopp).attr("y2", ih)
      .attr("stroke", ink.linje).attr("stroke-dasharray", "2 3").attr("stroke-opacity", 0.8);
    gBand.append("text").attr("class", `bt bt${i}`).attr("x", xm).attr("y", bandTopp + 15).attr("text-anchor", "middle")
      .attr("font-size", 12.5).attr("font-weight", 600).attr("fill", ink.mjuk).text(gr.namn);
    gBand.append("text").attr("x", xm).attr("y", bandTopp + 28).attr("text-anchor", "middle")
      .attr("font-size", 9.5).attr("fill", ink.svag).text(foddGrupp(gr));
  });

  // x-axlarna: ålder och födelseår
  const AX1 = ih + 16, AXL = ih + 25, AX2 = ih + 39;
  gRut.append("line").attr("x1", 0).attr("x2", iw).attr("y1", ih + 0.5).attr("y2", ih + 0.5).attr("stroke", ink.linje);
  gRut.append("line").attr("x1", 0).attr("x2", iw).attr("y1", AXL + 0.5).attr("y2", AXL + 0.5).attr("stroke", ink.rutnat);
  const aldTicks = [...d3.range(0, OPPEN, 10), OPPEN];
  for (const a of aldTicks) {
    const x = Math.round(xFor(a)) + 0.5;
    gRut.append("line").attr("x1", x).attr("x2", x).attr("y1", ih).attr("y2", ih + 4).attr("stroke", ink.linje);
    gAx.append("text").attr("x", xFor(a)).attr("y", AX1).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10.5)
      .attr("fill", ink.mjuk).text(alderKort(a));
  }
  const arTicks = [];
  for (let y = Math.floor(AR / 10) * 10; AR - y <= OPPEN - 1; y -= 10) if (AR - y >= 0) arTicks.push(y);
  for (const y of arTicks) {
    const x = Math.round(sx(AR - y)) + 0.5;
    gRut.append("line").attr("x1", x).attr("x2", x).attr("y1", AXL).attr("y2", AXL + 4).attr("stroke", ink.linje);
    gAx.append("text").attr("x", sx(AR - y)).attr("y", AX2).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10.5)
      .attr("fill", ink.svag).text(y);
  }
  gAx.append("text").attr("x", xFor(OPPEN)).attr("y", AX2).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10.5)
    .attr("fill", ink.svag).text(foddKort(OPPEN));
  for (const [t, y] of [["Ålder", AX1], ["Född", AX2]]) {
    gAx.append("text").attr("x", -M.left).attr("y", y).attr("font-size", 9.5).attr("letter-spacing", "0.08em")
      .attr("fill", ink.svag).text(t.toUpperCase());
  }
  // Brytmarkering på axeln mellan 99 och 100+
  const xb = sx((OPPEN - 1 + X_OPPEN) / 2);
  gAx.append("path").attr("d", `M${xb - 4},${ih + 4}l3,-8M${xb},${ih + 4}l3,-8`).attr("stroke", ink.svag).attr("stroke-width", 1).attr("fill", "none");
  gAx.append("rect").attr("x", xb - 4).attr("y", ih - 0.5).attr("width", 6).attr("height", 2).attr("fill", bakgrund);
  const yAx = gAx.append("g");

  // Hovringslagret: lodrätt streck, prickar och markeringar på båda axlarna
  const hStreck = gHov.append("line").attr("y1", bandTopp + 32).attr("y2", ih).attr("stroke", ink.mjuk).attr("stroke-width", 1).attr("stroke-opacity", 0.6).attr("opacity", 0);
  const hPrickar = gHov.append("g");
  const pill = () => { const p = gHov.append("g").attr("opacity", 0); p.append("rect").attr("rx", 3).attr("fill", ink.stark); p.append("text").attr("text-anchor", "middle").attr("dy", "0.34em").attr("font-family", MONO).attr("font-size", 10.5).attr("font-weight", 600).attr("fill", bakgrund); return p; };
  const pAlder = pill(), pAr = pill();
  const yta = g.append("rect").attr("x", -6).attr("y", bandTopp).attr("width", iw + 12).attr("height", ih - bandTopp + M.bottom - 4)
    .attr("fill", "transparent").style("cursor", "crosshair");

  // ── Tabellen ──────────────────────────────────────────────────────────────
  const tab = el("div", { class: "ad-tab" });
  tabYta.appendChild(tab);
  let tabCeller = [];      // [{ kod, celler: [...] }]
  function prov(e, w = 16) {
    const s = d3.create("svg").attr("width", w).attr("height", 8);
    s.append("line").attr("x1", 1).attr("x2", w - 1).attr("y1", 4).attr("y2", 4).attr("stroke", e.farg)
      .attr("stroke-width", e.rike ? 2.6 : 2.4).attr("stroke-linecap", "round").attr("stroke-dasharray", e.rike ? "0.1 4" : null);
    return s.node().outerHTML;
  }
  function byggTabell() {
    const valda = st.valda.map(k => enhMap.get(k)).filter(Boolean);
    const max = GRUPPER.map((_, i) => d3.max(valda, e => e.grp[i]) || 1);
    tab.replaceChildren();
    tab.appendChild(el("div", { class: "ad-over" }, "Andel av invånarna per åldersgrupp, procent"));
    tab.appendChild(el("div", { class: "ad-th ad-namn" }, "&nbsp;<small>&nbsp;</small>"));
    GRUPPER.forEach(gr => tab.appendChild(el("div", { class: "ad-th", "data-g": gr.id }, `${gr.kort}<small>år</small>`)));
    tab.appendChild(el("div", { class: "ad-th" }, `Median<small>ålder, år</small>`));
    tabCeller = valda.map(e => {
      const celler = [];
      const c0 = el("div", { class: "ad-c ad-namn", title: e.namn }, `${prov(e)}${e.namn}<small>${tal.format(e.summa)} inv.</small>`);
      celler.push(c0);
      GRUPPER.forEach((gr, i) => {
        const c = el("div", { class: "ad-c", "data-g": gr.id }, `${pct1(e.grp[i])}<i style="width:${Math.max(2, (100 * e.grp[i]) / max[i])}%;background:${e.farg};opacity:${e.rike ? 0.75 : 0.85}"></i>`);
        celler.push(c);
      });
      celler.push(el("div", { class: "ad-c ad-med", title: "Medianålder: hälften är yngre, hälften äldre" }, nf(1).format(e.median)));
      for (const c of celler) {
        c.addEventListener("pointerenter", () => { lyft = e.kod; malaLyft(); rita(); });
        c.addEventListener("pointerleave", () => { if (lyft === e.kod) { lyft = null; malaLyft(); rita(); } });
        tab.appendChild(c);
      }
      return { kod: e.kod, celler };
    });
    malaLyft();
    malaGrupp();
  }
  function malaLyft() { for (const r of tabCeller) r.celler.forEach(c => c.classList.toggle("hr", r.kod === lyft)); }
  function malaGrupp() {
    const gi = hovA == null ? null : gruppFor(hovA).id;
    tab.querySelectorAll("[data-g]").forEach(c => c.classList.toggle("hg", gi != null && +c.dataset.g === gi));
    gBand.selectAll("text.bt").attr("fill", (_, i) => (gi === i ? ink.stark : ink.mjuk));
  }

  // ── Ritning med övergång ──────────────────────────────────────────────────
  const visas = new Map();   // kod → { V: Float64Array, op } — det som ritas just nu
  let dom = null, anim = null;
  function malDom() {
    let max = 0;
    for (const k of st.valda) { const e = enhMap.get(k); if (e) max = Math.max(max, d3.max(varden(e))); }
    if (!(max > 0)) max = 1;
    const ny = d3.scaleLinear().domain([0, max * 1.04]).nice(6).domain();
    return [0, ny[1]];
  }
  function uppdatera({ direkt = false } = {}) {
    const mal = new Map(st.valda.map(k => [k, varden(enhMap.get(k))]));
    const mdom = malDom();
    rubrik.innerHTML = `${st.matt === "antal" ? "Antal invånare i varje ettårsklass" : "Andel av invånarna i varje ettårsklass, procent"}<small>31 december ${AR}${st.utjamnad ? " · utjämnad" : ""}</small>`;
    kHV.classList.toggle("pa", FEM.length > 0 && FEM.every(k => st.valda.includes(k)));
    byggTabell();
    for (const k of [...visas.keys()]) if (!mal.has(k)) visas.delete(k);
    if (direkt || !dom || typeof requestAnimationFrame === "undefined") {
      for (const [k, V] of mal) visas.set(k, { V: Float64Array.from(V), op: 1 });
      dom = mdom; anim = null; rita(); return;
    }
    const fran = new Map([...mal.keys()].map(k => [k, visas.get(k) ? { V: Float64Array.from(visas.get(k).V), op: visas.get(k).op, ny: false } : { V: mal.get(k), op: 0, ny: true }]));
    const d0 = [...dom], t0 = performance.now();
    const id = {};
    anim = id;
    const steg = () => {
      if (anim !== id) return;
      const t = Math.min(1, (performance.now() - t0) / OVERGANG_MS), e = d3.easeCubicOut(t);
      for (const [k, M_] of mal) {
        const f = fran.get(k), V = new Float64Array(M_.length);
        for (let i = 0; i < V.length; i++) V[i] = f.V[i] + (M_[i] - f.V[i]) * e;
        visas.set(k, { V, op: f.ny ? e : 1 });
      }
      dom = [d0[0] + (mdom[0] - d0[0]) * e, d0[1] + (mdom[1] - d0[1]) * e];
      rita();
      if (t < 1) requestAnimationFrame(steg); else anim = null;
    };
    requestAnimationFrame(steg);
  }

  const linje = d3.line().defined(v => ok(v[1])).x(v => sx(v[0])).y(v => sy(v[1]));
  function yFmt(v, steg) {
    if (Math.abs(v) < 1e-12) return "0";
    if (st.matt === "antal") return tal.format(v);
    const d = steg < 0.1 ? 2 : steg < 1 ? 1 : 0;
    return `${nf(d).format(v)} %`;
  }
  function rita() {
    sy.domain(dom);
    // y-axeln
    const yt = sy.ticks(6), steg = yt.length > 1 ? yt[1] - yt[0] : 1;
    gRut.selectAll("line.hy").data(yt.filter(v => v > 0), v => v).join("line").attr("class", "hy")
      .attr("x1", 0).attr("x2", iw).attr("y1", v => Math.round(sy(v)) + 0.5).attr("y2", v => Math.round(sy(v)) + 0.5)
      .attr("stroke", ink.rutnat).attr("stroke-opacity", 0.9);
    yAx.selectAll("text").data(yt, v => v).join("text").attr("x", -8).attr("y", v => sy(v)).attr("dy", "0.34em")
      .attr("text-anchor", "end").attr("font-family", MONO).attr("font-size", 10.5)
      .attr("fill", v => (v === 0 ? ink.mjuk : ink.svag)).text(v => yFmt(v, steg));
    // Linjerna: riket underst, sedan i knappordning. 0–99 som linje, 100+ som ring
    const poster = st.valda.map(k => enhMap.get(k)).filter(e => e && visas.has(e.kod))
      .sort((a, b) => (b.rike ? 1 : 0) - (a.rike ? 1 : 0));
    const opFor = e => visas.get(e.kod).op * (lyft && lyft !== e.kod ? 0.22 : 1);
    gLin.selectAll("path").data(poster, e => e.kod).join(en => en.append("path").attr("fill", "none")
      .attr("stroke-linejoin", "round").attr("stroke-linecap", "round"))
      .attr("stroke", e => e.farg).attr("stroke-width", e => (e.rike ? 2.8 : lyft === e.kod ? 2.8 : 2.1))
      .attr("stroke-dasharray", e => (e.rike ? "0.1 4.2" : null)).attr("stroke-opacity", opFor)
      .attr("d", e => { const V = visas.get(e.kod).V; const p = []; for (let a = 0; a < OPPEN; a++) p.push([a, V[a]]); return linje(p); });
    gOpp.selectAll("circle").data(poster, e => e.kod).join("circle").attr("r", 3.6)
      .attr("fill", bakgrund).attr("stroke", e => e.farg).attr("stroke-width", 1.8).attr("opacity", opFor)
      .attr("cx", sx(X_OPPEN)).attr("cy", e => sy(visas.get(e.kod).V[OPPEN]));
    ritaHov();
  }

  // ── Hovring ───────────────────────────────────────────────────────────────
  function placeraTips(gx, gy) {
    const rr = rot.getBoundingClientRect(), s = svg.node().getBoundingClientRect();
    const sk = rr.width / rot.offsetWidth || 1, svs = s.width / W;
    const px = ((s.left - rr.left) + (gx + M.left) * svs) / sk, py = ((s.top - rr.top) + (gy + M.top) * svs) / sk;
    const tw = tips.offsetWidth || 220, th = tips.offsetHeight || 120;
    // Helst till höger om strecket, men inte in över tabellen: då till vänster
    const kant = (s.right - rr.left) / sk + 6;
    const lx = px + 16 + tw > kant && px - 16 - tw >= 0 ? px - 16 - tw : px + 16;
    const ly = Math.max(0, Math.min(rot.offsetHeight - th - 4, py - th / 2));
    tips.style.transform = `translate(${Math.max(0, lx)}px, ${ly}px)`;
    tips.style.opacity = 1;
  }
  function visaPill(p, x, y, text) {
    const w = textbredd(text, 10.5, 600) + 12;
    p.attr("opacity", 1).attr("transform", `translate(${x},${y - 4})`);
    p.select("rect").attr("x", -w / 2).attr("y", -8.5).attr("width", w).attr("height", 17);
    p.select("text").text(text);
  }
  let tipsNyckel = null;
  function ritaHov() {
    if (hovA == null) {
      hStreck.attr("opacity", 0); hPrickar.selectAll("circle").remove();
      pAlder.attr("opacity", 0); pAr.attr("opacity", 0);
      tips.style.opacity = 0; tipsNyckel = null;
      malaGrupp();
      return;
    }
    const a = hovA, x = xFor(a);
    hStreck.attr("x1", x).attr("x2", x).attr("opacity", 1);
    const poster = st.valda.map(k => enhMap.get(k)).filter(e => e && visas.has(e.kod));
    hPrickar.selectAll("circle").data(poster, e => e.kod).join("circle").attr("r", e => (e.rike ? 3.4 : 3.8))
      .attr("fill", e => e.farg).attr("stroke", bakgrund).attr("stroke-width", 1.4)
      .attr("opacity", e => (lyft && lyft !== e.kod ? 0.3 : 1))
      .attr("cx", x).attr("cy", e => sy(visas.get(e.kod).V[a]));
    visaPill(pAlder, x, AX1, alderKort(a));
    visaPill(pAr, x, AX2, foddKort(a));
    malaGrupp();
    const nyckel = `${a}|${st.valda.join(",")}|${st.utjamnad}|${lyft}`;
    if (nyckel !== tipsNyckel) {
      tipsNyckel = nyckel;
      const gr = gruppFor(a);
      const rader = poster.map(e => ({ e, andel: e.andel[a], antal: e.antal[a] })).sort((p, q) => q.andel - p.andel);
      const prick = e => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${e.farg};margin-right:6px;vertical-align:middle${e.rike ? `;box-shadow:inset 0 0 0 2px ${botten}` : ""}"></span>`;
      const sv_ = t => `<span style="color:${ink.svag};font-size:9.5px;text-align:right">${t}</span>`;
      const rad_ = r => {
        const bg = lyft === r.e.kod ? `background:${tonad};` : "";
        return `<span style="${bg}padding:1px 2px;${r.e.rike ? "font-style:italic;" : ""}">${prick(r.e)}${r.e.namn}</span>`
          + `<span style="${bg}padding:1px 2px;font-family:${MONO};text-align:right;font-weight:600">${pct2(r.andel)}</span>`
          + `<span style="${bg}padding:1px 2px;font-family:${MONO};text-align:right;color:${ink.mjuk}">${tal.format(r.antal)}</span>`;
      };
      tips.innerHTML = `<div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">`
        + `<span style="font-weight:600;font-size:13.5px">${alderTxt(a)}</span>`
        + `<span style="font-family:${MONO};font-size:12px;font-weight:600">${fodd(a)}</span></div>`
        + `<div style="font-size:10.5px;color:${ink.svag};margin:2px 0 5px">Åldersgrupp ${gr.namn}</div>`
        + `<div style="display:grid;grid-template-columns:auto auto auto;column-gap:12px;row-gap:1px;align-items:baseline;padding-top:5px;border-top:1px solid ${ink.rutnat}">`
        + `<span></span>${sv_("andel")}${sv_("antal")}${rader.map(rad_).join("")}</div>`
        + (st.utjamnad ? `<div style="font-size:10px;color:${ink.svag};margin-top:6px">Linjerna är utjämnade, talen här är faktiska.</div>` : "");
    }
    placeraTips(x, Math.max(0, Math.min(ih, hovMy)));
  }
  yta.on("pointermove", ev => {
    const [mx, my] = d3.pointer(ev, g.node());
    const v = sx.invert(mx);
    const a = v > (OPPEN - 1 + X_OPPEN) / 2 ? OPPEN : Math.max(0, Math.min(OPPEN - 1, Math.round(v)));
    hovMy = my;
    if (a !== hovA) { hovA = a; ritaHov(); } else placeraTips(xFor(a), Math.max(0, Math.min(ih, my)));
  }).on("pointerleave", () => { hovA = null; ritaHov(); });

  // ── Styrning ──────────────────────────────────────────────────────────────
  rot.satt = ({ valda, matt, utjamnad } = {}) => {
    if (matt) { mattSeg.satt(matt, { tyst: true }); st.matt = mattSeg.varde(); }
    if (utjamnad != null) { utjSeg.satt(utjamnad ? "ja" : "nej", { tyst: true }); st.utjamnad = !!utjamnad; }
    if (valda) { krysset.satt(valda.map(String).filter(k => enhMap.has(k)), { tyst: true }); st.valda = krysset.valda(); }
    uppdatera();
  };
  rot.tillstand = () => ({
    valda: [...st.valda], matt: st.matt, utjamnad: st.utjamnad,
    enheter: ENH.map(e => ({ kod: e.kod, namn: e.namn, summa: e.summa, grupper: e.grp.map(v => Math.round(v * 10) / 10), median: Math.round(e.median * 10) / 10, andel100: Math.round(e.andel[OPPEN] * 1000) / 1000 }))
  });

  uppdatera({ direkt: true });
  return rot;
}
