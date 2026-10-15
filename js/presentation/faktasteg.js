// =============================================================================
// FAKTASTEG — bild 3 "Fem städer i korthet", stegvis på samma bild
// =============================================================================
//
//   faktasteg(orientering, opts) → DOM-nod
//
// orientering = datasetet 3khv-orientering:
//   { ar_folkmangd, antal_kommuner, antal_lan, kalla,
//     stader: [{ kod, namn, lan_namn, folkmangd, folkmangd_rang_riket, folkmangd_rang_lan,
//                kommuner_i_lanet, landareal_km2, areal_rang_riket, areal_rang_lan,
//                tathet, tathet_rang_riket, tathet_rang_lan, lan_folkmangd,
//                lan_folkmangd_rang, inom_10mil, inom_45min }],
//     restid_45min: { minuter: 45, km_h: 60, radie_km: 45 } }
//
// En rad per stad (störst → minst), en kolumn per mått. Varje cell: värdet,
// en stapel som visar de fems inbördes storlek (samma skala i kolumnen),
// en rangskala 1–290 med stadens plats i riket och en ruta per kommun i länet
// med stadens plats där. Länets invånare jämförs med de 21 länen.
//
// Steg (osynliga Reveal-fragment, → bläddrar):
//   0  invånare, landyta, invånare per km²
//   1  + länets invånare
//   2  + invånare inom 45 minuter (rev 1, ersätter 10 mil; ingen rang):
//        fältet inom_45min, uppskattat som 45 km fågelvägen (45 minuter i
//        60 km/h räknat fågelvägen, se restid_45min). Saknas fältet visas en
//        platshållare "uppgift saknas".
// Bilden får stegmarkören från ytstod.fragmentsteg (rev 1).
//
// opts: { temaNamn, width = 960, height = 540, steg = true, ordning = null
//         (koder; standard = störst först), kalla = null (källrad, HTML),
//         kolumner = null (ersätter standardkolumnerna, se KOLUMNER nedan) }
// =============================================================================

import { aktivtTema } from "../lib/tema.js";
import { ram, el, svgEl, f, fragmentsteg, MONO } from "./ytstod.js";

const STIL = `
.fs { display:flex; flex-direction:column; }
.fs .fs-rutnat { display:grid; column-gap:22px; flex:1; min-height:0; }
.fs .fs-hd { align-self:stretch; padding-bottom:8px; border-bottom:1px solid var(--ink-linje); }
.fs .fs-hd .t { font-size:13px; font-weight:600; color:var(--ink); line-height:1.2; }
.fs .fs-hd .u { font-size:10.5px; color:var(--ink-svag); margin-top:2px; }
.fs .fs-namn { display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid var(--ink-rutnat); }
.fs .fs-namn .n { font-size:18px; font-weight:600; line-height:1.15; }
.fs .fs-namn .l { font-size:11px; color:var(--ink-svag); margin-top:2px; }
.fs .fs-cell { display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid var(--ink-rutnat); min-width:0; }
.fs .fs-cell svg { display:block; overflow:visible; }
.fs .fs-v { font:500 19px/1.1 ${MONO}; font-variant-numeric:tabular-nums; color:var(--ink); letter-spacing:-.01em; }
.fs .fs-steg { transition:opacity .45s ease, transform .45s ease; }
.fs .fs-steg.dold { opacity:0; transform:translateY(6px); pointer-events:none; }
.fs .fs-saknas { font:italic 400 12px/1.2 Inter, system-ui, sans-serif; color:var(--ink-svag); letter-spacing:0; padding:2px 6px; border:1px dashed var(--ink-linje); border-radius:4px; }
.fs .fs-kalla { font-size:10.5px; color:var(--ink-svag); margin-top:8px; line-height:1.4; }
`;

