// =============================================================================
// BOSTADSYTOR: bild 16 "Bostadsbyggandet", tre flikar
// =============================================================================
//
//   bostadsflikar(data, opts) → DOM-nod
//
// data = datasetet 3khv-bostadsdata:
//   { kalla,
//     bestand:  [{ kod, namn, ar, ... }]                       (bara namn på länen används)
//     hushall:  [{ kod, ar, personer_per_hushall, andel_1person, andel_2person, andel_3plus }],
//     priser:   [{ kod, ar, pris_tkr, real_tkr }],
//     inkomst:  [{ kod, ar, median_tkr }],                      (rev 1)
//     pris_inkomst: [{ kod, ar, kvot }],                        (rev 1)
//     perioder: [{ kod, period, fran, till, byggt, byggt_per_ar, per_1000_ar, typ: "utfall"|"behov" }] }
//
// Flikar (kontroller.flikar, → bläddrar till nästa flik):
//   1 "Bostäderna i dag"    småhuspriser år för år (segment realt/nominellt) i
//                           fokus; till höger hushållens storlek (kompakt) och
//                           prisförändringen sedan första året och 2015.
//   2 "Pris mot inkomst"    hur många medianinkomster ett småhus kostar
//                           (medelpris / medianinkomst samma år), år för år
//                           och senaste år som staplar. De fem + riket; länen
//                           tunt i stadens färg med segmentet "Med länen".
//   3 "Byggande och behov"  en panel per stad: färdigställda bostäder per
//                           femårsperiod (snitt per år), 2025 för sig och
//                           Boverkets behov 2026–30 och 2031–35 som randiga
//                           staplar. Segment antal / per 1 000 invånare. Samma
//                           y-skala i alla paneler. (Riket som markör borttaget i rev 1.)
//
// opts: { temaNamn, width = 960, height = 540, steg = true,
//         ordning = null (koder; standard = flest bostäder först),
//         flikEtiketter = ["Bostäderna i dag", "Pris mot inkomst", "Byggande och behov"],
//         kalla = null ({ idag, inkomst, bygg } eller en sträng för alla flikar;
//                       inkomst saknas → källrad byggd av inkomstNamn),
//         inkomstNamn = null (vilken medianinkomst; standard läses ur data.kalla/om),
//         prisLage = "real", byggLage = "antal", inkomstLage = "stader" | "lan" }
// opts.miljoText (fliken "Miljöhänsyn") togs bort i rev 1 och ignoreras.
// =============================================================================

import { d3 } from "../lib/d3.js";
import { aktivtTema } from "../lib/tema.js";
import { flikar, segment } from "./kontroller.js";
import { placeraEtiketter, ritaEtiketter } from "./etiketter.js";
import { ram, el, f, tipsruta, MONO, STADER, RIKET } from "./ytstod.js";

const STIL = `
.bo svg { display:block; overflow:visible; font-family:Inter, system-ui, sans-serif; }
.bo .bo-yta { display:flex; flex-direction:column; }
.bo .bo-hd { display:flex; align-items:center; gap:14px; min-height:26px; margin-bottom:6px; }
.bo .bo-hd .u { font-size:11.5px; color:var(--ink-svag); flex:1; }
.bo .bo-titel { font-size:13px; font-weight:600; color:var(--ink); }
.bo .bo-undertitel { font-size:10.5px; color:var(--ink-svag); margin:1px 0 6px; }
.bo .bo-nyckel { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:10.5px; color:var(--ink-mjuk); margin:0 0 4px; }
.bo .bo-nyckel i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:5px; vertical-align:-0.5px; }
.bo .bo-kalla { font-size:10.5px; color:var(--ink-svag); margin-top:auto; padding-top:6px; line-height:1.4; }
.bo .bo-delar { display:grid; gap:0 34px; flex:1; min-height:0; }
.bo .bo-tab { display:grid; grid-template-columns:minmax(0,1fr) 62px 74px 74px; column-gap:6px; align-items:baseline; font-size:12px; }
.bo .bo-tab .h { font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-svag); text-align:right; padding-bottom:4px; border-bottom:1px solid var(--ink-linje); white-space:nowrap; }
.bo .bo-tab .h:first-child { text-align:left; }
.bo .bo-tab .n { font-weight:600; padding:3px 0; white-space:nowrap; }
.bo .bo-tab .v { font-family:${MONO}; font-size:11.5px; text-align:right; white-space:nowrap; padding:3px 0; }
.bo .bo-tab .riket { border-top:1px solid var(--ink-rutnat); }
`;

