// =============================================================================
// LÄGE — bild 13 "Var har detta lett fram till idag?" (revision 1)
// =============================================================================
//
//   lagejamforelse(data, opts) → DOM-nod
//
// data = datasetet 3khv-lage-idag:
//   { kalla,
//     grupper: [{ id, namn, kort, typ: "stad"|"skr"|"riket", antal_kommuner }],
//     matt:    [{ id, namn, enhet, ar }],
//     varden:  [{ grupp, matt, varde }],
//     naring:  [{ grupp, ar, tjanster, varuproduktion, totalt, ... }] }
//
// Två flikar (kontroller.flikar, → bläddrar till nästa flik):
//   1 "Läget idag": en facett per mått (rubrik, enhet och år ur data.matt, egen
//     x-skala, luft emellan). Raderna är de fem (i färg, värdet utskrivet) och
//     SKR:s kommungrupper (grå, diskreta). Riket är en streckad referenslinje
//     genom varje facett, och varje punkt har en tunn stjälk från riket, så att
//     avvikelsen syns. Inom varje block sorteras raderna efter första måttet.
//     Mått som är varandras komplement (par, standard platsbundna +
//     varuproduktion = 100 %) visas som en facett; motpolen står i tipset.
//   2 "Näringslivets omställning": spridningsdiagram. x = förändring i antal
//     jobb i platsbundna tjänster, y = förändring i varuproduktion, båda i
//     procent av gruppens alla jobb första året i perioden (x + y = total
//     förändring i procent). Samma skala på båda axlarna, axlar genom origo och
//     diagonalen x + y = 0 (netto noll); under den ligger nettominskning (tonad).
//     Period med årsreglage (standard hela serien). Hovring: antal och procent
//     per aggregat och totalt.
//
// opts: { temaNamn, width = 960, height = 560, steg = true,
//         flikEtiketter = ["Läget idag", "Näringslivets omställning"],
//         sortera = true (raderna efter första måttet; false = stadOrdning/datans ordning),
//         stadOrdning = null (koder), mattOrdning = null (matt-id),
//         mattRubrik = { platsbundna: "Andel jobb i platsbundna tjänster" } (rubrik per matt-id;
//                      övriga mått får data.matt[].namn),
//         kalla = null (källrad flik 1, HTML; standard byggd ur data.kalla),
//         kallaNaring = null (källrad flik 2, HTML),
//         brott = [{ ar: 2020, etikett: "BAS" }] (källbyten: hakar på reglaget och i källraden),
//         period = null ({ fran, till } förval i flik 2; standard hela serien),
//         par = [["platsbundna", "varuproduktion"]] }
//   (opts.lage från förra versionen tas emot men används inte längre.)
// =============================================================================

import { d3 } from "../lib/d3.js";
import { aktivtTema } from "../lib/tema.js";
import { flikar, arsreglage } from "./kontroller.js";
import { etikettRader, textbredd } from "./etiketter.js";
import { ram, el, f, tipsruta, MONO } from "./ytstod.js";

const STIL = `
.lj .lj-yta { display:flex; flex-direction:column; }
.lj svg { display:block; overflow:visible; font-family:Inter, system-ui, sans-serif; }
.lj .lj-hd { display:flex; align-items:center; gap:18px; min-height:32px; margin-bottom:2px; }
.lj .lj-hd .u { font-size:11.5px; color:var(--ink-mjuk); flex:1; text-align:right; }
.lj .lj-kalla { font-size:10.5px; color:var(--ink-svag); margin-top:4px; line-height:1.4; }
.lj .ys-tips table { border-collapse:collapse; margin-top:3px; }
.lj .ys-tips td { padding:1px 0 1px 12px; text-align:right; font-family:${MONO}; font-variant-numeric:tabular-nums; }
.lj .ys-tips td:first-child { padding-left:0; text-align:left; font-family:Inter, system-ui, sans-serif; }
.lj .ys-tips tr.h td { color:var(--ink-svag); font-size:9.5px; font-family:Inter, system-ui, sans-serif; }
.lj .ys-tips tr.t td { border-top:1px solid var(--ink-rutnat); font-weight:600; }
`;