const KOLUMNER = (o) => {
  const N = o.antal_kommuner ?? 290, NL = o.antal_lan ?? 21;
  const R = { minuter: 45, km_h: 60, radie_km: 45, ...(o.restid_45min ?? {}) };
  return [
    { id: "folkmangd", rubrik: `Invånare ${o.ar_folkmangd ?? ""}`.trim(), under: `flest = 1 av ${N} kommuner`,
      varde: d => d.folkmangd, format: f.tal, riket: d => d.folkmangd_rang_riket, n: N, lan: d => d.folkmangd_rang_lan, steg: 0 },
    { id: "areal", rubrik: "Landyta, km²", under: "störst yta = 1",
      varde: d => d.landareal_km2, format: f.tal, riket: d => d.areal_rang_riket, n: N, lan: d => d.areal_rang_lan, steg: 0 },
    { id: "tathet", rubrik: "Invånare per km²", under: "tätast = 1",
      varde: d => d.tathet, format: f.tal, riket: d => d.tathet_rang_riket, n: N, lan: d => d.tathet_rang_lan, steg: 0 },
    { id: "lan", rubrik: "Invånare i länet", under: `plats bland ${NL} län`,
      varde: d => d.lan_folkmangd, format: f.tal, riket: d => d.lan_folkmangd_rang, n: NL, enhet: "län", steg: 1 },
    { id: "inom45", rubrik: `Invånare inom ${R.minuter} minuter`,
      under: `${f.tal(R.radie_km)} km fågelvägen i ${R.km_h} km/h`,
      varde: d => d.inom_45min ?? null, format: v => (v == null ? SAKNAS : f.tal(v)), steg: 2 }
  ];
};
// Platshållare om dataagentens fält inom_45min ännu inte finns i datan
const SAKNAS = `<span class="fs-saknas">uppgift saknas</span>`;

export function faktasteg(orientering, {
  temaNamn = aktivtTema(), width = 960, height = 540, steg = true,
  ordning = null, kalla = null, kolumner = null
} = {}) {
  const { rot, farg, ink } = ram({ temaNamn, width, height, klass: "fs", stil: STIL });
  const stader = orientering?.stader ?? [];
  const rader = ordning
    ? ordning.map(k => stader.find(d => d.kod === k)).filter(Boolean)
    : [...stader].sort((a, b) => (b.folkmangd ?? 0) - (a.folkmangd ?? 0));
  const kol = kolumner ?? KOLUMNER(orientering ?? {});
  const antalSteg = Math.max(0, ...kol.map(k => k.steg ?? 0));

  const nameW = 150;
  const cw = Math.floor((width - nameW - 22 * kol.length) / kol.length);
  const rutnat = el("div", { class: "fs-rutnat" });
  rutnat.style.gridTemplateColumns = `${nameW}px repeat(${kol.length}, minmax(0, 1fr))`;
  rutnat.style.gridTemplateRows = `auto repeat(${rader.length}, minmax(0, 1fr))`;
  rot.appendChild(rutnat);

  const stegNoder = [];
  const markera = (n, s) => { n.classList.add("fs-steg"); n.dataset.steg = s; stegNoder.push(n); return n; };

  // Rubrikrad
  rutnat.appendChild(el("div", { class: "fs-hd" }));
  for (const k of kol) {
    const h = el("div", { class: "fs-hd" }, `<div class="t">${k.rubrik}</div><div class="u">${k.under ?? ""}</div>`);
    rutnat.appendChild(markera(h, k.steg ?? 0));
  }

  // Inbördes skala per kolumn: stapeln börjar i noll
  const maxV = Object.fromEntries(kol.map(k => [k.id, Math.max(...rader.map(d => k.varde(d) ?? 0))]));

  for (const d of rader) {
    const c = farg[d.kod] ?? ink.stark;
    rutnat.appendChild(el("div", { class: "fs-namn" }, `<span class="n" style="color:${c}">${d.namn}</span><span class="l">${d.lan_namn ?? ""}</span>`));
    for (const k of kol) {
      const cell = el("div", { class: "fs-cell" });
      const v = k.varde(d);
      cell.appendChild(el("div", { class: "fs-v" }, k.format(v)));
      cell.appendChild(rangcell({ k, d, v, max: maxV[k.id], c, ink, cw }));
      rutnat.appendChild(markera(cell, k.steg ?? 0));
    }
  }

  const kallText = kalla ?? orientering?.kalla;
  if (kallText) rot.appendChild(el("div", { class: "fs-kalla" }, kallText));

  fragmentsteg(rot, antalSteg, n => {
    for (const s of stegNoder) s.classList.toggle("dold", +s.dataset.steg > n);
  }, { steg });
  return rot;
}

