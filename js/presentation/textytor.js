// =============================================================================
// TEXTYTOR — textbilderna i 3KHV-dragningen (finalversionen)
// =============================================================================
//
//   innehall(avsnitt, opts)    dragningens upplägg: avsnitt med fråga och varför
//   trender(kluster, opts)     SKR:s 17 trender i sex kluster, numrerade i liten
//                              stil, och ett destillat per kluster: vad det betyder
//                              för regionstäderna (rev 1: ersätter taggarna)
//   teorifond(block, opts)     teoretisk fond: idéblock → regionstadens roll,
//                              plus en rad med storregionala nyttigheter
//   fragekort(kort, opts)      ett kort per tema med 2–4 punkter; steg: true tar
//                              fram korten ett i taget (rev 1)
//   textkolumner(kolumner, opts) fritext i kolumner (BRP+-förklaringar m.m.)
//
// Stilen injiceras en gång (klasser .tx-*). Revealduken har 40 px grundgrad —
// rotnoden sätter egen grad och radhöjd.
// =============================================================================

import { fragmentsteg } from "./ytstod.js";

const STIL = `
.tx { font: 400 12px/1.4 Inter, system-ui, sans-serif; color:#2F3632; text-align:left; width:100%; box-sizing:border-box; }
.tx * { box-sizing:border-box; }
.tx-kalla { font: 400 10px/1.45 Inter, system-ui, sans-serif; color:#59615D; margin-top:10px; }
.tx-ingress { font: 400 18px/1.4 Fraunces, Georgia, serif; color:#0D0D0D; margin:0 0 16px; max-width:52em; }
.tx-ingress i { color:#00664D; }

/* Innehåll */
.tx-innehall { display:grid; gap:0; }
.tx-avsnitt { display:grid; grid-template-columns:44px 230px minmax(0,1fr); column-gap:18px; align-items:start; padding:17px 0 15px; border-top:1px solid rgba(13,13,13,.10); }
.tx-avsnitt:first-child { border-top:0; }
.tx-avsnitt-nr { font: 500 26px/1 Fraunces, Georgia, serif; color:#00AB60; letter-spacing:-.02em; }
.tx-avsnitt-rubrik { font: 600 15px/1.25 Inter, system-ui, sans-serif; color:#0D0D0D; }
.tx-avsnitt-bilder { display:block; font: 500 10px/1.3 'IBM Plex Mono', monospace; color:#9AA19C; margin-top:3px; letter-spacing:.04em; }
.tx-avsnitt-fraga { font: 400 16px/1.35 Fraunces, Georgia, serif; color:#0D0D0D; }
.tx-avsnitt-varfor { font: 400 11.5px/1.4 Inter, system-ui, sans-serif; color:#59615D; margin-top:3px; }

/* Trender: ett kort per kluster med trenderna i liten stil och ett destillat */
.tx-trender { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; }
.tx-kluster { background:#F5F6F1; border-radius:10px; padding:9px 13px 10px; display:flex; flex-direction:column; gap:5px; border-top:3px solid #C1E8C4; }
.tx-kluster.pa { border-top-color:#00AB60; }
.tx-kluster-nr { font: 600 9px/1 'IBM Plex Mono', monospace; letter-spacing:.08em; color:#00AB60; }
.tx-kluster-namn { font: 500 15px/1.15 Fraunces, Georgia, serif; color:#0D0D0D; }
.reveal .tx-kluster-trender, .tx-kluster-trender { list-style:none; margin:0; padding:0 0 5px; border-bottom:1px solid rgba(13,13,13,.10); display:block; }
.reveal .tx-kluster-trender li, .tx-kluster-trender li { list-style:none; font: 400 10px/1.3 Inter, system-ui, sans-serif; color:#59615D; margin:0; padding:0 0 0 18px; position:relative; }
.tx-kluster-trender li::before, .tx-kluster-trender li::marker { content:none; }
.tx-kluster-trender li span { position:absolute; left:0; font: 600 9.5px/1.4 'IBM Plex Mono', monospace; color:#9AA19C; }
.tx-destillat { font: 400 11.8px/1.42 Inter, system-ui, sans-serif; color:#2F3632; margin:0; }
.tx-destillat b { font-weight:600; color:#0D0D0D; }
.tx-kluster { transition: opacity .25s; }
.tx-kluster.kommer { opacity:.3; }
.tx-kluster.kommer .tx-kluster-trender, .tx-kluster.kommer .tx-destillat { visibility:hidden; }

/* Teorifond */
.tx-teori { display:grid; grid-template-columns:repeat(var(--n,4), minmax(0,1fr)) 34px 250px; gap:10px; align-items:stretch; }
.tx-block { background:#F5F6F1; border-radius:10px; border-top:3px solid #00AB60; padding:11px 12px 10px; display:flex; flex-direction:column; gap:6px; }
.tx-block-etikett { font: 600 9.5px/1.2 'IBM Plex Mono', monospace; letter-spacing:.08em; text-transform:uppercase; color:#00664D; }
.tx-block-rubrik { font: 500 16px/1.2 Fraunces, Georgia, serif; color:#0D0D0D; }
.tx-block-text { font: 400 13px/1.45 Inter, system-ui, sans-serif; color:#2F3632; margin:0; }
.tx-block-kalla { font: 400 9.5px/1.3 Inter, system-ui, sans-serif; color:#9AA19C; margin-top:auto; }
.tx-pil { display:flex; align-items:center; justify-content:center; color:#00AB60; font-size:26px; }
.tx-roll { background:#00664D; color:#fff; border-radius:10px; padding:13px 15px 12px; display:flex; flex-direction:column; gap:7px; }
.tx-roll-rubrik { font: 500 19px/1.2 Fraunces, Georgia, serif; color:#fff; }
.tx-roll ul { list-style:none; margin:0; padding:0; }
.tx-roll li { font: 400 12px/1.38 Inter, system-ui, sans-serif; color:#E3F4E2; padding:5px 0 5px 12px; border-top:1px solid rgba(255,255,255,.18); margin:0; position:relative; }
.tx-roll li::before { content:""; position:absolute; left:0; top:11px; width:5px; height:5px; border-radius:50%; background:#C1E8C4; }
.tx-nyttigheter { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:12px; }
.tx-nyttigheter-et { font: 600 9.5px/1.2 'IBM Plex Mono', monospace; letter-spacing:.08em; text-transform:uppercase; color:#59615D; margin-right:4px; }
.tx-nytta { font: 500 11.5px/1 Inter, system-ui, sans-serif; color:#00664D; background:#EEF5EC; border:1px solid #C1E8C4; padding:5px 10px; border-radius:999px; white-space:nowrap; }

/* Frågekort */
.tx-fragor { display:grid; grid-template-columns:repeat(var(--n,3), minmax(0,1fr)); gap:9px; }
.tx-fraga { background:#F5F6F1; border-radius:10px; padding:9px 13px 8px; display:flex; flex-direction:column; gap:4px; border-top:3px solid #00AB60; }
.tx-fraga-nr { font: 600 10px/1 'IBM Plex Mono', monospace; color:#00AB60; letter-spacing:.08em; }
.tx-fraga-rubrik { font: 500 15.5px/1.18 Fraunces, Georgia, serif; color:#0D0D0D; }
.tx-fraga ul { list-style:none; margin:0; padding:0; }
.tx-fraga li { font: 400 11.3px/1.32 Inter, system-ui, sans-serif; color:#2F3632; padding:3px 0 3px 11px; margin:0; position:relative; border-top:1px solid rgba(13,13,13,.08); }
.tx-fraga li::before { content:""; position:absolute; left:0; top:8.5px; width:4px; height:4px; border-radius:50%; background:#00AB60; }
.tx-fraga-kalla { font: 400 9.5px/1.3 Inter, system-ui, sans-serif; color:#9AA19C; margin-top:auto; padding-top:2px; }
.tx-fraga { transition: opacity .25s, background-color .25s, border-color .25s; }
.tx-fraga.kommer { opacity:.38; }
.tx-fraga.kommer ul, .tx-fraga.kommer .tx-fraga-kalla { visibility:hidden; }
.tx-slutsats { margin-top:8px; display:grid; grid-template-columns:250px minmax(0,1fr); column-gap:18px; align-items:center; background:#00664D; border-top-color:#00AB60; padding:11px 16px; }
.tx-slutsats-rubrik { font: 500 18px/1.2 Fraunces, Georgia, serif; color:#fff; }
.tx-slutsats-text { font: 400 12.4px/1.42 Inter, system-ui, sans-serif; color:#E3F4E2; }
.tx-slutsats.kommer { opacity:.25; }
.tx-slutsats.kommer .tx-slutsats-text { visibility:hidden; }
.tx-fraga.tx-slutsats.nu { background:#00664D; border-top-color:#00AB60; }
.tx-fraga.nu { background:#EEF5EC; border-top-color:#00664D; box-shadow:0 8px 22px -16px rgba(0,60,40,.55); }

/* Trappa: stigande steg + matris nära bostaden / inom pendlingsavstånd */
.tx-trappa { display:grid; grid-template-columns:150px repeat(var(--n,4), minmax(0,1fr)); column-gap:10px; row-gap:0; align-items:end; }
.tx-trappa-steg { grid-row:1; display:flex; flex-direction:column; justify-content:flex-start; gap:5px; border-radius:10px 10px 0 0; padding:11px 13px 10px; background:#EEF5EC; border-top:4px solid #C1E8C4; transition:opacity .25s, background-color .25s; }
.tx-trappa-steg.grund { background:#00664D; border-top-color:#00AB60; }
.tx-trappa-steg.grund .tx-trappa-rubrik, .tx-trappa-steg.grund .tx-trappa-nr { color:#fff; }
.tx-trappa-steg.grund .tx-trappa-text { color:#E3F4E2; }
.tx-trappa-nr { font: 600 9.5px/1 'IBM Plex Mono', monospace; letter-spacing:.08em; color:#00AB60; }
.tx-trappa-rubrik { font: 500 19px/1.15 Fraunces, Georgia, serif; color:#0D0D0D; }
.tx-trappa-text { font: 400 12.6px/1.4 Inter, system-ui, sans-serif; color:#2F3632; margin:0; }
.tx-trappa-golv { grid-column:1 / -1; grid-row:2; height:3px; background:#2F3632; border-radius:2px; margin-bottom:10px; }
.tx-trappa-et { grid-column:1; font: 600 9.5px/1.3 'IBM Plex Mono', monospace; letter-spacing:.07em; text-transform:uppercase; color:#59615D; align-self:start; padding-top:8px; }
.tx-trappa-et small { display:block; font: 400 10.5px/1.3 Inter, system-ui, sans-serif; letter-spacing:0; text-transform:none; color:#9AA19C; margin-top:2px; }
.tx-trappa-cell { align-self:stretch; display:flex; flex-wrap:wrap; align-content:flex-start; gap:4px; padding:7px 0 9px; border-top:1px solid rgba(13,13,13,.10); transition:opacity .25s; }
.tx-trappa-cell span { font: 500 11.8px/1 Inter, system-ui, sans-serif; padding:5px 9px; border-radius:999px; white-space:nowrap; }
.tx-trappa-cell.nara span { background:#FFF1EC; color:#A51300; border:1px solid #F8CFC3; }
.tx-trappa-cell.region span { background:#EAF2FB; color:#004990; border:1px solid #C6DBF2; }
.tx-trappa-cell span.tom { background:none; border:0; color:#9AA19C; padding-left:0; }
.tx-trappa .kommer { opacity:.16; }
.tx-trappa-fot { font: 400 12px/1.45 Inter, system-ui, sans-serif; color:#2F3632; margin-top:10px; max-width:62em; }
.tx-trappa-fot b { font-weight:600; color:#0D0D0D; }

/* Textkolumner */
.tx-kolumner { display:grid; grid-template-columns:repeat(var(--n,2), minmax(0,1fr)); gap:14px; }
.tx-kolumn { background:#F5F6F1; border-radius:10px; padding:14px 16px; border-top:4px solid var(--c, #00AB60); }
.tx-kolumn-rubrik { font: 650 16px/1.2 Inter, system-ui, sans-serif; color:var(--c, #0D0D0D); margin-bottom:3px; }
.tx-kolumn-under { font: 500 11px/1.3 'IBM Plex Mono', monospace; color:#59615D; margin-bottom:7px; }
.tx-kolumn p { font: 400 13.5px/1.5 Inter, system-ui, sans-serif; color:#2F3632; margin:0 0 6px; }
.tx-kolumn b { font-weight:600; color:#0D0D0D; }
`;