// Korta namn på SKR:s grupper (2023)
const SKR_KORT = {
  A1: "Storstäder", A2: "Pendling nära storstad", B3: "Övriga större städer",
  B4: "Pendling nära större stad", B5: "Lågpendling nära större stad", C6: "Mindre städer/tätorter",
  C7: "Pendling nära mindre tätort", C8: "Landsbygdskommuner", C9: "Landsbygd med besöksnäring"
};
const kod = g => (/^[ABC]\d$/.test(g.id) ? g.id : /^[ABC]\d$/.test(g.kort ?? "") ? g.kort : null);
const kortNamn = g => (g.typ === "skr" ? SKR_KORT[kod(g)] ?? g.namn : g.typ === "riket" ? "Riket" : g.kort && g.kort.length > 3 ? g.kort : g.namn);
// Inga tankstreck i synlig text
const utanTankstreck = s => (s == null ? s : String(s).replace(/\s*—\s*/g, ", "));

// Talformat per mått. Diagrametiketter utan enhet (enheten står i rubriken).
const formatFor = m => {
  const e = (m.enhet ?? "").toLowerCase();
  if (e.includes("%") || e.includes("procent")) return { kort: f.dec1, lang: f.pct1, diff: v => `${tecken(v)}${f.dec1(Math.abs(v))} procentenheter` };
  if (e.includes("kvot")) return { kort: f.dec2, lang: f.dec2, diff: v => `${tecken(v)}${f.dec2(Math.abs(v))}` };
  return { kort: f.dec1, lang: f.dec1, diff: v => `${tecken(v)}${f.dec1(Math.abs(v))}` };
};
const tecken = v => (v > 0.0001 ? "+" : v < -0.0001 ? "−" : "±");
const plus1 = v => `${tecken(v)}${f.dec1(Math.abs(v))}`;

// Förklaring under facettrubriken (enhet och år ur data)
const UNDERTEXT = {
  forsorjningskvot: m => `(0–19 + 65+ år) per person 20–64, ${m.ar}`
};

export function lagejamforelse(data, {
  temaNamn = aktivtTema(), width = 960, height = 560, steg = true,
  flikEtiketter = ["Läget idag", "Näringslivets omställning"],
  sortera = true, stadOrdning = null, mattOrdning = null,
  mattRubrik = { platsbundna: "Andel jobb i platsbundna tjänster" },
  kalla = null, kallaNaring = null,
  brott = [{ ar: 2020, etikett: "BAS" }], period = null,
  par = [["platsbundna", "varuproduktion"]]
} = {}) {
  const R = ram({ temaNamn, width, height, klass: "lj", stil: STIL });
  const { rot } = R;
  const tips = tipsruta(rot);
  const gr = data.grupper ?? [];
  const stader = (stadOrdning ? stadOrdning.map(k => gr.find(g => g.id === k)) : gr.filter(g => g.typ === "stad")).filter(Boolean);
  const skr = gr.filter(g => g.typ === "skr");
  const riket = gr.filter(g => g.typ === "riket");
  const ctx = { ...R, tips, stader, skr, riket, data, W: width, H: height - 44 };
  const k1 = kalla ?? (data.kalla ? `Källa: ${utanTankstreck(data.kalla).replace(/\.?\s*$/, "")}. SKR:s grupper räknas utan de fem (B3 och C6 utan Karlskrona). Streckad linje = riket.` : null);
  rot.appendChild(flikar([
    { etikett: flikEtiketter[0], bygg: () => punktdiagram(ctx, { mattOrdning, mattRubrik, sortera, kalla: k1, par }) },
    { etikett: flikEtiketter[1], bygg: () => spridning(ctx, { kalla: kallaNaring, brott, period }) }
  ], { steg }));
  return rot;
}

// Text med halo i bakgrundsfärgen
function halo(t, botten) {
  return t.attr("paint-order", "stroke").attr("stroke", botten).attr("stroke-width", 3).attr("stroke-linejoin", "round");
}

