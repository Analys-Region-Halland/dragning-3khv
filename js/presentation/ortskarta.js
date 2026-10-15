// =============================================================================
// ORTSKARTA — kartan över tätorterna och bilden "ortsstruktur" (bild 4)
// =============================================================================
//
//   ortskarta(geo, opts) → nod
//     Interaktiv karta över de fem länen i SWEREF99 TM (d3.geoIdentity + reflectY).
//     En knapp per län och "Alla"; ett val zoomar med mjuk övergång till länets
//     utsnitt. Länsgränser, kommungränser tunt, tätorter som cirklar (yta ∝
//     folkmängd). Fokusstaden och länets största ort har samma färger som i
//     svärmen och är namngivna, övriga är grå. Hovring: namn + folkmängd.
//     Ingen legend.
//
//     geo (se FINAL-SPEC, 3khv-ortskarta):
//       { lan:      GeoJSON FeatureCollection, properties { lan, lan_namn, fokus },
//         kommuner: GeoJSON FeatureCollection, properties { kod, namn, lan },
//         tatorter: [{ tatort, kod, lan, folkmangd, x, y, centralort, storsta_i_lan }],
//         utsnitt:  [{ lan, lan_namn, stad_kod, bbox: [xmin, ymin, xmax, ymax] }] }
//     Länskoder jämförs som fyrsiffriga ("07" och "0007" är samma län).
//
//     opts: temaNamn, width (360), height (520), vald ("alla" | länskod),
//           vidVal: länskod | "alla" => …  (anropas när användaren väljer),
//           ordning: [länskod] — knapparnas ordning (förval: utsnitt),
//           lanNamn: { länskod: knapptext } (förval: länets namn utan "län"/genitiv-s),
//           knappar: true
//     nod.valj(länskod | "alla", { tyst, direkt }) — välj utifrån (tyst: utan vidVal;
//           direkt: utan övergång) · nod.vald() → aktuellt val
//
//   ortsstruktur(data, geo, opts) → nod
//     Svärmen (tätorter per län) och kartan sida vid sida inom ca 960 × 560 px,
//     med synkat länsval: klick på en länsrad zoomar kartan, länsknappen i kartan
//     lyfter raden. Vid varje rad: största tätortens storlek mot den näst största
//     (primatkvot) och centralortens yta och täthet.
//
//     data = 3khv-ortsstruktur ({ ar, lan[], tatorter[], centralorter[] })
//     opts: temaNamn, width (960), height (560), radOrdning, vald, domain, kalla,
//           svarmBredd (588), gap (20)
//     nod.valj(länskod | "alla")
// =============================================================================

import { d3 } from "../lib/d3.js";
import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { segment } from "./kontroller.js";
import { svarm, stadFarger, STADER, fmt } from "./jamforelse.js";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const lanNyckel = v => String(v).padStart(4, "0");
// "Kronobergs län" → "Kronoberg", "Skåne län" → "Skåne"
const kortLan = n => { const s = String(n).replace(/\s*län$/i, ""); return /s$/.test(s) ? s.slice(0, -1) : s; };
let raknare = 0;

function el(tagg, attr = {}, text = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}

// Planär bbox över alla koordinater i en GeoJSON-geometri/feature
function bboxAv(geo) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const gaigenom = c => {
    if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
    else c.forEach(gaigenom);
  };
  const g = geo.geometry ?? geo;
  gaigenom(g.coordinates);
  return [x0, y0, x1, y1];
}

