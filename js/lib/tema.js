// =============================================================================
// TEMA — ggplot-logik för grafmodulerna
// =============================================================================
//
// Ett tema är exakt det ggplot menar med ett tema: en uppsättning defaults som
// läggs UNDER dina egna opts. Du skriver alltid dina opts sist och de vinner.
//
//   rita(stapeldiagram, data, { title: "..." })          → aktivt tema
//   rita(stapeldiagram, data, { title: "..." }, "mork")  → uttryckligt tema
//
// Temat verkar i tre lager:
//
//   1. opts   – defaults som skickas in i grafmodulen (colors, showGrid, logo).
//               Detta är det "riktiga" lagret: modulerna känner till dem.
//   2. yta    – CSS-variabler på .graf-container (bakgrund, ram, typsnitt, ink).
//               Träffar rubrik/undertitel/källrad som redan har klassnamn.
//   3. patch  – en efterpass över den ritade SVG:n som byter NEUTRALA färger
//               (grå axlar, rutnät, svart text) mot temats. Varumärkesfärger
//               lämnas orörda. Se `patchaNeutraler` längst ned.
//
// Lager 3 finns för att grafmodulerna ännu hårdkodar sina gråtoner (#666, #333,
// #e5e5e5 …). Det är efterpassen som gör att mörkt läge fungerar redan i dag
// utan att vi rör 13 000 rader graf-kod. Allteftersom vi tematiserar modulerna
// på riktigt kan lager 3 krympa — det är en brygga, inte en slutstation.
// =============================================================================

// ── Paletter ────────────────────────────────────────────────────────────────
// Region Hallands grundpalett. Kvalitativa serier bygger på den och kompletteras
// med kontrastfärger där sex serier inte räcker med enbart grönt och blått.
export const PALETT = {
  gron1: "#00664D", gron2: "#00AB60", gron3: "#C1E8C4", gron4: "#E3F4E2",
  bla1:  "#004990", bla2:  "#2DB8F6", bla3:  "#A2D9F8", bla4:  "#E2F6FF",
  rod1:  "#A51300", rod2:  "#FF5F4A", rod3:  "#FFBFC1", rod4:  "#FEE6E7",
  lila1: "#433C9D", lila2: "#6473D9", lila3: "#C0C6FF", lila4: "#E8EBFF",
  gul1:  "#FF7E00", gul2:  "#FFD939", gul3:  "#FFEA96", gul4:  "#FEF8E8",
  brun1: "#59392E", brun2: "#895B42", brun3: "#C69675", brun4: "#EFCDB6",
  svart: "#000000", gra1:  "#83888A", gra2:  "#D6D6D6", vit:   "#FFFFFF",
  papper: "#F0F2E6"
};

export const SERIER = {
  // Standard: Hallands grön/blå först, sedan varma kontraster.
  halland:  ["#00664D", "#004990", "#FF7E00", "#433C9D", "#2DB8F6", "#A51300"],
  // Ljusare och mättare — håller på projektorduk och mörk bakgrund.
  ljusstark:["#00C878", "#4FC3F7", "#FFB040", "#9C8CFF", "#FF7A6B", "#8FE3C8"],
  // Enfärgat grönt i styrka — för ordnade kategorier (små → stora).
  gronskala:["#00332A", "#00664D", "#0C8C7E", "#00AB60", "#7FCFA5", "#C1E8C4"],
  // Hög kontrast i svartvitt-säkra valörer — tryck och tillgänglighet.
  tryck:    ["#111111", "#00664D", "#004990", "#8A6D00", "#7A2E00", "#5B5B5B"]
};

