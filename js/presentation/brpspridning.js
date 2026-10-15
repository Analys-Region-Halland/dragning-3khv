// =============================================================================
// BRPSPRIDNING: bild 17 flik "Alla kommuner", livskvalitet × hållbarhet
// =============================================================================
//
//   brpspridning(brp, opts) → DOM-nod
//
// brp = datasetet 3khv-brp (objekt med `bred`) eller arrayen `bred` direkt:
//   [{ kod, namn, lan, typ: "kommun"|"riket", livskvalitet, hallbarhet, ... }]
//
// Alla kommuner som grå punkter, riket som ring med streckat hårkors, de fem i
// sina färger med namn. Till höger en gruppväljare som i banor: 3KHV (förval),
// Län ▾ och Kommungrupp ▾. Vald grupp (annan än 3KHV) ritas mörk med namn och
// listas med värden och plats bland kommunerna (1 = högst). Hovra en punkt eller
// en rad i listan för namn och värden. Segmentet Hela bilden / Urvalet zoomar
// till vald grupp + de fem + riket (lika skala på axlarna, kvadratiskt utsnitt).
//
// opts: { temaNamn, width = 960, height = 540, ar = brp.ar,
//         x = "livskvalitet", y = "hallbarhet", xEtikett = "Livskvalitet", yEtikett = "Hållbarhet",
//         info = null (kommuner-3khv: { kod, lan_namn, skr2023_kod, skr2023 }),
//         grupperingar = null ([{ namn, kort?, nyckel: infoRad => värde }]; standard
//           Län och Kommungrupp när info finns),
//         forval = { namn: "3KHV-städerna", kort: "3KHV", koder: de fem },
//         kalla = null (källrad, HTML),
//         tips = null (rev 1: datasetet 3khv-brp-tips, se nedan) }
//
// Tooltip (rev 1). Med opts.tips visar hovring eller klick på en kommun en
// rik ruta (högst ca 410 × 460 px): namn, län och kommungrupp; för livskvalitet
// och hållbarhet indexet med plats av 290 och en liten rangskala, temana som
// divergerande staplar mot medianen bland kommunerna (över = drar upp, under =
// drar ner, sorterade) och de tre indikatorer som drar mest upp respektive ned.
// Klick låser rutan (× eller klick utanför eller Esc stänger), klick på en annan
// kommun flyttar den. De fem nås även via sina namn i diagrammet och via raderna
// i listan. Rutan placeras om vid ytans kanter. Utan tips: en enkel ruta.
//   tips = { ar, median: { livskvalitet: {tema: värde}, hallbarhet: {tema: värde} },
//            kommuner: [{ kod, namn,
//              livskvalitet: { index, rang, teman: [{ tema, varde, rang }], upp: [{ text, tema, standard }], ned: [...] },
//              hallbarhet:   { ... } }] }
// =============================================================================

import { d3 } from "../lib/d3.js";
import { aktivtTema } from "../lib/tema.js";
import { textbredd } from "./etiketter.js";
import { segment } from "./kontroller.js";
import { ram, el, f, skala, MONO, STADER, STADKODER, RIKET } from "./ytstod.js";

