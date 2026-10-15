// =============================================================================
// LINJEMULTIPLAR — en liten linjegraf per stad, med mätartabell (3KHV-dragningen)
// =============================================================================
//
//   linjemultiplar(rader, {
//     enheter: [{ kod, namn, farg? }],                // panelordning (de fem städerna)
//     referens: { kod: "0000", namn: "Riket", visa: "panel" | "linje" } | null,   // förval null
//     summa: { namn: "De fem tillsammans" } | null,   // summarad i tabellen (summerbara variabler)
//     variabler: [{ id, etikett, kort?, farg, falt, typ: "niva"|"flode"|"kvot", pa?,
//                   enhet?, decimaler?, relativ?, per1000?, grupp?, summerbar?, medReferens? }],
//     befFalt: "folkmangd",                           // folkmängden (Relativt för flöden, Per 1 000 inv.)
//     skala: "antal"|"relativ"|"per1000", tid: "arsvarde"|"ack"|"arlig",
//     yskala: "gemensam"|"egen", period: { fran, till } | [fran, till],
//     framtid: { fran, etikett },                     // prognosdelen streckad, tonad bakgrund
//     brott: [{ ar, etikett }],                       // tunt lodrätt streck + hake (källbyten)
//     tabellExtra: [{ etikett, titel?, varde: (enhet, period, rader) => text }],
//     andelAv: id | null,                             // nämnaren i andelstabellen (se nedan)
//     enhetsord: "personer", nollIAntal: true, kalla,
//     reglage: { variabler, skala, tid, yskala, period, spela } (false döljer ett reglage),
//     msPerAr: 330,                                   // uppspelningens tempo
//     width: 960, height: 560, tabellBredd: 280, kolumner: null, temaNamn
//   }) → DOM-nod · nod.satt({ variabler, skala, tid, yskala, period }) · nod.tillstand()
//     · nod.spela() · nod.pausa() · nod.forstora(kod | null)
//
// Variabler
//   falt      fältnamn eller funktion rad => värde (t.ex. utfall/prognos i olika fält,
//             eller en kvot/ett netto räknat ur flera fält)
//   typ       niva  — ett bestånd (pendlare, folkmängd i en åldersgrupp, ett netto)
//             flode — ett nettoflöde per år (födelsenetto, flyttnetto)
//             kvot  — en kvot/andel. Bara Antal; förändringar i procentenheter
//                     (enhet "%", förval) eller i kvotens egen enhet (enhet "")
//   relativ   false = variabeln saknar meningsfull bas (t.ex. nettopendling) →
//             visas inte i Relativt. per1000: false på samma sätt. Fältet befFalt
//             självt visas aldrig per 1 000 inv.
//   grupp     variabler i olika grupper blandas inte (de har olika enhet).
//             Förval: kvoter var för sig, övriga i en gemensam grupp. Kryssar man
//             i en variabel ur en annan grupp byts urvalet.
//   summerbar true = summaraden summerar värdena (förval för niva/flode).
//             "rader" = falt räknas på de fem städernas summerade rader, så att en
//             kvot blir kvoten av summorna (t.ex. demografisk försörjningskvot).
//
// Räknesätt (startår = periodens första år med värde)
//   Tid    niva/kvot  Årsvärde = nivån · Ackumulerat = nivån − startårets ·
//                     Årlig förändring = nivån − föregående års
//          flode      Årsvärde = årets flöde · Ackumulerat = summan av flödena
//                     åren EFTER startåret (0 startåret, så att t.ex. ackumulerad
//                     folkökning = folkmängdens förändring sedan startåret).
//                     Årlig förändring gäller inte flöden.
//   Skala  Antal = som ovan · Relativt = värdet / bas × 100, bas = startårets nivå
//          (niva) eller startårets folkmängd (flode); årsvärdet för en nivå blir
//          alltså "% av startårets nivå" (100 = startåret) · Per 1 000 inv. =
//          värdet / årets folkmängd × 1 000.
//   Val som ingen vald variabel stöder gråas ut; en vald variabel som inte stöder
//   läget döljs och dess knapp streckas.
//
// Tabellen ("var man landat"): perioden per enhet och vald variabel. Ackumulerat:
// slutvärdet; Årsvärde: slutårets nivå (niva/kvot) eller summan för perioden
// (flode); Årlig förändring: snitt per år. Sorterad efter den variabel vars
// kolumnrubrik man klickat på. Mätarstapeln divergerar från 0 (100 för index) i
// enhetens färg. Hovring i en panel → lodrät linje i alla paneler och tabellen
// visar det året. Riket och summaraden står under strecket och får staplar bara
// när skalan inte är Antal.
//
// Andelstabellen: när alla valda variabler är flöden och tiden är Ackumulerat
// visar tabellen hur stor del av folkökningen under perioden varje vald del står
// för (delens summa / folkökningens summa, samma år för alla delar). Nämnaren är
// variabeln `andelAv`, annars den vars falt är "folkokning", annars summan av de
// valda delarna. Under varje stad: förändringen och en staplad stapel (plus åt
// höger, minus åt vänster från 0, streck vid nettot). Är förändringen liten mot
// delarna (|netto| < 25 % av delarnas absoluta summa) visas antal i stället för
// andelar, med en kort förklaring.
//
// Uppspelning: ▶ vid periodreglaget flyttar slutåret ett år i taget från
// startåret + 1 till periodens slutår (axlarna står still under tiden). ❚❚
// pausar; ▶ igen fortsätter, eller börjar om när man står på slutet. Stoppas när
// bilden lämnas (perioden återställs då till slutåret).
//
// Hovring: årsstreck som snäpper till närmaste år, synkat i alla paneler, prickar
// på linjerna och en tipsruta med året (märkt "prognos" i prognosåren) och för
// varje vald variabel värdet i aktuell visning och förändringen mot startåret.
// Står pekaren kvar under uppspelning följer strecket med.
//
// Paneler: inramade kort med en rubrikrad i stadens färg. Klick på rubriken (eller
// på stadens rad i tabellen) förstorar panelen till hela diagramytan med samma
// skala, period och etiketter men större text; klick igen, × eller Esc stänger.
// Blir det en tom plats i rutnätet (t.ex. fem städer utan riket) står
// skalbeskrivningen och läsanvisningen där i stället för ovanför panelerna.
//
// Storlek (rev 1): ritytan i varje panel räknas fram ur tillgänglig yta med
// höjd/bredd 0,85–1,05 som krav (2 eller 3 kolumner, den som ger störst rityta),
// och rutnätet centreras. Etiketter vid linjeslut står bara i förstorad panel; i
// rutnätet står en liten linjenyckel i skaltexten eller på den tomma platsen.
// Nollinjen (100 för index) ritas mörkare än rutnätet. En enda vald
// variabel ritas i stadens färg. Gemensam y-skala som standard; egen skala
// markeras med "egen skala" i panelen. Riket som egen panel får alltid egen skala
// i Antal (annars skulle städerna plattas till).
// =============================================================================

import { d3 } from "../lib/d3.js";
import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { segment, kryss, arsreglage } from "./kontroller.js";
import { placeraEtiketter, ritaEtiketter, textbredd } from "./etiketter.js";
import { BANFARGER } from "./banor.js";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
// Samma ordning som STADER i jamforelse.js / BANFARGER i banor.js
const STADORDNING = ["1380", "0880", "1080", "1290", "0780"];
const SKALOR = [
  { id: "antal", etikett: "Antal" },
  { id: "relativ", etikett: "Relativt", titel: "Nivåer: % av startårets nivå. Flöden: % av startårets folkmängd" },
  { id: "per1000", etikett: "Per 1 000 inv.", titel: "Per 1 000 invånare (årets folkmängd)" }
];
const TIDER = [
  { id: "arsvarde", etikett: "Årsvärde" },
  { id: "ack", etikett: "Ackumulerat", titel: "Ackumulerat sedan periodens startår" },
  { id: "arlig", etikett: "Årlig förändring", titel: "Förändring mot föregående år (gäller nivåer och kvoter)" }
];
const YSKALOR = [
  { id: "gemensam", etikett: "Gemensam" },
  { id: "egen", etikett: "Egen per panel" }
];
const STANDARDFARG = ["#00664D", "#004990", "#FF7E00", "#433C9D", "#2DB8F6", "#A51300", "#895B42"];
const NARA_NOLL = 0.25;   // |netto| under så stor del av delarnas absoluta summa → inga andelar