// ── Temadefinitioner ────────────────────────────────────────────────────────
// `opts` går in i grafmodulen. `yta` blir CSS-variabler. `ink` styr efterpassen.
export const TEMAN = {
  rapport: {
    namn: "Rapport",
    mork: false,
    beskrivning: "Kapitelrapportens ton — papperston, redaktionella rubriker, luftigt.",
    opts: { colors: SERIER.halland, showGrid: true },
    yta: {
      sida:       "#F0F2E6",
      bakgrund:   "#FFFFFF",
      ram:        "1px solid #D8DFD2",
      radie:      "16px",
      skugga:     "0 1px 2px rgba(32,48,43,.04), 0 16px 38px -22px rgba(32,48,43,.22)",
      rubrikFont: "'Newsreader', Georgia, serif",
      textFont:   "'Inter', system-ui, sans-serif",
      rubrikVikt: "560",
      rubrikStorlek: "1.32rem",
      kort:       "rgba(255,255,255,.55)",
      kortRam:    "rgba(0,102,77,.15)"
    },
    ink: { stark: "#0D0D0D", mjuk: "#3B4742", svag: "#83888A", linje: "#B9C2BB", rutnat: "#E8ECE5", yta: "#FFFFFF" }
  },

  presentation: {
    namn: "Presentation",
    mork: false,
    beskrivning: "För duk: större typografi, kraftigare streck, ingen ram som stjäl ljus.",
    opts: { colors: SERIER.halland, showGrid: true, pointRadius: 9, radius: 7, lineWidth: 3 },
    yta: {
      sida:       "#FFFFFF",
      bakgrund:   "#FFFFFF",
      ram:        "none",
      radie:      "0",
      skugga:     "none",
      rubrikFont: "'Fraunces', Georgia, serif",
      textFont:   "'Inter', system-ui, sans-serif",
      rubrikVikt: "600",
      rubrikStorlek: "1.9rem",
      kort:       "rgba(255,255,255,.70)",
      kortRam:    "rgba(0,102,77,.14)"
    },
    ink: { stark: "#0A0A0A", mjuk: "#333B37", svag: "#6E7671", linje: "#9AA49D", rutnat: "#E4E9E3", yta: "#FFFFFF" }
  },

  mork: {
    namn: "Mörkt",
    mork: true,
    beskrivning: "Mörk duk. Ljusare serier så att färgerna håller mot svart.",
    opts: { colors: SERIER.ljusstark, showGrid: true, pointRadius: 8, radius: 7 },
    yta: {
      sida:       "#0E1613",
      bakgrund:   "#16211D",
      ram:        "1px solid #26332D",
      radie:      "14px",
      skugga:     "0 18px 40px -26px rgba(0,0,0,.8)",
      rubrikFont: "'Fraunces', Georgia, serif",
      textFont:   "'Inter', system-ui, sans-serif",
      rubrikVikt: "560",
      rubrikStorlek: "1.5rem",
      kort:       "rgba(255,255,255,.035)",
      kortRam:    "rgba(255,255,255,.09)"
    },
    ink: { stark: "#F2F6F3", mjuk: "#B6C2BB", svag: "#7E8C85", linje: "#3A4A43", rutnat: "#22302A", yta: "#16211D" }
  },

  minimal: {
    namn: "Minimal",
    mork: false,
    beskrivning: "Allt onödigt bort — inget rutnät, ingen ram, data får bära sig själv.",
    opts: { colors: SERIER.gronskala, showGrid: false },
    yta: {
      sida:       "#FBFBF9",
      bakgrund:   "transparent",
      ram:        "none",
      radie:      "0",
      skugga:     "none",
      rubrikFont: "'Inter', system-ui, sans-serif",
      textFont:   "'Inter', system-ui, sans-serif",
      rubrikVikt: "600",
      rubrikStorlek: "1.05rem",
      kort:       "transparent",
      kortRam:    "rgba(0,0,0,.08)"
    },
    ink: { stark: "#1A1A1A", mjuk: "#5A605C", svag: "#9AA09C", linje: "#C9CEC9", rutnat: "#F0F2EF", yta: "#FBFBF9" }
  },

  tryck: {
    namn: "Tryck",
    mork: false,
    beskrivning: "Hög kontrast, svartvitt-säkra valörer. Tål att skrivas ut och kopieras.",
    opts: { colors: SERIER.tryck, showGrid: true },
    yta: {
      sida:       "#FFFFFF",
      bakgrund:   "#FFFFFF",
      ram:        "1px solid #111111",
      radie:      "0",
      skugga:     "none",
      rubrikFont: "'Newsreader', Georgia, serif",
      textFont:   "'Inter', system-ui, sans-serif",
      rubrikVikt: "600",
      rubrikStorlek: "1.25rem",
      kort:       "#FFFFFF",
      kortRam:    "#111111"
    },
    ink: { stark: "#000000", mjuk: "#2A2A2A", svag: "#555555", linje: "#000000", rutnat: "#D9D9D9", yta: "#FFFFFF" }
  }
};