const STIL = `
.bp svg { display:block; overflow:visible; font-family:Inter, system-ui, sans-serif; }
.bp .bp-rad { display:flex; gap:26px; }
.bp .bp-panel { flex:1; min-width:0; display:flex; flex-direction:column; gap:8px; position:relative; }
.bp .bp-chips { display:flex; flex-wrap:wrap; gap:5px; }
.bp .bp-chip { border:1px solid rgba(13,13,13,.16); background:transparent; color:var(--ink-mjuk); font:500 11.5px/1 Inter, system-ui, sans-serif; padding:6px 11px; border-radius:999px; cursor:pointer; white-space:nowrap; }
.bp .bp-chip:hover { color:var(--ink); border-color:rgba(13,13,13,.3); }
.bp .bp-chip.pa { background:#0D0D0D; color:#fff; border-color:#0D0D0D; }
.bp .bp-meny { position:absolute; top:34px; left:0; right:0; max-height:300px; overflow:auto; background:var(--botten); border:1px solid var(--ink-rutnat); border-radius:8px; box-shadow:0 14px 34px -16px rgba(0,0,0,.45); padding:4px; z-index:15; display:none; scrollbar-width:thin; }
.bp .bp-meny button { display:block; width:100%; text-align:left; border:0; background:transparent; font:12px/1.3 Inter, system-ui, sans-serif; color:var(--ink); padding:5px 8px; border-radius:5px; cursor:pointer; }
.bp .bp-meny button:hover { background:var(--tonad); }
.bp .bp-meny button .n { float:right; color:var(--ink-svag); font-family:${MONO}; font-size:10.5px; }
.bp .bp-gruppnamn { font-size:14px; font-weight:600; color:var(--ink); display:flex; align-items:baseline; gap:8px; }
.bp .bp-gruppnamn .s { font-size:10.5px; font-weight:400; color:var(--ink-svag); }
.bp .bp-gruppnamn .x { margin-left:auto; border:0; background:transparent; color:var(--ink-svag); cursor:pointer; font-size:11px; }
.bp .bp-tab { display:grid; grid-template-columns: minmax(0,1fr) 84px 84px; column-gap:8px; align-items:baseline; font-size:12px; }
.bp .bp-tab .h { font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-svag); text-align:right; padding-bottom:4px; border-bottom:1px solid var(--ink-linje); }
.bp .bp-tab .h:first-child { text-align:left; }
.bp .bp-lista { display:flex; flex-direction:column; overflow:auto; min-height:0; scrollbar-width:thin; }
.bp .bp-r { display:grid; grid-template-columns: minmax(0,1fr) 84px 84px; column-gap:8px; align-items:baseline; padding:4px 2px; border-radius:4px; cursor:default; }
.bp .bp-r:hover, .bp .bp-r.hov { background:var(--tonad); }
.bp .bp-r .n { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:500; }
.bp .bp-r .n i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:0; }
.bp .bp-r .v { font-family:${MONO}; font-size:11.5px; text-align:right; color:var(--ink); white-space:nowrap; }
.bp .bp-r .v .rk { color:var(--ink-svag); font-size:9.5px; margin-left:3px; }
.bp .bp-r.riket { border-top:1px solid var(--ink-rutnat); margin-top:2px; }
.bp .bp-kalla { font-size:10.5px; color:var(--ink-svag); margin-top:6px; line-height:1.4; }
.bp .bp-tt { position:absolute; left:0; top:0; box-sizing:border-box; max-width:420px; background:var(--botten); border:1px solid var(--ink-rutnat); border-radius:8px; box-shadow:0 18px 40px -18px rgba(0,0,0,.5); padding:9px 12px 10px; z-index:25; opacity:0; visibility:hidden; pointer-events:none; transition:opacity .1s; font:11px/1.3 Inter, system-ui, sans-serif; color:var(--ink); text-align:left; }
.bp .bp-tt:not(.enkel) { width:416px; }
.bp .bp-tt.syns { opacity:1; visibility:visible; }
.bp .bp-tt.las { pointer-events:auto; border-color:var(--ink-linje); box-shadow:0 22px 46px -18px rgba(0,0,0,.6); }
.bp .bp-tt.enkel { white-space:nowrap; padding:7px 10px; font-size:11.5px; line-height:1.45; }
.bp .bp-tt .m { font-family:${MONO}; font-variant-numeric:tabular-nums; }
.bp .bp-tt .s { color:var(--ink-svag); font-size:10.5px; }
.bp .bp-tt i.p { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:6px; vertical-align:0; }
.bp .tt-hd { display:flex; align-items:baseline; gap:8px; }
.bp .tt-namn { font-size:15px; font-weight:600; white-space:nowrap; }
.bp .tt-under { font-size:10px; color:var(--ink-svag); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
.bp .tt-x { display:none; border:0; background:transparent; color:var(--ink-svag); font-size:15px; line-height:1; cursor:pointer; padding:0 2px; margin-left:auto; }
.bp .bp-tt.las .tt-x { display:block; }
.bp .tt-del { margin-top:6px; padding-top:5px; border-top:1px solid var(--ink-rutnat); }
.bp .tt-delhd { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.bp .tt-delnamn { font-size:10px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; }
.bp .tt-index { font:600 14px/1 ${MONO}; }
.bp .tt-plats { font-size:10.5px; color:var(--ink-mjuk); white-space:nowrap; }
.bp .tt-grid { display:grid; grid-template-columns:178px minmax(0,1fr); column-gap:10px; align-items:start; }
.bp .tt-ind { font-size:10.5px; line-height:1.22; }
.bp .tt-ind .rub { font-size:9.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; margin:0 0 2px; }
.bp .tt-ind .rub + ul { margin-bottom:4px; }
.bp .tt-ind ul { list-style:none; margin:0; padding:0; }
.bp .tt-ind li { position:relative; padding-left:9px; margin:0 0 2px; }
.bp .tt-ind li::before { content:""; position:absolute; left:0; top:.42em; width:5px; height:5px; border-radius:50%; background:var(--c); }
`;