const HUSHALL = [
  { id: "andel_1person", namn: "1 person", farg: "#004990" },
  { id: "andel_2person", namn: "2 personer", farg: "#2DB8F6" },
  { id: "andel_3plus", namn: "3 eller fler", farg: "#A2D9F8" }
];
// Länet som hör till respektive stad (4-siffriga länskoder i bostadsdatan)
const LAN_STAD = { "0007": "0780", "0008": "0880", "0010": "1080", "0012": "1290", "0013": "1380" };
const LAN_NAMN = { "0007": "Kronobergs län", "0008": "Kalmar län", "0010": "Blekinge län", "0012": "Skåne län", "0013": "Hallands län" };

export function bostadsflikar(data, {
  temaNamn = aktivtTema(), width = 960, height = 540, steg = true, ordning = null,
  flikEtiketter = ["Bostäderna i dag", "Pris mot inkomst", "Byggande och behov"],
  kalla = null, inkomstNamn = null, prisLage = "real", byggLage = "antal", inkomstLage = "stader"
} = {}) {
  const R = ram({ temaNamn, width, height, klass: "bo", stil: STIL });
  const tips = tipsruta(R.rot);
  const k = typeof kalla === "string" ? { idag: kalla, inkomst: kalla, bygg: kalla } : (kalla ?? {});
  const fem = (ordning ?? null) || ordningEfterStorlek(data);
  const namn = kod => STADER.find(s => s.kod === kod)?.namn ?? LAN_NAMN[kod] ?? data.bestand?.find(d => d.kod === kod)?.namn ?? (kod === RIKET ? "Riket" : kod);
  const ctx = { ...R, tips, data, fem, namn, W: width, H: height - 44 };
  const ink = inkomstNamn ?? inkomstText(data);
  const kallaInkomst = k.inkomst ?? `Källa: SCB, köpeskilling för permanenta småhus (BO0501) och ${ink}, löpande priser.`;
  R.rot.appendChild(flikar([
    { etikett: flikEtiketter[0], bygg: () => idag(ctx, { kalla: k.idag ?? data.kalla, prisLage }) },
    { etikett: flikEtiketter[1], bygg: () => prisInkomst(ctx, { kalla: kallaInkomst, lage: inkomstLage, inkomstNamn: ink }) },
    { etikett: flikEtiketter[2], bygg: () => bygg(ctx, { kalla: k.bygg ?? data.kalla, byggLage }) }
  ], { steg }));
  return R.rot;
}

// Vilken medianinkomst datan avser, ur kalla/om (dataagenten dokumenterar den där)
function inkomstText(data) {
  const t = [data.inkomst_kalla, data.kalla, data.om].filter(Boolean).join(" ");
  if (/disponib/i.test(t)) return `median av hushållens disponibla inkomst, alla hushåll${/HE0110/.test(t) ? " (HE0110)" : ""}`;
  if (/sammanr|förvärvsinkomst/i.test(t)) return "median av sammanräknad förvärvsinkomst 20–64 år";
  return "medianinkomst";
}

function ordningEfterStorlek(data) {
  const sista = d3.max(data.bestand ?? [], d => d.ar);
  const tot = new Map((data.bestand ?? []).filter(d => d.ar === sista).map(d => [d.kod, d.totalt]));
  return STADER.map(s => s.kod).sort((a, b) => (tot.get(b) ?? 0) - (tot.get(a) ?? 0));
}

