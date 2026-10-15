// =============================================================================
// KONCENTRATION — bild 10 "Fem städer 1990 → 2024" (rev 1, ersätter landning.js)
// =============================================================================
//
//   koncentration(data, opts) → DOM-nod
//
// Fokus: kommunens roll i regionen och koncentrationen, inte tillväxten (den
// är redan visad). Inga rangtal, bara andelar och hur de förflyttats.
//
// data = datasetet 3khv-koncentration:
//   { kalla,
//     kommun: [{ kod, namn, lan, lan_namn, ar, bef, jobb, lan_bef, lan_jobb, andel_bef, andel_jobb }],
//     tatort: [{ kod, centralort, ar, ort_bef, kommun_bef, lan_bef, andel_av_kommun, andel_av_lan }] }
//   Andelar i procent.
//
// Två flikar (flikar() i kontroller.js; → bläddrar, stegmarkören följer med):
//   1  Kommunen i länet: kommunens andel av länets invånare och jobb.
//   2  Centralorten: centralortens andel av kommunens och av länets befolkning
//      (tätortsåren; reglaget snäpper till närmaste tätortsår).
// En rad per stad med två hantlar på en gemensam procentaxel: ring = startår,
// prick med pil = slutår. Till höger andelen slutåret och förändringen i
// procentenheter. Flik 1: skuggat fält mellan invånar- och jobbprickarna när
// jobbandelen är större än invånarandelen (kommunen är ett nav för länets
// jobb). Perioden väljs med arsreglage. Hovring på en rad visar antalen.
//
// opts: { temaNamn, width = 960, height = 560, steg = true,
//         ordning = null (koder; standard = störst andel av länets invånare sista året först),
//         kalla = null (sträng för båda flikarna, eller { kommun, tatort }; standard data.kalla),
//         flikEtiketter = ["Kommunen i länet", "Centralorten"],
//         fran = null, till = null (startperiod flik 1; standard hela serien) }
// =============================================================================

import { d3 } from "../lib/d3.js";
import { aktivtTema } from "../lib/tema.js";
import { flikar, arsreglage } from "./kontroller.js";
import { ram, el, f, tipsruta, MONO } from "./ytstod.js";

const STIL = `
.kc svg { display:block; overflow:visible; font-family:Inter, system-ui, sans-serif; }
.kc .kc-yta { display:flex; flex-direction:column; }
.kc .kc-hd { display:flex; align-items:center; gap:18px; min-height:34px; }
.kc .kc-nyckel { margin-left:auto; display:flex; align-items:center; gap:16px; font-size:11px; color:var(--ink-mjuk); white-space:nowrap; }
.kc .kc-nyckel span { display:inline-flex; align-items:center; gap:6px; }
.kc .kc-nyckel .m { font-family:${MONO}; font-variant-numeric:tabular-nums; color:var(--ink); }
.kc .kc-kalla { font-size:10.5px; color:var(--ink-svag); margin-top:4px; line-height:1.4; }
`;

// Om lan_namn saknas i datan
const LAN_NAMN = { "07": "Kronobergs län", "08": "Kalmar län", "10": "Blekinge län", "12": "Skåne län", "13": "Hallands län" };
const pe = v => (v == null || !Number.isFinite(v) ? "–"
  : `${v > 0.049 ? "+" : v < -0.049 ? "−" : "±"}${f.dec1(Math.abs(v))}`);