// ── Flik 1: en facett per mått ──────────────────────────────────────────────
function punktdiagram(ctx, { mattOrdning, mattRubrik, sortera, kalla, par }) {
  const { ink, farg, tips, stader, skr, riket, data, W, H, botten } = ctx;
  const yta = el("div", { class: "lj-yta", style: `width:${W}px;height:${H}px` });
  const v = new Map(data.varden.map(d => [`${d.grupp}|${d.matt}`, d.varde]));
  const motpol = new Map();
  for (const [a, b] of par) if (data.matt.some(m => m.id === a) && data.matt.some(m => m.id === b)) motpol.set(a, data.matt.find(m => m.id === b));
  const doljs = new Set([...motpol.values()].map(m => m.id));
  const matt = (mattOrdning ? mattOrdning.map(id => data.matt.find(m => m.id === id)) : data.matt).filter(m => m && !doljs.has(m.id));
  const kallaH = kalla ? 34 : 0;
  const svgH = H - kallaH;
  const svg = d3.select(yta).append("svg").attr("width", W).attr("height", svgH);
  const rk = riket[0];

  // Sortering inom blocken: första måttet, störst först
  const m0 = matt[0];
  const sorterad = lista => (sortera && m0
    ? [...lista].sort((a, b) => (v.get(`${b.id}|${m0.id}`) ?? -Infinity) - (v.get(`${a.id}|${m0.id}`) ?? -Infinity))
    : lista);

  const labW = 206, gap = 34;
  const pw = (W - labW - gap * (matt.length - 1)) / Math.max(1, matt.length);

  // Rubrikhöjd: lika för alla facetter
  const rubriker = matt.map(m => etikettRader(mattRubrik?.[m.id] ?? m.namn, pw, 13, 600).slice(0, 2));
  const nRub = Math.max(1, ...rubriker.map(r => r.length));
  const subY = 20 + nRub * 16 - 2;
  const riketY = subY + 22;                 // rikets etikett och blockrubriken "De fem"
  const BLK = 20, GAPB = 10, AX = 26;
  const n = stader.length + skr.length;
  const rh = Math.min(27, (svgH - riketY - 4 - 2 * BLK - GAPB - AX) / Math.max(1, n));

  // Rader
  const rader = [];
  const block = [];
  let y = riketY - 12;
  for (const [i, [namn, lista]] of [["De fem", sorterad(stader)], ["SKR:s kommungrupper 2023", sorterad(skr)]].entries()) {
    if (!lista.length) continue;
    if (i) y += GAPB;
    block.push({ namn, y: y + 12 });
    y += BLK;
    for (const g of lista) { rader.push({ g, y: y + rh / 2 }); y += rh; }
  }
  const yTop = riketY + 6, yMax = y + 4;

  // Vänsterkolumnen: blockrubriker och radnamn
  const gl = svg.append("g");
  for (const b of block) {
    gl.append("text").attr("x", 0).attr("y", b.y).attr("font-size", 9.5).attr("letter-spacing", "0.08em")
      .attr("fill", ink.svag).text(b.namn.toUpperCase());
  }
  for (const r of rader) {
    const g = r.g, stad = g.typ === "stad";
    const t = gl.append("text").attr("x", labW - 16).attr("y", r.y).attr("dy", "0.34em").attr("text-anchor", "end")
      .attr("font-size", stad ? 13.5 : 11.5).attr("font-weight", stad ? 600 : 400)
      .attr("fill", stad ? farg[g.id] ?? ink.stark : ink.mjuk);
    if (g.typ === "skr" && kod(g)) t.append("tspan").attr("font-family", MONO).attr("font-size", 9.5).attr("fill", ink.svag).text(`${kod(g)}  `);
    t.append("tspan").text(kortNamn(g));
  }

  matt.forEach((m, mi) => {
    const x0 = labW + mi * (pw + gap);
    const g = svg.append("g").attr("transform", `translate(${x0},0)`);
    const fm = formatFor(m);
    const mp = motpol.get(m.id);
    const rv = rk ? v.get(`${rk.id}|${m.id}`) : null;
    const vals = [...stader, ...skr, ...riket].map(gg => v.get(`${gg.id}|${m.id}`)).filter(Number.isFinite);
    const [lo, hi] = d3.extent(vals);
    const pad = (hi - lo) * 0.06 || 1;
    // Plats på båda sidor för värdena (ca 34 px)
    const dv = (hi - lo + 2 * pad) * 34 / (pw - 68);
    const sx = d3.scaleLinear().domain([lo - pad - dv, hi + pad + dv]).range([0, pw]);

    // Facettens huvud: tjock linje, rubrik, enhet och år
    g.append("rect").attr("x", 0).attr("y", 0).attr("width", pw).attr("height", 2).attr("fill", ink.stark);
    rubriker[mi].forEach((r, j) => g.append("text").attr("x", 0).attr("y", 20 + j * 16).attr("font-size", 13).attr("font-weight", 600).attr("fill", ink.stark).text(r));
    const enh = /%|procent/i.test(m.enhet ?? "") ? (mp ? "procent av jobben" : "procent") : m.enhet;
    g.append("text").attr("x", 0).attr("y", subY).attr("font-size", 10.5).attr("fill", ink.svag)
      .text(UNDERTEXT[m.id] ? UNDERTEXT[m.id](m) : [enh, m.ar].filter(Boolean).join(", "));

    // Axel: baslinje med tre tal, svaga stödlinjer
    const ticks = sx.ticks(3).filter(t => sx(t) >= 4 && sx(t) <= pw - 4);
    for (const t of ticks) {
      const p = Math.round(sx(t)) + 0.5;
      g.append("line").attr("x1", p).attr("x2", p).attr("y1", yTop).attr("y2", yMax).attr("stroke", ink.rutnat);
      g.append("text").attr("x", p).attr("y", yMax + 16).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(fm.kort(t).replace(/,0+$/, ""));
    }
    g.append("line").attr("x1", 0).attr("x2", pw).attr("y1", yMax + 0.5).attr("y2", yMax + 0.5).attr("stroke", ink.linje);

    // Riket: streckad referens med etikett överst
    if (Number.isFinite(rv)) {
      const p = Math.round(sx(rv)) + 0.5;
      g.append("line").attr("x1", p).attr("x2", p).attr("y1", yTop - 2).attr("y2", yMax).attr("stroke", ink.mjuk).attr("stroke-width", 1.2).attr("stroke-dasharray", "4 3");
      const txt = `Riket ${fm.kort(rv)}`;
      const tw = textbredd(txt, 10.5, 600);
      const tx = Math.max(tw / 2, Math.min(pw - tw / 2, p));
      g.append("text").attr("x", tx).attr("y", riketY).attr("text-anchor", "middle").attr("font-size", 10.5).attr("font-weight", 600).attr("fill", ink.mjuk).text(txt);
    }

    // Punkterna med stjälk från riket
    for (const r of rader) {
      const val = v.get(`${r.g.id}|${m.id}`);
      if (!Number.isFinite(val)) continue;
      const stad = r.g.typ === "stad";
      const c = stad ? farg[r.g.id] ?? ink.stark : ink.svag;
      const px = sx(val);
      if (Number.isFinite(rv)) g.append("line").attr("x1", sx(rv)).attr("x2", px).attr("y1", r.y).attr("y2", r.y).attr("stroke", stad ? c : ink.linje).attr("stroke-opacity", stad ? 0.45 : 0.9).attr("stroke-width", stad ? 2 : 1.4);
      g.append("circle").attr("cx", px).attr("cy", r.y).attr("r", stad ? 6 : 4.2)
        .attr("fill", c).attr("stroke", botten).attr("stroke-width", stad ? 1.5 : 1);
      // Värdet på den sida som vetter bort från riket (stjälken ligger på andra sidan)
      const vanster = Number.isFinite(rv) && val < rv - 1e-9 && px - 40 > 0;
      halo(g.append("text"), botten).attr("x", px + (vanster ? -1 : 1) * (stad ? 10 : 8)).attr("text-anchor", vanster ? "end" : "start")
        .attr("y", r.y).attr("dy", "0.34em").attr("font-family", MONO)
        .attr("font-size", stad ? 11 : 9.5).attr("font-weight", stad ? 600 : 400).attr("fill", stad ? ink.stark : ink.svag).text(fm.kort(val));
      g.append("rect").attr("x", -6).attr("y", r.y - rh / 2).attr("width", pw + 12).attr("height", rh).attr("fill", "transparent")
        .on("pointermove", ev => {
          const mv = mp ? v.get(`${r.g.id}|${mp.id}`) : null;
          const ant = r.g.antal_kommuner && r.g.typ !== "stad" ? ` <span class="s">${r.g.antal_kommuner} kommuner</span>` : "";
          tips.visa(`<b>${r.g.namn}</b>${ant}<br><span class="s">${mattRubrik?.[m.id] ?? m.namn}, ${m.ar}</span><br><span class="m">${fm.lang(val)}</span>` +
            (Number.isFinite(rv) ? ` <span class="s">riket ${fm.lang(rv)}, skillnad ${fm.diff(val - rv)}</span>` : "") +
            (Number.isFinite(mv) ? `<br><span class="s">${mp.namn}</span> <span class="m">${formatFor(mp).lang(mv)}</span>` : ""), ev);
        })
        .on("pointerleave", () => tips.dolj());
    }
  });
  if (kalla) yta.appendChild(el("div", { class: "lj-kalla" }, kalla));
  return yta;
}