// Gemensam linjegraf med etikettkolumn, hovring och tunna läns-/referenslinjer
function linjegraf(svg, { serier, falt, sx, ar, ink, farg, tips, namn, botten, iw, ih, M, tf, tipsText, yNoll = true, hovStart = null }) {
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  let hov = hovStart;
  const c = k => farg[LAN_STAD[k] ?? k] ?? ink.stark;
  const vs = serier.flatMap(s => s.v.map(d => d[falt])).filter(Number.isFinite);
  const sy = d3.scaleLinear().domain([yNoll ? 0 : d3.min(vs) * 0.95, d3.max(vs) * 1.05]).nice(5).range([ih, 0]);
  function rita() {
    g.selectAll("*").remove();
    for (const t of sy.ticks(5)) {
      const y = Math.round(sy(t)) + 0.5;
      g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y).attr("y2", y).attr("stroke", ink.rutnat);
      g.append("text").attr("x", -6).attr("y", y).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(tf(t));
    }
    const A0 = ar[0], A1 = ar[ar.length - 1];
    const tickAr = [A0, ...d3.range(Math.ceil((A0 + 2) / 5) * 5, A1 - 1, 5), A1];
    for (const t of tickAr) g.append("text").attr("x", sx(t)).attr("y", ih + 16).attr("text-anchor", t === A0 ? "start" : t === A1 ? "end" : "middle").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(t);
    const ln = d3.line().defined(d => Number.isFinite(d[falt])).x(d => sx(d.ar)).y(d => sy(d[falt]));
    const lan = s => !!LAN_STAD[s.k];
    for (const s of [...serier].sort((a, b) => lan(b) - lan(a))) g.append("path").attr("d", ln(s.v)).attr("fill", "none").attr("stroke", c(s.k))
      .attr("stroke-width", s.k === RIKET ? 1.6 : lan(s) ? 1.2 : 2.2).attr("stroke-dasharray", s.k === RIKET ? "4 3" : lan(s) ? "2 2" : null)
      .attr("stroke-opacity", hov && hov !== s.k ? 0.15 : lan(s) ? 0.7 : 1);
    const lista = serier.map(s => {
      const d = [...s.v].reverse().find(q => Number.isFinite(q[falt]));
      return d && { id: s.k, text: `${namn(s.k)} ${tf(d[falt])}`, ankarY: sy(d[falt]), ankarX: sx(d.ar), prioritet: s.k === RIKET ? 1 : lan(s) ? 0 : 2 };
    }).filter(Boolean);
    const pl = placeraEtiketter(lista, { yMin: 0, yMax: ih, avstand: 13, maxBredd: M.right - 20, px: 10.5 }).map(e => ({ ...e, ankarX: lista.find(q => q.id === e.id).ankarX }));
    ritaEtiketter(g.append("g"), pl, {
      farg: e => c(e.id), px: 10.5, avstand: 13, halo: botten,
      vikt: e => (LAN_STAD[e.id] ? 400 : 600),
      opacitet: e => (hov && hov !== e.id ? 0.3 : LAN_STAD[e.id] ? 0.8 : 1)
    });
    g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("pointermove", ev => {
        const [mx, my] = d3.pointer(ev);
        const a = Math.round(sx.invert(mx));
        let bast = null, av = 20;
        for (const s of serier) { const q = s.v.find(d => d.ar === a); if (q && Number.isFinite(q[falt])) { const dd = Math.abs(sy(q[falt]) - my); if (dd < av) { av = dd; bast = { s, q }; } } }
        const id = bast?.s.k ?? null;
        if (id !== hov) { hov = id; rita(); }
        if (!bast) return tips.dolj();
        tips.visa(tipsText(bast.s.k, bast.q, a), ev);
      })
      .on("pointerleave", () => { tips.dolj(); if (hov) { hov = null; rita(); } });
  }
  rita();
  return { satHov(k) { if (k !== hov) { hov = k; rita(); } } };
}