export const TEMANAMN = Object.keys(TEMAN);

// ── Aktivt tema ─────────────────────────────────────────────────────────────
let AKTIVT = "rapport";

export function settTema(namn) {
  if (!TEMAN[namn]) throw new Error(`Okänt tema: ${namn}. Finns: ${TEMANAMN.join(", ")}`);
  AKTIVT = namn;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.tema = namn;
    // Sidans egna token — så att galleriets kort och panel följer temat och inte
    // blir en ljus ram runt en mörk graf.
    const { yta, ink } = TEMAN[namn];
    const rot = document.documentElement.style;
    rot.setProperty("--sida", yta.sida);
    rot.setProperty("--sid-kort", yta.kort);
    rot.setProperty("--sid-kort-ram", yta.kortRam);
    rot.setProperty("--sid-ink", ink.stark);
    rot.setProperty("--sid-ink-mjuk", ink.mjuk);
    rot.setProperty("--sid-ink-svag", ink.svag);
    rot.setProperty("--sid-accent", TEMAN[namn].opts.colors[0]);
  }
  return namn;
}

export function aktivtTema() { return AKTIVT; }

export function tema(namn = AKTIVT) {
  const t = TEMAN[namn];
  if (!t) throw new Error(`Okänt tema: ${namn}. Finns: ${TEMANAMN.join(", ")}`);
  return t;
}

// ── Lager 1: opts ───────────────────────────────────────────────────────────
// Temats defaults under, dina opts över. Samma riktning som ggplot: sista ordet
// vinner. Grafmodulerna plockar ut de nycklar de känner igen och struntar i
// resten, så ett tema får innehålla nycklar som bara vissa graftyper använder
// (t.ex. pointRadius). Arrayer ersätts rakt av — `colors` slås inte ihop.
export function medTema(opts = {}, namn = AKTIVT) {
  return { ...tema(namn).opts, ...opts };
}

// ── Lager 2: yta (CSS-variabler) ────────────────────────────────────────────
export function ytaStil(namn = AKTIVT) {
  const { yta, ink } = tema(namn);
  return {
    "--graf-sida": yta.sida,
    "--graf-bakgrund": yta.bakgrund,
    "--graf-ram": yta.ram,
    "--graf-radie": yta.radie,
    "--graf-skugga": yta.skugga,
    "--graf-rubrik-font": yta.rubrikFont,
    "--graf-text-font": yta.textFont,
    "--graf-rubrik-vikt": yta.rubrikVikt,
    "--graf-rubrik-storlek": yta.rubrikStorlek,
    "--graf-ink": ink.stark,
    "--graf-ink-mjuk": ink.mjuk,
    "--graf-ink-svag": ink.svag
  };
}

function satStil(el, namn) {
  const s = ytaStil(namn);
  for (const [k, v] of Object.entries(s)) el.style.setProperty(k, v);
  el.dataset.tema = namn;
}

// ── Lager 3: efterpass över ritad SVG ───────────────────────────────────────
// Byter neutrala (grå/svarta/vita) färger mot temats bläckskala. En färg räknas
// som neutral när kanalerna ligger nära varandra — då är den en axel, ett
// rutnät eller text, aldrig en varumärkesfärg. #00664D rörs alltså aldrig.

const NEUTRAL_TROSKEL = 14;   // max spridning mellan R, G och B

function tillRgb(f) {
  if (!f || f === "none" || f === "transparent" || f.startsWith("url(")) return null;
  let m = /^#([0-9a-f]{3})$/i.exec(f);
  if (m) return [0, 1, 2].map(i => parseInt(m[1][i] + m[1][i], 16));
  m = /^#([0-9a-f]{6})$/i.exec(f);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(f);
  if (m) return [+m[1], +m[2], +m[3]];
  if (f === "black") return [0, 0, 0];
  if (f === "white") return [255, 255, 255];
  return null;
}