// ── Flik 2: spridningsdiagram över omställningen ────────────────────────────
let klippNr = 0;
function spridning(ctx, { kalla, brott, period }) {
  const { ink, farg, tips, stader, skr, riket, data, W, H, botten } = ctx;
  const yta = el("div", { class: "lj-yta", style: `width:${W}px;height:${H}px` });
  const nar = data.naring ?? [];
  const ar = [...new Set(nar.map(d => d.ar))].sort((a, b) => a - b);
  const AMIN = ar[0], AMAX = ar[ar.length - 1];
  let A0 = Math.max(AMIN, period?.fran ?? AMIN), A1 = Math.min(AMAX, period?.till ?? AMAX);
  const rad = new Map(nar.map(d => [`${d.grupp}|${d.ar}`, d]));

  const hd = el("div", { class: "lj-hd" });
  const under = el("span", { class: "u" });
  const reglage = arsreglage({
    min: AMIN, max: AMAX, fran: A0, till: A1, bredd: 230, brott,
    vidByte: p => { A0 = p.fran; A1 = p.till; rita(); }
  });
  hd.append(reglage, under);
  yta.appendChild(hd);

  const brottText = (brott ?? []).map(b => `${b.ar}${b.etikett ? ` (${b.etikett})` : ""}`).join(" och ");
  const k2 = kalla ?? `Källa: SCB, sysselsatt dagbefolkning efter bransch, harmoniserad (RAMS ${AMIN}–2019, BAS 2020–${AMAX}).` +
    (brottText ? ` Brott i serien ${brottText}: perioder över brottet jämför två källor.` : "") +
    ` Platsbundna tjänster = branschgrupp 5–10, varuproduktion = grupp 1–4 (inklusive bygg). SKR:s kommungrupper 2023, räknade utan de fem.`;
  const kallaH = 34;
  const svgH = H - 34 - kallaH;
  const svg = d3.select(yta).append("svg").attr("width", W).attr("height", svgH);
  yta.appendChild(el("div", { class: "lj-kalla" }, k2));

  const M = { top: 22, right: 14, bottom: 34, left: 46 };
  const iw = W - M.left - M.right, ih = svgH - M.top - M.bottom;
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const klipp = `lj-klipp-${++klippNr}`;
  svg.append("defs").append("clipPath").attr("id", klipp).append("rect").attr("width", iw).attr("height", ih);
  const grupper = [...skr, ...riket, ...stader];   // städerna överst i ritordningen
  const fargFor = gg => (gg.typ === "stad" ? farg[gg.id] ?? ink.stark : gg.typ === "riket" ? ink.stark : ink.svag);
  let hov = null;

  function punkter() {
    return grupper.map(gg => {
      const a = rad.get(`${gg.id}|${A0}`), b = rad.get(`${gg.id}|${A1}`);
      if (!a || !b || !(a.totalt > 0)) return null;
      const dt = b.tjanster - a.tjanster, dv = b.varuproduktion - a.varuproduktion, dtot = b.totalt - a.totalt;
      return { gg, a, b, dt, dv, dtot, x: (dt / a.totalt) * 100, y: (dv / a.totalt) * 100, tot: (dtot / a.totalt) * 100 };
    }).filter(Boolean);
  }

  function rita() {
    g.selectAll("*").remove();
    tips.dolj();
    under.textContent = `Förändring ${A0}–${A1} i procent av gruppens alla jobb ${A0}. x + y = total förändring.`;
    const P = punkter();
    if (!P.length) return;

    // Lika skala på båda axlarna (diagonalen blir 45°), origo alltid med
    let [x0, x1] = d3.extent([0, ...P.map(p => p.x)]);
    let [y0, y1] = d3.extent([0, ...P.map(p => p.y)]);
    const spann = Math.max(x1 - x0, y1 - y0, 1);
    x0 -= spann * 0.06; x1 += spann * 0.13; y0 -= spann * 0.08; y1 += spann * 0.08;
    const k = Math.min(iw / (x1 - x0), ih / (y1 - y0));
    const ex = iw / k - (x1 - x0), ey = ih / k - (y1 - y0);
    x0 -= ex * 0.35; x1 += ex * 0.65; y0 -= ey * 0.5; y1 += ey * 0.5;
    const sx = d3.scaleLinear().domain([x0, x1]).range([0, iw]);
    const sy = d3.scaleLinear().domain([y0, y1]).range([ih, 0]);
    const steg = d3.tickStep(0, Math.max(x1 - x0, y1 - y0), 9);
    const tickar = (a, b) => d3.range(Math.ceil(a / steg) * steg, b + 1e-9, steg);
    const fmtT = t => `${t > 0 ? "+" : t < 0 ? "−" : ""}${f.tal(Math.abs(t))}`;

    // Tonad nettominskning (under diagonalen)
    const yta2 = g.append("g").attr("clip-path", `url(#${klipp})`);
    yta2.append("path").attr("d", `M${sx(x0)},${sy(-x0)}L${sx(x1)},${sy(-x1)}L${sx(x1)},${sy(y0) + 2000}L${sx(x0)},${sy(y0) + 2000}Z`)
      .attr("fill", ink.stark).attr("fill-opacity", ctx.T?.mork ? 0.06 : 0.035);

    // Rutnät
    for (const t of tickar(x0, x1)) {
      const p = Math.round(sx(t)) + 0.5;
      if (t !== 0) g.append("line").attr("x1", p).attr("x2", p).attr("y1", 0).attr("y2", ih).attr("stroke", ink.rutnat);
      g.append("text").attr("x", p).attr("y", ih + 15).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(fmtT(t));
    }
    for (const t of tickar(y0, y1)) {
      const p = Math.round(sy(t)) + 0.5;
      if (t !== 0) g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", p).attr("y2", p).attr("stroke", ink.rutnat);
      g.append("text").attr("x", -7).attr("y", p).attr("dy", "0.34em").attr("text-anchor", "end").attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(fmtT(t));
    }
    // Axlar genom origo
    g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", Math.round(sy(0)) + 0.5).attr("y2", Math.round(sy(0)) + 0.5).attr("stroke", ink.mjuk);
    g.append("line").attr("x1", Math.round(sx(0)) + 0.5).attr("x2", Math.round(sx(0)) + 0.5).attr("y1", 0).attr("y2", ih).attr("stroke", ink.mjuk);
    // Diagonalen x + y = 0
    yta2.append("line").attr("x1", sx(x0)).attr("y1", sy(-x0)).attr("x2", sx(x1)).attr("y2", sy(-x1))
      .attr("stroke", ink.mjuk).attr("stroke-width", 1.3).attr("stroke-dasharray", "5 4");

    // Axeltitlar
    g.append("text").attr("x", iw).attr("y", ih + 30).attr("text-anchor", "end").attr("font-size", 11).attr("fill", ink.mjuk)
      .text(`Jobb i platsbundna tjänster, förändring i procent av alla jobb ${A0} →`);
    halo(g.append("text"), botten).attr("x", sx(0) + 6).attr("y", -9).attr("font-size", 11).attr("fill", ink.mjuk)
      .text(`↑ Jobb i varuproduktion, förändring i procent av alla jobb ${A0}`);

    // Hinder för etikettplaceringen: punkter, axeltitel
    const hinder = P.map(p => ({ x: sx(p.x) - 7, y: sy(p.y) - 7, w: 14, h: 14 }));
    hinder.push({ x: sx(0), y: -22, w: textbredd(`↑ Jobb i varuproduktion, förändring i procent av alla jobb ${A0}`, 11, 400) + 10, h: 18 });
    const krock = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    const overlapp = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const inom = b => b.x >= 0 && b.y >= 0 && b.x + b.w <= iw && b.y + b.h <= ih;
    const axlar = [{ x: sx(0) - 3, y: 0, w: 6, h: ih }, { x: 0, y: sy(0) - 3, w: iw, h: 6 }];

    // Områdesetiketter: placeras i sitt område, nära önskat hörn, fritt från punkter
    const omraden = [
      { text: "Nettotillväxt: tjänsterna ersatte varuproduktionen", i: (x, y) => x > 0 && y < 0 && x + y > 0, hörn: [iw, ih] },
      { text: "Båda växte", i: (x, y) => x > 0 && y > 0, hörn: [iw, 0] },
      { text: "Nettominskning", i: (x, y) => x + y < 0, hörn: [0, ih] },
      { text: "Varuproduktionen ersatte tjänsterna", i: (x, y) => x < 0 && y > 0 && x + y > 0, hörn: [0, 0] }
    ];
    for (const o of omraden) {
      const w = textbredd(o.text, 10.5, 600) + 4, h = 15;
      let bast = null, bd = Infinity;
      for (let cx = 4; cx + w <= iw - 2; cx += 8) {
        for (let cy = 4; cy + h <= ih - 2; cy += 6) {
          const b = { x: cx, y: cy, w, h };
          const hornen = [[b.x, b.y], [b.x + w, b.y], [b.x, b.y + h], [b.x + w, b.y + h]];
          if (!hornen.every(([qx, qy]) => o.i(sx.invert(qx), sy.invert(qy)))) continue;
          if ([...hinder, ...axlar].some(hh => krock({ x: b.x - 6, y: b.y - 6, w: w + 12, h: h + 12 }, hh))) continue;
          const d = Math.hypot(b.x + w / 2 - o.hörn[0], b.y + h / 2 - o.hörn[1]);
          if (d < bd) { bd = d; bast = b; }
        }
      }
      if (!bast) continue;
      hinder.push(bast);
      g.append("text").attr("x", bast.x + 2).attr("y", bast.y + 11).attr("font-size", 10.5).attr("font-weight", 600)
        .attr("letter-spacing", "0.02em").attr("fill", ink.svag).text(o.text);
    }
    // Diagonalens etikett längs linjen, där den är fri
    {
      const txt = "Netto noll: x + y = 0";
      const w = textbredd(txt, 10, 500);
      // Den synliga delen av diagonalen, mitten först
      const xa = Math.max(x0, -y1), xb = Math.min(x1, -y0);
      const ts = d3.range(0.02, 0.98, 0.02).sort((a, b) => Math.abs(a - 0.45) - Math.abs(b - 0.45));
      let bast = null;
      for (const t of ts) {
        const xv = xa + (xb - xa) * t, X = sx(xv), Y = sy(-xv);
        const b = { x: X - 2, y: Y - 12, w: w * 0.71 + 12, h: w * 0.71 + 12 };
        if (!inom(b)) continue;
        if ([...hinder, ...axlar].some(hh => krock(b, hh))) continue;
        bast = { X, Y, b };
        break;
      }
      if (bast) {
        hinder.push(bast.b);
        halo(g.append("text"), botten).attr("transform", `translate(${bast.X + 4},${bast.Y - 5}) rotate(45)`)
          .attr("font-size", 10).attr("fill", ink.mjuk).text(txt);
      }
    }

    // Punkterna
    const gp = g.append("g");
    const ordn = [...P].sort((a, b) => (a.gg.typ === "stad") - (b.gg.typ === "stad"));
    for (const p of ordn) {
      const t = p.gg.typ, X = sx(p.x), Y = sy(p.y);
      if (t === "riket") gp.append("circle").attr("cx", X).attr("cy", Y).attr("r", 5.5).attr("fill", botten).attr("stroke", ink.stark).attr("stroke-width", 2.2);
      else gp.append("circle").attr("cx", X).attr("cy", Y).attr("r", t === "stad" ? 6.5 : 4.6)
        .attr("fill", fargFor(p.gg)).attr("fill-opacity", t === "skr" ? 0.85 : 1).attr("stroke", botten).attr("stroke-width", t === "stad" ? 1.6 : 1);
      if (hov === p.gg.id) gp.append("circle").attr("cx", X).attr("cy", Y).attr("r", t === "stad" ? 10 : 8).attr("fill", "none").attr("stroke", fargFor(p.gg)).attr("stroke-width", 1.5);
    }

    // Punktetiketter: de fem först, sedan riket, sist grupperna
    const prio = { stad: 0, riket: 1, skr: 2 };
    const ge = g.append("g");
    for (const p of [...P].sort((a, b) => prio[a.gg.typ] - prio[b.gg.typ])) {
      const t = p.gg.typ, X = sx(p.x), Y = sy(p.y);
      const px = t === "stad" ? 13 : t === "riket" ? 12 : 10.5;
      const vikt = t === "skr" ? 400 : 600;
      const text = t === "skr" ? kortNamn(p.gg) : kortNamn(p.gg);
      const w = textbredd(text, px, vikt) + 2, h = px + 2;
      const r = t === "stad" ? 9 : 7;
      const kand = [];
      for (const s of [1, 1.9, 2.9]) {
        kand.push(
          { x: X + r * s, y: Y - h / 2 }, { x: X - r * s - w, y: Y - h / 2 },
          { x: X - w / 2, y: Y - r * s - h + 2 }, { x: X - w / 2, y: Y + r * s - 2 },
          { x: X + r * s * 0.7, y: Y - r * s * 0.7 - h + 3 }, { x: X + r * s * 0.7, y: Y + r * s * 0.7 - 3 },
          { x: X - r * s * 0.7 - w, y: Y - r * s * 0.7 - h + 3 }, { x: X - r * s * 0.7 - w, y: Y + r * s * 0.7 - 3 }
        );
      }
      let bast = null, bk = Infinity;
      kand.forEach((c, i) => {
        const b = { x: c.x, y: c.y, w, h };
        const kost = (inom(b) ? 0 : 1e6) + hinder.reduce((s, hh) => s + overlapp(b, hh), 0) * 10 + i;
        if (kost < bk) { bk = kost; bast = b; }
      });
      hinder.push(bast);
      const cx = bast.x + bast.w / 2, cy = bast.y + bast.h / 2;
      const avst = Math.hypot(cx - X, cy - Y);
      if (avst > r * 1.9 + Math.max(w, h) / 2) {
        // Ledlinje från punkten till närmaste kant av etiketten
        const lx = Math.max(bast.x, Math.min(bast.x + bast.w, X)), ly = Math.max(bast.y, Math.min(bast.y + bast.h, Y));
        ge.append("line").attr("x1", X).attr("y1", Y).attr("x2", lx).attr("y2", ly).attr("stroke", fargFor(p.gg)).attr("stroke-opacity", 0.5).attr("stroke-width", 0.8);
      }
      halo(ge.append("text"), botten).attr("x", bast.x + 1).attr("y", bast.y + h / 2).attr("dy", "0.34em")
        .attr("font-size", px).attr("font-weight", vikt)
        .attr("fill", t === "stad" ? fargFor(p.gg) : t === "riket" ? ink.stark : ink.svag).text(text);
    }

    // Hovring: närmaste punkt
    g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("pointermove", ev => {
        const [mx, my] = d3.pointer(ev);
        let bast = null, av = 22;
        for (const p of P) {
          const d = Math.hypot(sx(p.x) - mx, sy(p.y) - my);
          if (d < av) { av = d; bast = p; }
        }
        const id = bast?.gg.id ?? null;
        if (id !== hov) { hov = id; rita(); }
        if (!bast) return tips.dolj();
        tips.visa(tipsHtml(bast), ev);
      })
      .on("pointerleave", () => { tips.dolj(); if (hov) { hov = null; rita(); } });
  }

  function tipsHtml(p) {
    const ant = p.gg.antal_kommuner && p.gg.typ !== "stad" ? ` <span class="s">${p.gg.antal_kommuner} kommuner</span>` : "";
    const sek = (a, b) => (a > 0 ? `${plus1(((b - a) / a) * 100)} %` : "–");
    const rd = (namn, a, b, d, andel, klass = "") =>
      `<tr class="${klass}"><td>${namn}</td><td>${f.tal(a)}</td><td>${f.tal(b)}</td><td>${f.plus(d)}</td><td>${sek(a, b)}</td><td>${plus1(andel)} %</td></tr>`;
    return `<b>${p.gg.namn}</b>${ant} <span class="s">${A0}–${A1}</span>` +
      `<table><tr class="h"><td></td><td>${A0}</td><td>${A1}</td><td>förändring</td><td>procent</td><td>av alla jobb ${A0}</td></tr>` +
      rd("Platsbundna tjänster", p.a.tjanster, p.b.tjanster, p.dt, p.x) +
      rd("Varuproduktion", p.a.varuproduktion, p.b.varuproduktion, p.dv, p.y) +
      rd("Totalt", p.a.totalt, p.b.totalt, p.dtot, p.tot, "t") + `</table>`;
  }

  rita();
  return yta;
}