// ── Flik 1: bostäderna i dag ────────────────────────────────────────────────
function idag(ctx, { kalla, prisLage }) {
  const { W, H, fem, namn, data, ink, farg, tips, botten } = ctx;
  const yta = el("div", { class: "bo-yta", style: `width:${W}px;height:${H}px` });
  const hogerW = 316, gap = 34, vansterW = W - hogerW - gap;
  const delar = el("div", { class: "bo-delar", style: `grid-template-columns:${vansterW}px ${hogerW}px` });
  yta.appendChild(delar);
  if (kalla) yta.appendChild(el("div", { class: "bo-kalla" }, kalla));
  const kallaH = kalla ? 30 : 0;
  const radKoder = [...fem, RIKET];
  const vanster = el("div", { style: "display:flex;flex-direction:column;min-width:0" });
  const hoger = el("div", { style: "display:flex;flex-direction:column;gap:22px;min-width:0;padding-top:4px" });
  delar.append(vanster, hoger);

  // Priser i fokus (vänster), prisförändring och hushåll (höger)
  const priser = data.priser ?? [];
  const sistaAr = d3.max(priser, d => d.ar);
  const forstaAr = d3.min(priser, d => d.ar);
  let nu = prisLage;
  const hd = el("div", { class: "bo-hd", style: "margin-bottom:0" });
  hd.appendChild(el("span", { class: "bo-titel" }, "Småhusens medelpris"));
  hd.appendChild(el("span", { style: "flex:1" }));
  hd.appendChild(segment({ val: [{ id: "real", etikett: "Realt" }, { id: "nominellt", etikett: "Nominellt" }], varde: nu, vidByte: v => { nu = v; ritaPris(); } }));
  vanster.appendChild(hd);
  const under = el("div", { class: "bo-undertitel" });
  vanster.appendChild(under);
  const pris = el("div");
  vanster.appendChild(pris);
  const svgH = H - kallaH - 50;

  const tabell = el("div");
  hoger.appendChild(tabell);

  function ritaPris() {
    const falt = nu === "real" ? "real_tkr" : "pris_tkr";
    under.textContent = nu === "real" ? `Köpeskilling för permanenta småhus, tusen kronor i ${sistaAr} års penningvärde (KPI)` : "Köpeskilling för permanenta småhus, tusen kronor i löpande priser";
    pris.replaceChildren();
    const svg = d3.select(pris).append("svg").attr("width", vansterW).attr("height", svgH);
    const M = { top: 8, right: 118, bottom: 22, left: 44 };
    const iw = vansterW - M.left - M.right, ih = svgH - M.top - M.bottom;
    const ar = [...new Set(priser.map(d => d.ar))].sort((a, b) => a - b);
    const sx = d3.scaleLinear().domain(d3.extent(ar)).range([0, iw]);
    const per = d3.group(priser.filter(d => radKoder.includes(d.kod)), d => d.kod);
    const serier = radKoder.filter(k => per.has(k)).map(k => ({ k, v: per.get(k).slice().sort((a, b) => a.ar - b.ar) }));
    linjegraf(svg, {
      serier, falt, sx, ar, ink, farg, tips, namn, botten, iw, ih, M, tf: f.tal,
      tipsText: (k, q, a) => `<b>${namn(k)}</b> <span class="s">${a}</span><br><span class="m">${f.tal(q[falt])}</span> <span class="s">tusen kr ${nu === "real" ? `(${sistaAr} års priser)` : "(löpande)"}</span>`
    });
    ritaTabell(falt);
  }

  // Prisförändring: senaste pris, förändring sedan första året och sedan 2015
  function ritaTabell(falt) {
    const mitt = 2015;
    const v = (kod, a) => priser.find(d => d.kod === kod && d.ar === a)?.[falt];
    const rader = radKoder.map(kod => ({ kod, sista: v(kod, sistaAr), forsta: v(kod, forstaAr), mitt: v(kod, mitt) }))
      .filter(r => Number.isFinite(r.sista));
    const fem_ = rader.filter(r => r.kod !== RIKET).sort((a, b) => b.sista - a.sista);
    const rk = rader.find(r => r.kod === RIKET);
    const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? f.plusPct((a / b - 1) * 100) : "–");
    let html = `<div class="bo-titel">Prisutveckling</div><div class="bo-undertitel">${nu === "real" ? `Real förändring (${sistaAr} års penningvärde)` : "Förändring i löpande priser"}</div>`;
    html += `<div class="bo-tab"><span class="h">Kommun</span><span class="h">${sistaAr}, tkr</span><span class="h">sedan ${forstaAr}</span><span class="h">sedan ${mitt}</span>`;
    for (const r of [...fem_, ...(rk ? [rk] : [])]) {
      const kl = r.kod === RIKET ? " riket" : "";
      html += `<span class="n${kl}" style="color:${farg[r.kod] ?? ink.stark}">${namn(r.kod)}</span><span class="v${kl}">${f.tal(r.sista)}</span><span class="v${kl}">${pct(r.sista, r.forsta)}</span><span class="v${kl}">${pct(r.sista, r.mitt)}</span>`;
    }
    tabell.innerHTML = html + "</div>";
  }
  ritaPris();

  // Hushållens storlek, kompakt
  const sistaH = d3.max(data.hushall ?? [], d => d.ar);
  const hh = new Map((data.hushall ?? []).filter(d => d.ar === sistaH).map(d => [d.kod, d]));
  hoger.appendChild(block({
    titel: "Hushållen", under: `Andel av hushållen efter storlek ${sistaH ?? ""}, procent`, nyckel: HUSHALL.map(b => ({ namn: b.namn, farg: b.farg })),
    rader: radKoder.filter(k => hh.has(k)).map(k => {
      const d = hh.get(k);
      return { kod: k, namn: namn(k), delar: HUSHALL.map(b => ({ ...b, andel: d[b.id] ?? 0 })), hoger: f.dec2(d.personer_per_hushall) };
    }), W: hogerW, ink, farg, tips, hogerRubrik: "pers./hushåll"
  }));
  return yta;
}

