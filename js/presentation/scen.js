// =============================================================================
// SCEN — grafmodulerna anpassade för en presentationsbild
// =============================================================================
//
// En presentation är en vanlig Quarto-fil med `format: revealjs`. Varje bild är
// en rubrik plus en OJS-cell. Det enda du behöver därifrån är `bild()`:
//
//   ```{ojs}
//   //| echo: false
//   bild(linjediagram, bef, {
//     x: "år", y: "befolkning", color: "kommun",
//     title: "Halland växer — men inte jämnt"
//   }, { poang: "Norr har vuxit dubbelt så snabbt som söder sedan 1970." })
//   ```
//
// bild() gör tre saker utöver att rita: sätter presentationstemat, ger grafen
// mått som faktiskt får plats på duken, och lägger poängen under grafen. Poängen
// är den mening som är själva anledningen till att bilden finns — skriv den
// alltid, det är den åhöraren minns.
//
// Behöver du något annat än en graf finns citat(), nyckeltal() och jamfor().
// =============================================================================

import { rita, ritaMed, settTema, ytaStil, patchaNeutraler } from "../lib/tema.js";

// Revealjs standardduk är 1050 × 700. Det här är vad som får plats när rubriken
// tagit sin del. Höjd är ett tak — grafer med följsam höjd tar mindre.
export const MATT = {
  stor:  { width: 940, height: 470 },   // en graf, full bredd — grundformen
  hog:   { width: 940, height: 560 },   // ingen poängrad, grafen får hela ytan
  halv:  { width: 455, height: 430 },   // två grafer sida vid sida
  liten: { width: 620, height: 330 }    // graf plus text bredvid
};

let SCENTEMA = "presentation";

// Byt tema för hela presentationen. Anropas en gång högst upp i qmd-filen.
export function scentema(namn) {
  SCENTEMA = namn;
  settTema(namn);
  return namn;
}

// ── Bild med en graf ────────────────────────────────────────────────────────
// bild(grafFn, data, opts, { poang, storlek })
//
// `storlek` är en nyckel ur MATT ("stor", "hog", "halv", "liten") eller ett eget
// { width, height }. Egna width/height i `opts` vinner alltid över storleken.
export function bild(grafFn, data, opts = {}, { poang = null, storlek = "stor", tema = SCENTEMA } = {}) {
  return rama(rita(grafFn, data, { ...matt(storlek), ...opts }, tema), poang, tema);
}

// Samma sak för moduler som tar mer än ett argument före opts — kartor:
//   bildMed(karta, [geo], { data: tabell, value: "andel" }, { poang: "…" })
export function bildMed(grafFn, args, opts = {}, { poang = null, storlek = "stor", tema = SCENTEMA } = {}) {
  return rama(ritaMed(grafFn, args, { ...matt(storlek), ...opts }, tema), poang, tema);
}

export function matt(storlek) {
  return typeof storlek === "string" ? (MATT[storlek] || MATT.stor) : storlek;
}

function rama(nod, poang, tema) {
  if (!poang) return nod;
  const yta = document.createElement("div");
  yta.className = "scen";
  Object.entries(ytaStil(tema)).forEach(([k, v]) => yta.style.setProperty(k, v));
  yta.appendChild(nod);
  const rad = document.createElement("p");
  rad.className = "scen-poang";
  rad.textContent = poang;
  yta.appendChild(rad);
  return yta;
}

// ── Två grafer sida vid sida ────────────────────────────────────────────────
// jamfor([nodA, nodB], { poang })  — noderna ritar du själv med storlek "halv".
export function jamfor(noder, { poang = null, tema = SCENTEMA } = {}) {
  const yta = document.createElement("div");
  yta.className = "scen";
  Object.entries(ytaStil(tema)).forEach(([k, v]) => yta.style.setProperty(k, v));
  const rad = document.createElement("div");
  rad.className = "scen-jamfor";
  noder.forEach(n => rad.appendChild(n));
  yta.appendChild(rad);
  if (poang) {
    const p = document.createElement("p");
    p.className = "scen-poang";
    p.textContent = poang;
    yta.appendChild(p);
  }
  return yta;
}

// ── Nyckeltal ───────────────────────────────────────────────────────────────
// nyckeltal([{ tal: "203 000", etikett: "invånare i norr", om: "+104 % sedan 1970" }])
export function nyckeltal(poster, { poang = null, tema = SCENTEMA } = {}) {
  const yta = document.createElement("div");
  yta.className = "scen";
  Object.entries(ytaStil(tema)).forEach(([k, v]) => yta.style.setProperty(k, v));
  const rad = document.createElement("div");
  rad.className = "scen-nyckeltal";
  for (const p of poster) {
    const ruta = document.createElement("div");
    ruta.className = "scen-nyckeltal-ruta";
    ruta.innerHTML = `
      <div class="scen-tal">${p.tal}</div>
      <div class="scen-etikett">${p.etikett}</div>
      ${p.om ? `<div class="scen-om">${p.om}</div>` : ""}`;
    rad.appendChild(ruta);
  }
  yta.appendChild(rad);
  if (poang) {
    const p = document.createElement("p");
    p.className = "scen-poang";
    p.textContent = poang;
    yta.appendChild(p);
  }
  patchaNeutraler(yta, tema);
  return yta;
}

// ── Påstående ───────────────────────────────────────────────────────────────
// citat("Norr drar ifrån söder.", { av: "Kapitelrapport Halland, 2026" })
export function citat(text, { av = null, tema = SCENTEMA } = {}) {
  const yta = document.createElement("div");
  yta.className = "scen scen-citat";
  Object.entries(ytaStil(tema)).forEach(([k, v]) => yta.style.setProperty(k, v));
  yta.innerHTML = `<blockquote>${text}</blockquote>${av ? `<cite>${av}</cite>` : ""}`;
  return yta;
}