// Korta temanamn i tooltipen (datasetets egna namn och Tillväxtverkets)
const TEMAKORT = {
  "Demokratisk delaktighet": "Delaktighet",
  "Närhet till service": "Service",
  "Inkomster": "Inkomst",
  "Relationer och tillit": "Relationer",
  "Utbildning": "Utbildning",
  "Välbefinnande": "Välbefinnande",
  "Ekonomisk": "Ekonomisk",
  "Miljömässig": "Miljömässig",
  "Social": "Social",
  "Medborgarengagemang och demokratisk delaktighet": "Delaktighet",
  "Trygghet och säkerhet": "Trygghet",
  "Miljökvalitet": "Miljökvalitet",
  "Tillgänglighet till tjänster": "Service",
  "Inkomst och förmögenhet": "Inkomst",
  "Arbete och löner": "Arbete",
  "Bostad": "Bostad",
  "Balans arbete–fritid": "Arbete–fritid",
  "Hälsa": "Hälsa",
  "Utbildning och kompetens": "Utbildning",
  "Sociala relationer och tillit": "Relationer",
  "Individuellt välbefinnande": "Välbefinnande",
  "Ekonomisk hållbarhet": "Ekonomisk",
  "Miljömässig hållbarhet": "Miljömässig",
  "Social hållbarhet": "Social"
};
const UPP = "#00A05A", NED = "#D4572E";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function brpspridning(brp, {
  temaNamn = aktivtTema(), width = 960, height = 540, ar = null,
  x = "livskvalitet", y = "hallbarhet", xEtikett = "Livskvalitet", yEtikett = "Hållbarhet",
  info = null, grupperingar = null,
  forval = { namn: "3KHV-städerna", kort: "3KHV", koder: STADKODER },
  kalla = null, tips: tipsData = null
} = {}) {
  const R = ram({ temaNamn, width, height, klass: "bp", stil: STIL });
  const { rot, ink, farg, botten } = R;
  const tt = el("div", { class: "bp-tt", role: "tooltip" });
  rot.appendChild(tt);
  const tipsMap = new Map((tipsData?.kommuner ?? []).map(d => [d.kod, d]));
  const tipsAntal = tipsData?.n_kommuner || tipsData?.kommuner?.length || 290;
  // Fast skala för staplarna per index (97:e percentilen av avståndet till medianen),
  // så att kommunerna går att jämföra med varandra
  const skalaD = {};
  for (const del of ["livskvalitet", "hallbarhet"]) {
    const med = tipsData?.median?.[del] ?? {};
    const avst = (tipsData?.kommuner ?? []).flatMap(k => (k[del]?.teman ?? []).map(t => Math.abs(t.varde - (med[t.tema] ?? t.varde)))).filter(Number.isFinite).sort((a, b) => a - b);
    skalaD[del] = Math.max(10, Math.ceil((d3.quantile(avst, 0.97) ?? 30) / 5) * 5);
  }
  const rader = (Array.isArray(brp) ? brp : brp?.bred ?? []).filter(d => Number.isFinite(d[x]) && Number.isFinite(d[y]));
  const arText = ar ?? brp?.ar ?? null;
  const kommuner = rader.filter(d => d.typ !== "riket" && d.kod !== RIKET && d.kod.length === 4 && d.typ !== "lan");
  const riket = rader.find(d => d.kod === RIKET || d.typ === "riket");
  const alla = [...kommuner, ...(riket ? [riket] : [])];
  // Plats bland kommunerna (1 = högst)
  const rang = f_ => { const s = [...kommuner].sort((a, b) => b[f_] - a[f_]); const m = new Map(); s.forEach((d, i) => m.set(d.kod, i + 1)); return m; };
  const rX = rang(x), rY = rang(y);
  const infoMap = new Map((info ?? []).map(d => [d.kod, d]));
  const gr = grupperingar ?? (info ? [
    { namn: "Län", nyckel: d => d.lan_namn },
    { namn: "Kommungrupp", nyckel: d => d.skr2023_kod && `${d.skr2023_kod} ${d.skr2023}` }
  ] : []);

  // Gruppkatalog
  const katalog = [{ id: "forval", namn: forval.namn, kort: forval.kort, typ: "Förval", koder: forval.koder.filter(k => kommuner.some(d => d.kod === k)) }];
  for (const g of gr) {
    for (const [v, ll] of d3.groups(kommuner, d => g.nyckel(infoMap.get(d.kod) ?? {})).filter(([v]) => v != null).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "sv"))) {
      katalog.push({ id: `${g.namn}:${v}`, namn: v, typ: g.namn, koder: ll.map(d => d.kod) });
    }
  }
  let vald = katalog[0];
  let hovKod = null;

  // ── Layout ──
  const kallaH = kalla ? 30 : 0;
  const plotH = height - kallaH;
  const radEl = el("div", { class: "bp-rad", style: `height:${plotH}px` });
  rot.appendChild(radEl);
  if (kalla) rot.appendChild(el("div", { class: "bp-kalla" }, kalla));
  const M = { top: 16, right: 16, bottom: 40, left: 46 };
  const sida = Math.min(plotH - M.top - M.bottom, 520);
  const svgW = sida + M.left + M.right;
  const svg = d3.select(radEl).append("svg").attr("width", svgW).attr("height", plotH).style("flex", "0 0 auto");
  const panel = el("div", { class: "bp-panel" });
  radEl.appendChild(panel);

  // Utsnitt: "hela" = alla kommuner, "urval" = vald grupp + de fem + riket.
  // Lika skala på båda axlarna i urvalsläget (kvadratiskt utsnitt kring urvalet).
  let utsnitt = "hela";
  const pad = ([a, b], k = 0.04) => [a - (b - a) * k, b + (b - a) * k];
  const sx = d3.scaleLinear().range([0, sida]);
  const sy = d3.scaleLinear().range([sida, 0]);
  function satSkalor() {
    if (utsnitt === "hela") {
      const ext = f_ => d3.extent([...kommuner, riket].filter(Boolean), d => d[f_]);
      sx.domain(pad(ext(x))).nice(); sy.domain(pad(ext(y))).nice();
      return;
    }
    const med = [...kommuner.filter(d => vald.koder.includes(d.kod) || STADKODER.includes(d.kod)), riket].filter(Boolean);
    const [xa, xb] = d3.extent(med, d => d[x]), [ya, yb] = d3.extent(med, d => d[y]);
    const spann = Math.max(xb - xa, yb - ya, 8) * 1.18;
    const cx = (xa + xb) / 2, cy = (ya + yb) / 2;
    sx.domain([cx - spann / 2, cx + spann / 2]); sy.domain([cy - spann / 2, cy + spann / 2]);
  }
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const klippId = `bp-klipp-${Math.random().toString(36).slice(2, 8)}`;
  svg.append("defs").append("clipPath").attr("id", `${klippId}`).append("rect").attr("x", -8).attr("y", -8).attr("width", sida + 16).attr("height", sida + 16);
  const gAx = g.append("g");
  g.append("text").attr("x", sida).attr("y", sida + 33).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(`${xEtikett} (index 0–100) →`);
  g.append("text").attr("transform", `translate(${-M.left + 11},0) rotate(-90)`).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", ink.mjuk).text(`${yEtikett} (index 0–100) →`);
  function ritaAxlar() {
    gAx.selectAll("*").remove();
    const steg = utsnitt === "hela" ? 6 : 5;
    for (const t of sx.ticks(steg)) {
      const p = Math.round(sx(t)) + 0.5;
      gAx.append("line").attr("x1", p).attr("x2", p).attr("y1", 0).attr("y2", sida).attr("stroke", ink.rutnat);
      gAx.append("text").attr("x", p).attr("y", sida + 15).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(f.tal(t));
    }
    for (const t of sy.ticks(steg)) {
      const p = Math.round(sy(t)) + 0.5;
      gAx.append("line").attr("x1", 0).attr("x2", sida).attr("y1", p).attr("y2", p).attr("stroke", ink.rutnat);
      gAx.append("text").attr("x", -7).attr("y", p).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(f.tal(t));
    }
    if (riket) {
      gAx.append("line").attr("x1", sx(riket[x])).attr("x2", sx(riket[x])).attr("y1", 0).attr("y2", sida).attr("stroke", ink.mjuk).attr("stroke-dasharray", "3 3").attr("stroke-opacity", 0.6);
      gAx.append("line").attr("x1", 0).attr("x2", sida).attr("y1", sy(riket[y])).attr("y2", sy(riket[y])).attr("stroke", ink.mjuk).attr("stroke-dasharray", "3 3").attr("stroke-opacity", 0.6);
    }
  }
  const gPunkter = g.append("g").attr("clip-path", `url(#${klippId})`);
  const gGra = gPunkter.append("g"), gVal = gPunkter.append("g"), gFem = gPunkter.append("g"), gEt = g.append("g").attr("pointer-events", "none");
  const ring = g.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.3).attr("opacity", 0).attr("pointer-events", "none");
  const pt = d => ({ px: sx(d[x]), py: sy(d[y]) });
  const synlig = d => { const p = pt(d); return p.px >= -4 && p.px <= sida + 4 && p.py >= -4 && p.py <= sida + 4; };

  function tipsHtml(d) {
    const inf = infoMap.get(d.kod);
    const under = d.kod === RIKET ? "" : [inf?.lan_namn, inf?.skr2023].filter(Boolean).join(" · ");
    const c = farg[d.kod];
    return `<b>${c ? `<i class="p" style="background:${c}"></i>` : ""}${d.namn}</b>${under ? ` <span class="s">${under}</span>` : ""}<br>` +
      `<span class="s">${xEtikett}</span> <span class="m">${f.dec1(d[x])}</span>${rX.has(d.kod) ? ` <span class="s">nr ${rX.get(d.kod)}</span>` : ""}<br>` +
      `<span class="s">${yEtikett}</span> <span class="m">${f.dec1(d[y])}</span>${rY.has(d.kod) ? ` <span class="s">nr ${rY.get(d.kod)}</span>` : ""}`;
  }

  // ── Rik tooltip ──
  const DELAR = [
    { id: "livskvalitet", namn: "Livskvalitet", farg: "#00664D", fargMork: "#3FD08A" },
    { id: "hallbarhet", namn: "Hållbarhet", farg: "#004990", fargMork: "#6FB6FF" }
  ];
  // Liten rangskala: plats 1 till vänster, sista till höger
  function rangskala(rang, n, c) {
    if (!Number.isFinite(rang)) return "";
    const w = 64, px = 3 + (w - 6) * (rang - 1) / Math.max(1, n - 1);
    return `<svg width="${w}" height="10" style="display:inline-block;vertical-align:middle;overflow:visible" aria-hidden="true">` +
      `<line x1="0" x2="${w}" y1="5" y2="5" stroke="${ink.linje}" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="${w / 2}" x2="${w / 2}" y1="2" y2="8" stroke="${ink.svag}" stroke-width="1"/>` +
      `<circle cx="${px}" cy="5" r="4" fill="${c}" stroke="${botten}" stroke-width="1.2"/></svg>`;
  }
  // Divergerande staplar mot medianen, sorterade: överst det som drar upp mest
  function temastaplar(del, t, c) {
    const med = tipsData?.median?.[del.id] ?? {};
    const rader = (t.teman ?? []).filter(q => Number.isFinite(q.varde))
      .map(q => ({ ...q, diff: q.varde - (med[q.tema] ?? q.varde) }))
      .sort((a, b) => b.diff - a.diff);
    const D = skalaD[del.id];
    const labW = 82, barW = 70, rangW = 26, W = labW + barW + rangW;
    const rh = rader.length > 6 ? 13 : 16, top = 11;
    const H = top + rader.length * rh + 2;
    const mid = labW + barW / 2, half = barW / 2 - 1;
    let s = `<svg width="${W}" height="${H}" style="display:block;overflow:visible" aria-hidden="true">`;
    s += `<text x="${mid - 4}" y="8" text-anchor="end" font-size="8.5" fill="${NED}">drar ner</text>`;
    s += `<text x="${mid + 4}" y="8" font-size="8.5" fill="${UPP}">drar upp</text>`;
    s += `<text x="${W}" y="8" text-anchor="end" font-size="8.5" fill="${ink.svag}">plats</text>`;
    rader.forEach((q, i) => {
      const y = top + i * rh;
      const w = Math.min(half, Math.abs(q.diff) / D * half);
      const upp = q.diff >= 0;
      s += `<text x="${labW - 6}" y="${y + rh / 2}" dy="0.34em" text-anchor="end" font-size="10.5" fill="${ink.stark}">${esc(TEMAKORT[q.tema] ?? q.tema)}</text>`;
      s += `<rect x="${labW}" y="${y + 1}" width="${barW}" height="${rh - 2}" fill="${ink.rutnat}" fill-opacity="0.35"/>`;
      s += `<rect x="${upp ? mid : mid - w}" y="${y + 2}" width="${Math.max(1, w)}" height="${rh - 4}" rx="1.5" fill="${upp ? UPP : NED}" fill-opacity="${Math.abs(q.diff) < 2 ? 0.45 : 0.9}"/>`;
      s += `<text x="${W}" y="${y + rh / 2}" dy="0.34em" text-anchor="end" font-family="${MONO}" font-size="9.5" fill="${ink.mjuk}">${Number.isFinite(q.rang) ? q.rang : ""}</text>`;
    });
    s += `<line x1="${mid}" x2="${mid}" y1="${top - 1}" y2="${H}" stroke="${ink.stark}" stroke-width="1" stroke-opacity="0.55"/>`;
    return s + "</svg>";
  }
  function indikatorer(t) {
    const lista = (arr, c) => `<ul style="--c:${c}">${(arr ?? []).slice(0, 3).map(q => `<li>${esc(q.text)}</li>`).join("")}</ul>`;
    return `<div class="tt-ind">` +
      ((t.upp ?? []).length ? `<div class="rub" style="color:${UPP}">▲ Drar upp mest</div>${lista(t.upp, UPP)}` : "") +
      ((t.ned ?? []).length ? `<div class="rub" style="color:${NED}">▼ Drar ner mest</div>${lista(t.ned, NED)}` : "") +
      `</div>`;
  }
  function rikHtml(d, rad) {
    const inf = infoMap.get(d.kod);
    const under = [inf?.lan_namn, inf?.skr2023].filter(Boolean).join(" · ");
    const c = farg[d.kod];
    let h = `<div class="tt-hd"><span class="tt-namn">${c ? `<i class="p" style="background:${c}"></i>` : ""}${esc(rad.namn ?? d.namn)}</span>` +
      `<span class="tt-under">${esc(under)}</span><button class="tt-x" type="button" title="Stäng" aria-label="Stäng">×</button></div>`;
    for (const del of DELAR) {
      const t = rad[del.id];
      if (!t) continue;
      const dc = R.T.mork ? del.fargMork : del.farg;
      h += `<div class="tt-del"><div class="tt-delhd"><span class="tt-delnamn" style="color:${dc}">${del.namn}</span>` +
        `<span class="tt-index">${f.dec1(t.index)}</span>` +
        `<span class="tt-plats">plats ${Number.isFinite(t.rang) ? t.rang : "–"} av ${tipsAntal}</span>` +
        `<span style="margin-left:auto">${rangskala(t.rang, tipsAntal, dc)}</span></div>` +
        `<div class="tt-grid">${temastaplar(del, t, dc)}${indikatorer(t)}</div></div>`;
    }
    return h;
  }

  let lastKod = null;
  function visaTips(d) {
    const rad = tipsMap.get(d.kod);
    tt.classList.toggle("enkel", !rad);
    tt.innerHTML = rad ? rikHtml(d, rad) : tipsHtml(d);
    tt.querySelector(".tt-x")?.addEventListener("click", ev => { ev.stopPropagation(); avlas(); });
    tt.classList.add("syns");
    placeraTips(d);
  }
  // Rutan placeras bredvid punkten, inom modulens yta (vänster om det inte ryms till höger)
  function placeraTips(d) {
    const s = skala(rot);
    const rr = rot.getBoundingClientRect(), sr = svg.node().getBoundingClientRect();
    const p = pt(d);
    const px = (sr.left - rr.left) / s + M.left + p.px, py = (sr.top - rr.top) / s + M.top + p.py;
    const tw = tt.offsetWidth, th = tt.offsetHeight, W = rot.offsetWidth, Hh = rot.offsetHeight;
    let lx = px + 16;
    if (lx + tw > W) lx = px - 16 - tw;
    lx = Math.max(0, Math.min(lx, W - tw));
    let ly = py - th * 0.35;
    ly = Math.max(0, Math.min(ly, Hh - th));
    tt.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
  }
  function doljTips() { tt.classList.remove("syns"); }
  function las(d) {
    lastKod = d.kod;
    tt.classList.add("las");
    hovKod = null;
    hovra(d, false, true);
  }
  function avlas() {
    lastKod = null;
    tt.classList.remove("las");
    hovra(null, false, true);
  }
  const klickPa = (d, ev) => {
    if (ev) ev.bpHanterad = true;
    if (!d) { if (lastKod) avlas(); return; }
    if (lastKod === d.kod) avlas(); else las(d);
  };

  // Etiketter: girigt, höger → vänster → över → under, hoppa över om ingen plats
  function etikettera(poster) {
    const lagda = [];
    const ut = [];
    const krock = (b) => lagda.some(a => b.x0 < a.x1 && b.x1 > a.x0 && b.y0 < a.y1 && b.y1 > a.y0);
    // Punkterna själva ska inte heller täckas av namn
    const prickar = poster.map(p => ({ x0: p.px_ - p.r, x1: p.px_ + p.r, y0: p.py_ - p.r, y1: p.py_ + p.r }));
    for (const p of poster) {
      const w = textbredd(p.text, p.px, p.vikt), h = p.px + 2;
      const kand = [];
      for (const av of [p.r + 3, p.r + 13, p.r + 24]) {
        const d = av * 0.72;
        kand.push(
          { x: p.px_ + av, y: p.py_, a: "start" }, { x: p.px_ - av, y: p.py_, a: "end" },
          { x: p.px_, y: p.py_ - av - h / 2 + 3, a: "middle" }, { x: p.px_, y: p.py_ + av + h / 2 - 3, a: "middle" },
          { x: p.px_ + d, y: p.py_ - d - 2, a: "start" }, { x: p.px_ + d, y: p.py_ + d + 2, a: "start" },
          { x: p.px_ - d, y: p.py_ - d - 2, a: "end" }, { x: p.px_ - d, y: p.py_ + d + 2, a: "end" }
        );
      }
      let lagd = null;
      for (const k of kand) {
        const x0 = k.a === "start" ? k.x : k.a === "end" ? k.x - w : k.x - w / 2;
        const b = { x0, x1: x0 + w, y0: k.y - h / 2, y1: k.y + h / 2 };
        if (b.x0 < -M.left + 2 || b.x1 > sida + M.right || b.y0 < -M.top || b.y1 > sida) continue;
        if (krock(b) || prickar.some((q, i) => poster[i] !== p && b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
        lagd = { k, b };
        break;
      }
      // De fem och riket får alltid namn — till höger om inget annat ryms
      if (!lagd && p.alltid) { const k = kand[0]; lagd = { k, b: { x0: k.x, x1: k.x + w, y0: k.y - h / 2, y1: k.y + h / 2 } }; }
      if (!lagd) continue;
      lagda.push(lagd.b);
      const lang = Math.hypot(lagd.k.x - p.px_, lagd.k.y - p.py_) > p.r + 6;
      ut.push({ ...p, ...lagd.k, linje: lang });
    }
    return ut;
  }

  function rita() {
    satSkalor();
    ritaAxlar();
    gGra.selectAll("circle").data(kommuner.filter(d => !STADKODER.includes(d.kod)), d => d.kod).join("circle")
      .attr("cx", d => sx(d[x])).attr("cy", d => sy(d[y])).attr("r", utsnitt === "hela" ? 3 : 3.6).attr("fill", ink.svag).attr("fill-opacity", 0.32);
    const valda = vald.id === "forval" ? [] : kommuner.filter(d => vald.koder.includes(d.kod) && !STADKODER.includes(d.kod));
    gVal.selectAll("circle").data(valda, d => d.kod).join("circle")
      .attr("cx", d => sx(d[x])).attr("cy", d => sy(d[y])).attr("r", 4.6).attr("fill", ink.stark).attr("fill-opacity", 0.85).attr("stroke", botten).attr("stroke-width", 1);
    const fem = STADER.map(s => kommuner.find(d => d.kod === s.kod)).filter(Boolean);
    const femTona = vald.id !== "forval" && !fem.some(d => vald.koder.includes(d.kod));
    gFem.selectAll("circle.f").data(fem, d => d.kod).join("circle").attr("class", "f")
      .attr("cx", d => sx(d[x])).attr("cy", d => sy(d[y])).attr("r", 6).attr("fill", d => farg[d.kod]).attr("stroke", botten).attr("stroke-width", 1.4)
      .attr("fill-opacity", femTona ? 0.55 : 1);
    if (riket) gFem.selectAll("circle.r").data([riket]).join("circle").attr("class", "r")
      .attr("cx", d => sx(d[x])).attr("cy", d => sy(d[y])).attr("r", 6.5).attr("fill", botten).attr("stroke", ink.stark).attr("stroke-width", 2.2);
    // Etiketter: de fem, riket, sedan vald grupp (högst livskvalitet först)
    const poster = [
      ...fem.map(d => ({ d, text: d.namn, px: 12.5, vikt: 700, farg: farg[d.kod], r: 6, opac: femTona ? 0.6 : 1, alltid: true })),
      ...(riket ? [{ d: riket, text: "Riket", px: 11.5, vikt: 600, farg: ink.stark, r: 6.5, opac: 1, alltid: true }] : []),
      ...[...valda].sort((a, b) => b[x] - a[x]).map(d => ({ d, text: d.namn, px: 10.5, vikt: 500, farg: ink.stark, r: 4.6, opac: 1 }))
    ].filter(p => synlig(p.d)).map(p => ({ ...p, px_: sx(p.d[x]), py_: sy(p.d[y]) }));
    const ut = etikettera(poster);
    // Ledlinje när namnet hamnat en bit från punkten
    gEt.selectAll("line").data(ut.filter(p => p.linje), p => p.d.kod).join("line")
      .attr("x1", p => p.px_).attr("y1", p => p.py_)
      .attr("x2", p => p.a === "start" ? p.x - 2 : p.a === "end" ? p.x + 2 : p.x)
      .attr("y2", p => p.a === "middle" ? p.y + (p.y > p.py_ ? -p.px / 2 : p.px / 2) : p.y)
      .attr("stroke", p => p.farg).attr("stroke-width", 0.8).attr("stroke-opacity", 0.7);
    gEt.selectAll("text").data(ut, p => p.d.kod).join("text")
      .attr("x", p => p.x).attr("y", p => p.y).attr("dy", "0.34em").attr("text-anchor", p => p.a)
      .attr("font-size", p => p.px).attr("font-weight", p => p.vikt).attr("fill", p => p.farg).attr("opacity", p => p.opac)
      .attr("paint-order", "stroke").attr("stroke", botten).attr("stroke-width", 3).attr("stroke-linejoin", "round").text(p => p.text)
      // De fem och riket nås också via sina namn
      .attr("pointer-events", p => (p.alltid ? "all" : "none")).style("cursor", p => (p.alltid ? "pointer" : null))
      .on("pointerenter", (ev, p) => { if (p.alltid) hovra(p.d); })
      .on("pointerleave", (ev, p) => { if (p.alltid) hovra(null); })
      .on("click", (ev, p) => { if (p.alltid) klickPa(p.d, ev); });
    malaPanel();
    if (lastKod) {
      const d = alla.find(q => q.kod === lastKod);
      if (d && synlig(d)) hovra(d, false, true); else avlas();
    }
  }

  // ── Panel ──
  const chips = el("div", { class: "bp-chips" });
  const meny = el("div", { class: "bp-meny" });
  panel.append(chips, meny);
  const knappar = [];
  const fv = el("button", { type: "button", class: "bp-chip" }, forval.kort ?? forval.namn);
  fv.addEventListener("click", () => { vald = katalog[0]; meny.style.display = "none"; rita(); });
  chips.appendChild(fv); knappar.push({ b: fv, typ: "Förval" });
  for (const gg of gr) {
    const b = el("button", { type: "button", class: "bp-chip" }, `${gg.kort ?? gg.namn} ▾`);
    b.addEventListener("click", ev => {
      ev.stopPropagation();
      const oppen = meny.style.display === "block" && meny.dataset.typ === gg.namn;
      if (oppen) { meny.style.display = "none"; return; }
      meny.dataset.typ = gg.namn;
      meny.replaceChildren(...katalog.filter(k => k.typ === gg.namn).map(k => {
        const m = el("button", { type: "button" }, `${k.namn}<span class="n">${k.koder.length}</span>`);
        m.addEventListener("click", e2 => { e2.stopPropagation(); vald = k; meny.style.display = "none"; rita(); });
        return m;
      }));
      meny.style.display = "block";
    });
    chips.appendChild(b); knappar.push({ b, typ: gg.namn });
  }
  rot.addEventListener("click", () => { meny.style.display = "none"; });
  chips.appendChild(el("span", { style: "flex:1" }));
  chips.appendChild(segment({
    val: [{ id: "hela", etikett: "Hela bilden", titel: "Axlarna ramar in alla kommuner" }, { id: "urval", etikett: "Urvalet", titel: "Zooma in på vald grupp, de fem och riket" }],
    varde: utsnitt, vidByte: v => { utsnitt = v; hovra(null); rita(); }
  }));
  const gruppnamn = el("div", { class: "bp-gruppnamn" });
  const tab = el("div", { class: "bp-tab" }, `<span class="h">Kommun</span><span class="h">${xEtikett}</span><span class="h">${yEtikett}</span>`);
  const lista = el("div", { class: "bp-lista" });
  panel.append(gruppnamn, tab, lista);
  const not = el("div", { style: "font-size:10.5px;color:var(--ink-svag);line-height:1.4;margin-top:auto" },
    `Index 0–100${arText ? `, ${arText}` : ""}. Siffran efter värdet = plats bland ${kommuner.length} kommuner (1 = högst). Streckat hårkors = riket.` +
    (tipsData ? " Hovra eller klicka på en kommun för att se vad som drar upp och ner (temana mot medianen bland kommunerna)." : ""));
  panel.appendChild(not);

  function malaPanel() {
    knappar.forEach(({ b, typ }) => b.classList.toggle("pa", vald.typ === typ));
    gruppnamn.innerHTML = `${vald.namn}<span class="s">${vald.koder.length} kommuner</span>` + (vald.id !== "forval" ? `<button class="x" type="button" title="Tillbaka till ${forval.kort ?? forval.namn}">× ${forval.kort ?? forval.namn}</button>` : "");
    gruppnamn.querySelector(".x")?.addEventListener("click", ev => { ev.stopPropagation(); vald = katalog[0]; rita(); });
    const medl = kommuner.filter(d => vald.koder.includes(d.kod)).sort((a, b) => b[x] - a[x]);
    const rad = (d, klass = "") => {
      const c = farg[d.kod] ?? (d.kod === RIKET ? null : ink.stark);
      const r = el("div", { class: `bp-r ${klass}`, "data-kod": d.kod },
        `<span class="n">${c ? `<i style="background:${c}"></i>` : `<i style="background:var(--botten);border:2px solid ${ink.stark};box-sizing:border-box"></i>`}${d.namn}</span>` +
        `<span class="v">${f.dec1(d[x])}${rX.has(d.kod) ? `<span class="rk">${rX.get(d.kod)}</span>` : ""}</span>` +
        `<span class="v">${f.dec1(d[y])}${rY.has(d.kod) ? `<span class="rk">${rY.get(d.kod)}</span>` : ""}</span>`);
      r.addEventListener("pointerenter", () => hovra(d, true));
      r.addEventListener("pointerleave", () => hovra(null, true));
      r.addEventListener("click", ev => klickPa(d, ev));
      r.style.cursor = "pointer";
      return r;
    };
    lista.replaceChildren(...medl.map(d => rad(d)), ...(riket ? [rad(riket, "riket")] : []));
  }

  // Hovring visar rutan; när en kommun är låst (klick) står rutan kvar tills
  // den stängs eller en annan kommun klickas.
  function hovra(d, franLista = false, tvinga = false) {
    if (lastKod && !tvinga) return;
    const kod = tvinga && lastKod ? lastKod : d?.kod ?? null;
    if (tvinga && lastKod) d = alla.find(q => q.kod === lastKod) ?? d;
    hovKod = lastKod ? null : kod;
    lista.querySelectorAll(".bp-r").forEach(r => r.classList.toggle("hov", r.dataset.kod === kod));
    if (!d) { ring.attr("opacity", 0); doljTips(); return; }
    const p = pt(d);
    ring.attr("cx", p.px).attr("cy", p.py).attr("r", 9).attr("opacity", 1).attr("stroke-width", lastKod ? 2 : 1.3);
    visaTips(d);
  }

  // Hovring och klick i diagrammet: närmaste punkt
  const narmast = ev => {
    const [mx, my] = d3.pointer(ev, g.node());
    let bast = null, av = 12;
    for (const d of alla) { if (!synlig(d)) continue; const s = Math.hypot(sx(d[x]) - mx, sy(d[y]) - my); if (s < av) { av = s; bast = d; } }
    return bast;
  };
  const yta = g.append("rect").attr("width", sida).attr("height", sida).attr("fill", "transparent")
    .on("pointermove", ev => {
      const bast = narmast(ev);
      yta.style("cursor", bast ? "pointer" : null);
      if ((bast?.kod ?? null) !== hovKod) hovra(bast);
    })
    .on("pointerleave", () => hovra(null))
    .on("click", ev => klickPa(narmast(ev), ev));
  // Namnen ligger över ytan så att de fems namn går att hovra och klicka
  gEt.raise();
  // Punkterna ska inte fånga pekaren, rektangeln gör det
  [gGra, gVal, gFem].forEach(s => s.attr("pointer-events", "none"));
  // Klick utanför rutan, eller Esc, stänger en låst ruta
  tt.addEventListener("click", ev => { ev.bpHanterad = true; });
  const utanfor = ev => {
    if (!rot.isConnected) { document.removeEventListener("click", utanfor); document.removeEventListener("keydown", tangent); return; }
    if (lastKod && !ev.bpHanterad) avlas();
  };
  // Esc fångas före Reveal (som annars öppnar översikten) bara när rutan är låst
  const tangent = ev => {
    if (!rot.isConnected) { document.removeEventListener("click", utanfor); window.removeEventListener("keydown", tangent, true); return; }
    if (ev.key === "Escape" && lastKod) { ev.stopImmediatePropagation(); ev.preventDefault(); avlas(); }
  };
  document.addEventListener("click", utanfor);
  window.addEventListener("keydown", tangent, true);

  rita();
  return rot;
}