// 100 %-staplar, en rad per enhet (kompakt)
function block({ titel, under, nyckel, rader, W, ink, farg, tips, hogerRubrik }) {
  const b = el("div");
  b.appendChild(el("div", { class: "bo-titel" }, titel));
  b.appendChild(el("div", { class: "bo-undertitel" }, under));
  const ny = el("div", { class: "bo-nyckel" });
  for (const n of nyckel) ny.appendChild(el("span", {}, `<i style="background:${n.farg}"></i>${n.namn}`));
  b.appendChild(ny);
  const labW = 86, hogW = 50, rh = 17, gap = 4;
  const bw = W - labW - hogW;
  const H = rader.length * (rh + gap) + 14;
  const svg = d3.select(b).append("svg").attr("width", W).attr("height", H);
  svg.append("text").attr("x", W).attr("y", 7).attr("text-anchor", "end").attr("font-size", 9.5).attr("fill", ink.svag).text(hogerRubrik);
  rader.forEach((r, i) => {
    const y = 14 + i * (rh + gap);
    const c = farg[r.kod];
    if (r.kod === RIKET) svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", y - gap / 2 - 0.5).attr("y2", y - gap / 2 - 0.5).attr("stroke", ink.linje);
    svg.append("text").attr("x", labW - 8).attr("y", y + rh / 2).attr("dy", "0.34em").attr("text-anchor", "end")
      .attr("font-size", 11.5).attr("font-weight", 600).attr("fill", c ?? ink.stark).text(r.namn);
    let x = labW;
    for (const d of r.delar) {
      const w = (d.andel / 100) * bw;
      if (w <= 0) continue;
      svg.append("rect").attr("x", x).attr("y", y).attr("width", Math.max(0, w - 1)).attr("height", rh).attr("fill", d.farg)
        .on("pointermove", ev => tips.visa(`<b>${r.namn}</b><br><span class="s">${d.namn}</span> <span class="m">${f.pct(d.andel)}</span>`, ev))
        .on("pointerleave", () => tips.dolj());
      if (w > 24) svg.append("text").attr("x", x + w / 2).attr("y", y + rh / 2).attr("dy", "0.34em").attr("text-anchor", "middle")
        .attr("font-family", MONO).attr("font-size", 9.5).attr("pointer-events", "none")
        .attr("fill", ["#004990"].includes(d.farg) ? "#fff" : "#0D0D0D").text(f.tal(d.andel));
      x += w;
    }
    svg.append("text").attr("x", W).attr("y", y + rh / 2).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-family", MONO)
      .attr("font-size", 11).attr("fill", ink.stark).text(r.hoger);
  });
  return b;
}