// ═══ ortskarta ════════════════════════════════════════════════════════════
export function ortskarta(geo, {
  temaNamn = aktivtTema(), width = 360, height = 520, vald = "alla", vidVal = null,
  ordning = null, lanNamn = null, knappar = true
} = {}) {
  const T = hamtaTema(temaNamn), ink = T.ink;
  const farg = stadFarger(temaNamn);
  const botten = T.mork ? "#16211D" : "#FFFFFF";
  const rgb = T.mork ? "255,255,255" : "10,20,15";
  const k_ = `ok-${++raknare}-${Math.random().toString(36).slice(2, 6)}`;

  // ── Rot, knappar, svg ──
  const rot = document.createElement("div");
  rot.className = `graf-container ok ${k_}`;
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", position: "relative", background: "var(--graf-bakgrund)",
    color: ink.stark, fontFamily: "var(--graf-text-font)", fontSize: "12px", lineHeight: "1.35",
    textAlign: "left", boxSizing: "border-box"
  });
  const stil = el("style");
  stil.textContent = `
    .${k_} .ok-knappar { height:34px; display:flex; align-items:flex-start; }
    .${k_} .kt-par button { padding:4px 8px; }
    ${T.mork ? `.${k_} .kt-par { border-color:${ink.linje}; }
    .${k_} .kt-par button { color:${ink.mjuk}; }
    .${k_} .kt-par button:hover { color:${ink.stark}; }
    .${k_} .kt-par button.pa { background:rgba(255,255,255,.12); color:${ink.stark}; }` : ""}
    .${k_} .ok-tips { position:absolute; left:0; top:0; pointer-events:none; opacity:0; transition:opacity .1s; background:${botten}; border:1px solid ${ink.rutnat}; box-shadow:0 10px 28px -14px rgba(0,0,0,.4); border-radius:6px; padding:7px 10px; color:${ink.stark}; white-space:nowrap; z-index:10; font-size:11.5px; }
    .${k_} .ok-tips b { font-weight:600; }
    .${k_} .ok-tips .m { font-family:${MONO}; }
    .${k_} .ok-tips .s { color:${ink.svag}; font-size:10.5px; }
  `;
  rot.appendChild(stil);
  const knappRad = el("div", { class: "ok-knappar" });
  if (knappar) rot.appendChild(knappRad);
  const W = width, H = height - (knappar ? 34 : 0);
  const svgSel = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").style("display", "block")
    .style("overflow", "hidden").style("font-family", "var(--graf-text-font)");
  rot.appendChild(svgSel.node());
  const tips = el("div", { class: "ok-tips" });
  rot.appendChild(tips);

  // ── Data ──
  const lanF = geo.lan.features.map(f => ({ f, key: lanNyckel(f.properties.lan), fokus: f.properties.fokus !== false }));
  const utsnitt = (geo.utsnitt ?? []).map(u => ({ ...u, key: lanNyckel(u.lan) }));
  for (const l of lanF.filter(l => l.fokus)) {          // saknat utsnitt → länets egen bbox
    if (!utsnitt.some(u => u.key === l.key)) utsnitt.push({ lan: l.f.properties.lan, lan_namn: l.f.properties.lan_namn, key: l.key, bbox: bboxAv(l.f) });
  }
  const ord = ordning ? ordning.map(lanNyckel) : utsnitt.map(u => u.key);
  const lanLista = ord.map(k => utsnitt.find(u => u.key === k)).filter(Boolean);
  const kommunF = geo.kommuner.features.map(f => ({ f, lan: lanNyckel(f.properties.lan) }));

  const tat = geo.tatorter.filter(d => Number.isFinite(d.x) && Number.isFinite(d.y)).map(d => ({ ...d, lanK: lanNyckel(d.lan) }));
  const maxLan = d3.rollup(tat, v => d3.max(v, d => d.folkmangd), d => d.lanK);
  for (const d of tat) {
    d.stad = d.centralort
      ? (STADER.find(s => s.kod === String(d.kod)) ?? STADER.find(s => s.namn === d.tatort && lanNyckel(s.lan) === d.lanK) ?? null)
      : null;
    d.storsta = d.folkmangd === maxLan.get(d.lanK);
  }
  tat.sort((a, b) => a.folkmangd - b.folkmangd);          // små först → stora ligger överst
  // Alla län i bild: som svärmen (≥ 3 000 inv). Inzoomat på ett län: ned till 1 000.
  const GRANS_ALLA = 3000, GRANS_LAN = 1000;
  const synlig = d => (d.stad || d.storsta || d.folkmangd >= (nu === "alla" ? GRANS_ALLA : GRANS_LAN));

  // ── Projektion och vyer ──
  // Bas: SWEREF99 TM rakt av, y vänd. Vyn är [mittX, mittY, synlig bredd] i basens koordinater.
  const union = lanLista.length ? lanLista.map(u => u.bbox) : lanF.filter(l => l.fokus).map(l => bboxAv(l.f));
  const ub = [d3.min(union, b => b[0]), d3.min(union, b => b[1]), d3.max(union, b => b[2]), d3.max(union, b => b[3])];
  const rektangel = b => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] } });
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[0, 0], [W, H]], rektangel(ub));
  const bana = d3.geoPath(proj);
  const vyAv = (b, luft = 1.08) => {
    const [ax, ay] = proj([b[0], b[1]]), [bx, by] = proj([b[2], b[3]]);
    return [(ax + bx) / 2, (ay + by) / 2, Math.max(Math.abs(bx - ax), Math.abs(by - ay) * W / H) * luft];
  };
  const vyAlla = vyAv(ub, 1.0);
  const vyer = new Map([["alla", vyAlla], ...lanLista.map(u => [u.key, vyAv(u.bbox)])]);
  const kAlla = W / vyAlla[2];
  for (const d of tat) { const p = proj([d.x, d.y]); d.px = p[0]; d.py = p[1]; }

  // ── Lager ──
  const gKarta = svgSel.append("g");
  const nc = "non-scaling-stroke";
  const landFyll = (l, v) => {
    const a = !l.fokus ? (v === "alla" ? 0.025 : 0.018) : v === "alla" ? 0.06 : l.key === v ? 0.085 : 0.032;
    return `rgba(${rgb},${a})`;
  };
  const gLand = gKarta.append("g");
  const lan = gLand.selectAll("path").data(lanF).join("path").attr("d", l => bana(l.f)).attr("stroke", "none");
  const kom = gKarta.append("g").selectAll("path").data(kommunF).join("path").attr("d", k => bana(k.f))
    .attr("fill", "none").attr("stroke", ink.svag).attr("stroke-width", 0.6).attr("vector-effect", nc).attr("stroke-linejoin", "round");
  const grans = gKarta.append("g").selectAll("path").data(lanF).join("path").attr("d", l => bana(l.f))
    .attr("fill", "none").attr("stroke", ink.mjuk).attr("stroke-opacity", l => (l.fokus ? 0.6 : 0.3)).attr("stroke-width", 1)
    .attr("vector-effect", nc).attr("stroke-linejoin", "round");
  const valdKant = gKarta.append("path").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.7)
    .attr("vector-effect", nc).attr("stroke-linejoin", "round").attr("opacity", 0);

  const gPunkt = svgSel.append("g");
  const rMax = Math.min(W, H) * 0.046;
  const rSk = d3.scaleSqrt().domain([0, d3.max(tat, d => d.folkmangd)]).range([0, rMax]);
  for (const d of tat) d.r0 = Math.max(1.7, rSk(d.folkmangd));
  const farg_ = d => (d.stad ? farg[d.stad.kod] : d.storsta ? ink.stark : ink.svag);
  const prickar = gPunkt.selectAll("circle").data(tat).join("circle")
    .attr("fill", farg_).attr("stroke", botten).attr("stroke-width", 0.7);
  const gEt = svgSel.append("g").attr("pointer-events", "none");
  const ring = svgSel.append("circle").attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1.3).attr("opacity", 0).attr("pointer-events", "none");

  // ── Tillstånd och ritning ──
  let nu = vald === "alla" ? "alla" : lanNyckel(vald);
  let vy = vyer.get(nu) ?? vyAlla;
  let hov = null, kontroll = null;
  const vyParam = () => { const k = W / vy[2]; return { k, tx: W / 2 - vy[0] * k, ty: H / 2 - vy[1] * k }; };

  function lagg() {
    const { k, tx, ty } = vyParam();
    gKarta.attr("transform", `translate(${tx},${ty}) scale(${k})`);
    const zf = Math.pow(k / kAlla, 0.32);
    prickar.attr("cx", d => k * d.px + tx).attr("cy", d => k * d.py + ty).attr("r", d => d.r0 * zf * (d === hov ? 1.12 : 1));
  }
  function styla({ mjukt = true } = {}) {
    const m = (s) => (mjukt ? s.transition().duration(350) : s);
    m(lan).attr("fill", l => landFyll(l, nu));
    m(kom).attr("stroke-opacity", k => (nu === "alla" ? 0.5 : k.lan === nu ? 0.85 : 0.22));
    const v = lanF.find(l => l.key === nu);
    valdKant.datum(v ?? null).attr("d", v ? bana(v.f) : null).attr("opacity", v ? 1 : 0);
    m(prickar).attr("fill-opacity", d => !synlig(d) ? 0 : (d.stad || d.storsta ? 0.96 : 0.5) * (nu === "alla" || d.lanK === nu ? 1 : 0.28))
      .attr("stroke-opacity", d => (synlig(d) ? 1 : 0));
  }

  function etiketter() {
    const { k, tx, ty } = vyParam();
    const zf = Math.pow(k / kAlla, 0.32);
    const lagda = [];
    const val = tat.filter(d => (d.stad || d.storsta) && (nu === "alla" || d.lanK === nu));
    const poster = [];
    for (const d of val) {
      const sx = k * d.px + tx, sy = k * d.py + ty, r = d.r0 * zf;
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      const fs = d.stad ? 13 : 12, bredd = d.tatort.length * (d.stad ? 7.4 : 6.6) + 4;
      // Först till höger om pricken, annars till vänster, annars ovanför
      const kand = [
        { x: sx + r + 5, y: sy + 4.5, a: "start", x0: sx + r + 5, x1: sx + r + 5 + bredd },
        { x: sx - r - 5, y: sy + 4.5, a: "end", x0: sx - r - 5 - bredd, x1: sx - r - 5 },
        { x: sx, y: sy - r - 6, a: "middle", x0: sx - bredd / 2, x1: sx + bredd / 2 }
      ];
      const ryms = c => c.x0 >= 2 && c.x1 <= W - 2 && !lagda.some(l => c.x0 < l.x1 && c.x1 > l.x0 && Math.abs(c.y - l.y) < 14);
      const val_ = kand.find(ryms) ?? kand[0];
      lagda.push(val_);
      poster.push({ d, ...val_, fs });
    }
    gEt.selectAll("text").data(poster, p => p.d.tatort).join("text")
      .attr("x", p => p.x).attr("y", p => p.y).attr("text-anchor", p => p.a).attr("font-size", p => p.fs)
      .attr("font-weight", p => (p.d.stad ? 700 : 600)).attr("fill", p => farg_(p.d))
      .attr("paint-order", "stroke").attr("stroke", botten).attr("stroke-width", 3.2).attr("stroke-linejoin", "round")
      .text(p => p.d.tatort)
      .attr("opacity", 0).transition().duration(220).attr("opacity", 1);
  }

  function gaTill(mal, direkt) {
    svgSel.interrupt("zoom");
    gEt.interrupt();
    const i = d3.interpolateZoom(vy, mal);
    if (direkt || !(i.duration > 0)) { vy = [...mal]; lagg(); etiketter(); return; }
    gEt.selectAll("text").interrupt().transition().duration(120).attr("opacity", 0);
    svgSel.transition("zoom").duration(Math.min(1100, Math.max(650, i.duration * 0.75))).ease(d3.easeCubicInOut)
      .tween("vy", () => t => { vy = i(t); lagg(); })
      .on("end", () => { vy = [...mal]; lagg(); etiketter(); });
  }

  function valj(id, { tyst = false, direkt = false } = {}) {
    const ny = id === "alla" || id == null ? "alla" : lanNyckel(id);
    if (!vyer.has(ny)) return;
    const andrad = ny !== nu;
    nu = ny;
    kontroll?.satt(nu, { tyst: true });
    if (andrad || direkt) { styla({ mjukt: !direkt }); gaTill(vyer.get(nu), direkt); }
    if (!tyst && andrad) vidVal?.(nu);
  }

  // ── Knappar ──
  if (knappar) {
    const namnPa = Object.fromEntries(lanLista.map(u => [u.key, lanNamn?.[u.lan] ?? lanNamn?.[u.key] ?? kortLan(u.lan_namn)]));
    kontroll = segment({
      val: [{ id: "alla", etikett: "Alla" }, ...lanLista.map(u => ({ id: u.key, etikett: namnPa[u.key] }))],
      varde: nu, vidByte: id => valj(id)
    });
    knappRad.appendChild(kontroll);
  }

  // ── Hovring ──
  function visaTips(html, gx, gy) {
    tips.innerHTML = html;
    const rr = rot.getBoundingClientRect(), s = svgSel.node().getBoundingClientRect();
    const sk = rr.width / rot.offsetWidth || 1, svs = s.width / W;
    const px = ((s.left - rr.left) + gx * svs) / sk, py = ((s.top - rr.top) + gy * svs) / sk;
    const tw = tips.offsetWidth || 150, th = tips.offsetHeight || 44;
    const lx = px + 14 + tw > rot.offsetWidth ? px - 14 - tw : px + 14;
    const ly = py - th - 10 < 0 ? py + 14 : py - th - 10;
    tips.style.transform = `translate(${Math.max(0, lx)}px, ${Math.max(0, ly)}px)`;
    tips.style.opacity = 1;
  }
  const dolj = () => { tips.style.opacity = 0; ring.attr("opacity", 0); if (hov) { hov = null; lagg(); } };
  svgSel.append("rect").attr("width", W).attr("height", H).attr("fill", "transparent")
    .on("pointermove", ev => {
      const [mx, my] = d3.pointer(ev, svgSel.node());
      const { k, tx, ty } = vyParam();
      let bast = null, av = 11;
      for (const d of tat) {
        if (!synlig(d) || (nu !== "alla" && d.lanK !== nu)) continue;
        const sx = k * d.px + tx, sy = k * d.py + ty, s = Math.hypot(sx - mx, sy - my) - d.r0 * 0.5;
        if (s < av) { av = s; bast = d; }
      }
      if (!bast) return dolj();
      if (bast !== hov) { hov = bast; lagg(); }
      const sx = k * bast.px + tx, sy = k * bast.py + ty;
      ring.attr("cx", sx).attr("cy", sy).attr("r", bast.r0 * Math.pow(k / kAlla, 0.32) + 3).attr("opacity", 1);
      visaTips(`<b>${bast.tatort}</b>${bast.kommun ? ` <span class="s">${bast.kommun}</span>` : ""}<br><span class="m">${fmt.tal(bast.folkmangd)}</span> <span class="s">invånare</span>`, sx, sy);
    })
    .on("pointerleave", dolj);

  styla({ mjukt: false });
  lagg();
  // Etiketterna kräver mått — rita när noden hamnat i sidan (annars direkt)
  etiketter();

  rot.valj = valj;
  rot.vald = () => nu;
  return rot;
}