function stil() {
  if (typeof document === "undefined" || document.getElementById("tx-stil")) return;
  const s = document.createElement("style");
  s.id = "tx-stil";
  s.textContent = STIL;
  document.head.appendChild(s);
}
function el(tagg, klass = null, html = null) {
  const e = document.createElement(tagg);
  if (klass) e.className = klass;
  if (html != null) e.innerHTML = html;
  return e;
}
function rot(klass, { ingress, kalla } = {}) {
  stil();
  const r = el("div", `tx ${klass}`);
  if (ingress) r.appendChild(el("p", "tx-ingress", ingress));
  r.kalla = () => { if (kalla) r.appendChild(el("div", "tx-kalla", kalla)); return r; };
  return r;
}

// avsnitt: [{ rubrik, bilder, fraga, varfor }]
export function innehall(avsnitt, opts = {}) {
  const r = rot("tx-innehall-rot", opts);
  const lista = el("div", "tx-innehall");
  avsnitt.forEach((a, i) => {
    const rad = el("div", "tx-avsnitt");
    rad.append(
      el("div", "tx-avsnitt-nr", String(i + 1)),
      el("div", "tx-avsnitt-rubrik", `${a.rubrik}${a.bilder ? `<span class="tx-avsnitt-bilder">${a.bilder}</span>` : ""}`),
      el("div", null, `<div class="tx-avsnitt-fraga">${a.fraga}</div>${a.varfor ? `<div class="tx-avsnitt-varfor">${a.varfor}</div>` : ""}`)
    );
    lista.appendChild(rad);
  });
  r.appendChild(lista);
  return r.kalla();
}