export function koncentration(data, {
  temaNamn = aktivtTema(), width = 960, height = 560, steg = true,
  ordning = null, kalla = null, flikEtiketter = ["Kommunen i länet", "Centralorten"],
  fran = null, till = null
} = {}) {
  const R = ram({ temaNamn, width, height, klass: "kc", stil: STIL });
  const { rot } = R;
  const tips = tipsruta(rot);
  const kommun = data?.kommun ?? [], tatort = data?.tatort ?? [];
  const K = new Map(kommun.map(d => [`${d.kod}|${d.ar}`, d]));
  const T = new Map(tatort.map(d => [`${d.kod}|${d.ar}`, d]));
  const koder = [...new Set(kommun.map(d => d.kod))];

  // År där båda andelarna finns (jobben slutar ett år före folkmängden)
  const arK = [...new Set(kommun.filter(d => d.andel_bef != null && d.andel_jobb != null).map(d => d.ar))].sort((a, b) => a - b);
  const arT = [...new Set(tatort.filter(d => d.andel_av_kommun != null).map(d => d.ar))].sort((a, b) => a - b);

  const sistaK = arK.at(-1);
  const ord = ordning
    ? ordning.filter(k => koder.includes(k))
    : [...koder].sort((a, b) => (K.get(`${b}|${sistaK}`)?.andel_bef ?? 0) - (K.get(`${a}|${sistaK}`)?.andel_bef ?? 0));
  const info = k => {
    const d = kommun.find(d => d.kod === k) ?? {};
    return { ...d, lan_namn: d.lan_namn ?? LAN_NAMN[String(d.lan ?? "").slice(-2)] ?? "" };
  };
  const kallaFor = id => (kalla && typeof kalla === "object" ? kalla[id] : kalla) ?? data?.kalla ?? null;
  const ctx = { ...R, tips, W: width, H: height - 44 };

  rot.appendChild(flikar([
    { etikett: flikEtiketter[0], bygg: () => hantelpanel(ctx, {
      ar: arK, fran, till, band: true, kalla: kallaFor("kommun"),
      axeltitel: "Andel av länet",
      rader: ord.map(k => ({ kod: k, namn: info(k).namn, under: info(k).lan_namn })),
      serier: [
        { id: "bef", etikett: "Invånare", varde: (k, a) => K.get(`${k}|${a}`)?.andel_bef },
        { id: "jobb", etikett: "Jobb", varde: (k, a) => K.get(`${k}|${a}`)?.andel_jobb }
      ],
      tips: (k, a, b) => {
        const d0 = K.get(`${k}|${a}`), d1 = K.get(`${k}|${b}`);
        if (!d0 || !d1) return null;
        const rad = (et, v0, l0, p0, v1, l1, p1) => `<div>${et}: <span class="m">${f.tal(v0)}</span> av <span class="m">${f.tal(l0)}</span> <span class="s">(${f.pct1(p0)})</span> → <span class="m">${f.tal(v1)}</span> av <span class="m">${f.tal(l1)}</span> <span class="s">(${f.pct1(p1)})</span></div>`;
        return `<b>${d1.namn}</b> <span class="s">i ${info(k).lan_namn}, ${a}–${b}</span>`
          + rad("Invånare", d0.bef, d0.lan_bef, d0.andel_bef, d1.bef, d1.lan_bef, d1.andel_bef)
          + rad("Jobb", d0.jobb, d0.lan_jobb, d0.andel_jobb, d1.jobb, d1.lan_jobb, d1.andel_jobb);
      }
    }) },
    { etikett: flikEtiketter[1], bygg: () => hantelpanel(ctx, {
      ar: arT, snapp: true, band: false, kalla: kallaFor("tatort"),
      axeltitel: "Centralortens andel av befolkningen",
      rader: ord.map(k => {
        const t = tatort.find(d => d.kod === k);
        return { kod: k, namn: t?.centralort ?? info(k).namn, under: "centralorten" };
      }),
      serier: [
        { id: "kommun", etikett: "Av kommunen", varde: (k, a) => T.get(`${k}|${a}`)?.andel_av_kommun },
        { id: "lan", etikett: "Av länet", varde: (k, a) => T.get(`${k}|${a}`)?.andel_av_lan }
      ],
      tips: (k, a, b) => {
        const d0 = T.get(`${k}|${a}`), d1 = T.get(`${k}|${b}`);
        if (!d0 || !d1) return null;
        return `<b>${d1.centralort}</b> <span class="s">tätort, ${a}–${b}</span>`
          + `<div>Invånare i tätorten: <span class="m">${f.tal(d0.ort_bef)}</span> → <span class="m">${f.tal(d1.ort_bef)}</span></div>`
          + `<div>Av kommunen: <span class="m">${f.pct1(d0.andel_av_kommun)}</span> → <span class="m">${f.pct1(d1.andel_av_kommun)}</span> <span class="s">(${f.tal(d1.kommun_bef)} i kommunen)</span></div>`
          + `<div>Av länet: <span class="m">${f.pct1(d0.andel_av_lan)}</span> → <span class="m">${f.pct1(d1.andel_av_lan)}</span> <span class="s">(${f.tal(d1.lan_bef)} i länet)</span></div>`;
      }
    }) }
  ], { steg }));
  return rot;
}