// ═══ ortsstruktur ═════════════════════════════════════════════════════════
export function ortsstruktur(data, geo, {
  temaNamn = aktivtTema(), width = 960, height = 560,
  radOrdning = ["Kronobergs län", "Kalmar län", "Blekinge län", "Hallands län", "Skåne län"],
  vald = "alla", domain = [2800, 420000], kalla = null, svarmBredd = 588, gap = 20
} = {}) {
  const T = hamtaTema(temaNamn), ink = T.ink;
  const farg = stadFarger(temaNamn);
  const FEMKODER = STADER.map(s => s.kod);

  // Län: namn ↔ kod, och länets fokusstad
  const lanInfo = new Map(data.lan.map(l => [l.lan_namn, l]));
  const kodAvNamn = n => lanNyckel(lanInfo.get(n).lan);
  const namnAvKod = Object.fromEntries(radOrdning.map(n => [kodAvNamn(n), n]));
  const stadAvNamn = n => STADER.find(s => lanNyckel(s.lan) === kodAvNamn(n));
  const central = n => {
    const s = stadAvNamn(n);
    return s ? (data.centralorter ?? []).find(c => String(c.kod) === s.kod || c.tatort === s.namn) ?? null : null;
  };

  // Tätorterna i svärmen: de fem centralorterna får stadens kod (= färg), länets största markeras
  const rader = data.tatorter.filter(d => radOrdning.includes(d.lan_namn));
  const storst = new Map(radOrdning.map(n => [n, d3.max(rader.filter(d => d.lan_namn === n), d => d.folkmangd)]));
  const tat = rader.map(d => {
    const s = d.centralort ? STADER.find(s => s.namn === d.tatort) : null;
    return { ...d, kod: s ? s.kod : d.tatort, namn: d.tatort, storsta: d.folkmangd === storst.get(d.lan_namn) };
  });

  const kallaH = kalla ? 36 : 0;
  const bodyH = height - kallaH;
  const kartB = width - svarmBredd - gap;

  const rot = document.createElement("div");
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", background: "var(--graf-bakgrund)", color: ink.stark,
    fontFamily: "var(--graf-text-font)", fontSize: "12px", lineHeight: "1.35", textAlign: "left", boxSizing: "border-box"
  });
  const kropp = el("div", { style: `display:flex;gap:${gap}px;align-items:flex-start;height:${bodyH}px` });
  rot.appendChild(kropp);

  let nu = "alla", kartan = null, sv = null;
  const valj = (id, { tyst = false } = {}) => {
    nu = id === "alla" || id == null ? "alla" : lanNyckel(id);
    sv.markeraRad(nu === "alla" ? null : namnAvKod[nu] ?? null);
    if (!tyst) kartan.valj(nu, { tyst: true });
  };

  const tal0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
  const yta = v => (v >= 100 ? tal0.format(v) : fmt.dec1(v));
  sv = svarm(tat, {
    temaNamn, width: svarmBredd, height: bodyH, rad: "lan_namn", radOrdning, x: "folkmangd", domain,
    namn: "namn", kod: "kod", legend: false, ren: true, rMax: 22,
    etikettera: d => FEMKODER.includes(d.kod) || d.storsta,
    fargFor: d => (d.storsta ? ink.stark : null),
    radEtikett: 164, radNotBredd: 100,
    radNamn: kortLan,
    radUnder: k => {
      const c = central(k), s = stadAvNamn(k);
      if (!c || !s) return [];
      return [`${s.namn}: ${yta(c.landareal_km2)} km²`, `${tal0.format(c.tathet)} inv/km²`];
    },
    radNotRubrik: "Störst ÷ näst störst",
    radNot: k => { const l = lanInfo.get(k); return { tal: `${fmt.dec1(l.primat)}×`, text: `mot ${l.nast}` }; },
    xLabel: "Invånare i tätorten, logaritmisk skala →",
    tips: d => `<b>${d.tatort}</b> <span class="s">${d.kommun}</span><br><span class="m">${fmt.tal(d.folkmangd)}</span> <span class="s">invånare${data.ar ? ` ${data.ar}` : ""}</span>`,
    radKlick: k => valj(nu === kodAvNamn(k) ? "alla" : kodAvNamn(k))
  });
  kartan = ortskarta(geo, {
    temaNamn, width: kartB, height: bodyH, vald, ordning: radOrdning.map(kodAvNamn),
    vidVal: id => valj(id, { tyst: true })
  });
  kropp.append(sv, kartan);
  valj(vald, { tyst: true });
  if (kalla) rot.appendChild(el("div", { style: `font-size:10.5px;line-height:1.45;color:${ink.svag};margin-top:6px;height:${kallaH - 6}px;overflow:hidden` }, kalla));

  rot.valj = valj;
  rot.vald = () => nu;
  return rot;
}