// kluster: [{ namn, pa, trender: [{ nr, namn }], destillat: html }]
// pa = klustret markeras med grön kant (de som väger tyngst för regionstäderna)
// steg: true → klustren tas fram ett i taget (kommande kluster tonade, rubriken syns)
export function trender(kluster, { steg: stega = false, ...opts } = {}) {
  const r = rot("tx-trender-rot", opts);
  const nat = el("div", "tx-trender");
  const kort = [];
  kluster.forEach((k, i) => {
    const kluster_kort = el("div", `tx-kluster${k.pa ? " pa" : ""}`);
    kluster_kort.append(
      el("div", "tx-kluster-nr", `KLUSTER ${i + 1}`),
      el("div", "tx-kluster-namn", k.namn),
      el("ul", "tx-kluster-trender", k.trender.map(t => `<li><span>${t.nr}</span>${t.namn}</li>`).join(""))
    );
    if (k.destillat) kluster_kort.appendChild(el("p", "tx-destillat", k.destillat));
    nat.appendChild(kluster_kort);
    kort.push(kluster_kort);
  });
  r.appendChild(nat);
  r.kalla();
  if (stega && kort.length > 1) {
    fragmentsteg(r, kort.length - 1, n => kort.forEach((e, i) => e.classList.toggle("kommer", i > n)));
  }
  return r;
}