// Stapel (inbördes) + rangskala i riket + rutor i länet
function rangcell({ k, d, v, max, c, ink, cw }) {
  const W = cw;
  const harRiket = k.riket && k.riket(d) != null;
  const harLan = k.lan && k.lan(d) != null && d.kommuner_i_lanet;
  const H = 14 + (harRiket ? 14 : 0) + (harLan ? 12 : 0) + (harRiket || harLan ? 16 : 0);
  const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  // Inbördes stapel: samma skala för de fem i kolumnen
  const bw = max > 0 && v != null ? Math.max(2, (v / max) * W) : 0;
  svg.appendChild(svgEl("rect", { x: 0, y: 5, width: W, height: 6, rx: 3, fill: ink.rutnat }));
  svg.appendChild(svgEl("rect", { x: 0, y: 5, width: bw, height: 6, rx: 3, fill: c }));
  let y = 14;
  const delar = [];
  if (harRiket) {
    // Rangskala 1–n: linje med hakar i ändarna, stadens plats som prick
    const r = k.riket(d), n = k.n, yy = y + 8;
    const x = 4 + ((r - 1) / Math.max(1, n - 1)) * (W - 8);
    svg.appendChild(svgEl("line", { x1: 0, x2: W, y1: yy, y2: yy, stroke: ink.linje, "stroke-width": 1 }));
    for (const t of [0.5, W / 2, W - 0.5]) svg.appendChild(svgEl("line", { x1: t, x2: t, y1: yy - 3, y2: yy + 3, stroke: ink.linje, "stroke-width": 1 }));
    svg.appendChild(svgEl("circle", { cx: x, cy: yy, r: 4.4, fill: c, stroke: "var(--botten)", "stroke-width": 1.3 }));
    svg.appendChild(svgEl("title", {}, `${d.namn}: plats ${r} av ${n}${k.enhet === "län" ? " län" : " kommuner"}`));
    delar.push([String(r), k.enhet === "län" ? ` av ${n} län` : " i riket"]);
    y += 14;
  }
  if (harLan) {
    // En ruta per kommun i länet, stadens plats ifylld
    const r = k.lan(d), n = d.kommuner_i_lanet, yy = y + 6;
    const steg = W / n, s = Math.max(1.6, Math.min(9, steg - (steg > 4 ? 1.8 : 1)));
    for (let i = 0; i < n; i++) {
      const pa = i + 1 === r, h = pa ? 10 : 7;
      svg.appendChild(svgEl("rect", { x: i * steg, y: yy - h / 2, width: pa ? Math.max(s, 3) : s, height: h, rx: Math.min(1.5, s / 3), fill: pa ? c : ink.rutnat }));
    }
    delar.push([String(r), ` av ${n} i länet`]);
    y += 12;
  }
  if (delar.length) {
    const t = svgEl("text", { x: 0, y: y + 10, "font-size": 10.5, fill: ink.svag });
    delar.forEach(([tal, text], i) => {
      if (i) t.appendChild(svgEl("tspan", {}, "  ·  "));
      t.appendChild(svgEl("tspan", { fill: ink.stark, "font-family": MONO, "font-weight": 600 }, tal));
      t.appendChild(svgEl("tspan", {}, text));
    });
    svg.appendChild(t);
  }
  return svg;
}