const nfCache = new Map();
const nf = d => { if (!nfCache.has(d)) nfCache.set(d, new Intl.NumberFormat("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d })); return nfCache.get(d); };
const ok = x => Number.isFinite(x);

function el(tagg, attr = {}, html = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) if (v != null) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  return e;
}

export function linjemultiplar(rader, opts = {}) {
  const {
    enheter = [],
    referens = null,
    summa = { namn: "De fem" },
    variabler = [],
    befFalt = "folkmangd", kod: kodF = "kod", ar: arF = "ar",
    skala: skala0 = "antal", tid: tid0 = "arsvarde", yskala: yskala0 = "gemensam",
    period: period0 = null, framtid = null, brott = [],
    tabellExtra = [], kalla = null, enhetsord = "personer", nollIAntal = true,
    andelAv = null, msPerAr = 330,
    reglage = {},
    width = 960, height = 560, tabellBredd = 280, kolumner = null,
    temaNamn = aktivtTema()
  } = opts;
  const R = { variabler: true, skala: true, tid: true, yskala: true, period: true, spela: true, ...reglage };

  // ── Tema ──────────────────────────────────────────────────────────────────
  const T = hamtaTema(temaNamn), ink = T.ink;
  const bakgrund = T.yta.bakgrund && T.yta.bakgrund !== "transparent" ? T.yta.bakgrund : ink.yta;
  const hov = T.mork ? "rgba(255,255,255,.06)" : "rgba(10,20,15,.045)";
  const kortYta = T.mork ? "rgba(255,255,255,.028)" : "#FCFDFC";
  const kortRam = T.mork ? "rgba(255,255,255,.12)" : "rgba(13,30,20,.12)";
  const rutnat = T.mork ? "rgba(255,255,255,.07)" : "rgba(13,30,20,.075)";
  const stadsfarger = T.mork ? BANFARGER.mork : BANFARGER.ljus;
  const rikeFarg = T.mork ? "#B6C2BB" : "#59615D";
  const fargFor = e => e.farg ?? (STADORDNING.includes(e.kod) ? stadsfarger[STADORDNING.indexOf(e.kod)] : ink.stark);

  // ── Variabler ─────────────────────────────────────────────────────────────
  const VAR = variabler.map((v, i) => ({
    ...v,
    farg: v.farg ?? STANDARDFARG[i % STANDARDFARG.length],
    kort: v.kort ?? v.etikett,
    grupp: v.grupp ?? (v.typ === "kvot" ? `kvot:${v.id}` : "antal"),
    hamta: typeof v.falt === "function" ? v.falt : d => d[v.falt]
  }));
  const varMap = new Map(VAR.map(v => [v.id, v]));
  const stodSkala = (v, s) => s === "antal" || (v.typ !== "kvot" && (s === "relativ" ? v.relativ !== false : v.per1000 !== false && v.falt !== befFalt));
  const stodTid = (v, t) => t !== "arlig" || v.typ !== "flode";
  // Nämnaren i andelstabellen
  const OKNING = (() => {
    const v = (andelAv && varMap.get(andelAv)) ?? VAR.find(v => v.falt === "folkokning");
    return v && v.typ === "flode" ? v : null;
  })();

  // ── Data ──────────────────────────────────────────────────────────────────
  const refKod = referens?.kod ?? null;
  const koder = new Set([...enheter.map(e => String(e.kod)), ...(refKod ? [String(refKod)] : [])]);
  const egna = rader.filter(d => koder.has(String(d[kodF])) && ok(+d[arF]));
  const perKod = d3.group(egna, d => String(d[kodF]));
  const [AR0, AR1] = d3.extent(egna, d => +d[arF]);
  const N = AR1 - AR0 + 1;
  const ix = a => a - AR0;
  const tal_ = x => (x != null && x !== "" && ok(+x) ? +x : NaN);
  function bygg(kod, namn, farg, rs = [], rike = false) {
    const raw = new Map(VAR.map(v => [v.id, new Float64Array(N).fill(NaN)]));
    const bef = new Float64Array(N).fill(NaN);
    for (const d of rs) {
      const i = +d[arF] - AR0;
      for (const v of VAR) {
        if (rike && v.medReferens === false) continue;
        raw.get(v.id)[i] = tal_(v.hamta(d));
      }
      bef[i] = tal_(d[befFalt]);
    }
    return { kod, namn, farg, raw, bef, rader: rs.slice().sort((a, b) => a[arF] - b[arF]) };
  }
  const STAD = enheter.map(e => bygg(String(e.kod), e.namn, fargFor({ ...e, kod: String(e.kod) }), perKod.get(String(e.kod))));
  const RIKE = refKod && perKod.has(String(refKod)) ? { ...bygg(String(refKod), referens.namn ?? "Riket", rikeFarg, perKod.get(String(refKod)), true), rike: true } : null;
  let SUMMA = null;
  if (summa && STAD.length > 1) {
    // Summerade rader per år (för variabler med summerbar: "rader")
    const sumRad = new Map();
    for (let i = 0; i < N; i++) {
      const rs = STAD.map(E => E.rader.find(d => +d[arF] === AR0 + i));
      if (rs.some(d => !d)) continue;
      const o = {};
      for (const k of Object.keys(rs[0])) {
        const xs = rs.map(d => d[k]);
        if (xs.every(x => typeof x === "number" && ok(x))) o[k] = xs.reduce((s, x) => s + x, 0);
        else if (xs.some(x => x == null)) o[k] = null;
      }
      o[arF] = AR0 + i;
      sumRad.set(i, o);
    }
    const raw = new Map(), bef = new Float64Array(N).fill(NaN);
    for (const v of VAR) {
      const a = new Float64Array(N).fill(NaN);
      if (v.summerbar === "rader") for (const [i, o] of sumRad) a[i] = tal_(v.hamta(o));
      else if (v.typ !== "kvot" || v.summerbar) for (let i = 0; i < N; i++) { let s = 0; for (const e of STAD) s += e.raw.get(v.id)[i]; a[i] = s; }
      raw.set(v.id, a);
    }
    for (let i = 0; i < N; i++) { let s = 0; for (const e of STAD) s += e.bef[i]; bef[i] = s; }
    SUMMA = { kod: "Σ", namn: summa.namn ?? "Tillsammans", farg: ink.mjuk, raw, bef, rader: [...sumRad.values()], summa: true };
  }
  const PANELER = [...STAD, ...(RIKE && referens.visa === "panel" ? [RIKE] : [])];
  const RIKE_LINJE = RIKE && referens.visa === "linje";

  // ── Tillstånd ─────────────────────────────────────────────────────────────
  let valda = VAR.filter(v => v.pa !== false).map(v => v.id);
  if (!valda.length && VAR.length) valda = [VAR[0].id];
  { const g0 = varMap.get(valda[0])?.grupp; valda = valda.filter(id => varMap.get(id).grupp === g0); }
  let onskadSkala = skala0, onskadTid = tid0, yskala = yskala0;
  const p0 = Array.isArray(period0) ? { fran: period0[0], till: period0[1] } : period0 ?? {};
  let fran = Math.max(AR0, Math.min(AR1 - 1, p0.fran ?? AR0)), till = Math.min(AR1, Math.max(fran + 1, p0.till ?? AR1));
  let sortId = null, hovAr = null, fokus = null;
  let skalaEff = "antal", tidEff = "arsvarde", synliga = [];
  let forstorad = null;              // kod för den förstorade panelen
  let pekare = null;                 // { kod, ar } medan pekaren står i en panel
  let spelMal = null, spelTimer = null;   // uppspelningens slutår (axeln står still till dit) och timer

  // ── Räkning ───────────────────────────────────────────────────────────────
  // Serien för en enhet och variabel över fran..slut: { ut: Float64Array, b: startår }
  function serie(E, v, s, t, slut = till) {
    const r = E.raw.get(v.id), bef = E.bef;
    const ut = new Float64Array(slut - fran + 1).fill(NaN);
    let b = fran;
    if (v.typ === "flode") {
      let f = fran; while (f <= slut && !ok(r[ix(f)])) f++;
      if (f > slut) return { ut, b: null };
      b = f === fran ? fran : f - 1;
    } else while (b <= slut && !ok(r[ix(b)])) b++;
    if (b > slut) return { ut, b: null };
    let cum = 0;
    for (let a = fran; a <= slut; a++) {
      const i = ix(a), x = r[i];
      let y = NaN;
      if (t === "arsvarde") y = x;
      else if (t === "ack") {
        if (v.typ === "flode") { if (a === b) { cum = 0; y = 0; } else if (a > b) { cum += x; y = cum; } }
        else if (a >= b) y = x - r[ix(b)];
      } else if (t === "arlig") y = i > 0 ? x - r[i - 1] : NaN;
      if (s === "relativ") { const bas = v.typ === "flode" ? bef[ix(b)] : r[ix(b)]; y = bas > 0 ? (100 * y) / bas : NaN; }
      else if (s === "per1000") y = bef[i] > 0 ? (1000 * y) / bef[i] : NaN;
      ut[a - fran] = y;
    }
    return { ut, b };
  }
  const sista = ut => { for (let k = ut.length - 1; k >= 0; k--) if (ok(ut[k])) return k; return -1; };
  // "Var man landat" för perioden (eller värdet ett visst år vid hovring)
  function landat(E, v, ar) {
    const S = serie(E, v, skalaEff, tidEff);
    if (ar != null) return { v: S.ut[ar - fran], ar };
    if (tidEff === "arlig") {
      let s = 0, n = 0;
      for (let k = 1; k < S.ut.length; k++) if (ok(S.ut[k])) { s += S.ut[k]; n++; }
      return { v: n ? s / n : NaN, b: S.b };
    }
    const U = tidEff === "arsvarde" && v.typ === "flode" ? serie(E, v, skalaEff, "ack") : S;
    const k = sista(U.ut);
    return { v: k >= 0 ? U.ut[k] : NaN, b: U.b, slut: k >= 0 ? fran + k : null };
  }

  // ── Format ────────────────────────────────────────────────────────────────
  const tecken = v => tidEff !== "arsvarde" || v.typ === "flode";
  const index = v => skalaEff === "relativ" && tidEff === "arsvarde" && v.typ === "niva";
  function tal(x, dec, plus) {
    if (!ok(x)) return "–";
    let r = Number(x.toFixed(dec)); if (Object.is(r, -0) || r === 0) r = 0;
    return `${r < 0 ? "−" : plus && r > 0 ? "+" : plus && r === 0 ? "±" : ""}${nf(dec).format(Math.abs(r))}`;
  }
  function fmt(v, x, { kort = false } = {}) {
    if (!ok(x)) return "–";
    if (v.typ === "kvot") {
      const dec = v.decimaler ?? 1, pr = (v.enhet ?? "%") === "%";
      if (tidEff === "arsvarde") return `${tal(x, dec, false)}${pr ? " %" : ""}`;
      return `${tal(x, dec, true)}${pr && !kort ? " p.e." : ""}`;
    }
    if (skalaEff === "antal") {
      if (kort && Math.abs(x) >= 1e6) return `${tal(x / 1e6, 2, tecken(v))} mn`;
      return tal(x, 0, tecken(v));
    }
    if (skalaEff === "relativ") return index(v) ? `${tal(x, 1, false)} %` : `${tal(x, 1, true)} %`;
    return tal(x, 1, tecken(v));
  }
  // Skalsteg: bara så många decimaler som stegen kräver
  function tickFmt(v, x, steg) {
    if (v.typ === "kvot") {
      const dec = Math.max(0, Math.min(3, -Math.floor(Math.log10(steg) + 1e-9)));
      const pr = (v.enhet ?? "%") === "%";
      return `${tal(x, dec, tidEff !== "arsvarde")}${pr && tidEff === "arsvarde" ? " %" : ""}`;
    }
    const dec = steg >= 1 ? 0 : Math.min(2, -Math.floor(Math.log10(steg) + 1e-9));
    const plus = tecken(v) || (skalaEff === "relativ" && !index(v));
    if (skalaEff === "antal" && Math.abs(x) >= 1e6) return `${tal(x / 1e6, steg >= 1e6 ? 0 : 1, plus)} mn`;
    return `${tal(x, dec, plus && x !== 0)}${skalaEff === "relativ" ? " %" : ""}`;
  }
  // Beskrivning av vad linjerna visar
  function beskrivning(v) {
    const st = `${fran}`;
    if (v.typ === "kvot") {
      const pr = (v.enhet ?? "%") === "%";
      return tidEff === "arsvarde" ? (pr ? "Procent" : "Kvot") : tidEff === "ack" ? `Förändring sedan ${st}${pr ? ", procentenheter" : ""}` : `Förändring mot föregående år${pr ? ", procentenheter" : ""}`;
    }
    const flode = v.typ === "flode";
    const vad = tidEff === "arsvarde" ? (flode ? "Per år" : "Nivå") : tidEff === "ack" ? (flode ? `Summa sedan ${st}` : `Förändring sedan ${st}`) : "Förändring mot föregående år";
    const enh = skalaEff === "antal" ? `antal ${enhetsord}` : skalaEff === "per1000" ? "per 1 000 invånare" : flode ? `% av folkmängden ${st}` : `% av nivån ${st}`;
    if (index(v)) return `Index: % av nivån ${st}`;
    return `${vad}, ${enh}`;
  }
  function periodRubrik(v) {
    if (tidEff === "arlig") return `Snitt per år ${fran}–${till}`;
    if (v.typ === "flode") return `Summa ${fran + 1}–${till}`;
    if (tidEff === "ack") return `Förändring ${fran}–${till}`;
    return `Nivå ${till}`;
  }
  function enhetText(v) {
    if (v.typ === "kvot") return (v.enhet ?? "%") === "%" ? (tidEff === "arsvarde" ? "procent" : "procentenheter") : "kvot";
    if (skalaEff === "antal") return `antal ${enhetsord}`;
    if (skalaEff === "per1000") return "per 1 000 invånare";
    if (index(v)) return `% av nivån ${fran}`;
    return v.typ === "flode" ? `% av folkmängden ${fran}` : `% av nivån ${fran}`;
  }

  // ── DOM ───────────────────────────────────────────────────────────────────
  const k_ = `lm-${Math.random().toString(36).slice(2, 8)}`;
  const rot = el("div", { class: `graf-container linjemultiplar ${k_}` });
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", height: `${height}px`, position: "relative", boxSizing: "border-box",
    background: "var(--graf-bakgrund)", color: ink.stark, fontFamily: "var(--graf-text-font, Inter, system-ui, sans-serif)",
    fontSize: "12px", lineHeight: "1.35", textAlign: "left", userSelect: "none", display: "flex", flexDirection: "column"
  });
  const knappRam = T.mork ? "rgba(255,255,255,.22)" : "rgba(13,13,13,.18)";
  const stil = el("style");
  stil.textContent = `
    .${k_} .lm-reglage { display:flex; flex-direction:column; gap:4px; flex:none; }
    .${k_} .lm-tabinn { min-height:0; }
    .${k_} .lm-yval { margin-top:auto; padding-top:8px; align-self:flex-end; }
    .${k_} .lm-rad { display:flex; align-items:center; gap:6px 16px; flex-wrap:wrap; min-height:26px; }
    .${k_} .lm-rad > .lm-hoger { margin-left:auto; }
    .${k_} .lm-pergrupp { display:inline-flex; align-items:center; gap:8px; }
    .${k_} .lm-spela { width:26px; height:24px; flex:none; display:inline-flex; align-items:center; justify-content:center; border:1px solid ${knappRam}; border-radius:999px; background:transparent; color:${ink.stark}; font:600 10px/1 Inter, system-ui, sans-serif; cursor:pointer; padding:0; letter-spacing:-1px; }
    .${k_} .lm-spela:hover { background:${hov}; }
    .${k_} .lm-spela.pa { background:${T.mork ? "rgba(255,255,255,.14)" : "rgba(10,20,15,.09)"}; }
    .${k_} .kt-kryss button.lm-dold { opacity:.5; border-style:dashed; text-decoration:line-through; text-decoration-color:${ink.svag}; }
    .${k_} .lm-kropp { display:flex; gap:16px; flex:1 1 auto; min-height:0; margin-top:4px; }
    .${k_} .lm-yta { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; position:relative; }
    .${k_} .lm-yta > svg { flex:none; }
    .${k_} .lm-skaltext { flex:none; font-size:11px; color:${ink.mjuk}; height:16px; line-height:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .lm-skaltext b { font-weight:600; color:${ink.stark}; }
    .${k_} .lm-skaltext .lm-nyckel { color:${ink.svag}; margin-left:10px; }
    .${k_} .lm-skaltext .lm-nv, .${k_} .lm-info .lm-nv { color:${ink.mjuk}; font-weight:500; }
    .${k_} .lm-info { position:absolute; box-sizing:border-box; padding:12px 6px 8px 14px; display:flex; flex-direction:column; gap:7px; font-size:11px; line-height:1.4; color:${ink.mjuk}; overflow:hidden; }
    .${k_} .lm-info b { font-weight:600; color:${ink.stark}; font-size:12px; }
    .${k_} .lm-info .lm-ik { display:flex; align-items:center; gap:7px; color:${ink.svag}; }
    .${k_} .lm-info .lm-ik svg { flex:none; overflow:visible; }
    .${k_} .lm-info .lm-sep { height:1px; background:${kortRam}; margin:2px 0; width:60%; }
    .${k_} .lm-tips { position:absolute; z-index:5; pointer-events:none; box-sizing:border-box; background:${T.mork ? "rgba(22,33,29,.97)" : "rgba(255,255,255,.97)"}; border:1px solid ${kortRam}; border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,${T.mork ? ".45" : ".10"}); padding:6px 9px 7px; font-size:11px; line-height:1.3; color:${ink.mjuk}; white-space:nowrap; }
    .${k_} .lm-tips .tt-hd { display:flex; align-items:baseline; gap:8px; margin-bottom:4px; }
    .${k_} .lm-tips .tt-ar { font:600 13px/1.2 ${MONO}; color:${ink.stark}; }
    .${k_} .lm-tips .tt-stad { font-weight:600; }
    .${k_} .lm-tips .tt-prog { font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:${T.mork ? "#A2D9F8" : "#004990"}; border:1px solid currentColor; border-radius:3px; padding:0 4px; }
    .${k_} .lm-tips table { border-collapse:collapse; margin:0; border:0; font-size:11px; }
    .${k_} .lm-tips tr, .${k_} .lm-tips td { border:0 !important; background:transparent !important; }
    .${k_} .lm-tips td { padding:1px 0; vertical-align:middle; line-height:1.3; }
    .${k_} .lm-tips td + td { padding-left:10px; text-align:right; font:500 11px/1.3 ${MONO}; font-variant-numeric:tabular-nums; }
    .${k_} .lm-tips td.v { color:${ink.stark}; font-weight:600; }
    .${k_} .lm-tips td.f { color:${ink.svag}; }
    .${k_} .lm-tips i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:0; }
    .${k_} .lm-tips .tt-fot { margin-top:4px; font-size:9.5px; color:${ink.svag}; }
    .${k_} .lm-hd { cursor:pointer; }
    .${k_} .lm-hd .lm-ikon { opacity:.5; transition:opacity .15s; }
    .${k_} .lm-hd:hover .lm-ikon { opacity:1; }
    .${k_} .lm-hd:hover .lm-pnamn { text-decoration:underline; text-underline-offset:2px; }
    .${k_} .lm-hd .lm-hdyta { transition:fill-opacity .15s; }
    .${k_} .lm-hd:hover .lm-hdyta { fill-opacity:${T.mork ? 0.22 : 0.13}; }
    .${k_} .lm-tab { flex:none; display:flex; flex-direction:column; border-left:1px solid ${ink.rutnat}; padding-left:14px; min-height:0; }
    .${k_} .lm-over { font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:${ink.svag}; }
    .${k_} .lm-period { font:600 15px/1.25 ${MONO}; color:${ink.stark}; margin-top:3px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .${k_} .lm-period.hov { color:#00664D; }
    .${k_} .lm-enh { font-size:10.5px; color:${ink.svag}; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .lm-g { display:grid; column-gap:8px; align-items:center; }
    .${k_} .lm-thead { margin-top:10px; padding-bottom:5px; border-bottom:1px solid ${ink.linje}; align-items:end; }
    .${k_} .lm-th { font-size:9.5px; line-height:1.15; color:${ink.svag}; text-align:right; white-space:normal; }
    .${k_} .lm-th.k { cursor:pointer; border:0; background:transparent; padding:0; font-family:inherit; display:flex; flex-direction:column; align-items:flex-end; gap:3px; min-width:0; }
    .${k_} .lm-th.k span { white-space:normal; hyphens:manual; overflow:hidden; max-width:100%; text-align:right; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .${k_} .lm-th.k:hover { color:${ink.stark}; }
    .${k_} .lm-th.pa { color:${ink.stark}; font-weight:600; }
    .${k_} .lm-th i { display:block; width:16px; height:3px; border-radius:1px; }
    .${k_} .lm-rader { display:flex; flex-direction:column; min-height:0; }
    .${k_} .lm-r { padding:5px 4px 5px; border-radius:5px; row-gap:3px; }
    .${k_} .lm-r.kan { cursor:pointer; }
    .${k_} .lm-r.fokus { background:${hov}; }
    .${k_} .lm-r.vald { background:${hov}; box-shadow:inset 2px 0 0 var(--f); }
    .${k_} .lm-r.under { border-top:1px solid ${ink.rutnat}; border-radius:0 0 5px 5px; }
    .${k_} .lm-r.under + .lm-r.under { border-top:0; }
    .${k_} .lm-r.tat { padding:4px 4px 4px; row-gap:1px; }
    .${k_} .lm-namn { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px; }
    .${k_} .lm-namn i { flex:none; width:8px; height:8px; border-radius:2px; }
    .${k_} .lm-r.under .lm-namn { font-weight:500; font-style:italic; color:${ink.mjuk}; }
    .${k_} .lm-v { font:500 11.5px/1.2 ${MONO}; text-align:right; white-space:nowrap; color:${ink.mjuk}; font-variant-numeric:tabular-nums; }
    .${k_} .lm-v.pa { color:${ink.stark}; font-weight:600; }
    .${k_} .lm-v small { display:block; font:400 8.5px/1.1 Inter, system-ui, sans-serif; color:${ink.svag}; }
    .${k_} .lm-tot { font:500 9.5px/1.2 ${MONO}; color:${ink.svag}; white-space:nowrap; padding-left:14px; font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .lm-andel { font:600 10.5px/1.2 ${MONO}; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .${k_} .lm-nara { grid-column:1 / -1; font-size:9.5px; line-height:1.25; color:${ink.svag}; font-style:italic; padding-left:14px; }
    .${k_} .lm-bar { grid-column:1 / -1; height:6px; position:relative; }
    .${k_} .lm-bar .sp { position:absolute; left:0; right:0; top:2.5px; height:1px; background:${ink.rutnat}; }
    .${k_} .lm-bar .noll { position:absolute; top:-1px; width:1px; height:8px; background:${ink.linje}; }
    .${k_} .lm-bar .st { position:absolute; top:0; height:6px; border-radius:2px; transition:left .18s, width .18s; }
    .${k_} .lm-stapel { grid-column:1 / -1; height:9px; position:relative; margin-top:2px; }
    .${k_} .lm-stapel .sp { position:absolute; left:0; right:0; top:4px; height:1px; background:${ink.rutnat}; }
    .${k_} .lm-stapel .seg { position:absolute; top:1px; height:7px; box-shadow:inset 0 0 0 .5px ${bakgrund}; }
    .${k_} .lm-stapel .noll { position:absolute; top:-1px; width:1px; height:11px; background:${ink.linje}; }
    .${k_} .lm-stapel .nt { position:absolute; top:-2px; width:2px; height:13px; margin-left:-1px; background:${ink.stark}; border-radius:1px; box-shadow:0 0 0 1px ${bakgrund}; }
    .${k_} .lm-not { font-size:10px; line-height:1.4; color:${ink.svag}; margin-top:8px; }
    ${T.mork ? `
    .${k_} .lm-period.hov { color:#00AB60; }
    .${k_} .kt-rad, .${k_} .kt-et { color:${ink.svag}; }
    .${k_} .kt-par, .${k_} .kt-kryss button { border-color:rgba(255,255,255,.18); }
    .${k_} .kt-par button, .${k_} .kt-kryss button { color:${ink.mjuk}; }
    .${k_} .kt-par button:hover, .${k_} .kt-kryss button:hover { color:${ink.stark}; }
    .${k_} .kt-par button.pa { background:rgba(255,255,255,.13); color:${ink.stark}; }
    .${k_} .kt-kryss button.pa { color:${ink.stark}; border-color:rgba(255,255,255,.35); background:rgba(255,255,255,.05); }
    .${k_} .kt-ar .kt-period { color:${ink.stark}; }
    .${k_} .kt-ar rect[fill^="rgba(13"] { fill:rgba(255,255,255,.16); }
    .${k_} .kt-ar rect[fill="#2F3632"] { fill:${ink.mjuk}; }
    .${k_} .kt-ar circle.h { fill:${ink.stark}; stroke:${bakgrund}; }` : ""}
    .${k_} .lm-kalla { flex:none; font-size:10px; line-height:1.35; color:${ink.svag}; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  `;
  rot.appendChild(stil);
  // Knappar ska inte behålla fokus: mellanslag skulle annars både klicka och bläddra
  rot.addEventListener("click", ev => { const b = ev.target.closest?.("button"); if (b) b.blur(); });

  // Reveal: är modulen på bilden som visas?
  const Rv = () => (typeof window !== "undefined" ? window.Reveal : null);
  const iBild = () => { const s = Rv()?.getCurrentSlide?.(); return !s || s.contains(rot); };

  // ── Reglage ───────────────────────────────────────────────────────────────
  const reg = el("div", { class: "lm-reglage" });
  const rad1 = el("div", { class: "lm-rad" }), rad2 = el("div", { class: "lm-rad" });
  reg.append(rad1, rad2);
  rot.appendChild(reg);
  let kryssEl = null, segSkala = null, segTid = null, segY = null, arEl = null, spelKnapp = null, perGrupp = null;
  if (R.variabler && VAR.length > 1) {
    kryssEl = kryss({
      val: VAR.map(v => ({ id: v.id, etikett: v.etikett, farg: v.farg, pa: valda.includes(v.id) })),
      etikett: "Visa",
      vidByte: ids => {
        const ny = ids.find(id => !valda.includes(id));
        if (ny) { const g = varMap.get(ny).grupp; ids = ids.filter(id => varMap.get(id).grupp === g); kryssEl.satt(ids, { tyst: true }); }
        valda = VAR.map(v => v.id).filter(id => ids.includes(id));   // alltid variabellistans ordning
        if (!valda.includes(sortId)) sortId = null;
        ritaAllt();
      }
    });
    rad1.appendChild(kryssEl);
  }
  if (R.period) {
    const grupp = el("span", { class: "lm-pergrupp lm-hoger" });
    if (R.spela) {
      spelKnapp = el("button", { type: "button", class: "lm-spela", title: "Spela perioden år för år", "aria-label": "Spela perioden år för år", "aria-pressed": "false" }, "▶");
      // Klick och tangenter i knappen ska inte nå Reveal
      for (const t of ["pointerdown", "mousedown", "touchstart", "keydown"]) spelKnapp.addEventListener(t, ev => ev.stopPropagation());
      spelKnapp.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); spelTimer ? pausa() : spela(); });
      grupp.appendChild(spelKnapp);
    }
    arEl = arsreglage({ min: AR0, max: AR1, fran, till, brott, bredd: 180, vidByte: p => { avbrytSpel({ aterstall: false }); fran = p.fran; till = p.till; ritaAllt(); } });
    grupp.appendChild(arEl);
    perGrupp = grupp;   // läggs sist på rad 2
  }
  // Rad 1: bara variablerna. Rad 2: skala, tid och periodreglaget med ▶.
  // Y-skalan står längst ned i tabellkolumnen, så att huvudet tar två rader.
  if (R.skala) { segSkala = segment({ val: SKALOR, varde: onskadSkala, etikett: "Skala", vidByte: id => { onskadSkala = id; ritaAllt(); } }); rad2.appendChild(segSkala); }
  if (R.tid) { segTid = segment({ val: TIDER, varde: onskadTid, etikett: "Tid", vidByte: id => { onskadTid = id; ritaAllt(); } }); rad2.appendChild(segTid); }
  if (perGrupp) (rad2.childElementCount || !kryssEl ? rad2 : rad1).appendChild(perGrupp);
  if (R.yskala && PANELER.length > 1) {
    segY = segment({ val: YSKALOR, varde: yskala, etikett: "Y-skala", vidByte: id => { yskala = id; ritaAllt(); } });
    segY.classList.add("lm-yval");
  }
  if (!rad1.childElementCount) rad1.remove();
  if (!rad2.childElementCount) rad2.remove();

  // ── Kropp: paneler + tabell ───────────────────────────────────────────────
  const kropp = el("div", { class: "lm-kropp" });
  const yta = el("div", { class: "lm-yta" });
  const skaltext = el("div", { class: "lm-skaltext" });
  const svgEl = d3.create("svg").style("display", "block").style("overflow", "visible")
    .style("font-family", "var(--graf-text-font, Inter, system-ui, sans-serif)").attr("role", "img");
  const info = el("div", { class: "lm-info", style: "display:none" });
  const tips = el("div", { class: "lm-tips", style: "display:none" });
  yta.append(skaltext, svgEl.node(), info, tips);
  const tab = el("div", { class: "lm-tab" });
  const tabInnehall = el("div", { class: "lm-tabinn" });
  tab.appendChild(tabInnehall);
  if (segY) tab.appendChild(segY);
  kropp.append(yta, tab);
  rot.appendChild(kropp);
  if (kalla) rot.appendChild(el("div", { class: "lm-kalla", title: kalla.replace(/<[^>]+>/g, "") }, kalla));

  // Höjder i px (rotnoden mäts inte, den är inte i dokumentet när den byggs)
  const har1 = reg.contains(rad1), har2 = reg.contains(rad2);
  const H_REG = (har1 ? 26 : 0) + (har2 ? 26 : 0) + (har1 && har2 ? 4 : 0);
  const H_KALLA = kalla ? 18 : 0;
  // Uppskattning tills noden är i dokumentet; sedan mäts reglageraderna (de kan
  // radbrytas när variablerna är många) och panelerna ritas om vid behov
  let H_YTA = height - H_REG - 4 - H_KALLA - 16;   // minus skaltexten
  if (typeof ResizeObserver !== "undefined") {
    let sett = false;
    const ro = new ResizeObserver(() => {
      if (!rot.isConnected) { if (sett) ro.disconnect(); return; }
      sett = true;
      const h = reg.offsetHeight;
      if (!h && reg.childElementCount) return;          // dold bild: mät när den visas
      const ny = Math.round(height - h - 4 - H_KALLA - 16);
      if (Math.abs(ny - H_YTA) > 1) { H_YTA = ny; ritaAllt(); }
    });
    ro.observe(reg);
  }

  let paneler = [];   // { E, g, sx, sy, gH, hl, arText, prickar, ser, linjeFarg }

  function ritaAllt() {
    // Effektiva val: det som inte gäller någon vald variabel faller tillbaka
    const valdaV = valda.map(id => varMap.get(id));
    const skalaOk = s => valdaV.some(v => stodSkala(v, s));
    const tidOk = t => valdaV.some(v => stodTid(v, t));
    skalaEff = skalaOk(onskadSkala) ? onskadSkala : "antal";
    tidEff = tidOk(onskadTid) ? onskadTid : "arsvarde";
    if (segSkala) { SKALOR.forEach(s => segSkala.inaktivera(s.id, !skalaOk(s.id))); segSkala.satt(skalaEff, { tyst: true }); }
    if (segTid) { TIDER.forEach(t => segTid.inaktivera(t.id, !tidOk(t.id))); segTid.satt(tidEff, { tyst: true }); }
    synliga = valdaV.filter(v => stodSkala(v, skalaEff) && stodTid(v, tidEff));
    if (kryssEl) {
      const knappar = kryssEl.querySelectorAll(".kt-kryss button");
      VAR.forEach((v, i) => {
        const b = knappar[i]; if (!b) return;
        const dold = valda.includes(v.id) && !synliga.includes(v);
        b.classList.toggle("lm-dold", dold);
        b.title = dold ? `Visas inte med ${SKALOR.find(s => s.id === skalaEff).etikett.toLowerCase()} / ${TIDER.find(t => t.id === tidEff).etikett.toLowerCase()}` : "";
      });
    }
    if (!sortId || !synliga.some(v => v.id === sortId)) sortId = synliga[0]?.id ?? null;
    hovAr = null;
    const tw = tabellBreddFor();
    tab.style.width = `${tw}px`;
    ritaPaneler(width - tw - 16);
    ritaTabell();
    // Står pekaren kvar i en panel (t.ex. under uppspelning): behåll årsstrecket och tipsrutan
    tips.style.display = "none";
    if (pekare && paneler.some(p => p.E.kod === pekare.kod)) {
      fokus = null; satFokus(pekare.kod);
      satHov(Math.max(fran, Math.min(till, pekare.ar)));
    } else pekare = null;
  }

  // Kolumnbredd efter rubriken (med plats för sorteringspilen), minst ett tal
  // Rubriken får brytas vid "netto" (mjukt bindestreck), så att kolumnerna hålls smala
  const rubrikDelar = t => t.replace(/([a-zåäö])(netto)\b/gi, "$1­$2").split("­");
  const rubrikHtml = t => rubrikDelar(t).join("&shy;");
  const kolBredd = v => Math.round(Math.max(synliga.length === 1 ? 74 : 54, Math.min(80, d3.max(rubrikDelar(v.kort), d => textbredd(d, 9.5, 600)) + 12)));
  function tabellBreddFor() {
    const x = tabellExtra.length;
    const vars = synliga.reduce((s, v) => s + kolBredd(v), 0) || 74;
    return Math.max(tabellBredd, Math.min(400, 92 + vars + x * 62 + (synliga.length + x) * 8 + 16));
  }

  // ── Paneler ───────────────────────────────────────────────────────────────
  function ritaPaneler(W) {
    const svg = svgEl;
    svg.selectAll("*").remove();
    const axTill = spelMal != null && spelMal > till ? spelMal : till;   // under uppspelning står axeln still
    const VISA = forstorad ? PANELER.filter(p => p.kod === forstorad) : PANELER;
    const np = VISA.length;
    const F = forstorad ? 1.32 : 1;                    // textskala
    const en = synliga.length === 1;
    const linjeFarg = (P, v) => (en && !P.rike ? P.farg : v.farg);
    const visaRike = RIKE_LINJE && synliga.some(v => v.medReferens !== false) && (skalaEff !== "antal" || synliga.some(v => v.typ === "kvot"));

    // Serier över hela axeln (domänerna); det som ritas klipps vid slutåret
    const S = new Map();
    const lagra = E => S.set(E.kod, new Map(synliga.map(v => [v.id, serie(E, v, skalaEff, tidEff, axTill)])));
    PANELER.forEach(lagra);
    if (visaRike && !S.has(RIKE.kod)) lagra(RIKE);
    const klipp = ut => (axTill > till ? ut.map((y, j) => (fran + j <= till ? y : NaN)) : ut);

    // Etikettbredd (gemensam för panelerna)
    const etiketter = synliga.map(v => v.kort);
    if (visaRike && en) etiketter.push(RIKE.namn);
    const maxEt = 86 * F, etPx = 10 * F;
    const etB = Math.min(maxEt, d3.max(etiketter, t => textbredd(t, etPx, 600)) ?? 30);
    const SH = Math.round(21 * F);                     // rubrikraden
    // Etiketter vid linjeslut bara i förstorad panel; i rutnätet står nyckeln i
    // skaltexten (eller på den tomma platsen), så att ritytan kan bli kvadratisk
    const medEt = !!forstorad;
    const M = { top: SH + Math.round(12 * F), right: medEt ? etB + 17 * F : 10, bottom: Math.round(17 * F), left: Math.round(42 * F) };
    // Panelstorleken räknas ur ytan med kvadratisk rityta som krav (höjd/bredd
    // 0,85–1,05), inte genom att fylla bredden. Rutnätet centreras; hellre luft i
    // kanten än platta paneler. Av 2 och 3 kolumner väljs den med störst rityta.
    const GX = 10, GY = 10, KMIN = 0.85, KMAX = 1.05;
    const matt = c => {
      const r = Math.ceil(np / c), hal_ = !forstorad && c * r > np;
      const HP_ = H_YTA + (hal_ ? 16 : 0);
      const sw = (W - (c - 1) * GX) / c - M.left - M.right, sh = (HP_ - (r - 1) * GY) / r - M.top - M.bottom;
      const iw_ = Math.max(40, Math.min(sw, sh / KMIN)), ih_ = Math.max(30, Math.min(sh, iw_ * KMAX));
      return { c, r, hal: hal_, HP: HP_, iw: Math.floor(iw_), ih: Math.floor(ih_) };
    };
    const kand = forstorad ? [1] : kolumner ? [kolumner] : np <= 3 ? [np] : np === 4 ? [2] : [2, 3];
    const L = kand.map(matt).reduce((a, b) => (b.iw * b.ih > a.iw * a.ih * 1.02 ? b : a));
    const { c: cols, r: rows, hal, HP, iw, ih } = L;
    skaltext.style.display = hal ? "none" : "";
    const pw = iw + M.left + M.right, ph = ih + M.top + M.bottom;
    const gx0 = Math.max(0, Math.round((W - (cols * pw + (cols - 1) * GX)) / 2));
    const gy0 = Math.max(0, Math.round((HP - (rows * ph + (rows - 1) * GY)) / 2));
    svg.attr("width", W).attr("height", HP).attr("viewBox", `0 0 ${W} ${HP}`);
    rot.dataset.rityta = `${iw}x${ih}`;

    // Y-domäner
    const referensVarde = synliga.length && synliga.every(v => index(v)) ? 100 : (tidEff !== "arsvarde" || synliga.some(v => v.typ === "flode")) ? 0 : null;
    const medNoll = referensVarde != null || (skalaEff === "antal" && nollIAntal && synliga.every(v => v.typ !== "kvot"));
    const domanFor = lista => {
      let lo = Infinity, hi = -Infinity;
      for (const E of lista) for (const s of S.get(E.kod)?.values() ?? []) for (const y of s.ut) if (ok(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
      if (!ok(lo)) { lo = 0; hi = 1; }
      if (referensVarde != null) { lo = Math.min(lo, referensVarde); hi = Math.max(hi, referensVarde); }
      else if (medNoll) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      if (hi - lo < 1e-9) { hi += 1; lo -= medNoll && lo === 0 ? 0 : 1; }
      const pad = (hi - lo) * 0.04;
      return [lo === 0 || lo === referensVarde ? lo : lo - pad, hi === 0 ? hi : hi + pad];
    };
    const rikeEgen = p => p.rike && skalaEff === "antal" && !synliga.every(v => v.typ === "kvot");
    const gemensam = domanFor([...PANELER.filter(p => !rikeEgen(p)), ...(visaRike ? [RIKE] : [])]);
    const nTick = ih < 110 ? 3 : ih < 260 ? 4 : 6;

    paneler = VISA.map((P, k) => {
      const c = k % cols, r = Math.floor(k / cols);
      const x0 = gx0 + c * (pw + GX), y0 = gy0 + r * (ph + GY);
      const egen = yskala === "egen" || rikeEgen(P);
      const dom = egen ? domanFor([P, ...(visaRike && !P.rike ? [RIKE] : [])]) : gemensam;
      const sy = d3.scaleLinear().domain(dom).range([ih, 0]).nice(nTick);
      const sx = d3.scaleLinear().domain([fran, axTill]).range([0, iw]);
      const g = svg.append("g").attr("class", "lm-panel").attr("transform", `translate(${x0},${y0})`).style("transition", "opacity .15s");
      // Kortet: ljus yta, diskret ram, rubrikrad i stadens färg
      const rr = 6;
      g.append("rect").attr("x", 0.5).attr("y", 0.5).attr("width", pw - 1).attr("height", ph - 1).attr("rx", rr).attr("fill", kortYta);
      const hd = g.append("g").attr("class", "lm-hd").attr("role", "button")
        .attr("aria-label", forstorad ? `Stäng förstoringen av ${P.namn}` : `Förstora ${P.namn}`);
      hd.append("path").attr("class", "lm-hdyta")
        .attr("d", `M0.5,${SH}V${rr + 0.5}A${rr},${rr} 0 0 1 ${rr + 0.5},0.5H${pw - rr - 0.5}A${rr},${rr} 0 0 1 ${pw - 0.5},${rr + 0.5}V${SH}Z`)
        .attr("fill", P.rike ? ink.svag : P.farg).attr("fill-opacity", T.mork ? 0.14 : 0.075);
      hd.append("line").attr("x1", 0.5).attr("x2", pw - 0.5).attr("y1", SH).attr("y2", SH).attr("stroke", P.rike ? ink.svag : P.farg).attr("stroke-opacity", 0.35);
      hd.append("circle").attr("cx", 10 * F).attr("cy", SH / 2).attr("r", 3.4 * F).attr("fill", P.farg);
      const namnPx = 12.5 * F;
      hd.append("text").attr("class", "lm-pnamn").attr("x", 18 * F).attr("y", SH / 2).attr("dy", "0.35em").attr("font-size", namnPx).attr("font-weight", 650)
        .attr("fill", P.rike ? ink.mjuk : P.farg).attr("font-style", P.rike ? "italic" : null).text(P.namn);
      if (egen) hd.append("text").attr("x", 18 * F + textbredd(P.namn, namnPx, 650) + 8 * F).attr("y", SH / 2).attr("dy", "0.35em").attr("font-size", 9.5 * F).attr("font-style", "italic")
        .attr("fill", ink.svag).text("egen skala");
      // Ikon: förstora (fyra hörn) eller stäng (×)
      const ik = hd.append("g").attr("class", "lm-ikon").attr("fill", "none").attr("stroke", ink.mjuk).attr("stroke-width", 1.3).attr("stroke-linecap", "round");
      if (forstorad) {
        const s = 4.5 * F, cx = pw - 12 * F, cy = SH / 2;
        ik.append("path").attr("d", `M${cx - s},${cy - s}L${cx + s},${cy + s}M${cx + s},${cy - s}L${cx - s},${cy + s}`).attr("stroke-width", 1.6);
        ik.append("text").attr("x", cx - s - 7 * F).attr("y", cy).attr("dy", "0.35em").attr("text-anchor", "end").attr("stroke", "none")
          .attr("fill", ink.mjuk).attr("font-size", 10.5 * F).text("Visa alla");
      } else {
        const s = 4, cx = pw - 12, cy = SH / 2, a = 2.2;
        ik.append("path").attr("d", `M${cx - s},${cy - s + a}V${cy - s}H${cx - s + a}M${cx + s - a},${cy - s}H${cx + s}V${cy - s + a}M${cx + s},${cy + s - a}V${cy + s}H${cx + s - a}M${cx - s + a},${cy + s}H${cx - s}V${cy + s - a}`);
      }
      hd.append("rect").attr("x", 0).attr("y", 0).attr("width", pw).attr("height", SH).attr("fill", "transparent")
        .append("title").text(forstorad ? "Tillbaka till alla paneler (Esc)" : `Förstora ${P.namn}`);
      hd.on("click", ev => { ev.stopPropagation(); vaxla(P.kod); });
      g.append("rect").attr("x", 0.5).attr("y", 0.5).attr("width", pw - 1).attr("height", ph - 1).attr("rx", rr)
        .attr("fill", "none").attr("stroke", kortRam).attr("pointer-events", "none");

      const pg = g.append("g").attr("transform", `translate(${M.left},${M.top})`);
      // Framtid: tonad bakgrund
      if (framtid && framtid.fran <= axTill) {
        const xa = sx(Math.max(fran, framtid.fran - 0.5));
        pg.append("rect").attr("x", xa).attr("y", 0).attr("width", Math.max(0, iw - xa)).attr("height", ih)
          .attr("fill", T.mork ? "rgba(162,217,248,.07)" : "rgba(0,73,144,.05)");
        if (k === 0 && framtid.etikett && iw - xa > 30) pg.append("text").attr("x", iw - 4).attr("y", 10 * F).attr("text-anchor", "end")
          .attr("font-size", 9 * F).attr("fill", ink.svag).text(framtid.etikett);
      }
      // Rutnät och skalsteg
      const tk = sy.ticks(nTick), steg = tk.length > 1 ? Math.abs(tk[1] - tk[0]) : 1;
      const fv = synliga[0] ?? VAR[0];
      // Nollinjen (100 för index) tydligt mörkare än rutnätet, när den ligger inom skalan
      const nollV = referensVarde ?? 0;
      const nollSyns = nollV >= sy.domain()[0] && nollV <= sy.domain()[1];
      for (const t of tk) {
        if (!(nollSyns && Math.abs(t - nollV) < 1e-9)) pg.append("line").attr("x1", 0).attr("x2", iw).attr("y1", sy(t)).attr("y2", sy(t)).attr("stroke", rutnat).attr("shape-rendering", "crispEdges");
        pg.append("text").attr("x", -6).attr("y", sy(t)).attr("dy", "0.33em").attr("text-anchor", "end").attr("font-family", MONO)
          .attr("font-size", 9 * F).attr("fill", egen ? ink.mjuk : ink.svag).attr("font-style", egen ? "italic" : null).text(tickFmt(fv, t, steg));
      }
      if (nollSyns)
        pg.append("line").attr("class", "lm-noll").attr("x1", 0).attr("x2", iw).attr("y1", sy(nollV)).attr("y2", sy(nollV))
          .attr("stroke", T.mork ? "#B6C2BB" : "#59615D").attr("stroke-width", F > 1 ? 1.25 : 1).attr("shape-rendering", "crispEdges");
      // Årtal: start, slut och jämna år emellan
      const span = axTill - fran, st = span <= 6 ? 1 : span <= 14 ? 5 : 10;
      const arTick = [fran];
      for (let a = Math.ceil((fran + 1) / st) * st; a < axTill; a += st)
        if (sx(a) - sx(arTick[arTick.length - 1]) > 38 * F && sx(axTill) - sx(a) > 38 * F) arTick.push(a);
      arTick.push(axTill);
      arTick.forEach((a, i) => pg.append("text").attr("x", sx(a)).attr("y", ih + 12 * F).attr("text-anchor", i === 0 ? "start" : i === arTick.length - 1 ? "end" : "middle")
        .attr("font-family", MONO).attr("font-size", 9 * F).attr("fill", ink.svag).text(a));
      // Brott i serien: tunt streck + hake
      for (const b of brott) {
        if (b.ar <= fran || b.ar > axTill) continue;
        const bx = sx(b.ar - 0.5);
        const gb = pg.append("g");
        gb.append("line").attr("x1", bx).attr("x2", bx).attr("y1", 0).attr("y2", ih).attr("stroke", ink.linje).attr("stroke-width", 0.8).attr("stroke-dasharray", "2 2");
        gb.append("path").attr("d", `M${bx - 3},-1h6l-3,4z`).attr("fill", ink.svag);
        gb.append("title").text(b.etikett ?? `Källbyte ${b.ar}`);
      }
      // Linjer
      const linje = d3.line().defined(p => ok(p[1])).x(p => sx(p[0])).y(p => sy(p[1]));
      const gL = pg.append("g").attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
      const split = framtid && framtid.fran <= axTill ? framtid.fran - 1 : Infinity;
      const ritaSerie = (ut, farg, { streck = null, bredd = 1.6, opacitet = 1 } = {}) => {
        const pts = Array.from(ut, (y, j) => [fran + j, y]);
        const fore = pts.filter(p => p[0] <= split), efter = pts.filter(p => p[0] >= split);
        if (fore.length) gL.append("path").attr("d", linje(fore)).attr("stroke", farg).attr("stroke-width", bredd).attr("stroke-dasharray", streck).attr("opacity", opacitet);
        if (efter.filter(p => ok(p[1])).length > 1) gL.append("path").attr("d", linje(efter)).attr("stroke", farg).attr("stroke-width", bredd).attr("stroke-dasharray", streck ?? `${4 * F} ${3 * F}`).attr("opacity", opacitet);
      };
      const ser = new Map([...S.get(P.kod)].map(([id, s]) => [id, { ...s, ut: klipp(s.ut) }]));
      const et = [];
      if (visaRike && !P.rike) {
        for (const v of synliga) {
          const ut = klipp(S.get(RIKE.kod).get(v.id).ut);
          ritaSerie(ut, en ? rikeFarg : v.farg, { streck: "1.5 3", bredd: 1.3 * F, opacitet: en ? 1 : 0.8 });
          const j = sista(ut);
          if (en && j >= 0) et.push({ id: `rike-${v.id}`, text: RIKE.namn, ankarY: sy(ut[j]), ankarX: sx(fran + j), farg: rikeFarg, prioritet: -1, kursiv: true });
        }
      }
      for (const v of synliga) {
        const ut = ser.get(v.id).ut, f = linjeFarg(P, v);
        ritaSerie(ut, f, { bredd: 1.6 * F });
        const j = sista(ut);
        if (j >= 0) {
          gL.append("circle").attr("cx", sx(fran + j)).attr("cy", sy(ut[j])).attr("r", 2.4 * F).attr("fill", f).attr("stroke", kortYta.startsWith("#") ? kortYta : bakgrund).attr("stroke-width", 1);
          et.push({ id: v.id, text: v.kort, ankarY: sy(ut[j]), ankarX: sx(fran + j), farg: f, prioritet: 1 });
        }
      }
      // Etiketter vid linjeslut (förstorad panel)
      const plac = !medEt ? [] : placeraEtiketter(et, { yMin: 0, yMax: ih, avstand: 12 * F, maxBredd: maxEt, px: etPx, vikt: 600 })
        .map(e => ({ ...e, ankarX: et.find(q => q.id === e.id).ankarX }));
      const gE = pg.append("g").attr("pointer-events", "none");
      if (medEt) ritaEtiketter(gE, plac, { farg: e => e.farg, halo: kortYta.startsWith("#") ? kortYta : bakgrund, px: etPx, vikt: () => 600, avstand: 12 * F, knack: 5 * F, slut: 10 * F, kursiv: e => !!e.kursiv });
      // Hovring
      const gH = pg.append("g").attr("pointer-events", "none").attr("opacity", 0);
      const hl = gH.append("line").attr("y1", -2).attr("y2", ih).attr("stroke", ink.mjuk).attr("stroke-width", 1);
      const arText = gH.append("text").attr("y", -4).attr("text-anchor", "middle").attr("font-family", MONO).attr("font-size", 9.5 * F)
        .attr("font-weight", 600).attr("fill", ink.stark).attr("paint-order", "stroke").attr("stroke", kortYta.startsWith("#") ? kortYta : bakgrund).attr("stroke-width", 3);
      const prickar = gH.append("g");
      const yta_ = pg.append("rect").attr("x", -4).attr("y", -6).attr("width", iw + 8).attr("height", ih + 12).attr("fill", "transparent").style("cursor", "crosshair");
      yta_.on("pointermove", ev => {
        const [mx] = d3.pointer(ev, pg.node());
        // Pekarens år sparas oklippt mot slutåret: under uppspelning följer strecket med
        const ar = Math.round(Math.max(fran, Math.min(axTill, sx.invert(mx))));
        pekare = { kod: P.kod, ar };
        satFokus(P.kod); satHov(Math.min(till, ar), true);
      }).on("pointerleave", () => { pekare = null; satHov(null); satFokus(null); });
      return { E: P, g, pg, sx, sy, gH, hl, arText, prickar, ser, F, ox: x0 + M.left, oy: y0 + M.top, iw, ih, pw, x0, linjeFarg: v => linjeFarg(P, v) };
    });

    // Skaltext: ovanför panelerna, eller på den tomma platsen i rutnätet
    const texter = [...new Set(synliga.map(beskrivning))];
    const prognos = framtid && framtid.fran <= axTill;
    const brottSyns = brott.filter(b => b.ar > fran && b.ar <= axTill);
    // Nyckel för linjerna (i rutnätet står inga etiketter vid linjeslut). En enda
    // variabel ritas i stadens färg: då en neutral linje med variabelns namn.
    const nyckelIk = (farg, streck) => `<svg width="18" height="8" style="vertical-align:0"><line x1="1" x2="17" y1="4" y2="4" stroke="${farg}" stroke-width="2" ${streck ? `stroke-dasharray="${streck}"` : ""} stroke-linecap="round"/></svg>`;
    const nyckel = medEt ? [] : synliga.map(v => ({ farg: en ? ink.mjuk : v.farg, text: en ? v.etikett : v.kort }));
    if (!hal) {
      info.style.display = "none";
      skaltext.innerHTML = `<b>${texter.join(" · ") || "–"}</b>${nyckel.map(n => `<span class="lm-nyckel lm-nv">${nyckelIk(n.farg)} ${n.text}</span>`).join("")}${visaRike ? `<span class="lm-nyckel">┄ ${RIKE.namn.toLowerCase()}</span>` : ""}${prognos ? `<span class="lm-nyckel">- - prognos från ${framtid.fran}</span>` : ""}`;
      if (RIKE_LINJE && !visaRike && skalaEff === "antal" && synliga.some(v => v.medReferens !== false)) skaltext.innerHTML += `<span class="lm-nyckel">${RIKE.namn} visas relativt och per 1 000 inv.</span>`;
    } else {
      const c = np % cols, r = Math.floor(np / cols);
      Object.assign(info.style, { display: "flex", left: `${gx0 + c * (pw + GX)}px`, top: `${gy0 + r * (ph + GY)}px`, width: `${pw}px`, height: `${ph}px` });
      const linjeIk = streck => `<svg width="22" height="8"><line x1="1" x2="21" y1="4" y2="4" stroke="${ink.mjuk}" stroke-width="1.6" ${streck ? `stroke-dasharray="${streck}"` : ""} stroke-linecap="round"/></svg>`;
      const rader_ = [`<b>${texter.join("<br>") || "–"}</b>`];
      for (const n of nyckel) rader_.push(`<span class="lm-ik lm-nv">${nyckelIk(n.farg).replace('width="18"', 'width="22"')}${n.text}</span>`);
      if (visaRike) rader_.push(`<span class="lm-ik">${linjeIk("1.5 3")}${RIKE.namn}</span>`);
      else if (RIKE_LINJE && skalaEff === "antal" && synliga.some(v => v.medReferens !== false)) rader_.push(`<span class="lm-ik">${RIKE.namn} visas relativt och per 1 000 inv.</span>`);
      if (prognos) rader_.push(`<span class="lm-ik">${linjeIk("4 3")}prognos från ${framtid.fran}</span>`);
      if (brottSyns.length) rader_.push(`<span class="lm-ik"><svg width="22" height="10"><line x1="11" x2="11" y1="2" y2="10" stroke="${ink.linje}" stroke-dasharray="2 2"/><path d="M8,0h6l-3,4z" fill="${ink.svag}"/></svg>${brottSyns.map(b => b.etikett ?? `källbyte ${b.ar}`).join(", ")}</span>`);
      rader_.push(`<span class="lm-sep"></span>`);
      rader_.push(`<span class="lm-ik"><svg width="22" height="10"><path d="M7,3V1H9M13,1H15V3M15,7V9H13M9,9H7V7" fill="none" stroke="${ink.mjuk}" stroke-width="1.2" stroke-linecap="round"/></svg>Klicka på ett namn för att förstora</span>`);
      if (spelKnapp) rader_.push(`<span class="lm-ik"><svg width="22" height="10"><path d="M8,1L15,5L8,9Z" fill="${ink.mjuk}"/></svg>Spela perioden år för år</span>`);
      info.innerHTML = rader_.join("");
    }
  }

  function satHov(a, tvinga = false) {
    if (a === hovAr && !tvinga) return;
    const nytt = a !== hovAr;
    hovAr = a;
    visaTips();
    if (!nytt) return;
    for (const p of paneler) {
      if (a == null) { p.gH.attr("opacity", 0); continue; }
      const x = p.sx(a);
      p.gH.attr("opacity", 1);
      p.hl.attr("x1", x).attr("x2", x);
      p.arText.attr("x", x).text(a);
      p.prickar.selectAll("circle").data(synliga.filter(v => ok(p.ser.get(v.id).ut[a - fran])), v => v.id).join("circle")
        .attr("r", 3 * p.F).attr("stroke", bakgrund).attr("stroke-width", 1.2)
        .attr("fill", v => p.linjeFarg(v)).attr("cx", x).attr("cy", v => p.sy(p.ser.get(v.id).ut[a - fran]));
    }
    ritaTabell();
  }
  // Tipsrutan: året, och för varje vald variabel värdet i aktuell visning och
  // förändringen mot periodens startår (i antal, kvotens enhet eller summa för flöden)
  const antalTxt = x => (Math.abs(x) >= 1e6 ? `${tal(x / 1e6, 2, true)} mn` : tal(x, 0, true));
  function forandring(E, v, a) {
    const r = E.raw.get(v.id);
    if (v.typ === "flode") {
      let f = fran; while (f <= a && !ok(r[ix(f)])) f++;
      if (f > a) return null;
      const b = f === fran ? fran : f - 1;
      let s = 0; for (let y = b + 1; y <= a; y++) if (ok(r[ix(y)])) s += r[ix(y)];
      return { b, txt: antalTxt(s), sum: true };
    }
    let b = fran; while (b <= a && !ok(r[ix(b)])) b++;
    if (b > a || !ok(r[ix(a)])) return null;
    const d = r[ix(a)] - r[ix(b)];
    if (v.typ === "kvot") {
      const pr = (v.enhet ?? "%") === "%";
      return { b, txt: `${tal(d, v.decimaler ?? 1, true)}${pr ? " p.e." : ""}` };
    }
    const pct = r[ix(b)] > 0 && v.relativ !== false ? ` (${tal((100 * d) / r[ix(b)], 1, true)} %)` : "";
    return { b, txt: `${antalTxt(d)}${pct}` };
  }
  function visaTips() {
    const p = pekare && hovAr != null ? paneler.find(q => q.E.kod === pekare.kod) : null;
    if (!p) { tips.style.display = "none"; return; }
    const a = hovAr, E = p.E;
    const prog = framtid && a >= framtid.fran;
    const rader_ = synliga.map(v => {
      const y = p.ser.get(v.id)?.ut[a - fran];
      const fo = forandring(E, v, a);
      // Ackumulerat flöde i antal = summan sedan startåret: visa den inte två gånger
      const dubbel = fo?.sum && tidEff === "ack" && skalaEff === "antal";
      const fTxt = !fo || dubbel ? "" : a === fo.b ? "startår" : `${fo.txt} sedan ${fo.b}`;
      return `<tr><td><i style="background:${p.linjeFarg(v)}"></i>${v.kort}</td><td class="v">${fmt(v, y, { kort: true })}</td><td class="f">${fTxt}</td></tr>`;
    }).join("");
    const besk = [...new Set(synliga.map(beskrivning))].join(" · ");
    tips.innerHTML = `<div class="tt-hd"><span class="tt-ar">${a}</span><span class="tt-stad" style="color:${E.rike ? ink.mjuk : E.farg}">${E.namn}</span>${prog ? `<span class="tt-prog">prognos</span>` : ""}</div>`
      + `<table>${rader_}</table><div class="tt-fot">${besk}${synliga.some(v => v.typ === "flode") && !(tidEff === "ack" && skalaEff === "antal") ? ". Till höger för flöden: summa i antal sedan startåret" : ""}</div>`;
    tips.style.display = "block";
    // Placering: bredvid årsstrecket, inom diagramytan
    const svgTop = skaltext.style.display === "none" ? 0 : skaltext.offsetHeight;   // SVG har ingen offsetTop
    const W = yta.clientWidth, bw = tips.offsetWidth, bh = tips.offsetHeight;
    const xs = p.ox + p.sx(a);
    let left = xs + 14;
    if (left + bw > W) left = xs - 14 - bw;
    left = Math.max(0, Math.min(W - bw, left));
    let top = svgTop + p.oy + 4;
    const maxTop = yta.clientHeight - bh - 2;
    top = Math.max(0, Math.min(maxTop, top));
    tips.style.left = `${left}px`; tips.style.top = `${top}px`;
  }
  function satFokus(kod) {
    if (kod === fokus) return;
    fokus = kod;
    for (const p of paneler) p.g.style("opacity", kod == null || p.E.kod === kod || forstorad ? 1 : 0.35);
    tab.querySelectorAll(".lm-r").forEach(r => r.classList.toggle("fokus", r.dataset.kod === kod));
  }

  // ── Förstoring ────────────────────────────────────────────────────────────
  function vaxla(kod) {
    const ny = kod == null || forstorad === kod ? null : kod;
    if (ny === forstorad) return;
    forstorad = ny;
    fokus = null;
    ritaAllt();
  }
  if (typeof document !== "undefined") {
    // Esc stänger förstoringen utan att Reveal får tangenten (översiktsläget)
    document.addEventListener("keydown", ev => {
      if (ev.key !== "Escape" || !forstorad || !rot.isConnected || !iBild()) return;
      ev.stopPropagation(); ev.stopImmediatePropagation(); ev.preventDefault();
      vaxla(null);
    }, true);
  }

  // ── Uppspelning ───────────────────────────────────────────────────────────
  function malaSpel() {
    if (!spelKnapp) return;
    const pa = !!spelTimer;
    spelKnapp.textContent = pa ? "❚❚" : "▶";
    spelKnapp.classList.toggle("pa", pa);
    spelKnapp.setAttribute("aria-pressed", pa);
    spelKnapp.title = pa ? "Pausa" : "Spela perioden år för år";
  }
  function stegTill(t) {
    till = t;
    arEl?.satt(fran, till, { tyst: true });
    ritaAllt();
  }
  function spela() {
    if (spelTimer) return;
    // Fortsätt mot det pausade slutåret, annars spela den valda perioden från början
    let mal = spelMal != null && spelMal > till ? spelMal : till;
    if (mal <= fran + 1) mal = AR1;
    spelMal = mal;
    spelTimer = setInterval(() => {
      if (!rot.isConnected || !iBild()) { avbrytSpel(); return; }
      if (till >= spelMal) { pausa(); return; }
      stegTill(till + 1);
      if (till >= spelMal) pausa();
    }, msPerAr);
    malaSpel();
    stegTill(till >= mal ? fran + 1 : till + 1);
  }
  function pausa() {
    clearInterval(spelTimer); spelTimer = null;
    if (spelMal != null && till >= spelMal) spelMal = null;   // vid slutet: axeln = perioden
    malaSpel();
  }
  // Stoppa och visa hela perioden (när bilden lämnas eller perioden ändras för hand)
  function avbrytSpel({ aterstall = true } = {}) {
    const mal = spelMal;
    clearInterval(spelTimer); spelTimer = null; spelMal = null;
    malaSpel();
    if (aterstall && mal != null && mal > till && rot.isConnected) stegTill(mal);
  }
  // Bilden lämnas: stoppa uppspelningen och stäng förstoringen
  if (typeof window !== "undefined") {
    const koppla = () => {
      const Rr = Rv();
      if (!Rr?.on) return;
      const vid = () => {
        if (!rot.isConnected) { Rr.off?.("slidechanged", vid); return; }
        if (iBild()) return;
        if (spelTimer || spelMal != null) avbrytSpel();
        if (forstorad) { forstorad = null; ritaAllt(); }
      };
      Rr.on("slidechanged", vid);
    };
    const forsok = (n = 0) => { if (rot.isConnected && Rv()?.on) koppla(); else if (n < 80) setTimeout(() => forsok(n + 1), 100); };
    setTimeout(() => forsok(), 0);
  }

  // ── Tabellen ──────────────────────────────────────────────────────────────
  // Andelsläget: vilka delar och vilken nämnare
  function andelInfo() {
    if (tidEff !== "ack" || !synliga.length || !synliga.every(v => v.typ === "flode")) return null;
    const nVar = OKNING;
    const komp = synliga.filter(v => v !== nVar);
    if (!komp.length || (!nVar && komp.length < 2)) return null;
    // Gemensamma år: åren efter startåret där alla delar (och nämnaren) har värde
    const alla = [...komp, ...(nVar ? [nVar] : [])];
    const slut = hovAr ?? till;
    const ar = [];
    for (let a = fran + 1; a <= slut; a++) if (STAD.every(E => alla.every(v => ok(E.raw.get(v.id)[ix(a)])))) ar.push(a);
    if (!ar.length) return null;
    return { nVar, komp, ar, start: ar[0], slut };
  }
  // Summor i antal över de gemensamma åren, omräknade till skalans enhet
  function andelar(E, A) {
    const sum = v => { let s = 0; for (const a of A.ar) { const x = E.raw.get(v.id)[ix(a)]; if (!ok(x)) return NaN; s += x; } return s; };
    const f = skalaEff === "relativ" ? 100 / E.bef[ix(A.start - 1)] : skalaEff === "per1000" ? 1000 / E.bef[ix(A.slut)] : 1;
    const delar = A.komp.map(v => ({ v, x: sum(v) }));
    const netto = A.nVar ? sum(A.nVar) : delar.reduce((s, d) => s + d.x, 0);
    const brutto = delar.reduce((s, d) => s + (ok(d.x) ? Math.abs(d.x) : 0), 0);
    const nara = !ok(netto) || !(Math.abs(netto) >= NARA_NOLL * brutto) || netto === 0;
    return {
      netto: netto * f, nara, f,
      delar: delar.map(d => ({ ...d, y: d.x * f, p: ok(d.x) && !nara ? (100 * d.x) / netto : NaN }))
    };
  }

  function ritaTabell() {
    const sv = varMap.get(sortId) ?? synliga[0];
    const n = synliga.length, x = tabellExtra.length;
    const mall = `minmax(0,1fr) ${synliga.map(v => `${kolBredd(v)}px`).join(" ")}${x ? ` repeat(${x}, 62px)` : ""}`;
    const periodObj = { fran, till, ar: hovAr };
    // Ordningen följer periodens värden: den hoppar inte vid hovring
    const per = E => new Map(synliga.map(v => [v.id, landat(E, v, null)]));
    const perioden = new Map(STAD.map(E => [E.kod, per(E)]));
    const ordning = sv ? STAD.slice().sort((a, b) => {
      const va = perioden.get(a.kod).get(sv.id).v, vb = perioden.get(b.kod).get(sv.id).v;
      return (ok(vb) ? vb : -Infinity) - (ok(va) ? va : -Infinity);
    }) : STAD.slice();
    const under = [...(SUMMA ? [SUMMA] : []), ...(RIKE ? [RIKE] : [])];
    const varden = E => (hovAr == null ? (E.summa || E.rike ? per(E) : perioden.get(E.kod)) : new Map(synliga.map(v => [v.id, landat(E, v, hovAr)])));
    const A = andelInfo();
    const alla = [...ordning, ...under].map(E => ({ E, V: varden(E), An: A ? andelar(E, A) : null }));
    // Mätarstaplarna: skalan över de fem (och riket/summan när skalan inte är Antal)
    const medUnder = skalaEff !== "antal" || sv?.typ === "kvot";
    const ref = sv && index(sv) ? 100 : 0;
    const iBar = r => !r.E.summa && !r.E.rike || medUnder;
    let lo = ref, hi = ref;
    if (A) {
      for (const r of alla) if (iBar(r) && r.An) {
        let pos = 0, neg = 0;
        for (const d of r.An.delar) if (ok(d.y)) d.y > 0 ? (pos += d.y) : (neg += d.y);
        lo = Math.min(lo, neg, ok(r.An.netto) ? r.An.netto : 0); hi = Math.max(hi, pos, ok(r.An.netto) ? r.An.netto : 0);
      }
    } else for (const r of alla) if (sv && iBar(r)) { const y = r.V.get(sv.id)?.v; if (ok(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }
    const pos = y => (hi - lo < 1e-12 ? 0 : (100 * (y - lo)) / (hi - lo));

    const rubrik = hovAr != null ? `År ${hovAr}` : sv ? periodRubrik(sv) : `${fran}–${till}`;
    const enh = sv ? enhetText(sv) : "";
    const nNamn = A?.nVar ? "folkökningen" : "summan av delarna";
    const andelEnh = A ? ` · % = andel av ${nNamn}${A.start > fran + 1 ? ` ${A.start}–${A.slut}` : ""}` : "";
    let html = `<div class="lm-over">Var man landat</div>`
      + `<div class="lm-period${hovAr != null ? " hov" : ""}">${rubrik}</div>`
      + `<div class="lm-enh" title="${enh}${andelEnh}">${enh}${andelEnh}${framtid && till >= framtid.fran ? ` · prognos från ${framtid.fran}` : ""}</div>`;
    html += `<div class="lm-g lm-thead" style="grid-template-columns:${mall}"><span class="lm-th" style="text-align:left">${A ? `Under namnet: ${A.nVar ? "folkökningen" : "summan"}` : n > 1 ? "Klicka för att sortera" : ""}</span>`
      + synliga.map(v => `<button type="button" class="lm-th k${v.id === sv?.id ? " pa" : ""}" data-v="${v.id}" title="Sortera efter ${v.etikett.toLowerCase()}"><i style="background:${n === 1 ? ink.stark : v.farg}"></i><span>${v.id === sv?.id && n > 1 ? "▾ " : ""}${rubrikHtml(v.kort)}</span></button>`).join("")
      + tabellExtra.map(t => `<span class="lm-th" title="${t.titel ?? ""}">${t.etikett}</span>`).join("")
      + `</div><div class="lm-rader">`;
    const kanForstora = kod => PANELER.some(p => p.kod === kod) && PANELER.length > 1;
    for (const { E, V, An } of alla) {
      const u = E.summa || E.rike;
      const kl = `lm-g lm-r${u ? " under" : ""}${A ? " tat" : ""}${fokus === E.kod ? " fokus" : ""}${forstorad === E.kod ? " vald" : ""}${kanForstora(E.kod) ? " kan" : ""}`;
      html += `<div class="${kl}" data-kod="${E.kod}" style="grid-template-columns:${mall};--f:${E.farg}"${kanForstora(E.kod) ? ` title="${forstorad === E.kod ? "Visa alla paneler" : `Förstora ${E.namn}`}"` : ""}>`
        + `<span class="lm-namn" title="${E.namn}"><i style="background:${E.farg}"></i>${E.namn}</span>`
        + synliga.map(v => {
          const r = V.get(v.id) ?? {};
          const fot = hovAr == null && r.b != null && r.b > fran && (tidEff !== "arsvarde" || v.typ === "flode") ? `<small>från ${v.typ === "flode" ? r.b + 1 : r.b}</small>` : "";
          return `<span class="lm-v${v.id === sv?.id ? " pa" : ""}">${fmt(v, r.v, { kort: true })}${fot}</span>`;
        }).join("")
        + tabellExtra.map(t => { let s = ""; try { s = t.varde(E, periodObj, E.rader) ?? ""; } catch (e) { s = "–"; } return `<span class="lm-v">${s}</span>`; }).join("");
      if (A && An) {
        // Rad 2: förändringen under namnet, andelen under varje del
        const nv = A.nVar ?? A.komp[0];
        // Under namnet: förändringen (vad talet är står i kolumnrubriken)
        html += `<span class="lm-tot" title="${A.nVar ? "Folkökning" : "Summan av de valda delarna"} ${A.start}–${A.slut}">${fmt(nv, An.netto, { kort: true })}</span>`
          + synliga.map(v => {
            const d = An.delar.find(q => q.v === v);
            if (!d || An.nara || !ok(d.p)) return `<span class="lm-andel"></span>`;
            return `<span class="lm-andel" style="color:${v.farg}">${tal(d.p, 0, false)} %</span>`;
          }).join("")
          + tabellExtra.map(() => "<span></span>").join("");
        if (iBar({ E }) && ok(An.netto)) {
          const z = pos(0);
          let p0 = 0, n0 = 0, seg = "";
          for (const d of An.delar) {
            if (!ok(d.y) || d.y === 0) continue;
            const a = d.y > 0 ? p0 : n0 + d.y, b = d.y > 0 ? p0 + d.y : n0;
            if (d.y > 0) p0 += d.y; else n0 += d.y;
            seg += `<span class="seg" style="left:${pos(a)}%;width:${Math.max(0.6, pos(b) - pos(a))}%;background:${d.v.farg};opacity:${u ? 0.8 : 1}" title="${d.v.etikett} ${fmt(d.v, d.y, { kort: true })}"></span>`;
          }
          html += `<div class="lm-stapel"><span class="sp"></span><span class="noll" style="left:${z}%"></span>${seg}<span class="nt" style="left:${pos(An.netto)}%" title="${A.nVar ? "Folkökning" : "Summa"} ${fmt(nv, An.netto, { kort: true })}"></span></div>`;
        }
        if (An.nara && ok(An.netto)) {
          html += `<span class="lm-nara">Förändringen är liten jämfört med delarna, så andelar säger lite: se antalen.</span>`;
        }
      } else {
        const y = sv ? V.get(sv.id)?.v : NaN;
        if (sv && iBar({ E }) && ok(y)) {
          const z = pos(ref < lo ? lo : ref), p = pos(y);
          html += `<div class="lm-bar"><span class="sp"></span><span class="noll" style="left:${z}%"></span><span class="st" style="left:${Math.min(z, p)}%;width:${Math.max(0.8, Math.abs(p - z))}%;background:${E.farg};opacity:${u ? 0.75 : 1}"></span></div>`;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;
    const noter = [];
    if (A) {
      noter.push(`Andel = delens summa / ${nNamn}. Över 100 %: andra delar drog åt motsatt håll. Strecket i stapeln = ${A.nVar ? "folkökningen" : "summan"}.`);
      if (A.nVar) {
        // Summerar de valda delarna till nämnaren? Annars: resten är justeringar och delar som inte visas
        const rest = alla.some(({ An }) => An && !An.nara && Math.abs(100 - An.delar.reduce((s, d) => s + (ok(d.p) ? d.p : 0), 0)) >= 0.5);
        if (rest) noter.push("Resten är justeringar och delar som inte visas.");
      }
    } else if (tidEff === "ack" && synliga.some(v => v.typ === "flode")) noter.push(`Flöden summeras åren efter ${fran}, så att summan motsvarar förändringen sedan ${fran}.`);
    if (!medUnder && under.length) noter.push(`Staplar för de fem; ${under.map(E => E.summa ? "summan" : E.namn.toLowerCase()).join(" och ")} i Antal står utan stapel.`);
    if (noter.length) html += `<div class="lm-not">${noter.join(" ")}</div>`;
    tabInnehall.innerHTML = html;
    tab.querySelectorAll("button.lm-th").forEach(b => b.addEventListener("click", () => { sortId = b.dataset.v; ritaTabell(); }));
    tab.querySelectorAll(".lm-r").forEach(r => {
      const k = r.dataset.kod;
      r.addEventListener("mouseenter", () => { if (PANELER.some(p => p.kod === k)) satFokus(k); });
      r.addEventListener("mouseleave", () => satFokus(null));
      if (kanForstora(k)) r.addEventListener("click", ev => { ev.stopPropagation(); vaxla(k); });
    });
  }

  ritaAllt();

  // ── Styrning ──────────────────────────────────────────────────────────────
  rot.satt = ({ variabler: v, skala: s, tid: t, yskala: y, period: p } = {}) => {
    if (v) { valda = v.filter(id => varMap.has(id)); kryssEl?.satt(valda, { tyst: true }); }
    if (s) onskadSkala = s;
    if (t) onskadTid = t;
    if (y) { yskala = y; segY?.satt(y, { tyst: true }); }
    if (p) {
      avbrytSpel({ aterstall: false });
      const q = Array.isArray(p) ? { fran: p[0], till: p[1] } : p;
      fran = Math.max(AR0, Math.min(AR1 - 1, q.fran ?? fran)); till = Math.min(AR1, Math.max(fran + 1, q.till ?? till));
      arEl?.satt(fran, till, { tyst: true });
    }
    ritaAllt();
  };
  rot.tillstand = () => ({ variabler: [...valda], skala: skalaEff, tid: tidEff, yskala, period: { fran, till }, spelar: !!spelTimer, forstorad });
  rot.spela = () => spela();
  rot.pausa = () => { if (spelTimer) pausa(); };
  rot.forstora = kod => vaxla(kod == null ? null : String(kod));
  return rot;
}