// ── Flik 2: pris mot inkomst ────────────────────────────────────────────────
function prisInkomst(ctx, { kalla, lage, inkomstNamn }) {
  const { W, H, fem, namn, data, ink, farg, tips, botten } = ctx;
  const yta = el("div", { class: "bo-yta", style: `width:${W}px;height:${H}px` });
  const kvot = (data.pris_inkomst ?? []).filter(d => Number.isFinite(d.kvot));
  const inkomst = new Map((data.inkomst ?? []).map(d => [`${d.kod}|${d.ar}`, d.median_tkr]));
  const prisMap = new Map((data.priser ?? []).map(d => [`${d.kod}|${d.ar}`, d.pris_tkr]));
  const kallaH = kalla ? 30 : 0;
  if (!kvot.length) {
    yta.appendChild(el("div", { class: "bo-undertitel", style: "font-size:13px;margin-top:40px" }, "Uppgifterna om pris mot inkomst saknas i datan (pris_inkomst)."));
    if (kalla) yta.appendChild(el("div", { class: "bo-kalla" }, kalla));
    return yta;
  }
  let nu = lage;
  const hd = el("div", { class: "bo-hd" });
  hd.appendChild(segment({ val: [{ id: "stader", etikett: "De fem och riket" }, { id: "lan", etikett: "Med länen" }], varde: nu, vidByte: v => { nu = v; rita(); } }));
  hd.appendChild(el("span", { class: "u" }, `Hur många årsinkomster ett småhus kostar: småhusens medelpris delat med ${/disponib/.test(inkomstNamn) ? "hushållens medianinkomst (disponibel inkomst)" : "medianinkomsten"} samma år`));
  yta.appendChild(hd);
  const hogerW = 300, gap = 30, vansterW = W - hogerW - gap;
  const delar = el("div", { class: "bo-delar", style: `grid-template-columns:${vansterW}px ${hogerW}px` });
  yta.appendChild(delar);
  if (kalla) yta.appendChild(el("div", { class: "bo-kalla" }, kalla));
  const vanster = el("div"), hoger = el("div", { style: "display:flex;flex-direction:column;min-width:0" });
  delar.append(vanster, hoger);
  const svgH = H - kallaH - 40;
  const ar = [...new Set(kvot.map(d => d.ar))].sort((a, b) => a - b);
  const sistaAr = ar[ar.length - 1];
  const per = d3.group(kvot, d => d.kod);
  const lanKoder = Object.keys(LAN_STAD).filter(k => per.has(k));
  let graf = null;

  function tipsText(k, q, a) {
    const ink_ = inkomst.get(`${k}|${a}`), p = prisMap.get(`${k}|${a}`);
    return `<b>${namn(k)}</b> <span class="s">${a}</span><br><span class="m">${f.dec1(q.kvot)}</span> <span class="s">årsinkomster</span>` +
      (Number.isFinite(p) ? `<br><span class="s">Medelpris</span> <span class="m">${f.tal(p)}</span> <span class="s">tusen kr</span>` : "") +
      (Number.isFinite(ink_) ? `<br><span class="s">Medianinkomst</span> <span class="m">${f.tal(ink_)}</span> <span class="s">tusen kr</span>` : "");
  }

  function rita() {
    const koder = [...fem, RIKET, ...(nu === "lan" ? lanKoder : [])].filter(k => per.has(k));
    vanster.replaceChildren();
    const svg = d3.select(vanster).append("svg").attr("width", vansterW).attr("height", svgH);
    const M = { top: 10, right: nu === "lan" ? 150 : 118, bottom: 22, left: 34 };
    const iw = vansterW - M.left - M.right, ih = svgH - M.top - M.bottom;
    const sx = d3.scaleLinear().domain(d3.extent(ar)).range([0, iw]);
    const serier = koder.map(k => ({ k, v: per.get(k).slice().sort((a, b) => a.ar - b.ar) }));
    graf = linjegraf(svg, { serier, falt: "kvot", sx, ar, ink, farg, tips, namn, botten, iw, ih, M, tf: f.dec1, tipsText });
    staplar(koder);
  }

  // Senaste år som liggande staplar
  function staplar(koder) {
    hoger.replaceChildren();
    hoger.appendChild(el("div", { class: "bo-titel" }, `Årsinkomster per småhus ${sistaAr}`));
    const sista = k => per.get(k)?.find(d => d.ar === sistaAr)?.kvot;
    const rad = k => ({ k, v: sista(k) });
    const femR = koder.filter(k => k !== RIKET && !LAN_STAD[k]).map(rad).filter(r => Number.isFinite(r.v)).sort((a, b) => b.v - a.v);
    const rk = koder.includes(RIKET) ? [rad(RIKET)].filter(r => Number.isFinite(r.v)) : [];
    const lanR = koder.filter(k => LAN_STAD[k]).map(rad).filter(r => Number.isFinite(r.v)).sort((a, b) => b.v - a.v);
    const fsta = per.get(RIKET)?.find(d => d.ar === ar[0])?.kvot;
    hoger.appendChild(el("div", { class: "bo-undertitel" }, `Medelpris delat med medianinkomst${Number.isFinite(fsta) ? `. Riket ${ar[0]}: ${f.dec1(fsta)}` : ""}`));
    const alla = [...femR, ...rk, ...lanR];
    const labW = 104, valW = 34, rh = 20, gapR = 6, sep = 12;
    const bw = hogerW - labW - valW;
    const h = alla.length * (rh + gapR) + (rk.length ? sep : 0) + (lanR.length ? sep : 0) + 6;
    const svg = d3.select(hoger).append("svg").attr("width", hogerW).attr("height", h);
    const sxB = d3.scaleLinear().domain([0, d3.max(alla, r => r.v) * 1.02]).range([0, bw]);
    let y = 4;
    const ritaRad = (r, typ) => {
      const c = farg[LAN_STAD[r.k] ?? r.k] ?? ink.stark;
      const lan = typ === "lan";
      const gg = svg.append("g").attr("transform", `translate(0,${y})`).style("cursor", "default");
      gg.append("text").attr("x", labW - 8).attr("y", rh / 2).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-size", lan ? 10.5 : 11.5).attr("font-weight", lan ? 400 : 600).attr("fill", c).attr("opacity", lan ? 0.85 : 1).text(namn(r.k));
      const rect = gg.append("rect").attr("x", labW).attr("y", lan ? 4 : 2).attr("height", lan ? rh - 8 : rh - 4).attr("width", Math.max(1, sxB(r.v))).attr("rx", 1.5);
      if (r.k === RIKET) rect.attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.4).attr("stroke-dasharray", "4 3");
      else rect.attr("fill", c).attr("fill-opacity", lan ? 0.35 : 0.9);
      gg.append("text").attr("x", labW + sxB(r.v) + 5).attr("y", rh / 2).attr("dy", "0.34em").attr("font-family", MONO).attr("font-size", 11)
        .attr("fill", ink.stark).attr("opacity", lan ? 0.8 : 1).text(f.dec1(r.v));
      gg.append("rect").attr("width", hogerW).attr("height", rh).attr("fill", "transparent")
        .on("pointerenter", () => graf?.satHov(r.k)).on("pointerleave", () => graf?.satHov(null));
      y += rh + gapR;
    };
    femR.forEach(r => ritaRad(r, "stad"));
    if (rk.length) {
      y += sep / 2; svg.append("line").attr("x1", 0).attr("x2", hogerW).attr("y1", y - gapR / 2 - sep / 2 + 0.5).attr("y2", y - gapR / 2 - sep / 2 + 0.5).attr("stroke", ink.linje);
      y += sep / 2; rk.forEach(r => ritaRad(r, "riket"));
    }
    if (lanR.length) { y += sep; lanR.forEach(r => ritaRad(r, "lan")); }
  }
  rita();
  return yta;
}