// ── En flik: reglage + hantlar per stad ─────────────────────────────────────
function hantelpanel(ctx, { ar, fran = null, till = null, snapp = false, band, kalla, axeltitel, rader, serier, tips: tipsHtml }) {
  const { ink, farg, botten, tips, W, H } = ctx;
  const yta = el("div", { class: "kc-yta", style: `width:${W}px;height:${H}px` });
  if (!ar.length || !rader.length) {
    yta.appendChild(el("div", { class: "kc-kalla" }, "Data saknas (3khv-koncentration)."));
    return yta;
  }
  const min = ar[0], max = ar.at(-1);
  let a0 = fran != null ? narmast(ar, fran) : min, a1 = till != null ? narmast(ar, till) : max;
  if (a1 <= a0) { a0 = min; a1 = max; }

  // ── Huvud: periodreglage + nyckel
  const hd = el("div", { class: "kc-hd" });
  const reglage = arsreglage({
    min, max, fran: a0, till: a1, bredd: 230,
    brott: snapp ? ar.slice(1, -1).map(a => ({ ar: a, etikett: `Tätortsår ${a}` })) : [],
    vidByte: ({ fran: x, till: y }) => {
      let a = x, b = y;
      if (snapp) {
        a = narmast(ar, x); b = narmast(ar, y);
        if (b <= a) { const i = ar.indexOf(a); if (i < ar.length - 1) b = ar[i + 1]; else a = ar[i - 1]; }
        if (a !== x || b !== y) reglage.satt(a, b, { tyst: true });
      }
      a0 = a; a1 = b; rita(true);
    }
  });
  const nyckel = el("div", { class: "kc-nyckel" });
  const nyckelAr = el("span", {});
  nyckel.appendChild(nyckelAr);
  if (band) {
    nyckel.appendChild(el("span", {}, `<svg width="22" height="12"><rect x="1" y="1" width="20" height="10" rx="2" fill="${ink.stark}" fill-opacity=".1" stroke="${ink.svag}" stroke-opacity=".5" stroke-width="1" stroke-dasharray="2 2"/></svg>Jobbandelen större än invånarandelen`));
  }
  hd.append(reglage, nyckel);
  yta.appendChild(hd);

  // ── Geometri
  const kallaH = kalla ? 30 : 0;
  const svgH = H - 34 - kallaH;
  const nameW = 150, subW = 92, valW = 86;
  const px0 = nameW + subW, px1 = W - 2 * valW - 28;
  const c1 = W - valW - 14, c2 = W - 2; // högerkanter för värdekolumnerna
  const top = 50, bot = 4;
  const rh = (svgH - top - bot) / rader.length;
  const dy = Math.min(14, rh * 0.18);
  const allaV = rader.flatMap(r => serier.flatMap(s => ar.map(a => s.varde(r.kod, a)))).filter(v => v != null && Number.isFinite(v));
  const vMax = Math.max(10, ...allaV);
  const x = d3.scaleLinear().domain([0, Math.ceil(vMax / 10) * 10 + (vMax % 10 > 7 ? 5 : 0)]).range([px0, px1]);

  const svg = d3.select(yta).append("svg").attr("width", W).attr("height", svgH);

  // Axeltitel, rutnät och tickar
  svg.append("text").attr("x", px0).attr("y", 16).attr("font-size", 11.5).attr("font-weight", 600).attr("fill", ink.stark).text(axeltitel);
  const ticks = x.ticks(Math.max(4, Math.round((px1 - px0) / 90)));
  const gT = svg.append("g");
  ticks.forEach(t => {
    gT.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", top - 8).attr("y2", svgH - bot)
      .attr("stroke", t === 0 ? ink.linje : ink.rutnat).attr("stroke-width", 1);
    gT.append("text").attr("x", x(t)).attr("y", top - 13).attr("text-anchor", "middle")
      .attr("font-family", MONO).attr("font-size", 10).attr("fill", ink.svag).text(`${f.tal(t)} %`);
  });
  // Kolumnrubriker
  const hd1 = svg.append("text").attr("x", c1).attr("y", 16).attr("text-anchor", "end").attr("font-size", 11.5).attr("font-weight", 600).attr("fill", ink.stark);
  const hd2 = svg.append("text").attr("x", c2).attr("y", 16).attr("text-anchor", "end").attr("font-size", 11.5).attr("font-weight", 600).attr("fill", ink.stark);
  svg.append("text").attr("x", c1).attr("y", top - 13).attr("text-anchor", "end").attr("font-size", 10).attr("fill", ink.svag).text("andel");
  svg.append("text").attr("x", c2).attr("y", top - 13).attr("text-anchor", "end").attr("font-size", 10).attr("fill", ink.svag).text("procentenheter");

  // Rader
  const R_RING = 4.6, R_PRICK = 5.6;
  const radNoder = rader.map((r, i) => {
    const y = top + i * rh, ym = y + rh / 2;
    const c = farg[r.kod] ?? ink.stark;
    const g = svg.append("g");
    if (i > 0) g.append("line").attr("x1", 0).attr("x2", W).attr("y1", y).attr("y2", y).attr("stroke", ink.rutnat);
    g.append("text").attr("x", 0).attr("y", ym - 3).attr("font-size", 16).attr("font-weight", 600).attr("fill", c).text(r.namn);
    g.append("text").attr("x", 0).attr("y", ym + 13).attr("font-size", 10.5).attr("fill", ink.svag).text(r.under ?? "");
    const ys = serier.map((_, j) => ym + (j === 0 ? -dy : dy));
    // Skuggat fält (jobbandel > invånarandel), under hantlarna
    const bandRect = band ? g.append("rect").attr("y", ys[0]).attr("height", ys[1] - ys[0]).attr("fill", c).attr("fill-opacity", 0.13).attr("x", px0).attr("width", 0) : null;
    const delar = serier.map((s, j) => {
      const yy = ys[j];
      g.append("text").attr("x", px0 - 14).attr("y", yy).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-size", 11.5).attr("fill", ink.mjuk).text(s.etikett);
      g.append("line").attr("x1", px0).attr("x2", px1).attr("y1", yy).attr("y2", yy).attr("stroke", ink.rutnat).attr("stroke-dasharray", "1 3");
      const linje = g.append("line").attr("y1", yy).attr("y2", yy).attr("stroke", c).attr("stroke-width", 2.4).attr("stroke-linecap", "round");
      const pil = g.append("path").attr("fill", c);
      const ring = g.append("circle").attr("cy", yy).attr("r", R_RING).attr("fill", botten).attr("stroke", c).attr("stroke-width", 1.7);
      const prick = g.append("circle").attr("cy", yy).attr("r", R_PRICK).attr("fill", c).attr("stroke", botten).attr("stroke-width", 1.2);
      const v1 = g.append("text").attr("x", c1).attr("y", yy).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-family", MONO).attr("font-size", 14).attr("font-weight", 500).attr("fill", ink.stark);
      const v2 = g.append("text").attr("x", c2).attr("y", yy).attr("dy", "0.34em").attr("text-anchor", "end")
        .attr("font-family", MONO).attr("font-size", 13).attr("fill", ink.mjuk);
      return { s, yy, linje, pil, ring, prick, v1, v2 };
    });
    // Hovringsyta för raden
    g.append("rect").attr("x", 0).attr("y", y).attr("width", W).attr("height", rh).attr("fill", "transparent")
      .on("pointermove", ev => { const h = tipsHtml?.(r.kod, a0, a1); if (h) tips.visa(h, ev); })
      .on("pointerleave", () => tips.dolj());
    return { r, delar, bandRect };
  });

  function rita(anim) {
    hd1.text(`${a1}`);
    hd2.text(`sedan ${a0}`);
    nyckelAr.innerHTML = `<svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="${botten}" stroke="${ink.stark}" stroke-width="1.6"/></svg><span class="m">${a0}</span>`
      + `<svg width="34" height="12"><line x1="2" x2="26" y1="6" y2="6" stroke="${ink.stark}" stroke-width="2"/><path d="M25,2.5L32,6L25,9.5z" fill="${ink.stark}"/></svg>`
      + `<svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${ink.stark}"/></svg><span class="m">${a1}</span>`;
    const tr = sel => (anim ? sel.transition().duration(320).ease(d3.easeCubicOut) : sel);
    for (const { r, delar, bandRect } of radNoder) {
      const slut = [];
      for (const d of delar) {
        const va = d.s.varde(r.kod, a0), vb = d.s.varde(r.kod, a1);
        const ok = va != null && vb != null;
        slut.push(ok ? vb : null);
        const xa = ok ? x(va) : px0, xb = ok ? x(vb) : px0;
        const dx = xb - xa, sg = Math.sign(dx) || 1;
        const harPil = Math.abs(dx) > R_PRICK + 12;
        const spets = xb - sg * R_PRICK, bas = spets - sg * 7;
        tr(d.ring).attr("cx", xa).attr("opacity", ok ? 1 : 0);
        tr(d.prick).attr("cx", xb).attr("opacity", ok ? 1 : 0);
        tr(d.linje).attr("x1", xa).attr("x2", harPil ? bas : xa).attr("opacity", ok ? 0.85 : 0);
        tr(d.pil).attr("d", `M${bas},${d.yy - 4}L${spets},${d.yy}L${bas},${d.yy + 4}Z`).attr("opacity", ok && harPil ? 0.85 : 0);
        d.v1.text(ok ? f.pct1(vb) : "–");
        d.v2.text(ok ? pe(vb - va) : "–");
      }
      if (bandRect) {
        const [b, j] = slut;
        const pa = b != null && j != null && j > b;
        tr(bandRect).attr("x", pa ? x(b) : x(b ?? 0)).attr("width", pa ? x(j) - x(b) : 0);
      }
    }
  }
  rita(false);

  if (kalla) yta.appendChild(el("div", { class: "kc-kalla" }, kalla));
  return yta;
}

function narmast(lista, v) {
  return lista.reduce((m, a) => (Math.abs(a - v) < Math.abs(m - v) ? a : m), lista[0]);
}