// block: [{ etikett, rubrik, text, kalla }]; roll: { rubrik, punkter: [] };
// nyttigheter: [text]
export function teorifond(block, { roll = null, nyttigheter = [], nyttigheterRubrik = "Storregionala nyttigheter", ...opts } = {}) {
  const r = rot("tx-teori-rot", opts);
  const nat = el("div", "tx-teori");
  nat.style.setProperty("--n", block.length);
  for (const b of block) {
    const k = el("div", "tx-block");
    k.append(el("div", "tx-block-etikett", b.etikett ?? ""), el("div", "tx-block-rubrik", b.rubrik), el("p", "tx-block-text", b.text));
    if (b.kalla) k.appendChild(el("div", "tx-block-kalla", b.kalla));
    nat.appendChild(k);
  }
  if (roll) {
    nat.appendChild(el("div", "tx-pil", "→"));
    const k = el("div", "tx-roll");
    k.append(el("div", "tx-roll-rubrik", roll.rubrik), el("ul", null, roll.punkter.map(p => `<li>${p}</li>`).join("")));
    nat.appendChild(k);
  } else nat.style.gridTemplateColumns = `repeat(${block.length}, minmax(0,1fr))`;
  r.appendChild(nat);
  if (nyttigheter.length) {
    const rad = el("div", "tx-nyttigheter");
    rad.appendChild(el("span", "tx-nyttigheter-et", nyttigheterRubrik));
    nyttigheter.forEach(n => rad.appendChild(el("span", "tx-nytta", n)));
    r.appendChild(rad);
  }
  return r.kalla();
}