// ── Flik 3: byggande och behov ──────────────────────────────────────────────
function bygg(ctx, { kalla, byggLage }) {
  const { W, H, fem, namn, data, ink, farg, tips } = ctx;
  const yta = el("div", { class: "bo-yta", style: `width:${W}px;height:${H}px` });
  const hd = el("div", { class: "bo-hd" });
  let nu = byggLage;
  const under = el("span", { class: "u" });
  hd.append(segment({ val: [{ id: "antal", etikett: "Bostäder per år" }, { id: "per1000", etikett: "Per 1 000 invånare" }], varde: nu, vidByte: v => { nu = v; rita(); } }), under);
  yta.appendChild(hd);
  const kallaH = kalla ? 30 : 0;
  const svgH = H - 32 - kallaH;
  const svg = d3.select(yta).append("svg").attr("width", W).attr("height", svgH);
  if (kalla) yta.appendChild(el("div", { class: "bo-kalla" }, kalla));

  const per = d3.group(data.perioder ?? [], d => d.kod);
  const ordningP = p => (p.fran ?? 0);
  const gap = 18, M = { top: 30, bottom: 34, left: 38 };
  const pw = (W - M.left - gap * (fem.length - 1)) / fem.length;
  const ih = svgH - M.top - M.bottom;
  const g0 = svg.append("g");
  const kortP = p => `${String(p.fran).slice(2)}`;
  function rita() {
    g0.selectAll("*").remove();
    const falt = nu === "antal" ? "byggt_per_ar" : "per_1000_ar";
    under.textContent = nu === "antal"
      ? "Färdigställda bostäder per år, snitt per femårsperiod · randigt = Boverkets beräknade behov · samma skala i alla paneler"
      : "Färdigställda bostäder per 1 000 invånare och år · randigt = Boverkets beräknade behov · samma skala i alla paneler";
    const alla = fem.flatMap(k => (per.get(k) ?? []).map(d => d[falt])).filter(Number.isFinite);
    const sy = d3.scaleLinear().domain([0, d3.max(alla) * 1.08 || 1]).nice(5).range([ih, 0]);
    fem.forEach((kod, i) => {
      const x0 = M.left + i * (pw + gap);
      const g = g0.append("g").attr("transform", `translate(${x0},${M.top})`);
      const rader = (per.get(kod) ?? []).slice().sort((a, b) => ordningP(a) - ordningP(b) || (a.typ === "behov") - (b.typ === "behov"));
      const utfall = rader.filter(d => d.typ !== "behov"), behov = rader.filter(d => d.typ === "behov");
      const c = farg[kod] ?? ink.stark;
      g.append("text").attr("x", 0).attr("y", -14).attr("font-size", 14).attr("font-weight", 600).attr("fill", c).text(namn(kod));
      for (const t of sy.ticks(5)) {
        const y = Math.round(sy(t)) + 0.5;
        g.append("line").attr("x1", 0).attr("x2", pw).attr("y1", y).attr("y2", y).attr("stroke", ink.rutnat);
        if (i === 0) g.append("text").attr("x", -6).attr("y", y).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(f.tal(t));
      }
      const n = utfall.length + behov.length, glipa = behov.length ? 8 : 0;
      const steg = (pw - glipa) / Math.max(1, n), bw = Math.max(3, steg * 0.74);
      const xFor = (j, ar_behov) => j * steg + (ar_behov ? glipa : 0) + (steg - bw) / 2;
      const allaP = [...utfall.map((d, j) => ({ d, x: xFor(j, false) })), ...behov.map((d, j) => ({ d, x: xFor(utfall.length + j, true) }))];
      const monsterId = `bo-rand-${kod}-${Math.random().toString(36).slice(2, 6)}`;
      const def = g.append("defs").append("pattern").attr("id", monsterId).attr("patternUnits", "userSpaceOnUse").attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)");
      def.append("rect").attr("width", 5).attr("height", 5).attr("fill", "var(--botten)");
      def.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 5).attr("stroke", c).attr("stroke-width", 2.2);
      const sistaUtfall = utfall.filter(d => d.fran !== d.till).slice(-1)[0];
      const tf = nu === "antal" ? f.tal : f.dec1;
      const likaBehov = behov.length > 1 && behov.every(b => tf(b[falt]) === tf(behov[0][falt]));
      for (const { d, x } of allaP) {
        const v = d[falt];
        if (!Number.isFinite(v)) continue;
        const ar1 = d.fran === d.till;
        const y = sy(v), hh = ih - y;
        const r = g.append("rect").attr("x", x).attr("y", y).attr("width", bw).attr("height", Math.max(0.5, hh)).attr("rx", 1.2);
        if (d.typ === "behov") r.attr("fill", `url(#${monsterId})`).attr("stroke", c).attr("stroke-width", 1.2);
        else r.attr("fill", c).attr("fill-opacity", ar1 ? 0.45 : 0.92);
        const etikettX = d.typ === "behov" && likaBehov ? (d === behov[0] ? (allaP[utfall.length].x + allaP[allaP.length - 1].x + bw) / 2 : null) : x + bw / 2;
        if ((d === sistaUtfall || d.typ === "behov") && etikettX != null) g.append("text").attr("x", etikettX).attr("y", y - 4).attr("text-anchor", "middle")
          .attr("font-family", MONO).attr("font-size", 9.5).attr("font-weight", 600).attr("fill", ink.stark).text(tf(v));
        g.append("text").attr("x", x + bw / 2).attr("y", ih + 12).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 8.5)
          .attr("fill", d.typ === "behov" ? c : ink.svag).text(kortP(d));
        g.append("rect").attr("x", x - (steg - bw) / 2).attr("y", 0).attr("width", steg).attr("height", ih + 14).attr("fill", "transparent")
          .on("pointermove", ev => {
            tips.visa(`<b>${namn(kod)}</b> <span class="s">${d.period}${d.typ === "behov" ? ", Boverkets behov" : ""}</span><br>` +
              `<span class="m">${f.tal(d.byggt_per_ar)}</span> <span class="s">bostäder per år</span><br>` +
              `<span class="m">${f.dec1(d.per_1000_ar)}</span> <span class="s">per 1 000 invånare</span>` +
              (d.typ !== "behov" && d.byggt != null ? `<br><span class="m">${f.tal(d.byggt)}</span> <span class="s">totalt under perioden</span>` : ""), ev);
          })
          .on("pointerleave", () => tips.dolj());
      }
      if (utfall.length) {
        const a = allaP[0].x, b = allaP[utfall.length - 1].x + bw;
        g.append("text").attr("x", (a + b) / 2).attr("y", ih + 26).attr("text-anchor", "middle").attr("font-size", 9.5).attr("fill", ink.svag)
          .text(`byggt ${utfall[0].fran}–${utfall[utfall.length - 1].till}`);
      }
      if (behov.length) {
        const a = allaP[utfall.length].x, b = allaP[allaP.length - 1].x + bw;
        g.append("text").attr("x", (a + b) / 2).attr("y", ih + 26).attr("text-anchor", "middle").attr("font-size", 9.5).attr("fill", c).text("behov");
      }
      g.append("line").attr("x1", 0).attr("x2", pw).attr("y1", ih + 0.5).attr("y2", ih + 0.5).attr("stroke", ink.mjuk).attr("stroke-opacity", 0.6);
    });
  }
  rita();
  return yta;
}