function arNeutral(rgb) {
  return Math.max(...rgb) - Math.min(...rgb) <= NEUTRAL_TROSKEL;
}

// Mappar en neutral färg till temats bläckskala efter hur ljus den är.
// Trappan följer hur modulerna faktiskt använder grått: text mörkast,
// sedan dämpad text, axellinjer, rutnät, och till sist ytor.
function mappaNeutral(rgb, ink, mork) {
  const L = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114);
  if (L < 80)  return ink.stark;
  if (L < 140) return ink.mjuk;
  if (L < 190) return ink.svag;
  if (L < 232) return ink.linje;
  if (L < 251) return ink.rutnat;
  return mork ? ink.yta : null;   // rent vitt byts bara i mörkt tema
}

const FARGATTR = ["fill", "stroke", "stop-color", "flood-color"];

export function patchaNeutraler(rot, namn = AKTIVT) {
  const t = tema(namn);
  const mork = !!t.mork;
  const byt = f => {
    const rgb = tillRgb(f);
    if (!rgb || !arNeutral(rgb)) return null;
    return mappaNeutral(rgb, t.ink, mork);
  };

  for (const el of rot.querySelectorAll("*")) {
    for (const attr of FARGATTR) {
      const v = el.getAttribute(attr);
      if (v) { const ny = byt(v); if (ny) el.setAttribute(attr, ny); }
    }
    // Inline-stilar (modulerna sätter en del via .style)
    const st = el.style;
    if (st) {
      for (const prop of ["color", "fill", "stroke", "backgroundColor", "borderColor"]) {
        const v = st[prop];
        if (v) { const ny = byt(v); if (ny) st[prop] = ny; }
      }
    }
  }
  return rot;
}

// ── Det enda anrop du behöver ───────────────────────────────────────────────
// rita(stapeldiagram, data, { title: "…" })
//   → ritar med aktivt tema, sätter CSS-variabler, kör efterpassen.
//
// Grafmodulerna returnerar en färdig DOM-nod, så temat läggs på efteråt.
// Interaktiva grafer ritar om sig själva vid klick; `observera` fångar det och
// kör efterpassen igen så att temat håller även efter omritning.
export function rita(grafFn, data, opts = {}, namn = AKTIVT) {
  const nod = grafFn(data, medTema(opts, namn));
  satStil(nod, namn);
  patchaNeutraler(nod, namn);
  observera(nod, namn);
  return nod;
}

// Kartor tar (geodata, opts) och koncentration tar (data, geodata, opts) —
// den här varianten skickar vidare vad du än ger den.
export function ritaMed(grafFn, args, opts = {}, namn = AKTIVT) {
  const nod = grafFn(...args, medTema(opts, namn));
  satStil(nod, namn);
  patchaNeutraler(nod, namn);
  observera(nod, namn);
  return nod;
}

// Håller temat vid liv när en interaktiv graf ritar om sin SVG. Debounce så att
// en omritning i flera steg bara ger ett efterpass.
function observera(nod, namn) {
  if (typeof MutationObserver === "undefined") return;
  let kö = null, egen = false;
  const mo = new MutationObserver(() => {
    if (egen) return;
    clearTimeout(kö);
    kö = setTimeout(() => {
      egen = true;
      patchaNeutraler(nod, namn);
      egen = false;
    }, 40);
  });
  mo.observe(nod, { childList: true, subtree: true });
  nod._temaObservator = mo;   // så att galleriet kan koppla loss vid temabyte
}

// Byt tema på en redan ritad graf. Fungerar för yta + efterpass; färgserien
// sitter i SVG:n sedan ritningen, så för nya serie­färger måste grafen ritas om.
// Galleriet ritar om — det här finns för snabba justeringar i konsolen.
export function bytTema(nod, namn) {
  nod._temaObservator?.disconnect();
  satStil(nod, namn);
  patchaNeutraler(nod, namn);
  observera(nod, namn);
  return nod;
}