// kort: [{ rubrik, punkter: [], kalla }]
// steg: true → korten tas fram ett i taget med piltangenten (Reveal-fragment).
// Kommande kort syns som rubrik, tonade; det aktuella kortet markeras.
// slutsats: { rubrik, text } → ett helt brett band under korten, sista steget
export function fragekort(kort, { kolumner = null, steg = false, slutsats = null, ...opts } = {}) {
  const r = rot("tx-fragor-rot", opts);
  const nat = el("div", "tx-fragor");
  nat.style.setProperty("--n", kolumner ?? Math.min(kort.length, 3));
  const noder = kort.map((k, i) => {
    const e = el("div", "tx-fraga");
    e.append(el("div", "tx-fraga-nr", String(i + 1).padStart(2, "0")), el("div", "tx-fraga-rubrik", k.rubrik),
      el("ul", null, k.punkter.map(p => `<li>${p}</li>`).join("")));
    if (k.kalla) e.appendChild(el("div", "tx-fraga-kalla", k.kalla));
    nat.appendChild(e);
    return e;
  });
  r.appendChild(nat);
  if (slutsats) {
    const s = el("div", "tx-fraga tx-slutsats",
      `<div class="tx-slutsats-rubrik">${slutsats.rubrik}</div><div class="tx-slutsats-text">${slutsats.text}</div>`);
    r.appendChild(s);
    noder.push(s);
  }
  r.kalla();
  if (steg && noder.length > 1) {
    // fragmentsteg ger n = 0 … antal, där n = det kort som just tagits fram.
    // Utan Reveal (eller i utskrift) blir n = antal och alla kort syns.
    fragmentsteg(r, noder.length - 1, n => {
      noder.forEach((e, i) => { e.classList.toggle("kommer", i > n); e.classList.toggle("nu", i === n); });
    });
  }
  return r;
}

// Attraktivitetstrappan.
// steg: [{ rubrik, text, nara: [..], region: [..] }], nedersta steget först.
// Steg 1 ritas som grundplatta (mörkgrön). Stegen stiger åt höger; under dem en
// matris: vad som behöver finnas nära bostaden respektive inom pendlingsavstånd.
// opts: hojd (px, högsta steget), etiketter: { nara, naraUnder, region, regionUnder },
// fot (html under), steg (true = ett steg i taget med piltangenten), kalla.
export function trappa(steg, { hojd = 250, etiketter = {}, fot = null, steg: stega = true, ...opts } = {}) {
  const r = rot("tx-trappa-rot", opts);
  const et = { nara: "Nära bostaden", naraUnder: "behöver finnas i vardagen", region: "Inom pendlingsavstånd", regionUnder: "räcker i arbetsmarknadsregionen", ...etiketter };
  const nat = el("div", "tx-trappa");
  nat.style.setProperty("--n", steg.length);
  const n = steg.length, lagst = Math.round(hojd * 0.62);
  const kol = steg.map(() => []);
  nat.appendChild(el("div", null)).style.gridRow = "1";
  steg.forEach((s, i) => {
    const b = el("div", `tx-trappa-steg${i === 0 ? " grund" : ""}`);
    b.style.gridColumn = String(i + 2);
    b.style.height = `${Math.round(lagst + (hojd - lagst) * (n > 1 ? i / (n - 1) : 1))}px`;
    b.append(el("div", "tx-trappa-nr", i === 0 ? "STEG 1 · GRUNDPLATTA" : `STEG ${i + 1}`), el("div", "tx-trappa-rubrik", s.rubrik), el("p", "tx-trappa-text", s.text));
    nat.appendChild(b);
    kol[i].push(b);
  });
  nat.appendChild(el("div", "tx-trappa-golv"));
  for (const [typ, rubrik, under] of [["nara", et.nara, et.naraUnder], ["region", et.region, et.regionUnder]]) {
    nat.appendChild(el("div", "tx-trappa-et", `${rubrik}<small>${under}</small>`));
    steg.forEach((s, i) => {
      const lista = s[typ] ?? [];
      const c = el("div", `tx-trappa-cell ${typ}`, lista.length ? lista.map(x => `<span>${x}</span>`).join("") : `<span class="tom">–</span>`);
      c.style.gridColumn = String(i + 2);
      nat.appendChild(c);
      kol[i].push(c);
    });
  }
  r.appendChild(nat);
  if (fot) r.appendChild(el("div", "tx-trappa-fot", fot));
  r.kalla();
  if (stega && n > 1) {
    fragmentsteg(r, n - 1, k => kol.forEach((noder, i) => noder.forEach(e => e.classList.toggle("kommer", i > k))));
  }
  return r;
}

// kolumner: [{ rubrik, under, farg, html }]
export function textkolumner(kolumner, { antal = null, ...opts } = {}) {
  const r = rot("tx-kolumner-rot", opts);
  const nat = el("div", "tx-kolumner");
  nat.style.setProperty("--n", antal ?? kolumner.length);
  for (const k of kolumner) {
    const e = el("div", "tx-kolumn");
    if (k.farg) e.style.setProperty("--c", k.farg);
    e.innerHTML = `${k.rubrik ? `<div class="tx-kolumn-rubrik">${k.rubrik}</div>` : ""}${k.under ? `<div class="tx-kolumn-under">${k.under}</div>` : ""}${k.html ?? ""}`;
    nat.appendChild(e);
  }
  r.appendChild(nat);
  return r.kalla();
}
