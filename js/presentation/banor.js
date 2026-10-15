// =============================================================================
// BANOR — Sveriges kommuner i befolkning och jobb, jämförda med riket
// =============================================================================
//
//   banor(data, {
//     lage: "spridning",                // "spridning" (x = befolkning, y = jobb, banor) | "linje"
//     matt: "y",                        // linjeläget: måttet linjerna visar — "y" (jobb) | "x" (invånare)
//     visning: { skala: "relativ", tid: "ack" },
//                                       // linjeläget, startläge: skala "faktisk" | "relativ",
//                                       //   tid "ack" (sedan periodens första år) | "arlig" (mot året innan)
//     utsnitt: "riket",                 // startläge för vad grafen visar: "riket" (linjeläget, förval:
//                                       //   bara rikslinjen) | "hela" (alla kommuner, förval i
//                                       //   spridningsläget) | "urval" (ramen kring urvalet)
//     startAr, slutAr,                 // perioden vid start (förval: första–sista året med data)
//     x: "bef", y: "jobb", tid: "ar", id: "kod", namn: "namn",
//     referens: { kod: "0000", namn: "Riket" },
//     raknare: { y: "syss_dag", x: "folkmangd", yNamn: "Jobb", xNamn: "Invånare" },
//     forval: [{ namn: "3KHV-städerna", kort?, koder: [...], namnPa?: { kod: "Namn" },
//                uppdelad?: true }],    // uppdelad: snabbvalet lägger varje kommun som egen jämförelse
//     fargPa: { kod: "#00664D" },       // fasta färger för enskilda kommuner (när färgen är ledig)
//     grupperingar: [{ namn: "Län", kort?, nyckel: infoRad => värde }],
//     info: [...],                      // en rad per enhet (nyckel `id`)
//     region: { namn, plural, bestamd, nyckel },   // faktakortets jämförelse mot t.ex. länet
//     kallFalt: "kalla",                // källbyten i referensserien markeras på tidslinjen
//     brott: [{ ar, etikett, kort? }],  // eller uttryckliga brott (ersätter kallFalt)
//     underrubrik, kalla, xEtikett, yEtikett
//   }) → DOM-nod
//
// Faserna är borttagna (2026-10-15). `faser` och `steg` ignoreras.
//
// Element och lugnregler: presentationer/dragning_3khv/VERKTYG.md. Kort:
//   • Bara datan rör sig. DOM byggs när urvalet ändras; därefter byts bara text.
//   • Perioden väljs med två handtag på tidslinjen (från–till). Från-året är
//     basåret: index och förändringar räknas mot det. Till-handtaget är året som
//     visas. ▶ spelar perioden från första till sista året.
//   • Spridningsläget: index ur råtalen mot basåret, axlarna i ackumulerad
//     förändring. Basbyten glider över på 380 ms. Robust omfång (1–99:e
//     percentilen) över periodens år; axlarna står still under uppspelning.
//   • Linjeläget: år på x, ett mått på y, alla enheter som tunna grå linjer,
//     riket och valda grupper i färg med en etikettkolumn till höger
//     (etiketter.js: högst värde överst, klammer vid överlapp). Faktiska tal för
//     riket och grupper med flera kommuner är snitt per kommun — annars hamnar
//     de utanför skalan. Hörnräknaren är tvådelad: växer / minskar.
//     Utsnittet Riket | Hela Sverige | Urval: Riket (startläget) visar bara
//     rikslinjen, i faktiska tal rikets egen nivå. Väljs en grupp i Riket byts
//     läget till Urval; tas urvalet bort igen går det tillbaka till Riket.
//     Klick på Riket tar bort urvalet och markeringen.
//     Årsstrecket följer pekaren och snäpper till närmaste år; tipset listar
//     de färgade linjernas värden det året (sorterade), och en grå linje nära
//     pekaren läggs till i samma tips.
//     Prestanda (rev1): de grå kommunlinjerna ritas på en canvas under SVG:n
//     och bara när geometri eller opacitet ändras; linjelägets värden cachas
//     per serie och visning; hovring ritar bara hovringslagret; drag i
//     tidslinjen tas en gång per bildruta.
//   • Detaljvyn i panelen listar en grupps eller ett hörns kommuner i fast
//     ordning (periodens slutår). Hörnlistan är en ögonblicksbild av året.
//   • Klick på en rad i detaljvyn öppnar faktakortet (nyckeltal, slutsats mot
//     riket och regionen, perioden, år för år) över grafen; hovring lyfter bara.
//
// Styrning: nod.period(fran, till), nod.ar(år) (= till-året), nod.spela(fran?, till?),
//           nod.visning({ skala, tid }), nod.utsnitt("riket" | "hela" | "urval"),
//           nod.lagg(namn, { banor }), nod.rensa(),
//           nod.startaOm(), nod.markera(kod), nod.snap()
// =============================================================================

import { d3 } from "../lib/d3.js";
import { tema as hamtaTema, aktivtTema, ytaStil } from "../lib/tema.js";
import { placeraEtiketter, ritaEtiketter } from "./etiketter.js";

// Region Hallands primärfärger (grafisk profil). Ordningen är också de fem
// kommunernas i jamforelse.js: Halmstad Grön 1, Kalmar Röd 2, Karlskrona Blå 2,
// Kristianstad Röd 1, Växjö Blå 1. Grön 1 och Röd 1 är båda mörka — de skiljs åt
// för färgblinda genom namnen vid punkterna, inte genom färgen.
export const BANFARGER = {
  ljus: ["#00664D", "#FF5F4A", "#2DB8F6", "#A51300", "#004990"],
  mork: ["#00AB60", "#FF5F4A", "#2DB8F6", "#FFBFC1", "#A2D9F8"]
};

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const OVERGANG_MS = 380;
const TICKSTEG = [1, 2, 5, 10, 20, 25, 50];
const HORN_PIL = { hh: "↗", vh: "↖", hl: "↘", vl: "↙", upp: "▲", ned: "▼" };
const MAX_MEDETIKETTER = 10;   // fler kommunbanor än så får inga namn vid spetsen
const R_MAX = 17;              // radie för den folkrikaste enheten (ytan ∝ invånare)
const R_MIN = 1.6;             // minsta radie — de minsta kommunerna ska synas
const UPP = "#00AB60", NED = "#A51300";   // Grön 2 / Röd 1
const ET_AVST = 13;            // radavstånd i linjelägets etikettkolumn

export function banor(data, opts = {}) {
  const {
    width = 1010, height = 590,
    temaNamn = aktivtTema(),
    lage = "spridning", matt = "y", visning = {}, utsnitt: utsnittOpt = null,
    x = "bef", y = "jobb", tid = "ar", id = "kod", namn = "namn",
    referens = { kod: "0000", namn: "Riket" },
    bas = 100,
    raknare = { y: "syss_dag", x: "folkmangd", yNamn: "Jobb", xNamn: "Invånare" },
    forval = [], grupperingar = [], info = null,
    kallFalt = "kalla", brott = null,
    fargPa = null,
    storlek = "invanare",             // punktstorlek: "invanare" (yta ∝ råtalet för x) eller "lika"
    hornGruppering = null,            // vilken gruppering hörnen bryts ned på (förval: den som heter …grupp)
    region = null,                    // { namn, plural, bestamd, nyckel: infoRad => region } — faktakortet jämför mot den
    startAr = null, slutAr = null, period: periodOpt = null,
    msPerAr = 300,
    underrubrik = null, kalla = null,
    xEtikett = "Befolkning", yEtikett = "Jobb",
    hornText = {
      hh: "fler invånare, fler jobb", vh: "färre invånare, fler jobb",
      hl: "fler invånare, färre jobb", vl: "färre invånare, färre jobb"
    },
    hornKort = { hh: "Fler av båda", vh: "Fler jobb, färre inv.", hl: "Fler inv., färre jobb", vl: "Färre av båda" },
    enhetOrd = ["kommun", "kommuner"],
    bestamd = { y: "jobben", x: "invånarna" },
    panelBredd = 268,
    // Nivåläge (bara spridning): värdena är kvoter (t.ex. andel av länet) i
    // stället för index. Täljare och nämnare summeras var för sig i grupper.
    // { x: [täljare, nämnare], y: [...], skala }
    kvot = null,
    nivaFormat = null,                // v => text för nivåer (förval "48,4 %")
    forandFormat = null,              // v => text för förändringar (förval "+3,1 p.e.")
    kors = null,                      // { x, y } — hårkors i nivåläget (index: alltid vid bas)
    diagonal = false,                 // linjen y = x (meningsfull när axlarna mäter samma sak)
    storlekFalt = null,               // fält för punktens yta (förval: x-räknaren / x-täljaren)
    faktakort = true,                 // faktakortet (stängs alltid av i nivåläget)
    axelFormat = null,                // v => text på axlarna i nivåläget (förval "60 %")
    storlekNamn = null                // knappen för punktstorlek (förval x-räknarens namn)
  } = opts;
  const LINJE = lage === "linje";
  const NIVA = !!kvot && !LINJE, FAKTA = faktakort && !NIVA, SKALA = kvot?.skala ?? 100;
  const MK = matt === "x" ? "X" : "Y";                       // linjelägets mått
  const MNAMN = MK === "X" ? raknare.xNamn : raknare.yNamn;
  const MORD = MNAMN.toLowerCase(), MBEST = MK === "X" ? bestamd.x : bestamd.y;
  const MATT = LINJE ? [MK] : ["Y", "X"];                    // måtten som panel och faktakort visar
  const mNamn = k => (k === "Y" ? raknare.yNamn : raknare.xNamn);
  const mBest = k => (k === "Y" ? bestamd.y : bestamd.x);

  const T = hamtaTema(temaNamn);
  const ink = T.ink;
  const farger = T.mork ? BANFARGER.mork : BANFARGER.ljus;
  const halo = T.yta.bakgrund && T.yta.bakgrund !== "transparent" ? T.yta.bakgrund : ink.yta;
  const botten = T.mork ? "#16211D" : "#FFFFFF";
  const tonad = T.mork ? "rgba(255,255,255,.05)" : "rgba(10,20,15,.04)";
  const MAX = farger.length;

  // ── Data ──────────────────────────────────────────────────────────────────
  // Index räknas ur råtalen, så att basåret kan flyttas. Saknade värden (null)
  // blir NaN — ett mått kan sakna sista året (jobben 2025).
  const num = v => (v == null || v === "" ? NaN : +v);
  const serier = d3.group(data, d => d[id]);
  for (const s of serier.values()) s.sort((a, b) => a[tid] - b[tid]);
  const [AR0, ARD] = d3.extent(data, d => d[tid]);
  const N = ARD - AR0 + 1;
  const harFalt = f => f != null && data.some(d => d[f] != null);
  const fx = harFalt(raknare.x) ? raknare.x : x;
  const fy = harFalt(raknare.y) ? raknare.y : y;
  const yOrd = raknare.yNamn.toLowerCase(), xOrd = raknare.xNamn.toLowerCase();
  const sf = storlekFalt ?? (NIVA ? kvot.x[0] : fx);
  function serieAv(kod, rader) {
    const X = new Float64Array(N).fill(NaN), Y = new Float64Array(N).fill(NaN), S = new Float64Array(N).fill(NaN);
    if (!NIVA) {
      for (const r of rader) { const i = r[tid] - AR0; X[i] = num(r[fx]); Y[i] = num(r[fy]); S[i] = num(r[sf]); }
      return { kod, namn: rader[0][namn], X, Y, S, n: 1 };
    }
    const XT = new Float64Array(N), XN = new Float64Array(N), YT = new Float64Array(N), YN = new Float64Array(N);
    for (const r of rader) {
      const i = r[tid] - AR0;
      XT[i] = num(r[kvot.x[0]]); XN[i] = num(r[kvot.x[1]]); YT[i] = num(r[kvot.y[0]]); YN[i] = num(r[kvot.y[1]]); S[i] = num(r[sf]);
      X[i] = SKALA * XT[i] / XN[i]; Y[i] = SKALA * YT[i] / YN[i];
    }
    return { kod, namn: rader[0][namn], X, Y, S, XT, XN, YT, YN, n: 1 };
  }
  const refKod = referens && serier.has(referens.kod) ? referens.kod : null;
  const enheter = [...serier.entries()].filter(([k]) => k !== refKod).map(([k, s]) => serieAv(k, s));
  // Riket: n = antal enheter, så att faktiska tal i linjeläget blir snitt per kommun
  const ref = refKod ? { ...serieAv(refKod, serier.get(refKod)), namn: referens.namn ?? serier.get(refKod)[0][namn], n: enheter.length } : null;
  const enhetMap = new Map(enheter.map(e => [e.kod, e]));
  const infoMap = new Map((info ?? []).map(d => [d[id] ?? d.kod, d]));
  // Sista året med värde: referensseriens (annars första enhetens) per mått
  const sistaAr = k => { const s = ref ?? enheter[0]; let a = AR0; for (let i = 0; i < N; i++) if (Number.isFinite(s[k][i])) a = AR0 + i; return a; };
  const AR1 = LINJE ? sistaAr(MK) : Math.min(sistaAr("X"), sistaAr("Y"));
  const NI = AR1 - AR0 + 1;
  const lerp = (a, b, t) => a + (b - a) * t;
  const kl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ai = a => kl(Math.round(a) - AR0, 0, NI - 1);
  const ok = Number.isFinite;
  const iv = (V, a) => { const i = kl(Math.floor(a - AR0), 0, NI - 2), f = kl(a - AR0 - i, 0, 1); return lerp(V[i], V[i + 1], f); };
  const varde = (s, a) => [iv(s.X, a), iv(s.Y, a)];
  // Index mot basåret b — eller, i nivåläget, själva nivån (b påverkar bara var banan börjar)
  const idx = (s, a, b) => { const v = varde(s, a); if (NIVA) return v; const j = ai(b); return [bas * v[0] / s.X[j], bas * v[1] / s.Y[j]]; };
  const storlekVid = (s, a) => iv(s.S, a);
  // Banan från basåret b till år a (a får vara ett bråkår), utan övergång
  function banaB(s, a, b) {
    const ut = [idx(s, b, b)];
    for (let k = b + 1; k < a - 1e-9; k++) ut.push(idx(s, k, b));
    if (a > b + 1e-9) ut.push(idx(s, a, b));
    return ut;
  }
  const aggCache = new Map();
  function aggregat(lista) {
    const nyckel = lista.map(e => e.kod).sort().join(",");
    if (!aggCache.has(nyckel)) {
      const X = new Float64Array(N), Y = new Float64Array(N), S = new Float64Array(N);
      if (!NIVA) {
        for (const e of lista) for (let i = 0; i < N; i++) { X[i] += e.X[i]; Y[i] += e.Y[i]; S[i] += e.S[i]; }
        aggCache.set(nyckel, { kod: `Σ${nyckel}`, X, Y, S, n: lista.length });
      } else {
        // Gruppens kvot = summan av täljarna / summan av nämnarna
        const XT = new Float64Array(N), XN = new Float64Array(N), YT = new Float64Array(N), YN = new Float64Array(N);
        for (const e of lista) for (let i = 0; i < N; i++) { XT[i] += e.XT[i]; XN[i] += e.XN[i]; YT[i] += e.YT[i]; YN[i] += e.YN[i]; S[i] += e.S[i]; }
        for (let i = 0; i < N; i++) { X[i] = SKALA * XT[i] / XN[i]; Y[i] = SKALA * YT[i] / YN[i]; }
        aggCache.set(nyckel, { kod: `Σ${nyckel}`, X, Y, S, XT, XN, YT, YN, n: lista.length });
      }
    }
    return aggCache.get(nyckel);
  }
  const serieFor = ll => (ll.length > 1 ? aggregat(ll) : ll[0]);
  // Källbyten (t.ex. RAMS → BAS): ur referensseriens `kallFalt`, eller uttryckliga `brott`
  let kallByten = [];
  if (brott) kallByten = brott.map(b => ({ ar: b.ar, fran: b.fran ?? "", till: b.till ?? "", etikett: b.etikett, kort: b.kort }));
  else if (kallFalt) {
    const kallRader = serier.get(refKod) ?? [...serier.values()][0];
    for (let i = 1; i < kallRader.length; i++) {
      const a = kallRader[i - 1][kallFalt], b = kallRader[i][kallFalt];
      if (a && b && a !== b) kallByten.push({ ar: kallRader[i][tid], fran: a, till: b });
    }
  }
  kallByten = kallByten.filter(kb => kb.ar > AR0 && kb.ar <= AR1);
  const kbText = kb => kb.etikett ?? `${kb.fran} → ${kb.till}`;
  const kbKort = kb => kb.kort ?? kb.till ?? "";

  // ── Format (svenska) ──────────────────────────────────────────────────────
  const tal = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
  const tal1 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
  const dec = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dec1 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const tecken = r => (r > 0 ? "+" : r < 0 ? "−" : "");
  const pct = (a, b) => 100 * (b / a - 1);
  const talN = v => (ok(v) ? tal.format(v) : "–");
  const procent = v => { if (!ok(v)) return "–"; const r = Math.round(v); return `${tecken(r)}${tal.format(Math.abs(r))} %`; };
  const procent1 = v => { if (!ok(v)) return "–"; const r = Math.round(v * 10) / 10; return `${tecken(r)}${tal1.format(Math.abs(r))} %`; };
  const procentD = v => { if (!ok(v)) return "–"; const r = Math.round(v * 10) / 10; return `${tecken(r)}${dec1.format(Math.abs(r))} %`; };
  const andring = v => {
    if (!ok(v)) return "–";
    const a = Math.abs(v), t = v > 0 ? "+" : v < 0 ? "−" : "";
    return a >= 1e6 ? `${t}${dec.format(a / 1e6)} mn` : `${t}${tal.format(Math.round(a))}`;
  };
  // Genomsnittlig årlig förändring i procent över n år
  const cagr = (a, b, n) => (n > 0 && a > 0 && b > 0 ? 100 * (Math.pow(b / a, 1 / n) - 1) : NaN);
  const versal = s => s[0].toUpperCase() + s.slice(1);
  const periodTxt = a => (a === basAr ? `${a}` : `${basAr}–${a}`);
  const andelD = v => (!ok(v) ? "–" : v < 10 ? dec.format(v) : dec1.format(v));
  // Axlarna visar ackumulerad förändring i procent: index 120 → "+20 %"
  const axPct = v => { const d = Math.round(v - bas); return d === 0 ? "0" : `${d > 0 ? "+" : "−"}${tal.format(Math.abs(d))} %`; };
  const andelFmt = v => (v < 10 ? tal1.format(v) : tal.format(v));
  const antal = n => `${tal.format(n)} ${enhetOrd[n === 1 ? 0 : 1]}`;
  // Förändring: procent i indexläget, procentenheter (eller eget format) i nivåläget
  const nf = nivaFormat ?? (v => `${dec1.format(v)} %`);
  const forand = (a, b) => (NIVA ? b - a : pct(a, b));
  const fF = NIVA ? (forandFormat ?? (v => { const r = Math.round(v * 10) / 10; return `${tecken(r)}${dec1.format(Math.abs(r))} p.e.`; })) : procent;
  const fF1 = NIVA ? fF : procent1;
  const niv = v => (NIVA ? nf(v) : talN(v));                             // nivå i tips och listor
  const fran_ = (a, b) => (NIVA ? `från ${nf(a)}` : andring(b - a));    // underrad: start i nivåläget, antal i index
  const axFmt = NIVA ? (axelFormat ?? (v => `${tal.format(v)} %`)) : axPct;
  const KX = NIVA ? (kors?.x ?? null) : bas, KY = NIVA ? (kors?.y ?? null) : bas;

  // ── Gruppkatalog ──────────────────────────────────────────────────────────
  const katalog = [];
  for (const f of forval) katalog.push({ id: `f:${f.namn}`, namn: f.namn, kort: f.kort, typ: "Förval", koder: f.koder.filter(k => enhetMap.has(k)), namnPa: f.namnPa ?? {}, uppdelad: !!f.uppdelad });
  for (const gr of grupperingar) {
    for (const [v, ll] of d3.groups(enheter, e => gr.nyckel(infoMap.get(e.kod) ?? {})).filter(([v]) => v != null).sort((a, b) => a[0].localeCompare(b[0], "sv"))) {
      katalog.push({ id: `${gr.namn}:${v}`, namn: v, typ: gr.namn, koder: ll.map(e => e.kod) });
    }
  }
  const namnPa = kod => { for (const f of forval) if (f.namnPa?.[kod]) return f.namnPa[kod]; return enhetMap.get(kod)?.namn ?? kod; };
  for (const e of [...enheter].sort((a, b) => a.namn.localeCompare(b.namn, "sv"))) katalog.push({ id: `e:${e.kod}`, namn: namnPa(e.kod), typ: versal(enhetOrd[0]), koder: [e.kod] });
  const katalogMap = new Map(katalog.map(k => [k.id, k]));
  const sokbar = katalog.map(k => ({ k, n: k.namn.toLocaleLowerCase("sv") }));

  // ── Tillstånd ─────────────────────────────────────────────────────────────
  // Perioden: från-året är basåret, till-året det år som visas när tiden står still
  const P0 = (() => {
    const f0 = Array.isArray(periodOpt) ? periodOpt[0] : periodOpt?.fran ?? startAr ?? AR0;
    const t0 = Array.isArray(periodOpt) ? periodOpt[1] : periodOpt?.till ?? slutAr ?? AR1;
    const f = kl(Math.round(f0), AR0, AR1 - 1);
    return { fran: f, till: kl(Math.round(t0), f + 1, AR1) };
  })();
  const VIS0 = { skala: visning.skala === "faktisk" ? "faktisk" : "relativ", tid: visning.tid === "arlig" ? "arlig" : "ack" };
  let per = { ...P0 };
  let vis = { ...VIS0 };
  let ar = per.till;
  let grupper = [];          // { id, namn, typ, koder:Set, lista, farg, serie, banor }
  let forhand = null;        // { koder:Set, namn, serie } — hovring i väljaren
  let hornHov = null, lyftId = null, hov = null, hovA = null, radHov = null, timer = null, startar = null;
  let vy = null;             // detaljvyn: { typ: "grupp", id } | { typ: "horn", h, ar, bas, lista, koder }
  const KOL_K = LINJE ? ["a", "p"] : ["y", "x"];
  let sortering = { k: KOL_K[0], ned: true };
  // Utsnitt: "hela" = alla enheter (robust ram), "urval" = ramen kring urvalet,
  // "riket" (bara linjeläget) = bara rikslinjen, inga enheter
  const UTSNITT0 = LINJE && ref ? (["riket", "hela", "urval"].includes(utsnittOpt) ? utsnittOpt : "riket") : "hela";
  let utsnitt = UTSNITT0;
  let riketRetur = false;    // urvalet valdes i Riket: tillbaka dit när urvalet tas bort
  const riketVy = () => utsnitt === "riket";
  const BANOR0 = LINJE;      // linjeläget: gruppernas kommuner färgas från start
  let kommunbanor = BANOR0;  // nya grupper ritar sina kommuners banor/linjer
  let markerad = null;       // kod för kommunen i förgrunden
  let markAr = null;         // hovrad årsprick på den markerade banan
  let storlekPop = storlek !== "lika";   // punktens yta ∝ invånare
  // Hörnen bryts ned på en gruppering (kommungrupp) — eller listar enheterna (null)
  const hornGr = (hornGruppering ? grupperingar.find(g_ => g_.namn === hornGruppering) : null) ?? grupperingar.find(g_ => /grupp/i.test(g_.namn)) ?? grupperingar[0] ?? null;
  let hornVisa = hornGr?.namn ?? null;
  let drar = null;           // handtaget som dras på tidslinjen (0 = från, 1 = till)
  const helAr = () => Math.round(ar);
  const gruppFor = kod => grupper.find(g_ => g_.koder.has(kod)) ?? null;
  let basAr = per.fran, basFranAr = null, basT0 = 0, bE = 1;

  // Läge under pågående basbyte: glider mellan gamla och nya basårets index.
  // Banans början glider med — svansen dras in eller växer fram.
  function ix(s, a) {
    const p = idx(s, a, basAr);
    if (basFranAr == null) return p;
    const q = idx(s, a, basFranAr);
    return [lerp(q[0], p[0], bE), lerp(q[1], p[1], bE)];
  }
  const banStart = () => (basFranAr == null ? basAr : lerp(basFranAr, basAr, bE));
  function bana(s, a) {
    const s0 = Math.min(a, banStart());
    const ut = [ix(s, s0)];
    for (let k = Math.floor(s0) + 1; k < a - 1e-9; k++) ut.push(ix(s, k));
    if (a > s0 + 1e-9) ut.push(ix(s, a));
    return ut;
  }
  // Linjelägets värde för serien s år a mot basåret b, i aktuell visning.
  // Faktiska tal delas med s.n: snitt per kommun för riket och grupper (utom
  // riket i utsnittet Riket, där rikets egen nivå visas).
  // Helårsvärdena cachas per serie (nyckel: visning, delare och, i
  // ackumulerat läge, basår — årlig förändring beror inte på basåret).
  // Bråkår interpoleras linjärt mellan helåren, vilket ger samma värden som
  // att interpolera råtalen (förändringen är linjär i råtalet).
  const delare = s => (s === ref && riketVy() ? 1 : s.n ?? 1);
  function lvAr(s, b) {
    const n = delare(s), ack = vis.tid === "ack", rel = vis.skala === "relativ";
    const nyckel = `${ack ? ai(b) : ""}|${vis.skala}|${vis.tid}|${n}`;
    const c = s.__lv;
    if (c && c.nyckel === nyckel) return c.L;
    const V = s[MK], L = new Float64Array(NI).fill(NaN);
    if (ack) { const v0 = V[ai(b)]; for (let i = 0; i < NI; i++) L[i] = rel ? 100 * (V[i] / v0 - 1) : (V[i] - v0) / n; }
    else for (let i = 1; i < NI; i++) L[i] = rel ? 100 * (V[i] / V[i - 1] - 1) : (V[i] - V[i - 1]) / n;
    s.__lv = { nyckel, L };
    return L;
  }
  function lv(s, a, b) {
    const L = lvAr(s, b), x = a - AR0;
    if (vis.tid === "ack" && x >= NI - 1) return L[NI - 1];
    const i0 = Math.floor(x + 1e-9), t = x - i0;
    if (i0 < 0 || i0 > NI - 1) return NaN;
    return t < 1e-9 ? L[i0] : lerp(L[i0], i0 + 1 < NI ? L[i0 + 1] : NaN, t);
  }
  const linjeStart = b => (vis.tid === "ack" ? b : b + 1);
  const markEnhet = () => (markerad ? enhetMap.get(markerad) ?? null : null);
  const fargFor = kod => grupper.find(q => q.id === `e:${kod}`)?.farg ?? gruppFor(kod)?.farg ?? ink.stark;

  // Tabellkolumnerna: spridning = förändring i y och x (procent, antal under);
  // linje = måttets förändring i antal (nivån under) och procent (per år under)
  const KOL = LINJE ? [
    { k: "a", namn: "Antal", titel: `förändringen i antal ${MORD}`,
      v: (s, ia, ib) => andring(s[MK][ia] - s[MK][ib]), u: (s, ia) => talN(s[MK][ia]), sort: (s, is, ib) => s[MK][is] - s[MK][ib] },
    { k: "p", namn: "Procent", titel: `förändringen i procent`,
      v: (s, ia, ib) => procent1(pct(s[MK][ib], s[MK][ia])), u: (s, ia, ib) => (ia > ib ? `${procentD(cagr(s[MK][ib], s[MK][ia], ia - ib))}/år` : ""), sort: (s, is, ib) => s[MK][is] / s[MK][ib] }
  ] : ["Y", "X"].map(K => ({
    k: K.toLowerCase(), namn: mNamn(K), titel: `förändringen i ${mNamn(K).toLowerCase()}`,
    v: (s, ia, ib) => (NIVA ? niv(s[K][ia]) : procent(pct(s[K][ib], s[K][ia]))),
    u: (s, ia, ib) => (NIVA ? fF(forand(s[K][ib], s[K][ia])) : andring(s[K][ia] - s[K][ib])),
    sort: (s, is, ib) => s[K][is] / s[K][ib]
  }));

  // ── DOM ───────────────────────────────────────────────────────────────────
  const rot = document.createElement("div");
  const k_ = `banor-${Math.random().toString(36).slice(2, 8)}`;
  rot.className = `graf-container banor ${k_}`;
  Object.entries(ytaStil(temaNamn)).forEach(([k, v]) => rot.style.setProperty(k, v));
  Object.assign(rot.style, {
    width: `${width}px`, maxWidth: "100%", position: "relative", background: "var(--graf-bakgrund)",
    color: ink.stark, fontFamily: "var(--graf-text-font)", boxSizing: "border-box",
    fontSize: "12px", lineHeight: "1.35", textAlign: "left", userSelect: "none"
  });
  const stil = document.createElement("style");
  stil.textContent = `
    .${k_} button { font-family:var(--graf-text-font); }
    .${k_} .chip { border:1px solid ${ink.rutnat}; background:transparent; color:${ink.mjuk}; font-size:11.5px; padding:3px 9px; border-radius:999px; cursor:pointer; white-space:nowrap; }
    .${k_} .chip:hover, .${k_} .chip.pa { border-color:${ink.linje}; color:${ink.stark}; background:${tonad}; }
    .${k_} .chip.liten { font-size:10.5px; padding:2px 8px; }
    .${k_} .chip.av { opacity:.35; pointer-events:none; }
    .${k_} .pil { border:0; background:transparent; color:${ink.mjuk}; cursor:pointer; font-size:16px; line-height:1; padding:1px 5px 3px; border-radius:4px; }
    .${k_} .pil:hover { color:${ink.stark}; background:${tonad}; }
    .${k_} .pil:disabled { opacity:.25; cursor:default; background:transparent; }
    .${k_} .sok { flex:1 1 70px; min-width:0; box-sizing:border-box; border:1px solid ${ink.rutnat}; border-radius:999px; background:transparent; color:${ink.stark}; font:11.5px var(--graf-text-font); padding:3px 10px; outline:none; }
    .${k_} .sok:focus { border-color:${ink.mjuk}; }
    .${k_} .par { display:inline-flex; border:1px solid ${ink.rutnat}; border-radius:999px; padding:1px; gap:1px; }
    .${k_} .par button { border:0; background:transparent; color:${ink.mjuk}; font-size:10.5px; padding:2px 9px; border-radius:999px; cursor:pointer; white-space:nowrap; }
    .${k_} .par button:hover { color:${ink.stark}; }
    .${k_} .par button.pa { background:${T.mork ? "rgba(255,255,255,.13)" : "rgba(10,20,15,.08)"}; color:${ink.stark}; }
    .${k_} .par button.av { opacity:.35; pointer-events:none; }
    .${k_} .par.stor button { font-size:11.5px; padding:3px 11px; }
    .${k_} .par.tat button { padding:2px 6px; }
    .${k_} .sok::placeholder { color:${ink.svag}; }
    .${k_} .lista { position:absolute; left:0; right:0; top:calc(100% + 4px); max-height:290px; overflow:auto; scrollbar-width:thin; background:${botten}; border:1px solid ${ink.rutnat}; border-radius:6px; box-shadow:0 16px 36px -22px rgba(0,0,0,.45); padding:4px; display:none; z-index:9; }
    .${k_} .val { position:relative; display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:5px 8px; border-radius:4px; cursor:pointer; color:${ink.mjuk}; }
    .${k_} .val:hover { background:${tonad}; color:${ink.stark}; }
    .${k_} .val small { color:${ink.svag}; font-size:10px; white-space:nowrap; }
    .${k_} .val.vald small { color:${ink.stark}; }
    .${k_} .rad { display:grid; grid-template-columns:10px minmax(0,1fr) 62px 58px 12px; align-items:center; column-gap:7px; padding:3px 4px; border-radius:5px; }
    .${k_} .rad:hover { background:${tonad}; }
    .${k_} .rad.klick { cursor:pointer; }
    .${k_} .rad.mark { background:${tonad}; box-shadow:inset 2px 0 0 ${ink.mjuk}; }
    .${k_} .rad.klick:hover .namn small { color:${ink.mjuk}; }
    .${k_} .rad.m { grid-template-columns:24px minmax(0,1fr) 56px 56px; padding:3px 4px; cursor:pointer; }
    .${k_} .rad.m .v { font-size:11px; }
    .${k_} .namn { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${ink.stark}; }
    .${k_} .namn small { display:block; color:${ink.svag}; font-size:10px; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .v { text-align:right; font-family:${MONO}; font-variant-numeric:tabular-nums; font-size:11.5px; color:${ink.stark}; white-space:nowrap; line-height:1.2; }
    .${k_} .v small { display:block; font-size:9.5px; color:${ink.svag}; }
    .${k_} .x { border:0; background:transparent; color:${ink.svag}; cursor:pointer; padding:0; font-size:13px; line-height:1; opacity:0; }
    .${k_} .rad:hover .x { opacity:1; } .${k_} .x:hover { color:${ink.stark}; }
    .${k_} .over { font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:${ink.svag}; }
    .${k_} .sort { border:0; background:transparent; padding:0; cursor:pointer; text-align:right; font-family:inherit; font-size:10px; text-transform:none; letter-spacing:0; white-space:nowrap; }
    .${k_} .sort:hover, .${k_} .sort.pa { color:${ink.stark}; }
    .${k_} .horn { cursor:pointer; }
    .${k_} .horn:hover .hb, .${k_} .horn.pa .hb { text-decoration:underline; }
    .${k_} .horn.pa text { fill:${ink.stark}; }
    .${k_} circle.h { cursor:grab; outline:none; }
    .${k_} circle.h:focus { stroke:${ink.mjuk}; stroke-width:2.5; }
    .${k_} .fkort { width:min(600px, calc(100% - 8px)); max-height:calc(100% - 6px); box-sizing:border-box; background:${botten}; border:1px solid ${ink.rutnat}; border-radius:10px; box-shadow:0 24px 48px -24px rgba(0,0,0,.45); padding:14px 18px 12px; display:flex; flex-direction:column; gap:10px; user-select:text; overflow:hidden; }
    .${k_} .fk-under { font-size:10.5px; color:${ink.svag}; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .fk-tal { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; flex:none; }
    .${k_} .fk-ruta { border:1px solid ${ink.rutnat}; border-radius:7px; padding:6px 10px 7px; min-width:0; }
    .${k_} .fk-et, .${k_} .fk-rubrik { font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:${ink.svag}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .fk-v { font-family:${MONO}; font-size:19px; line-height:1.25; color:${ink.stark}; margin-top:2px; white-space:nowrap; }
    .${k_} .fk-u { font-size:10px; color:${ink.svag}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .${k_} .fk-slut { flex:0 1 auto; min-height:0; overflow:auto; scrollbar-width:thin; background:${tonad}; border-radius:7px; padding:8px 12px 7px; font-size:11.5px; line-height:1.45; color:${ink.mjuk}; }
    .${k_} .fk-slut p { margin:0 0 4px; line-height:1.45; font-size:11.5px; }
    .${k_} .fk-slut b { font-weight:600; color:${ink.stark}; }
    .${k_} .fk-etikett { display:inline-block; font-size:10.5px; font-weight:600; padding:1px 9px; border-radius:999px; margin:0 5px 3px 0; border:1px solid currentColor; white-space:nowrap; }
    .${k_} .fk-nere { display:grid; grid-template-columns:272px minmax(0,1fr); gap:18px; flex:none; height:228px; }
    .${k_} .fk-per { display:grid; grid-template-columns:minmax(0,1fr) 84px 84px; column-gap:8px; align-items:baseline; }
    .${k_} .fk-per > * { padding:3px 0; border-top:1px solid ${ink.rutnat}; }
    .${k_} .fk-per > .fk-rubrik { border-top:0; padding-top:0; }
    .${k_} .fk-per > .fk-del { grid-column:1/-1; font-size:10.5px; font-weight:600; color:${ink.stark}; padding-top:6px; }
    .${k_} .fk-fn { font-size:11px; line-height:1.25; color:${ink.mjuk}; }
    .${k_} .fk-fv { text-align:right; font-family:${MONO}; font-size:11px; line-height:1.25; color:${ink.stark}; white-space:nowrap; }
    .${k_} .ftab { border-collapse:collapse; width:100%; font-size:10.5px; margin:0; }
    .${k_} .ftab th { position:sticky; top:0; background:${botten}; font-weight:400; font-size:9.5px; color:${ink.svag}; text-align:right; padding:0 3px 4px; border-bottom:1px solid ${ink.linje}; white-space:nowrap; }
    .${k_} .ftab td { text-align:right; font-family:${MONO}; font-variant-numeric:tabular-nums; padding:1px 3px; color:${ink.mjuk}; white-space:nowrap; border:0; line-height:1.45; font-size:10px; }
    .${k_} .ftab td:first-child, .${k_} .ftab th:first-child { text-align:left; }
    .${k_} .ftab tr.ute td { opacity:.4; }
    .${k_} .ftab tr.hv td { background:${tonad}; color:${ink.stark}; }
    .${k_} .ftab tr.nu td { background:${tonad}; color:${ink.stark}; font-weight:600; }
    .${k_} .tt { display:grid; grid-template-columns:auto auto auto; column-gap:12px; row-gap:1px; align-items:baseline; }
    .${k_} ::-webkit-scrollbar { width:6px; } .${k_} ::-webkit-scrollbar-thumb { background:${ink.rutnat}; border-radius:3px; }
  `;
  rot.appendChild(stil);
  // Rubrikraden: underrubrik och basår till vänster. Till höger: punktstorlek
  // och dess nyckel (spridning) eller visningens segmentväljare (linje)
  const huvud = el("div", { style: `display:flex;align-items:center;gap:10px;height:26px;font-size:14px;color:${ink.mjuk};margin:0 0 2px` });
  const huvudText = el("span", { style: "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" });
  const basEt = el("span", { style: `color:${ink.svag};font-size:12px;margin-left:8px` }, NIVA || LINJE ? "" : `förändring sedan ${basAr}`);
  huvudText.append(document.createTextNode(underrubrik ?? ""), basEt);
  huvud.appendChild(huvudText);
  const storlekRam = el("div", { style: "display:flex;align-items:center;gap:8px;font-size:10.5px" });
  const storlekPar = el("div", { class: "par", title: "Punkternas storlek" });
  const vxLika = el("button", { type: "button", title: "Alla punkter lika stora" }, "Lika");
  const vxPop = el("button", { type: "button", title: `Punktens yta motsvarar antalet ${(storlekNamn ?? raknare.xNamn).toLowerCase()}` }, storlekNamn ?? raknare.xNamn);
  storlekPar.append(vxLika, vxPop);
  const nyckel = el("div", { style: `display:flex;align-items:flex-end;gap:6px;color:${ink.svag};font-family:${MONO};font-size:9.5px;line-height:1` });
  storlekRam.append(el("span", { style: `color:${ink.svag}` }, "Storlek"), storlekPar, nyckel);
  // Linjeläget: faktiska/relativa tal och ackumulerat/årlig förändring
  const visRam = el("div", { style: "display:flex;align-items:center;gap:8px" });
  const skalaPar = el("div", { class: "par stor", role: "radiogroup", "aria-label": "Faktiska eller relativa tal" });
  const vxFakt = el("button", { type: "button", "data-v": "faktisk", title: `Förändringen i antal ${MORD}. Med ${enhetOrd[1]} i bilden visas riket och grupper med flera ${enhetOrd[1]} som snitt per ${enhetOrd[0]}; i utsnittet Riket rikets egen nivå.` }, "Faktiska tal");
  const vxRel = el("button", { type: "button", "data-v": "relativ", title: "Förändringen i procent" }, "Relativa tal");
  skalaPar.append(vxFakt, vxRel);
  const tidPar = el("div", { class: "par stor", role: "radiogroup", "aria-label": "Ackumulerat eller årlig förändring" });
  const vxAck = el("button", { type: "button", "data-v": "ack", title: "Förändringen sedan periodens första år" }, "Ackumulerat");
  const vxArl = el("button", { type: "button", "data-v": "arlig", title: "Förändringen från föregående år" }, "Årlig förändring");
  tidPar.append(vxAck, vxArl);
  visRam.append(skalaPar, tidPar);
  huvud.appendChild(LINJE ? visRam : storlekRam);
  rot.appendChild(huvud);

  const kallaH = kalla ? 30 : 0, GAP = 18;
  const W = width - panelBredd - GAP, H = Math.max(260, height - 28 - kallaH);
  const M = LINJE ? { top: 30, right: 150, bottom: 28, left: 58 } : { top: 28, right: 92, bottom: 46, left: 62 };
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const rad = el("div", { style: `display:flex;gap:${GAP}px;height:${H}px` });
  const kol = el("div", { style: `flex:${W} 1 0;min-width:0;position:relative` });
  const panel = el("div", { style: `flex:${panelBredd} 1 0;min-width:0;display:flex;flex-direction:column;gap:10px;position:relative` });
  rad.append(kol, panel);
  rot.appendChild(rad);
  if (kalla) rot.appendChild(el("div", { style: `font-size:10.5px;line-height:1.45;color:${ink.svag};margin-top:4px` }, kalla));
  const tips = el("div", { style: `position:absolute;left:0;top:0;pointer-events:none;opacity:0;transition:opacity .1s;background:${botten};border:1px solid ${ink.rutnat};box-shadow:0 10px 28px -14px rgba(0,0,0,.4);border-radius:6px;padding:9px 11px;color:${ink.stark};white-space:nowrap;z-index:10;min-width:210px` });
  rot.appendChild(tips);
  // Knappar ska inte behålla fokus — mellanslag skulle annars både klicka och bläddra
  rot.addEventListener("click", ev => { const b = ev.target.closest?.("button"); if (b) b.blur(); });

  const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("role", "img")
    .attr("aria-label", underrubrik ?? "").style("display", "block").style("overflow", "visible")
    .style("font-family", "var(--graf-text-font)").style("text-rendering", "geometricPrecision");
  kol.appendChild(svg.node());
  // Linjeläget: de grå kommunlinjerna på en canvas under SVG:n (en canvas med
  // 283 streck är mycket billigare att rita om än 283 SVG-banor). Canvasen
  // täcker ritytan plus klippkanten och har bildpunkter efter skärmens skala.
  const duk = LINJE ? document.createElement("canvas") : null;
  const dukCtx = duk?.getContext("2d") ?? null;
  let dukS = 0, dukK = 1, dukNyckel = null;
  if (duk) {
    Object.assign(duk.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", display: "block" });
    kol.insertBefore(duk, svg.node());
    svg.style("position", "relative");     // SVG:n ovanpå canvasen
  }
  function matDuk() {
    if (!duk) return false;
    const bw = kol.clientWidth;
    if (!bw) return false;
    const s = bw / W, r = kol.getBoundingClientRect();
    // Högst 2 bildpunkter per enhet: tunna, svaga linjer blir inte skarpare av
    // mer, men rastreringen blir dyrare (kvadratiskt i skalan)
    const k = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * (r.width / bw || 1)));
    const pw = Math.round((iw + 2) * s * k), ph = Math.round((ih + 2) * s * k);
    if (s !== dukS || k !== dukK || duk.width !== pw || duk.height !== ph) {
      duk.width = pw; duk.height = ph;
      Object.assign(duk.style, { left: `${(M.left - 1) * s}px`, top: `${(M.top - 1) * s}px`, width: `${(iw + 2) * s}px`, height: `${(ih + 2) * s}px` });
      dukS = s; dukK = k; dukNyckel = null;
    }
    return true;
  }
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  // Linjeläget klipper exakt vid ritytan (linjer utanför skalan försvinner vid kanten)
  const kant = LINJE ? 1 : 6;
  svg.append("defs").append("clipPath").attr("id", `${k_}-k`).append("rect").attr("x", -kant).attr("y", -kant).attr("width", iw + 2 * kant).attr("height", ih + 2 * kant);
  const lager = n => g.append("g").attr("class", n);
  const klipp = s => s.attr("clip-path", `url(#${k_}-k)`);
  const gRut = lager("rut").attr("shape-rendering", "crispEdges"), gAx = lager("ax");
  const gPkt = klipp(lager("pkt"));
  const gGra = klipp(lager("gra")).attr("pointer-events", "none"), gGraM = klipp(lager("gram")).attr("pointer-events", "none");
  const gMed = klipp(lager("med")).attr("pointer-events", "none");
  // Linjeläget: slutprickarna klipps inte (de ligger på linjeslutet vid ritytans
  // högra kant och skulle annars skäras av); höjden kläms redan till ritytan
  const gBan = klipp(lager("ban")), gSp = LINJE ? lager("sp") : klipp(lager("sp"));
  // Hovrad och markerad kommun ritas ovanpå grupperna — i förgrunden
  const gHovB = klipp(lager("hovb")).attr("pointer-events", "none");
  const gMark = (LINJE ? lager("mark") : klipp(lager("mark"))).attr("pointer-events", "none");
  const gEt = lager("et").attr("pointer-events", "none"), gHorn = lager("hornlager"), gHov = lager("hov").attr("pointer-events", "none");
  // Axeltitlar. Spridning: y lodrätt längs axeln, x centrerat under ticken.
  // Linje: y-titeln vågrätt ovanför axeln (byts med visningen).
  const yTitel = LINJE
    ? gAx.append("text").attr("x", -M.left + 4).attr("y", -15).attr("font-size", 11.5).attr("font-weight", 500).attr("fill", ink.mjuk)
    : gAx.append("text").attr("transform", `translate(${-M.left + 12},0) rotate(-90)`).attr("text-anchor", "end")
      .attr("font-size", 11.5).attr("font-weight", 500).attr("fill", ink.mjuk).text(`${yEtikett} →`);
  if (!LINJE) gAx.append("text").attr("x", iw / 2).attr("y", ih + 36).attr("text-anchor", "middle")
    .attr("font-size", 11.5).attr("font-weight", 500).attr("fill", ink.mjuk).text(`${xEtikett} →`);
  const sx = d3.scaleLinear().range([0, iw]), sy = d3.scaleLinear().range([ih, 0]);
  const linje = d3.line().x(p => sx(p[0])).y(p => sy(p[1]));
  const linjeL = d3.line().defined(p => ok(p[1])).x(p => sx(p[0])).y(p => sy(p[1]));
  // Stora punkter ritas först, så att små ligger ovanpå och går att nå
  const punkter = LINJE ? gPkt.selectAll("circle")
    : gPkt.selectAll("circle").data([...enheter].sort((a, b) => (b.S[NI - 1] || 0) - (a.S[NI - 1] || 0)), d => d.kod).join("circle").attr("r", 2.6).attr("stroke-width", 1);
  const popMax = d3.max(enheter, e => d3.max(e.S)) || 1;
  const rPop = d3.scaleSqrt().domain([0, popMax]).range([0, R_MAX]);
  function malaStorlek() {
    vxLika.classList.toggle("pa", !storlekPop); vxPop.classList.toggle("pa", storlekPop);
    // Nyckeln: tre cirklar i skalans verkliga storlek, avrundade till jämna tal
    const steg_ = [25e3, 1e5, 5e5].filter(v => v <= popMax * 1.05 && rPop(v) >= R_MIN);
    nyckel.replaceChildren(...(storlekPop ? steg_.map(v => {
      const r = rPop(v), s = el("span", { style: "display:flex;align-items:center;gap:3px" });
      const c = d3.create("svg").attr("width", 2 * r + 2).attr("height", 2 * r + 2).style("display", "block");
      c.append("circle").attr("cx", r + 1).attr("cy", r + 1).attr("r", r).attr("fill", ink.svag).attr("fill-opacity", 0.35).attr("stroke", ink.svag).attr("stroke-width", 0.8);
      s.append(c.node(), document.createTextNode(tal.format(v)));
      return s;
    }) : []));
  }
  vxLika.addEventListener("click", () => { if (!storlekPop) return; storlekPop = false; malaStorlek(); rita(); });
  vxPop.addEventListener("click", () => { if (storlekPop) return; storlekPop = true; malaStorlek(); rita(); });
  const hovBana = gHovB.append("path").attr("fill", "none").attr("stroke-width", 1.6).attr("stroke-linejoin", "round").attr("stroke-linecap", "round").attr("opacity", 0);
  const hovRing = gHov.append("circle").attr("r", 6.5).attr("fill", "none").attr("stroke", ink.stark).attr("stroke-width", 1).attr("opacity", 0);
  // Linjeläget: årsstrecket som följer pekaren (snäpper till närmaste år) och
  // dess prickar på de färgade linjerna
  const arStreck = gHov.append("line").attr("y1", 0).attr("y2", ih).attr("stroke", ink.mjuk).attr("stroke-width", 1).attr("stroke-opacity", 0.55).attr("opacity", 0);
  const arPrickar = gHov.append("g");
  let arHov = null, hovMy = 0;     // året under pekaren och pekarens höjd
  let synliga = [];                // de färgade linjerna (fylls i ritaLinjer)

  // Visningen i linjeläget
  function malaVis() {
    for (const b of [vxFakt, vxRel]) b.classList.toggle("pa", b.dataset.v === vis.skala);
    for (const b of [vxAck, vxArl]) b.classList.toggle("pa", b.dataset.v === vis.tid);
  }
  function satVis(o) {
    const nytt = { ...vis, ...o };
    if (nytt.skala === vis.skala && nytt.tid === vis.tid) return;
    vis = nytt; tipsNyckel = null;
    malaVis(); nyttMal(); malaStartaOm(); rita();
  }
  for (const b of [vxFakt, vxRel]) b.addEventListener("click", () => satVis({ skala: b.dataset.v }));
  for (const b of [vxAck, vxArl]) b.addEventListener("click", () => satVis({ tid: b.dataset.v }));

  // ── Panel: tid och period ─────────────────────────────────────────────────
  const tidBlock = el("div", { style: `padding-bottom:9px;border-bottom:1px solid ${ink.rutnat}` });
  const tidTopp = el("div", { style: "display:flex;align-items:center;gap:9px;margin-bottom:4px" });
  const spelaKnapp = el("button", { type: "button", class: "chip", style: "padding:2px 0;width:30px;text-align:center" }, "▶");
  const arText = el("span", { style: `font-family:${MONO};font-size:21px;font-weight:500;letter-spacing:-0.02em;color:${ink.stark};line-height:1.1;white-space:nowrap` });
  const startaOmKnapp = el("button", { type: "button", class: "chip liten", style: "margin-left:auto", title: "Rensa alla val och börja om" }, "↺ Starta om");
  tidTopp.append(spelaKnapp, arText, startaOmKnapp);
  const spar = el("div", { style: "position:relative;height:38px;cursor:pointer;touch-action:none", title: "Dra i handtagen för att välja period: från och till" });
  const perRad = el("div", { style: `display:flex;align-items:center;gap:6px;font-size:10.5px;color:${ink.svag}` });
  const perText = el("span", { style: "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" });
  const helaKnapp = el("button", { type: "button", class: "chip liten", title: `Hela perioden ${AR0}–${AR1}` }, "Hela perioden");
  perRad.append(perText, helaKnapp);
  tidBlock.append(tidTopp, spar, perRad);
  panel.appendChild(tidBlock);
  const sparSvg = d3.select(spar).append("svg").attr("width", "100%").attr("height", 38).style("display", "block").style("overflow", "visible");
  helaKnapp.addEventListener("click", () => { stoppa(); satPeriod(AR0, AR1); });

  // ── Panel: jämför ─────────────────────────────────────────────────────────
  const jamfor = el("div", { style: "display:flex;flex-direction:column;gap:8px;min-height:0;flex:1" });
  // Rad 1: sök + snabbval (listan fälls ut under raden). Rad 2: hur urvalet
  // visas — kommunernas egna banor, och vad axlarna ramar in.
  const valjare = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
  const sokRam = el("div", { style: "position:relative" });
  const chips = el("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:5px" });
  const sok = el("input", { type: "text", class: "sok", placeholder: "⌕ Sök", title: `Sök ${enhetOrd[0]}, län eller grupp`, "aria-label": `Sök ${enhetOrd[0]}, län eller grupp` });
  const lista = el("div", { class: "lista" });
  chips.appendChild(sok);
  sokRam.append(chips, lista);
  const visaRad = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:6px" });
  const banAlla = el("button", { type: "button", class: "chip liten", title: LINJE ? `Färga och namnge varje ${enhetOrd[0]}s linje i gruppens färg, för alla valda grupper` : `Rita varje ${enhetOrd[0]}s egen bana i gruppens färg, för alla valda grupper` }, LINJE ? "≋ Kommunlinjer" : "≋ Kommunbanor");
  const utsnittPar = el("div", { class: LINJE ? "par tat" : "par", title: LINJE ? "Vad grafen visar" : "Vad axlarna ramar in" });
  const rn0 = ref?.namn ?? "Riket";
  const vxRiket = el("button", { type: "button", title: `Bara ${rn0.toLowerCase()}, utan ${enhetOrd[1]}. I faktiska tal ${rn0.toLowerCase()}s egen nivå. Tar bort urvalet.` }, rn0);
  const vxHela = el("button", { type: "button", title: LINJE ? `Alla ${enhetOrd[1]} som grå linjer, axlarna ramar in dem under perioden` : `Axlarna ramar in alla ${enhetOrd[1]} under perioden` }, LINJE ? "Hela Sverige" : "Hela bilden");
  const vxUrval = el("button", { type: "button", title: `Axlarna ramar in de valda grupperna och ${rn0.toLowerCase()}` }, LINJE ? "Urval" : "Urvalet");
  if (LINJE && ref) utsnittPar.append(vxRiket);
  utsnittPar.append(vxHela, vxUrval);
  visaRad.append(banAlla, utsnittPar);
  valjare.append(sokRam, visaRad);
  const snabb = [
    ...forval.map(f => ({ text: f.kort ?? f.namn, k: katalogMap.get(`f:${f.namn}`) })),
    ...grupperingar.map(gr => ({ text: `${gr.kort ?? gr.namn} ▾`, typ: gr.namn }))
  ].map(s => { const b = el("button", { type: "button", class: "chip" }, s.text); chips.appendChild(b); return { ...s, b }; });
  const tabHuvud = el("div", { class: "rad", style: `padding-top:2px;padding-bottom:4px;border-bottom:1px solid ${ink.linje};border-radius:0` });
  const periodEl = el("span", { class: "over" });
  tabHuvud.append(el("span"), periodEl, el("span", { class: "over", style: "text-align:right" }, KOL[0].namn), el("span", { class: "over", style: "text-align:right" }, KOL[1].namn), el("span"));
  const raderEl = el("div", { style: "display:flex;flex-direction:column;gap:1px;min-height:0;overflow:auto;scrollbar-width:thin" });
  const tom = el("div", { style: `font-size:11px;color:${ink.svag};line-height:1.45;padding:6px 4px` });
  const tomText = () => (!LINJE
    ? `Klicka på en punkt för att rita ${enhetOrd[0]}ens bana, eller välj en grupp ovan. ≋ Kommunbanor ritar varje ${enhetOrd[0]}s bana i gruppen. Klicka på ett hörn för att lista dess ${enhetOrd[1]}.`
    : riketVy()
      ? `Välj en grupp ovan för att jämföra med ${rn0.toLowerCase()}, eller Hela Sverige för att se alla ${enhetOrd[1]}. Klicka på växer eller minskar för att lista ${enhetOrd[1]}na.`
      : `Klicka på en linje för att lyfta fram ${enhetOrd[0]}en, eller välj en grupp ovan. ≋ Kommunlinjer färgar gruppens ${enhetOrd[1]}. Klicka på växer eller minskar för att lista ${enhetOrd[1]}na.`);
  jamfor.append(valjare, tabHuvud, raderEl);
  const detalj = el("div", { style: "display:none;flex-direction:column;gap:5px;min-height:0;flex:1" });
  panel.append(jamfor, detalj);

  // ── Hörnen ────────────────────────────────────────────────────────────────
  // Spridning: i marginalens fyra hörn, en rad var. Linje: två räknare ovanför
  // etikettkolumnen — växer och minskar under perioden. Antalet byts bara vid
  // nytt år. Hovra → enheterna markeras och ett tips visar samlad tillväxt,
  // andel av riket och av rikets förändring (koncentration) samt antal per
  // grupp. Klick → enheterna listas i panelen.
  const HORN = LINJE ? ["upp", "ned"] : ["vh", "hh", "vl", "hl"];
  const hornEtikett = h => (LINJE ? (h === "upp" ? "växer" : "minskar") : hornText[h]);
  const hornTitel = h => (LINJE ? `${h === "upp" ? "Fler" : "Färre"} ${MORD}` : versal(hornText[h]));
  const hornNamn = h => (LINJE ? `${h === "upp" ? "Fler" : "Färre"} ${MORD}` : hornKort[h]);
  const hornPos = LINJE ? {
    upp: { x: iw + M.right - 92, y: -15, a: "end" }, ned: { x: iw + M.right - 4, y: -15, a: "end" }
  } : {
    vh: { x: 0, y: -12, a: "start" }, hh: { x: iw, y: -12, a: "end" },
    vl: { x: 0, y: ih + 36, a: "start" }, hl: { x: iw, y: ih + 36, a: "end" }
  };
  const hornG = {};
  for (const h of HORN) {
    const p = hornPos[h];
    const gg = gHorn.append("g").attr("class", "horn").attr("transform", `translate(${p.x},${p.y})`);
    const t = gg.append("text").attr("text-anchor", p.a).attr("font-size", 11).attr("fill", ink.mjuk);
    if (LINJE) t.append("tspan").attr("fill", h === "upp" ? UPP : NED).attr("font-size", 9.5).text(`${HORN_PIL[h]} `);
    const n = t.append("tspan").attr("class", "hb").attr("font-family", MONO).attr("font-weight", 500).attr("fill", ink.stark);
    t.append("tspan").attr("class", "hb").text(` ${hornEtikett(h)}`);
    gg.append("title").text(LINJE ? `${versal(enhetOrd[1])} med ${h === "upp" ? "fler" : "färre"} ${MORD} under perioden. Hovra för detaljer, klicka för att lista dem.` : "");
    gg.on("mouseenter", () => { hornHov = h; rita(); visaHornTips(h); })
      .on("mouseleave", () => { hornHov = null; tips.style.opacity = 0; rita(); })
      .on("click", () => { hornHov = null; tips.style.opacity = 0; oppnaHorn(h); });
    hornG[h] = { n, gg };
  }
  const hornCache = new Map();
  function hornFor(a, b) {
    const nyckel = `${a}|${b}`;
    if (!hornCache.has(nyckel)) {
      const ut = Object.fromEntries(HORN.map(h => [h, []]));
      if (a !== b) for (const e of enheter) {
        if (LINJE) {
          const v0 = e[MK][ai(b)], v1 = e[MK][ai(a)];
          if (!ok(v0) || !ok(v1) || v0 === v1) continue;
          ut[v1 > v0 ? "upp" : "ned"].push(e);
          continue;
        }
        const p = idx(e, a, b);
        const p0 = idx(e, b, b);                             // [bas, bas] i indexläget
        if (!ok(p[0]) || !ok(p[1])) continue;
        if (p[0] === p0[0] && p[1] === p0[1]) continue;      // oförändrad
        ut[(p[0] >= p0[0] ? "h" : "v") + (p[1] >= p0[1] ? "h" : "l")].push(e);
      }
      hornCache.set(nyckel, ut);
    }
    return hornCache.get(nyckel);
  }
  let hornNyckel = null;
  function uppdateraHorn() {
    const a = helAr(), nyckel = `${a}|${basAr}`;
    if (nyckel === hornNyckel) return;
    hornNyckel = nyckel;
    const fh = hornFor(a, basAr);
    for (const h of HORN) hornG[h].n.text(a === basAr ? "  –" : tal.format(fh[h].length).padStart(3, " "));
  }
  // Koncentration: hörnets andel av alla enheter vid basåret och slutåret, och
  // hur stor del av bruttoförändringen hörnet står för — av summan av alla
  // ökningar respektive alla minskningar.
  const bruttoCache = new Map();
  function brutto(ia, ib) {
    const nyckel = `${ia}|${ib}`;
    if (!bruttoCache.has(nyckel)) {
      const ut = { Y: { upp: 0, ned: 0 }, X: { upp: 0, ned: 0 } };
      for (const e of enheter) for (const k of ["Y", "X"]) {
        if (!(e[k][ib] > 0 && e[k][ia] > 0)) continue;
        const d = e[k][ia] - e[k][ib];
        if (d > 0) ut[k].upp += d; else ut[k].ned += d;
      }
      bruttoCache.set(nyckel, ut);
    }
    return bruttoCache.get(nyckel);
  }
  function hornKoncentration(s, ia, ib) {
    const alla = aggregat(enheter), br = brutto(ia, ib);
    const matt_ = MATT.map(k => {
      const a0 = 100 * s[k][ib] / alla[k][ib], a1 = 100 * s[k][ia] / alla[k][ia];
      const dH = s[k][ia] - s[k][ib], gr = dH > 0 ? br[k].upp : br[k].ned;
      const forandring = dH === 0 || !gr ? "–" : `${dec1.format(100 * dH / gr)} % av ${dH > 0 ? "ökningen" : "minskningen"}`;
      return { k, namn_: mNamn(k), ord: mBest(k), a0, a1, forandring, upp: a1 - a0 >= 0.05, ned: a1 - a0 <= -0.05 };
    });
    const utslag = matt_.length === 2
      ? (matt_[0].upp && matt_[1].upp ? `Andelen ökar av både ${matt_[0].ord} och ${matt_[1].ord}: koncentration hit.`
        : matt_[0].ned && matt_[1].ned ? `Andelen minskar av både ${matt_[0].ord} och ${matt_[1].ord}: hörnet tappar mark.`
        : matt_.filter(m => m.upp || m.ned).map(m => `Andelen av ${m.ord} ${m.upp ? "ökar" : "minskar"}`).join(", ") + ".")
      : matt_.filter(m => m.upp || m.ned).map(m => `Andelen av ${m.ord} ${m.upp ? "ökar, koncentration hit" : "minskar"}`).join("") + ".";
    const cell = (t, stil_ = "") => `<span style="font-family:${MONO};text-align:right;${stil_}">${t}</span>`;
    const svag = t => `<span style="color:${ink.svag}">${t}</span>`;
    const ram = kol_ => `<div style="display:grid;grid-template-columns:${kol_};column-gap:10px;row-gap:1px;align-items:baseline;margin-top:7px;padding-top:5px;border-top:1px solid ${ink.rutnat};font-size:10.5px">`;
    return ram("auto auto auto auto")
      + `${svag(`Andel av ${antal(enheter.length)}`)}${cell(basAr, `color:${ink.svag}`)}${cell(helAr(), `color:${ink.svag}`)}${svag("av bruttoförändringen")}`
      + matt_.map(m => `<span style="color:${ink.mjuk}">${m.namn_}</span>${cell(`${dec1.format(m.a0)} %`, `color:${ink.mjuk}`)}${cell(`${dec1.format(m.a1)} %`, `color:${m.upp ? ink.stark : ink.mjuk}`)}<span>${m.forandring}</span>`).join("")
      + `</div>`
      + (utslag.length > 1 ? `<div style="font-size:10.5px;color:${ink.mjuk};margin-top:4px;white-space:normal">${utslag}</div>` : "")
      // Bruttoraden: alla ökningar, alla minskningar och nettot, för alla enheter
      + ram("auto auto auto auto")
      + `${svag(`Alla ${enhetOrd[1]} ${periodTxt(helAr())}`)}${cell("ökning", `color:${ink.svag}`)}${cell("minskning", `color:${ink.svag}`)}${cell("netto", `color:${ink.svag}`)}`
      + matt_.map(m => `<span style="color:${ink.mjuk}">${m.namn_}</span>${cell(andring(br[m.k].upp))}${cell(andring(br[m.k].ned))}${cell(andring(br[m.k].upp + br[m.k].ned), `color:${ink.mjuk}`)}`).join("")
      + `</div>`;
  }
  function visaHornTips(h) {
    tipsNyckel = null;
    const a = helAr(), ll = hornFor(a, basAr)[h], ia = ai(a), ib = ai(basAr);
    const s = ll.length ? aggregat(ll) : null;
    const rad_ = (et, a0, a1) => `<span style="color:${ink.mjuk}">${et}</span><span style="font-family:${MONO};text-align:right">${NIVA ? niv(a1) : andring(a1 - a0)}</span><span style="font-family:${MONO};text-align:right;color:${ink.mjuk}">${fF(forand(a0, a1))}</span>`;
    tips.innerHTML = `<div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline"><span style="font-weight:600;font-size:12.5px">${antal(ll.length)}</span><span style="font-family:${MONO};font-size:10.5px;color:${ink.svag}">${periodTxt(a)}</span></div>`
      + `<div style="font-size:10.5px;color:${ink.svag};margin:1px 0 6px">${hornTitel(h)}</div>`
      + (s ? `<div class="tt" style="padding-top:5px;border-top:1px solid ${ink.rutnat}">${MATT.map(k => rad_(mNamn(k), s[k][ib], s[k][ia])).join("")}</div>` : "")
      + (s && !NIVA ? hornKoncentration(s, ia, ib) : "")
      + (grupper.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:10.5px;color:${ink.mjuk}">${grupper.map(g_ => `<span><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${g_.farg};margin-right:4px"></span>${ll.filter(e => g_.koder.has(e.kod)).length} av ${g_.lista.length}</span>`).join("")}</div>` : "")
      + (hornGr && ll.length ? (() => {
        // De tre största grupperna i hörnet (t.ex. kommungrupper)
        const topp = d3.rollups(ll, v => v.length, e => hornGr.nyckel(infoMap.get(e.kod) ?? {})).filter(([k]) => k != null).sort((p, q) => q[1] - p[1]).slice(0, 3);
        return `<div style="margin-top:7px;padding-top:5px;border-top:1px solid ${ink.rutnat};font-size:10.5px;color:${ink.svag}">Störst ${LINJE ? "bland dem" : "i hörnet"}, efter ${hornGr.namn.toLowerCase()}</div>`
          + `<div style="display:grid;grid-template-columns:auto auto;column-gap:8px;font-size:10.5px">${topp.map(([k, n]) => `<span style="font-family:${MONO};text-align:right">${n}</span><span style="color:${ink.mjuk}">${k}</span>`).join("")}</div>`;
      })() : "")
      + (ll.length ? `<div style="font-size:10px;color:${ink.svag};margin-top:6px">Klicka för att se hela sammansättningen</div>` : "");
    if (LINJE) placeraTips(hornPos[h].x - 160, hornPos[h].y + 8, true);
    else placeraTips(hornPos[h].x + (hornPos[h].a === "end" ? -150 : 0), hornPos[h].y + (h[1] === "h" ? 6 : -10), h[1] === "h");
  }

  // ── Grupper ───────────────────────────────────────────────────────────────
  // Fasta färger (fargPa) för enskilda kommuner, översatta till det mörka
  // temats palett, när färgen inte redan är upptagen
  const fastFarg = kod => {
    const c = fargPa?.[kod];
    if (!c) return null;
    if (farger.includes(c)) return c;
    const i = BANFARGER.ljus.indexOf(c);
    return i >= 0 ? farger[i] : null;
  };
  function nyGrupp(k, banor_ = kommunbanor) {
    const upptagna = new Set(grupper.map(g_ => g_.farg));
    const ll = k.koder.map(kod => enhetMap.get(kod)).filter(Boolean);
    const fast = ll.length === 1 ? fastFarg(ll[0].kod) : null;
    const farg = fast && !upptagna.has(fast) ? fast : farger.find(f => !upptagna.has(f));
    return { ...k, koder: new Set(k.koder), lista: ll, farg, serie: serieFor(ll), banor: banor_ && ll.length > 1 };
  }
  function grupperAndrade() {
    forhand = null; lyftId = null;
    // Ett urval i Riket byter till Urval; utan urval finns inget att zooma till
    // (tillbaka till Riket om urvalet valdes där)
    if (grupper.length && riketVy()) { utsnitt = "urval"; riketRetur = true; }
    if (!grupper.length && utsnitt === "urval") { utsnitt = riketRetur ? "riket" : "hela"; riketRetur = false; }
    byggRader(); malaChips(); visaVy();
    omrakna();
  }
  // ≋ Kommunbanor: gäller alla valda grupper och blir förvalt för nya
  function satKommunbanor(pa) {
    kommunbanor = pa;
    for (const g_ of grupper) if (g_.lista.length > 1) g_.banor = pa;
    byggRader(); if (vy) visaVy(); malaVisa(); nyttMal(); rita();
  }
  banAlla.addEventListener("click", () => satKommunbanor(!kommunbanor));
  // Utsnittet. Riket: bara rikslinjen, så urvalet och markeringen tas bort.
  function satUtsnitt(u) {
    if (u === "riket" && !(LINJE && ref)) return;
    if (u === "urval" && !grupper.length) return;
    if (u === utsnitt && (u !== "riket" || (!grupper.length && !markerad))) return;
    riketRetur = false; tipsNyckel = null;
    if (u === "riket") {
      utsnitt = "riket"; markerad = null; markAr = null; hov = null; hovA = null; tips.style.opacity = 0; stangFakta();
      if (grupper.length || vy) { grupper = []; vy = null; return grupperAndrade(); }
      return omrakna();
    }
    utsnitt = u; omrakna();
  }
  vxRiket.addEventListener("click", () => satUtsnitt("riket"));
  vxHela.addEventListener("click", () => satUtsnitt("hela"));
  vxUrval.addEventListener("click", () => satUtsnitt("urval"));
  function malaVisa() {
    banAlla.classList.toggle("pa", kommunbanor);
    vxRiket.classList.toggle("pa", riketVy());
    vxHela.classList.toggle("pa", !riketVy() && !zoomar());
    vxUrval.classList.toggle("pa", zoomar());
    vxUrval.classList.toggle("av", !grupper.length);
    const t = tomText();
    if (tom.textContent !== t) tom.textContent = t;
  }
  const uppdeladPa = k => k.koder.length > 0 && k.koder.every(kod => grupper.some(g_ => g_.id === `e:${kod}`));
  function vaxla(k, { banor: banor_ = kommunbanor } = {}) {
    if (!k) return;
    // Uppdelat snabbval: varje kommun blir en egen jämförelse (så många som ryms)
    if (k.uppdelad) {
      const ids = k.koder.map(kod => `e:${kod}`);
      if (uppdeladPa(k)) grupper = grupper.filter(g_ => !ids.includes(g_.id));
      else for (const i of ids) if (!grupper.some(g_ => g_.id === i) && grupper.length < MAX) grupper.push(nyGrupp(katalogMap.get(i), banor_));
      return grupperAndrade();
    }
    const fanns = grupper.find(g_ => g_.id === k.id);
    if (fanns) grupper = grupper.filter(g_ => g_ !== fanns);
    else if (grupper.length < MAX) grupper.push(nyGrupp(k, banor_));
    else return;
    grupperAndrade();
  }
  function rensa() { grupper = []; vy = null; grupperAndrade(); }
  // Varje kommun i gruppen blir en egen jämförelse, i listans ordning
  function delaUpp(g_) {
    const ll = dOrdning.length ? dOrdning : g_.lista;
    if (ll.length > MAX - grupper.length + 1) return;
    grupper = grupper.filter(q => q !== g_);
    for (const e of ll) { const k = katalogMap.get(`e:${e.kod}`); if (k && !grupper.some(q => q.id === k.id)) grupper.push(nyGrupp(k)); }
    vy = null;
    grupperAndrade();
  }
  function hornTillGrupp() {
    if (vy?.typ !== "horn" || grupper.length >= MAX) return;
    const pr = vy.bas === vy.ar ? `${vy.ar}` : `${vy.bas}–${vy.ar}`;
    const k = { id: `h:${vy.h}:${pr}`, namn: LINJE ? `${hornNamn(vy.h)} ${pr}` : `${hornNamn(vy.h)} ${vy.ar}`, typ: `${LINJE ? "Urval" : "Hörn"} ${pr}`, koder: vy.lista.map(e => e.kod) };
    if (!grupper.some(q => q.id === k.id)) grupper.push(nyGrupp(k));
    vy = { typ: "grupp", id: k.id };
    grupperAndrade();
  }

  let oppenTyp = null;
  function visaLista(poster) {
    const fullt = grupper.length >= MAX;
    lista.replaceChildren(...(poster.length ? poster : [null]).map(k => {
      if (!k) return el("div", { class: "val", style: "cursor:default" }, "Ingen träff");
      const vald = k.uppdelad ? uppdeladPa(k) : grupper.find(g_ => g_.id === k.id);
      const it = el("div", { class: `val${vald ? " vald" : ""}` });
      it.innerHTML = `<span>${k.namn}</span><small>${vald ? "✓ vald" : fullt ? `max ${MAX}` : `${k.typ} · ${k.koder.length}`}</small>`;
      it.addEventListener("mouseenter", () => { forhand = { koder: new Set(k.koder), namn: k.namn, serie: serieFor(k.koder.map(kod => enhetMap.get(kod)).filter(Boolean)) }; rita(); });
      it.addEventListener("mouseleave", () => { forhand = null; rita(); });
      it.addEventListener("mousedown", ev => { ev.preventDefault(); if (vald || !fullt) { vaxla(k); visaLista(poster); } });
      return it;
    }));
    lista.style.display = "block";
  }
  function stangLista() { lista.style.display = "none"; oppenTyp = null; malaChips(); if (forhand) { forhand = null; rita(); } }
  sok.addEventListener("input", () => {
    const q = sok.value.trim().toLocaleLowerCase("sv");
    if (!q) return stangLista();
    oppenTyp = "sok";
    visaLista(sokbar.filter(d => d.n.includes(q))
      .sort((a, b) => (b.n.startsWith(q) - a.n.startsWith(q)) || (b.k.koder.length - a.k.koder.length) || a.n.localeCompare(b.n, "sv"))
      .slice(0, 10).map(d => d.k));
  });
  sok.addEventListener("keydown", ev => {
    ev.stopPropagation();                                      // Reveal ska inte få tangenterna
    if (ev.key === "Enter") lista.querySelector(".val")?.dispatchEvent(new MouseEvent("mousedown"));
    if (ev.key === "Escape") { sok.value = ""; stangLista(); sok.blur(); }
  });
  for (const s of snabb) {
    s.b.addEventListener("click", ev => {
      ev.stopPropagation();
      if (s.k) { stangLista(); vaxla(s.k); return; }
      if (oppenTyp === s.typ) return stangLista();
      oppenTyp = s.typ; malaChips();
      visaLista(katalog.filter(k => k.typ === s.typ));
    });
    if (s.k) {
      s.b.addEventListener("mouseenter", () => { if (s.k.uppdelad ? uppdeladPa(s.k) : grupper.some(g_ => g_.id === s.k.id)) return; forhand = { koder: new Set(s.k.koder), namn: s.k.namn, serie: serieFor(s.k.koder.map(kod => enhetMap.get(kod))) }; rita(); });
      s.b.addEventListener("mouseleave", () => { if (forhand) { forhand = null; rita(); } });
    }
  }
  function malaChips() { for (const s of snabb) s.b.classList.toggle("pa", s.k ? (s.k.uppdelad ? uppdeladPa(s.k) : grupper.some(g_ => g_.id === s.k.id)) : oppenTyp === s.typ); }
  document.addEventListener("click", ev => { if (lista.style.display === "block" && !valjare.contains(ev.target)) stangLista(); });

  // Rader med två värden (värde + underrad) — i jämförelsetabellen. Byggs när
  // urvalet ändras; sedan byts bara text.
  function vardeRad({ serie, prov, namn_, under = null, kursiv = false, sist = el("span") }) {
    const r = el("div", { class: "rad" });
    const nm = el("span", { class: "namn", style: kursiv ? "font-style:italic" : "" });
    nm.append(document.createTextNode(namn_));
    if (under) nm.appendChild(el("small", {}, under));
    const celler = KOL.map(() => { const c = el("span", { class: "v" }), p = document.createTextNode(""), s = el("small"); c.append(p, s); return { c, p, s }; });
    r.append(prov, nm, ...celler.map(c => c.c), sist);
    const upd = (ia, ib) => KOL.forEach((k, j) => { celler[j].p.nodeValue = k.v(serie, ia, ib); celler[j].s.textContent = k.u(serie, ia, ib); });
    return { r, upd };
  }
  const refProv = () => el("span", { style: `width:10px;border-top:2px dotted ${ink.stark}` });
  const ruta = farg => el("span", { style: `width:9px;height:9px;border-radius:2px;background:${farg}` });

  let rader = [], radNyckel = null;
  function byggRader() {
    rader = [];
    if (ref) rader.push(vardeRad({ serie: ref, prov: refProv(), namn_: ref.namn, kursiv: true }));
    for (const g_ of grupper) {
      const fler = g_.lista.length > 1;
      const kryss = el("button", { type: "button", class: "x", title: "Ta bort" }, "×");
      kryss.addEventListener("click", ev => { ev.stopPropagation(); vaxla(g_); });
      // En enskild kommun behöver ingen underrad — det håller tabellen låg nog för fem rader
      const v = vardeRad({ serie: g_.serie, prov: ruta(g_.farg), namn_: g_.namn, sist: kryss,
        under: fler ? `${g_.banor ? "≋ " : ""}${g_.typ} · ${antal(g_.lista.length)} ›` : null });
      if (fler) { v.r.classList.add("klick"); v.r.title = `Visa gruppens ${enhetOrd[1]}`; v.r.addEventListener("click", () => oppnaGrupp(g_.id)); }
      else if (FAKTA) { v.r.classList.add("klick"); v.r.title = `Klicka för att se ${g_.namn} år för år`; v.r.addEventListener("click", () => visaFakta(faktaEnhet(g_.lista[0]))); }
      v.r.addEventListener("mouseenter", () => { lyftId = g_.id; rita(); });
      v.r.addEventListener("mouseleave", () => { lyftId = null; rita(); });
      v.gid = g_.id;
      rader.push(v);
    }
    raderEl.replaceChildren(...rader.map(v => v.r), ...(grupper.length ? [] : [tom]));
    radNyckel = null;
    malaMarkRader();
  }
  function uppdateraRader() {
    const a = helAr(), nyckel = `${a}|${basAr}`;
    if (nyckel === radNyckel) return;                // bara vid nytt helår eller basår
    radNyckel = nyckel;
    periodEl.textContent = periodTxt(a);
    for (const r of rader) r.upd(ai(a), ai(basAr));
  }

  // ── Detaljvyn: en grupps eller ett hörns kommuner ─────────────────────────
  // Ersätter jämförelsen i panelen. Ordningen är fast (värdet vid periodens
  // slutår) så att raderna inte byter plats medan tiden spelar. Varje rad har
  // en minibana (spridning) eller minilinje (linje) i gemensam skala.
  let dRader = [], dSum = [], dOrdning = [], dPeriod = null, dLista = null, dSkala = null, dNyckel = null, dArNyckel = null, dSortKnappar = [];
  const vyGrupp = () => (vy?.typ === "grupp" ? grupper.find(g_ => g_.id === vy.id) ?? null : null);
  const vyLista = () => vyGrupp()?.lista ?? vy?.lista ?? [];
  const slutAr_ = () => (vy?.typ === "horn" ? vy.ar : per.till);
  function oppnaGrupp(gid) { vy = { typ: "grupp", id: gid }; lyftId = null; visaVy(); rita(); }
  function oppnaHorn(h) {
    const a = helAr();
    if (vy?.typ === "horn" && vy.h === h && vy.ar === a && vy.bas === basAr) return stangVy();
    const ll = hornFor(a, basAr)[h];
    if (!ll.length) return;
    vy = { typ: "horn", h, ar: a, bas: basAr, lista: ll, koder: new Set(ll.map(e => e.kod)) };
    stangLista(); visaVy(); rita();
  }
  function stangVy() { stangFakta(); vy = null; hov = null; radHov = null; tips.style.opacity = 0; visaVy(); rita(); }
  function visaVy() {
    if (vy?.typ === "grupp" && !vyGrupp()) vy = null;
    jamfor.style.display = vy ? "none" : "flex";
    detalj.style.display = vy ? "flex" : "none";
    dNyckel = null; dOrdning = [];
    if (vy) byggDetalj(); else detalj.replaceChildren();
    for (const h of HORN) hornG[h].gg.classed("pa", vy?.typ === "horn" && vy.h === h);
  }
  function byggDetalj() {
    const g_ = vyGrupp(), horn = vy.typ === "horn", ll = vyLista();
    const r1 = el("div", { style: "display:flex;align-items:center;gap:4px;margin:0 -5px" });
    const tillbaka = el("button", { type: "button", class: "pil", title: "Tillbaka till jämförelsen" }, "‹");
    tillbaka.addEventListener("click", stangVy);
    const tt = el("div", { style: `flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px;font-weight:600;color:${ink.stark}` });
    if (horn) tt.append(el("span", { style: `font-family:${MONO};color:${LINJE ? (vy.h === "upp" ? UPP : NED) : ink.mjuk};margin-right:6px` }, HORN_PIL[vy.h]), document.createTextNode(hornTitel(vy.h)));
    else tt.append(el("span", { style: `display:inline-block;width:9px;height:9px;border-radius:2px;background:${g_.farg};margin-right:7px` }), document.createTextNode(g_.namn));
    r1.append(tillbaka, tt);

    const r2 = el("div", { style: `display:flex;align-items:center;gap:5px;font-size:10.5px;color:${ink.svag}` });
    const perH = vy.bas === vy.ar ? `${vy.ar}` : `${vy.bas}–${vy.ar}`;
    r2.appendChild(el("span", { style: "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" },
      horn ? `${antal(ll.length)} ${LINJE ? "" : "i hörnet "}${perH}` : `${g_.typ} · ${antal(ll.length)}`));
    if (horn) {
      const gor = el("button", { type: "button", class: `chip liten${grupper.length >= MAX ? " av" : ""}`, title: `Jämför ${LINJE ? "dessa" : "hörnets"} ${enhetOrd[1]} som en grupp` }, "Gör till grupp");
      gor.addEventListener("click", hornTillGrupp);
      r2.appendChild(gor);
    } else if (ll.length > 1) {
      const banKnapp = el("button", { type: "button", class: `chip liten${g_.banor ? " pa" : ""}`, title: LINJE ? `Färga varje ${enhetOrd[0]}s linje i gruppens färg` : `Visa varje ${enhetOrd[0]}s bana i gruppens färg` }, LINJE ? "≋ Linjer" : "≋ Banor");
      banKnapp.addEventListener("click", () => { g_.banor = !g_.banor; banKnapp.classList.toggle("pa", g_.banor); byggRader(); nyttMal(); rita(); });
      const ledigt = MAX - grupper.length + 1;
      const dela = el("button", { type: "button", class: `chip liten${ll.length > ledigt ? " av" : ""}`,
        title: ll.length > ledigt ? `Högst ${MAX} jämförelser samtidigt` : `Varje ${enhetOrd[0]} blir en egen jämförelse med egen färg` }, "Dela upp");
      dela.addEventListener("click", () => delaUpp(g_));
      r2.append(banKnapp, dela);
    }

    // Hörnets andel av riket, året då ögonblicksbilden togs
    const r3 = horn && ref && !NIVA ? (() => {
      const s = aggregat(ll), i = ai(vy.ar);
      return el("div", { style: `font-size:10.5px;color:${ink.svag};margin-top:-3px` },
        LINJE ? `${andelFmt(100 * s[MK][i] / ref[MK][i])} % av ${MBEST} ${vy.ar}`
          : `${andelFmt(100 * s.X[i] / ref.X[i])} % av ${bestamd.x} och ${andelFmt(100 * s.Y[i] / ref.Y[i])} % av ${bestamd.y} ${vy.ar}`);
    })() : null;

    const th = el("div", { class: "rad m", style: `cursor:default;padding-top:4px;padding-bottom:3px;border-bottom:1px solid ${ink.linje};border-radius:0` });
    dPeriod = el("span", { class: "over" });
    const kolumn = kk => {
      const b = el("button", { type: "button", class: `over sort${sortering.k === kk.k ? " pa" : ""}` },
        `${kk.namn}${sortering.k === kk.k ? (sortering.ned ? " ▾" : " ▴") : ""}`);
      b.addEventListener("click", () => { sortering = sortering.k === kk.k ? { k: kk.k, ned: !sortering.ned } : { k: kk.k, ned: true }; visaVy(); rita(); });
      return b;
    };
    dSortKnappar = KOL.map(kolumn);
    th.append(el("span"), dPeriod, ...dSortKnappar);
    // Riket och hela gruppen/hörnet på en rad var, i listans kolumner
    const sumRad = (serie, prov, namn_, stil_, f) => {
      const r = el("div", { class: "rad m", title: `Klicka för att se ${f.namn} år för år` });
      if (FAKTA) r.addEventListener("click", () => visaFakta(f)); else r.style.cursor = "default";
      prov.style.justifySelf = "center";
      const celler = KOL.map(() => el("span", { class: "v" }));
      r.append(prov, el("span", { class: "namn", style: stil_ }, namn_), ...celler);
      return { r, upd: (ia, ib) => KOL.forEach((k, j) => { celler[j].textContent = k.v(serie, ia, ib); }) };
    };
    dSum = [];
    if (ref) dSum.push(sumRad(ref, refProv(), ref.namn, "font-style:italic", { id: "ref", serie: ref, lista: null, namn: ref.namn, under: `Referens · ${antal(enheter.length)}` }));
    const hornF = horn ? { id: `h:${vy.h}:${vy.bas}:${vy.ar}`, serie: aggregat(ll), lista: ll, subjekt: `${LINJE ? "De" : "Hörnets"} ${antal(ll.length)}`, namn: hornTitel(vy.h), farg: ink.mjuk, under: `${antal(ll.length)} ${LINJE ? "" : "i hörnet "}${perH}` } : null;
    dSum.push(sumRad(g_ ? g_.serie : aggregat(ll),
      horn ? el("span", { style: `font-family:${MONO};font-size:11px;color:${ink.mjuk}` }, HORN_PIL[vy.h]) : ruta(g_.farg),
      horn ? (LINJE ? "Alla dessa" : "Hela hörnet") : "Hela gruppen", "font-weight:500",
      horn ? hornF : { id: g_.id, serie: g_.serie, lista: g_.lista, namn: g_.namn, farg: g_.farg, under: `${g_.typ} · ${antal(ll.length)}` }));
    // Hörnet: visa sammansättningen efter en gruppering — eller enheterna själva
    let visaRad_ = null;
    if (horn && grupperingar.length) {
      visaRad_ = el("div", { style: `display:flex;align-items:center;gap:6px;font-size:10.5px;color:${ink.svag};margin-top:3px` });
      const par = el("div", { class: "par" });
      const val = [...new Set([hornGr, ...grupperingar])].map(gr => ({ text: gr.namn, v: gr.namn })).concat([{ text: versal(enhetOrd[1]), v: null }]);
      for (const o of val) {
        const k = el("button", { type: "button", class: hornVisa === o.v ? "pa" : "", title: o.v ? `Vilka ${o.text.toLowerCase()}er de hör till` : `Lista ${enhetOrd[1]}na` }, o.text);
        k.addEventListener("click", () => { if (hornVisa === o.v) return; hornVisa = o.v; forhand = null; visaVy(); rita(); });
        par.appendChild(k);
      }
      visaRad_.append(el("span", {}, "Visa"), par);
    }
    dLista = el("div", { style: `position:relative;display:flex;flex-direction:column;min-height:0;flex:1;overflow:auto;scrollbar-width:thin;border-top:1px solid ${ink.rutnat};padding-top:2px` });
    // I hörnets sammansättning får listan platsen — tabellhuvud och summarader döljs
    const sammans = horn && !!hornVisa;
    if (sammans) dSum = [];
    detalj.replaceChildren(r1, r2, ...(r3 ? [r3] : []), ...(sammans ? [] : [th, ...dSum.map(v => v.r)]), ...(visaRad_ ? [visaRad_] : []), dLista);
  }
  // Hörnets sammansättning: vilka grupper (t.ex. kommungrupper) står för
  // bulken. Stapeln = andel av hörnets enheter; "av N" = hur många av gruppens
  // enheter som hamnat här. Fetstil: gruppen är överrepresenterad i hörnet
  // (andelen av gruppen i hörnet är minst 1,5 gånger andelen av alla).
  function byggSammansattning() {
    const gr = grupperingar.find(g_ => g_.namn === hornVisa), ll = vy.lista;
    const nyckelFor = e => gr.nyckel(infoMap.get(e.kod) ?? {});
    const tot = d3.rollup(enheter, v => v.length, nyckelFor);
    const delar = d3.groups(ll, nyckelFor).filter(([k]) => k != null)
      .map(([k, v]) => ({ k, n: v.length, tot: tot.get(k), koder: new Set(v.map(e => e.kod)) }))
      .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k, "sv"));
    dRader = []; dOrdning = [...ll];
    const max = d3.max(delar, d => d.n) || 1, basAndel = ll.length / enheter.length;
    const vem = LINJE ? `de ${tal.format(ll.length)}` : `hörnets ${tal.format(ll.length)}`;
    const huvud_ = el("div", { style: `font-size:10px;color:${ink.svag};line-height:1.35;padding:2px 4px 4px` },
      `Stapel: andel av ${vem} · till höger: hur många av gruppens ${enhetOrd[1]} som ${LINJE ? "är med" : "ligger här"}`);
    // Två rader per grupp: namnet på hela bredden, stapel och tal under
    const rader_ = delar.map(d => {
      const over = d.n / d.tot >= 1.5 * basAndel, vald = grupper.find(q => q.id === `${gr.namn}:${d.k}`);
      const r = el("div", { class: "rad", style: "display:block;padding:3px 4px 4px;cursor:pointer" });
      const nm = el("div", { class: "namn", style: `font-size:11.5px;line-height:1.3;${over ? "font-weight:600" : `color:${ink.mjuk}`}` });
      if (vald) nm.appendChild(el("span", { style: `display:inline-block;width:7px;height:7px;border-radius:2px;background:${vald.farg};margin-right:5px` }));
      nm.appendChild(document.createTextNode(d.k));
      const rad2 = el("div", { style: "display:flex;align-items:center;gap:6px;margin-top:2px" });
      const stapel = el("span", { style: "flex:1;min-width:0;display:flex;align-items:center;gap:5px" });
      stapel.append(el("span", { style: `flex:none;height:6px;border-radius:2px;background:${over ? ink.mjuk : ink.linje};width:${Math.max(2, 130 * d.n / max)}px` }),
        el("span", { style: `font-family:${MONO};font-size:10px;color:${ink.mjuk}` }, `${tal.format(Math.round(100 * d.n / ll.length))} %`));
      const ant = el("span", { style: `font-family:${MONO};font-size:10.5px;color:${ink.stark};white-space:nowrap` });
      ant.append(document.createTextNode(tal.format(d.n)), el("span", { style: `color:${ink.svag}` }, ` av ${tal.format(d.tot)}`));
      rad2.append(stapel, ant);
      r.append(nm, rad2);
      r.title = `${d.n} av gruppens ${d.tot} ${enhetOrd[1]} ${LINJE ? "är med" : "ligger i hörnet"} (${tal.format(Math.round(100 * d.n / d.tot))} % mot ${tal.format(Math.round(100 * basAndel))} % av alla). `
        + `De är ${tal.format(Math.round(100 * d.n / ll.length))} % av ${vem}. ${vald ? "Klicka för att ta bort jämförelsen." : "Klicka för att jämföra hela gruppen."}`;
      r.addEventListener("mouseenter", () => { forhand = { koder: d.koder, namn: d.k, serie: null }; rita(); });
      r.addEventListener("mouseleave", () => { forhand = null; rita(); });
      r.addEventListener("click", () => vaxla(katalogMap.get(`${gr.namn}:${d.k}`)));
      return r;
    });
    const fot = el("div", { style: `font-size:10px;color:${ink.svag};line-height:1.4;padding:4px 4px 0` },
      `Fetstil: överrepresenterad, minst 1,5 gånger så stor andel av gruppen som av alla ${enhetOrd[1]}.`);
    dLista.replaceChildren(huvud_, ...rader_, fot);
  }
  function byggDetaljLista() {
    if (vy?.typ === "horn" && hornVisa) return byggSammansattning();
    const g_ = vyGrupp(), ll = vyLista(), b = basAr, slut = Math.max(b, slutAr_()), is = ai(slut), ib = ai(b);
    KOL.forEach((kk, i) => { dSortKnappar[i].title = `Sortera efter ${kk.titel} ${periodTxt(slut)}${sortering.k === kk.k ? ". Klicka igen för omvänd ordning" : ""}`; });
    const sk = KOL.find(kk => kk.k === sortering.k) ?? KOL[0];
    const sv_ = e => { const v = sk.sort(e, is, ib); return ok(v) ? v : -Infinity; };
    dOrdning = [...ll].sort((p, q) => (sortering.ned ? sv_(q) - sv_(p) : sv_(p) - sv_(q)) || namnPa(p.kod).localeCompare(namnPa(q.kod), "sv"));
    // Minibanorna/-linjerna delar skala; i långa listor kapas ytterpunkterna (2–98 %)
    let gsx, gsy, gl, spar_;
    if (LINJE) {
      const st = linjeStart(b);
      spar_ = (e, a) => { const ut = []; for (let k = st; k <= a; k++) ut.push([k, lv(e, k, b)]); return ut; };
      const vals = ll.flatMap(e => spar_(e, slut).map(p => p[1])).filter(ok);
      const [v0, v1] = ll.length > 20 ? [d3.quantile(vals, 0.02), d3.quantile(vals, 0.98)] : d3.extent(vals);
      gsx = d3.scaleLinear().domain([st, Math.max(st + 1, slut)]).range([1.5, 22.5]).clamp(true);
      gsy = d3.scaleLinear().domain([Math.min(v0 ?? 0, 0), Math.max(v1 ?? 0, 0)]).range([12.5, 1.5]).clamp(true);
      gl = d3.line().defined(p => ok(p[1])).x(p => gsx(p[0])).y(p => gsy(p[1]));
    } else {
      const pts = ll.flatMap(e => banaB(e, slut, b)).filter(p => ok(p[0]) && ok(p[1]));
      const om = ff => (ll.length > 20 ? [d3.quantile(pts, 0.02, ff), d3.quantile(pts, 0.98, ff)] : d3.extent(pts, ff));
      const [x0, x1] = om(p => p[0]), [y0, y1] = om(p => p[1]);
      const kx_ = KX ?? x0, ky_ = KY ?? y0;
      gsx = d3.scaleLinear().domain([Math.min(x0, kx_), Math.max(x1, kx_)]).range([1.5, 22.5]).clamp(true);
      gsy = d3.scaleLinear().domain([Math.min(y0, ky_), Math.max(y1, ky_)]).range([12.5, 1.5]).clamp(true);
      gl = d3.line().x(p => gsx(p[0])).y(p => gsy(p[1]));
    }
    dSkala = { gsx, gsy, slut };
    dRader = dOrdning.map(e => {
      const egenG = grupper.find(q => q.id === `e:${e.kod}`);
      const farg = egenG?.farg ?? g_?.farg ?? ink.mjuk;
      const r = el("div", { class: "rad m" });
      const sv = d3.create("svg").attr("width", 24).attr("height", 14).style("display", "block").style("overflow", "visible");
      if (LINJE) sv.append("line").attr("x1", 0).attr("x2", 24).attr("y1", gsy(0)).attr("y2", gsy(0)).attr("stroke", ink.rutnat);
      else {
        if (KX != null) sv.append("line").attr("x1", gsx(KX)).attr("x2", gsx(KX)).attr("y1", 0).attr("y2", 14).attr("stroke", ink.rutnat);
        if (KY != null) sv.append("line").attr("x1", 0).attr("x2", 24).attr("y1", gsy(KY)).attr("y2", gsy(KY)).attr("stroke", ink.rutnat);
      }
      sv.append("path").attr("d", gl(LINJE ? spar_(e, slut) : banaB(e, slut, b))).attr("fill", "none").attr("stroke", farg).attr("stroke-width", 1).attr("stroke-opacity", 0.75).attr("stroke-linejoin", "round");
      const prick = sv.append("circle").attr("r", 2).attr("fill", farg);
      const nm = el("span", { class: "namn" });
      if (egenG) nm.appendChild(el("span", { style: `display:inline-block;width:7px;height:7px;border-radius:2px;background:${egenG.farg};margin-right:5px` }));
      nm.appendChild(document.createTextNode(namnPa(e.kod)));
      const celler = KOL.map(() => el("span", { class: "v" }));
      r.append(sv.node(), nm, ...celler);
      r.title = `Klicka för att se ${namnPa(e.kod)} år för år`;
      r.addEventListener("mouseenter", () => { hov = e; hovA = null; radHov = e; tipsNyckel = null; rita(); });
      r.addEventListener("mouseleave", () => { if (radHov === e) radHov = null; if (hov === e) { hov = null; tips.style.opacity = 0; } rita(); });
      r.addEventListener("click", () => (FAKTA ? visaFakta(faktaEnhet(e)) : lyftFram(e.kod === markerad ? null : e.kod)));
      if (e.kod === markerad) r.classList.add("mark");
      return { e, r, prick, celler };
    });
    dLista.replaceChildren(...dRader.map(d => d.r));
    // Den markerade raden hålls synlig i listan (utan att rulla själva bilden)
    const m = dRader.find(d => d.e.kod === markerad);
    if (m) {
      const topp = m.r.offsetTop, h = dLista.clientHeight;
      if (topp < dLista.scrollTop || topp + 70 > dLista.scrollTop + h) dLista.scrollTop = Math.max(0, topp - 24);
    }
  }
  function uppdateraDetalj() {
    if (!vy) return;
    const ordning = `${basAr}|${slutAr_()}|${sortering.k}|${sortering.ned}|${markerad}|${vy.typ === "horn" ? hornVisa : ""}|${LINJE ? vis.skala + vis.tid : ""}`;
    if (ordning !== dNyckel) { dNyckel = ordning; byggDetaljLista(); dArNyckel = null; }
    const a = helAr(), nyckel = `${a}|${basAr}`;
    if (nyckel === dArNyckel) return;
    dArNyckel = nyckel;
    const ia = ai(a), ib = ai(basAr);
    dPeriod.textContent = periodTxt(a);
    for (const v of dSum) v.upd(ia, ib);
    for (const d of dRader) {
      KOL.forEach((k, j) => { d.celler[j].textContent = k.v(d.e, ia, ib); });
      const am = Math.min(a, dSkala.slut);
      const p = LINJE ? [am, lv(d.e, am, basAr)] : idx(d.e, am, basAr);
      d.prick.attr("cx", dSkala.gsx(p[0])).attr("cy", ok(p[1]) ? dSkala.gsy(p[1]) : -99);
    }
  }

  // ── Faktarutan: en kommun eller grupp i detalj ────────────────────────────
  // Öppnas med klick på en rad i detaljvyn (en kommun, hela gruppen/hörnet,
  // riket) som ett kort mitt över diagrammet. Uppifrån: nyckeltal, en
  // slutsats (mot riket och mot den egna regionen), förändringen över tid och
  // tabeller för perioden och år för år. Nyckeltal och slutsats avser basåret
  // → året som visas och följer med när tiden spelar. Hovring öppnar det
  // aldrig. Stängs med ×, Esc, klick utanför kortet eller nytt klick på samma rad.
  const faktaEl = el("div", { style: `position:absolute;left:0;top:0;bottom:0;z-index:12;display:none;align-items:center;justify-content:center;background:${T.mork ? "rgba(22,33,29,.62)" : "rgba(255,255,255,.66)"}` });
  faktaEl.addEventListener("click", ev => { if (ev.target === faktaEl) stangFakta(); });
  rot.appendChild(faktaEl);
  const FF = { Y: farger[0], X: LINJE ? farger[0] : farger[1] };
  let fakta = null, fk = null, faktaFlik = "period";
  const regNamn = r => (region?.namn ? `${region.namn} ${r}` : r), regBest = region?.bestamd ?? "regionen";
  const regionFor = kod => (region ? region.nyckel(infoMap.get(kod) ?? {}) ?? null : null);
  const summa = (ll, k, i) => { let t = 0; for (const e of ll) t += e[k][i]; return t; };
  function stangFakta() { fakta = null; fk = null; faktaEl.style.display = "none"; faktaEl.replaceChildren(); }
  function visaFakta(f) {
    if (fakta?.id === f.id) return stangFakta();
    fakta = f; tips.style.opacity = 0;
    faktaEl.style.width = `${kol.offsetLeft + kol.offsetWidth}px`;
    faktaEl.style.display = "flex";
    byggFakta();
  }
  const faktaEnhet = e => {
    const inf = infoMap.get(e.kod) ?? {}, r = regionFor(e.kod);
    return { id: `e:${e.kod}`, kod: e.kod, serie: e, lista: [e], namn: namnPa(e.kod), farg: fargFor(e.kod),
      under: [...new Set([...grupperingar.map(gr => gr.nyckel(inf)), r && regNamn(r)].filter(Boolean))].join(" · ") };
  };
  document.addEventListener("keydown", ev => {
    if (!fakta || ev.key !== "Escape" || !rot.isConnected) return;
    ev.stopPropagation(); ev.preventDefault(); stangFakta();
  }, true);

  function byggFakta() {
    const f = fakta, s = f.serie, medRef = ref && s !== ref, ib = ai(basAr), rn = ref?.namn.toLowerCase();
    f.bas = basAr; f.till = per.till;
    const kort = el("div", { class: "fkort" });

    // Rubrik: namn, tillhörighet, lyft fram och stäng
    const topp = el("div", { style: "display:flex;align-items:flex-start;gap:8px" });
    const titel = el("div", { style: "flex:1;min-width:0" });
    const t1 = el("div", { style: `display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;line-height:1.2;color:${ink.stark}` });
    t1.append(f.id === "ref" ? refProv() : ruta(f.farg ?? ink.stark), document.createTextNode(f.namn));
    titel.append(t1, el("div", { class: "fk-under" }, f.under ?? ""));
    topp.appendChild(titel);
    if (f.kod) {
      const vald = markerad === f.kod;
      const lyft = el("button", { type: "button", class: "chip liten", title: vald ? "Släpp markeringen i grafen" : "Stäng kortet och lyft fram i grafen" }, vald ? "Släpp markeringen" : "Lyft fram i grafen");
      lyft.addEventListener("click", () => { const kod = f.kod; stangFakta(); lyftFram(vald ? null : kod); });
      topp.appendChild(lyft);
    }
    const stang = el("button", { type: "button", class: "pil", title: "Stäng (Esc)" }, "×");
    stang.addEventListener("click", stangFakta);
    topp.appendChild(stang);

    // Nyckeltal
    const tal_ = el("div", { class: "fk-tal" });
    const ruta_ = et => { const r = el("div", { class: "fk-ruta" }), v = el("div", { class: "fk-v" }), u = el("div", { class: "fk-u" }); r.append(el("div", { class: "fk-et" }, et), v, u); tal_.appendChild(r); return { v, u }; };
    const rutor = LINJE ? {
      M: ruta_(MNAMN), antal: ruta_("Förändring, antal"),
      andel: ruta_(medRef ? `Andel av ${rn}` : `Färre ${MORD} än ${basAr}`), perAr: ruta_("Per år")
    } : {
      Y: ruta_(raknare.yNamn), X: ruta_(raknare.xNamn),
      andel: ruta_(medRef ? `Andel av ${rn}` : `Färre ${yOrd} än ${basAr}`),
      kvot: ruta_(`${raknare.yNamn} per 100 inv.`)
    };
    const slut = el("div", { class: "fk-slut" });

    // Diagrammet: förändring sedan basåret, enheten heldragen och riket prickat
    const cw = 272, ch = 190, fm = { t: 16, r: 46, b: 18, l: 40 };
    const fsx = d3.scaleLinear().domain([AR0, AR1]).range([fm.l, cw - fm.r]);
    const linjer = MATT.map(k => ({ k, namn_: mNamn(k), q: s }));
    if (medRef) for (const k of MATT) linjer.push({ k, q: ref, streck: true });
    for (const l of linjer) l.v = Array.from({ length: NI }, (_, i) => { const v = l.q[l.k][i], v0 = l.q[l.k][ib]; return v > 0 && v0 > 0 ? bas * v / v0 : NaN; });
    const fsy = d3.scaleLinear().domain(d3.extent([...linjer.flatMap(l => l.v).filter(ok), bas])).nice(5).range([ch - fm.b, fm.t]);
    const sv = d3.create("svg").attr("width", cw).attr("height", ch).style("display", "block").style("overflow", "visible").style("font-family", "var(--graf-text-font)");
    const mono = t => t.attr("font-size", 9.5).attr("font-family", MONO).attr("fill", ink.svag);
    // Den valda perioden tonad
    sv.append("rect").attr("x", fsx(basAr)).attr("width", Math.max(0, fsx(per.till) - fsx(basAr))).attr("y", fm.t - 12).attr("height", ch - fm.b - fm.t + 12).attr("fill", tonad);
    mono(sv.append("text").attr("x", (fsx(basAr) + fsx(per.till)) / 2).attr("y", fm.t - 3).attr("text-anchor", "middle")).text(`${basAr}–${per.till}`);
    for (const t of fsy.ticks(5)) {
      sv.append("line").attr("x1", fm.l).attr("x2", cw - fm.r).attr("y1", fsy(t)).attr("y2", fsy(t)).attr("stroke", t === bas ? ink.mjuk : ink.rutnat).attr("stroke-opacity", t === bas ? 0.6 : 1).attr("shape-rendering", "crispEdges");
      mono(sv.append("text").attr("x", fm.l - 5).attr("y", fsy(t)).attr("dy", "0.32em").attr("text-anchor", "end")).text(axPct(t));
    }
    for (const t of d3.range(Math.ceil(AR0 / 10) * 10, AR1 + 1, 10)) mono(sv.append("text").attr("x", fsx(t)).attr("y", ch - 4).attr("text-anchor", "middle")).text(t);
    for (const kb of kallByten) {
      const x_ = fsx(kb.ar - 0.5);
      sv.append("line").attr("x1", x_).attr("x2", x_).attr("y1", fm.t).attr("y2", ch - fm.b).attr("stroke", ink.svag).attr("stroke-dasharray", "1 2");
      mono(sv.append("text").attr("x", x_ + 3).attr("y", ch - fm.b - 4)).attr("font-size", 8.5).text(kbKort(kb)).append("title").text(`${kb.ar}: källbyte ${kbText(kb)}`);
    }
    const ln = d3.line().defined(ok).x((v, i) => fsx(AR0 + i)).y(v => fsy(v));
    for (const l of linjer) sv.append("path").attr("d", ln(l.v)).attr("fill", "none").attr("stroke", l.streck && LINJE ? ink.mjuk : FF[l.k]).attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
      .attr("stroke-width", l.streck ? 1.4 : 2).attr("stroke-dasharray", l.streck ? "0.1 3.2" : null).attr("stroke-opacity", l.streck ? 0.85 : 1);
    // Slutvärdena vid linjernas slut, isärskjutna
    const egna = linjer.filter(l => !l.streck);
    const ys = egna.map(l => fsy(l.v[NI - 1]));
    if (ys.length === 2 && Math.abs(ys[0] - ys[1]) < 12) { const m = (ys[0] + ys[1]) / 2, o = ys[0] <= ys[1] ? -6 : 6; ys[0] = m + o; ys[1] = m - o; }
    egna.forEach((l, i) => { if (ok(ys[i])) sv.append("text").attr("x", cw - fm.r + 5).attr("y", ys[i]).attr("dy", "0.32em").attr("font-size", 10).attr("font-family", MONO).attr("fill", FF[l.k]).text(axPct(l.v[NI - 1])); });
    const nu = sv.append("line").attr("y1", fm.t - 12).attr("y2", ch - fm.b).attr("stroke", ink.mjuk);
    const hovL = sv.append("line").attr("y1", fm.t - 12).attr("y2", ch - fm.b).attr("stroke", ink.mjuk).attr("stroke-dasharray", "2 2").attr("opacity", 0);
    const prickar = egna.map(l => ({ l, c: sv.append("circle").attr("r", 3.2).attr("fill", FF[l.k]).attr("stroke", botten).attr("stroke-width", 1.2) }));
    sv.append("rect").attr("x", fm.l).attr("y", 0).attr("width", cw - fm.l - fm.r).attr("height", ch).attr("fill", "transparent")
      .on("pointermove", ev => faktaHov(kl(Math.round(fsx.invert(d3.pointer(ev)[0])), AR0, AR1), true))
      .on("pointerleave", () => faktaHov(null));
    const nyckel_ = el("div", { style: `display:flex;flex-wrap:wrap;gap:3px 11px;font-size:10px;color:${ink.mjuk};margin-bottom:2px` });
    const streckProv = (farg, prick) => el("span", { style: `display:inline-block;width:14px;vertical-align:middle;margin-right:4px;border-top:2px ${prick ? "dotted" : "solid"} ${farg}` });
    for (const l of egna) { const sp = el("span"); sp.append(streckProv(FF[l.k]), document.createTextNode(LINJE ? f.namn : l.namn_)); nyckel_.appendChild(sp); }
    if (medRef) { const sp = el("span"); sp.append(streckProv(ink.mjuk, true), document.createTextNode(ref.namn)); nyckel_.appendChild(sp); }
    const diagram = el("div", { style: "min-width:0" });
    diagram.append(el("div", { class: "fk-rubrik", style: "margin-bottom:3px" }, `${LINJE ? `${MNAMN}, förändring` : "Förändring"} sedan ${basAr}`), nyckel_, sv.node());

    // Tabellerna: perioden och år för år, under var sin flik
    const flikar = el("div", { class: "par" }), innehall = el("div", { style: "position:relative;flex:1;min-height:0;overflow:auto;scrollbar-width:thin;margin-top:6px" });
    const perVy = byggPeriodTabell(f, medRef, rn), arVy = byggArTabell(s);
    for (const [v, text] of [["period", "Perioden"], ["ar", "År för år"]]) {
      const b = el("button", { type: "button", class: faktaFlik === v ? "pa" : "" }, text);
      b.addEventListener("click", () => { faktaFlik = v; [...flikar.children].forEach(c => c.classList.toggle("pa", c === b)); innehall.replaceChildren(v === "period" ? perVy.el : arVy.el); });
      flikar.appendChild(b);
    }
    innehall.appendChild(faktaFlik === "period" ? perVy.el : arVy.el);
    const tabeller = el("div", { style: "min-width:0;display:flex;flex-direction:column;min-height:0" });
    tabeller.append(flikar, innehall);
    const nere = el("div", { class: "fk-nere" });
    nere.append(diagram, tabeller);

    kort.append(topp, tal_, slut, nere);
    faktaEl.replaceChildren(kort);

    // Regionen: de regioner (t.ex. län) som enheten ligger i — om den inte är hela regionen
    let reg = null;
    if (region && f.lista) {
      const rs = new Set(f.lista.map(e => regionFor(e.kod)).filter(Boolean));
      const rl = enheter.filter(e => rs.has(regionFor(e.kod)));
      if (rs.size && rs.size <= 12 && rl.length > f.lista.length)
        reg = { lista: rl, best: rs.size === 1 ? regBest : (region.plural ?? regBest), text: rs.size === 1 ? `${regNamn([...rs][0])} (${antal(rl.length)})` : `de ${rs.size} ${region.plural ?? region.namn} (${antal(rl.length)})` };
    }
    fk = { fsx, fsy, nu, hovL, prickar, rader: arVy.rader, arTab: innehall, rutor, slut, reg, perVy, ar: null };
    uppdateraFakta();
  }

  // Perioden: nivå vid periodens början och slut, förändring i antal och
  // procent och genomsnittlig årlig förändring — enheten mot riket
  function byggPeriodTabell(f, medRef, rn) {
    const s = f.serie, t = el("div", { class: "fk-per" });
    const kolNamn = (text, stil_ = "") => el("span", { class: "fk-rubrik", style: `text-align:right;${stil_}` }, text);
    t.append(el("span", { class: "fk-rubrik" }, "Perioden"), kolNamn(f.id === "ref" ? ref.namn : (f.namn.length > 12 ? `${f.namn.slice(0, 11)}…` : f.namn)), medRef ? kolNamn(ref.namn) : el("span"));
    const celler = [];
    for (const k of MATT) {
      if (MATT.length > 1) t.appendChild(el("div", { class: "fk-del" }, mNamn(k)));
      const rad_ = (lab, fn, jamfor_ = false) => {
        const l = el("div", { class: "fk-fn" }, lab), cu = el("div", { class: "fk-fv" }), cr = el("div", { class: "fk-fv", style: `color:${ink.mjuk}` });
        t.append(l, cu, medRef ? cr : el("span"));
        celler.push({ l, cu, cr, fn, k, jamfor_ });
      };
      rad_(null, (q, ia, ib) => talN(q[k][ib]));
      rad_(null, (q, ia) => talN(q[k][ia]));
      rad_("Förändring", (q, ia, ib) => andring(q[k][ia] - q[k][ib]));
      rad_("I procent", (q, ia, ib) => procentD(pct(q[k][ib], q[k][ia])), true);
      rad_("Per år", (q, ia, ib) => procentD(cagr(q[k][ib], q[k][ia], ia - ib)), true);
    }
    if (medRef) t.appendChild(el("div", { style: `grid-column:1/-1;font-size:9.5px;color:${ink.svag};padding-top:4px;border-top:0` }, `Färgat: snabbare än ${rn} under perioden.`));
    const farg = f.farg && f.farg !== ink.stark ? f.farg : UPP;
    const upd = a => {
      const ia = ai(a), ib = ai(basAr);
      let i = 0;
      for (const c of celler) {
        if (i % 5 === 0) c.l.textContent = `${mNamn(c.k)} ${basAr}`;
        if (i % 5 === 1) c.l.textContent = `${mNamn(c.k)} ${a}`;
        c.cu.textContent = a > basAr || i % 5 < 2 ? c.fn(s, ia, ib) : "–";
        if (medRef) c.cr.textContent = a > basAr || i % 5 < 2 ? c.fn(ref, ia, ib) : "–";
        const battre = c.jamfor_ && medRef && a > basAr && pct(s[c.k][ib], s[c.k][ia]) > pct(ref[c.k][ib], ref[c.k][ia]) + 0.05;
        c.cu.style.color = battre ? farg : ink.stark; c.cu.style.fontWeight = battre ? "600" : "";
        i++;
      }
    };
    return { el: t, upd };
  }

  function byggArTabell(s) {
    const tab = el("table", { class: "ftab" }), thr = el("tr");
    const kolumner = LINJE ? ["År", MNAMN, "± antal", "± %"] : ["År", raknare.xNamn, "±", raknare.yNamn, "±"];
    for (const t of kolumner) thr.appendChild(el("th", {}, t));
    const thead = el("thead"); thead.appendChild(thr);
    const tb = el("tbody"), rader_ = new Map(), kallAr = new Map(kallByten.map(kb => [kb.ar, kbText(kb)]));
    for (let a = AR0; a <= AR1; a++) {
      const i = a - AR0, tr = el("tr", { class: a < basAr || a > per.till ? "ute" : "" });
      const yoy = k => (i > 0 && s[k][i - 1] > 0 ? procentD(pct(s[k][i - 1], s[k][i])) : "");
      const arCell = el("td", {}, `${a}`);
      if (kallAr.has(a)) { arCell.appendChild(el("span", { style: `color:${ink.svag}` }, "*")); arCell.title = `Källbyte: ${kallAr.get(a)}. Jämför inte rakt över gränsen.`; }
      if (LINJE) tr.append(arCell, el("td", {}, talN(s[MK][i])), el("td", {}, i > 0 ? andring(s[MK][i] - s[MK][i - 1]) : ""), el("td", {}, yoy(MK)));
      else tr.append(arCell, el("td", {}, talN(s.X[i])), el("td", {}, yoy("X")), el("td", {}, talN(s.Y[i])), el("td", {}, yoy("Y")));
      tr.addEventListener("mouseenter", () => faktaHov(a));
      tr.addEventListener("mouseleave", () => faktaHov(null));
      rader_.set(a, tr); tb.appendChild(tr);
    }
    tab.append(thead, tb);
    const ram = el("div");
    ram.append(tab);
    if (kallByten.length) ram.appendChild(el("div", { style: `font-size:9.5px;color:${ink.svag};padding:4px 3px 0` }, `* källbyte: ${kallByten.map(kb => `${kb.ar} ${kbText(kb)}`).join(", ")}`));
    return { el: ram, rader: rader_ };
  }

  // Hovrat år i kortet: hjälplinje i diagrammet och raden i årstabellen
  function faktaHov(a, rulla = false) {
    if (!fk) return;
    for (const tr of fk.rader.values()) tr.classList.remove("hv");
    if (a == null) return fk.hovL.attr("opacity", 0);
    fk.hovL.attr("x1", fk.fsx(a)).attr("x2", fk.fsx(a)).attr("opacity", 1);
    const tr = fk.rader.get(a);
    tr?.classList.add("hv");
    if (rulla && tr?.isConnected) {
      const t = tr.offsetTop, h = fk.arTab.clientHeight;
      if (t < fk.arTab.scrollTop + 22 || t > fk.arTab.scrollTop + h - 20) fk.arTab.scrollTop = Math.max(0, t - h / 2);
    }
  }

  // Slutsatsen: etiketter och några meningar, räknade för basåret → år a.
  // Mot riket: starkare/svagare utveckling betyder att andelen av riket ökar
  // eller minskar. Mot regionen: andel av regionens bruttoökning (eller
  // -minskning) jämförd med andelen av regionen vid basåret.
  function faktaSlutsats(a) {
    const f = fakta, s = f.serie, ia = ai(a), ib = ai(basAr), medRef = ref && s !== ref, rn = ref?.namn.toLowerCase();
    const subj = f.subjekt ?? f.namn, p = k => pct(s[k][ib], s[k][ia]);
    const etiketter = [], men = [];
    const etikett = (o, text) => etiketter.push(`<span class="fk-etikett" style="color:${o > 0 ? UPP : o < 0 ? NED : ink.mjuk}">${o > 0 ? "▲" : o < 0 ? "▼" : "●"} ${text}</span>`);
    // Två mått → en etikett om de pekar åt samma håll, annars en per mått.
    // Ett mått (linjeläget) → en etikett.
    const etiketterM = (os, upp, ned, takt) => {
      if (os.length === 1 || os[0] === os[1]) return etikett(os[0], os[0] > 0 ? upp : os[0] < 0 ? ned : takt);
      MATT.forEach((k, i) => etikett(os[i], `${mNamn(k)}: ${(os[i] > 0 ? upp : os[i] < 0 ? ned : takt).toLowerCase()}`));
    };
    if (!medRef) {
      const farre = k => enheter.filter(e => e[k][ib] > 0 && e[k][ia] < e[k][ib]).length;
      men.push(MATT.map((k, i) => `${i ? mBest(k) : versal(mBest(k))} <b>${procent(p(k))}</b>`).join(" och ") + ".");
      men.push(`<b>${tal.format(farre(MATT[0]))}</b> av ${antal(enheter.length)} har färre ${mNamn(MATT[0]).toLowerCase()} än ${basAr}${MATT.length > 1 ? `, <b>${tal.format(farre(MATT[1]))}</b> har färre ${mNamn(MATT[1]).toLowerCase()}` : ""}.`);
      return { etiketter, men };
    }
    const r = k => pct(ref[k][ib], ref[k][ia]);
    const o = k => (Math.abs(p(k) - r(k)) < 0.5 ? 0 : p(k) > r(k) ? 1 : -1);
    const ORD = { 1: "starkare än", 0: "i takt med", "-1": "svagare än" };
    const del = k => `${mBest(k)} (<b>${procent(p(k))}</b> mot ${procent(r(k))})`;
    const os = MATT.map(o);
    etiketterM(os, `Tar andelar av ${rn}`, `Tappar mark mot ${rn}`, `I takt med ${rn}`);
    men.push(MATT.length === 1 || os[0] === os[1]
      ? `${subj} har utvecklats <b>${ORD[os[0]]} ${rn}</b> i ${MATT.length > 1 ? "både " : ""}${MATT.map(del).join(" och ")}.`
      : `${subj} har utvecklats <b>${ORD[os[0]]} ${rn}</b> i ${del("Y")} ${os[0] * os[1] < 0 ? "men" : "och"} <b>${ORD[os[1]]}</b> ${rn} i ${del("X")}.`);
    if (fk.reg) {
      const rl = fk.reg.lista, ll = f.lista;
      const matt_ = k => {
        let gU = 0, gN = 0, uU = 0, uN = 0;
        const medlem = new Set(ll);
        for (const e of rl) {
          if (!(e[k][ib] > 0 && e[k][ia] > 0)) continue;
          const d = e[k][ia] - e[k][ib];
          if (d > 0) { gU += d; if (medlem.has(e)) uU += d; } else { gN += d; if (medlem.has(e)) uN += d; }
        }
        const okning = summa(ll, k, ia) >= summa(ll, k, ib), gg = okning ? gU : gN;
        const s0 = 100 * summa(ll, k, ib) / summa(rl, k, ib), s1 = 100 * summa(ll, k, ia) / summa(rl, k, ia);
        return { k, okning, andel: gg ? 100 * (okning ? uU : uN) / gg : null, s0, s1, o: Math.abs(s1 - s0) < 0.05 ? 0 : s1 > s0 ? 1 : -1 };
      };
      const mm = MATT.map(matt_);
      const rb = fk.reg.best;
      etiketterM(mm.map(m => m.o), `Koncentration i ${rb}`, `Tappar mark i ${rb}`, `I takt med ${rb}`);
      const stod = m => (m.andel == null ? null
        : `${m.andel >= 99.95 ? "<b>hela</b>" : `<b>${dec1.format(m.andel)} %</b> av`} ${m.okning ? "ökningen" : "minskningen"} av ${mBest(m.k)}`);
      const bada = mm.length === 2 && mm.every(m => m.andel >= 99.95) && mm[0].okning === mm[1].okning;
      const delar = bada ? [`<b>hela</b> ${mm[0].okning ? "ökningen" : "minskningen"} av både ${bestamd.y} och ${bestamd.x}`] : mm.map(stod).filter(Boolean);
      men.push((delar.length ? `I ${fk.reg.text} stod ${subj} för ${delar.join(" och ")}. ` : `I ${fk.reg.text}: `)
        + mm.map((m, i) => `${i ? "av" : `Andelen av ${rb}s`} ${i ? mBest(m.k) : mNamn(m.k).toLowerCase()} ${i ? "" : "gick "}från ${dec1.format(m.s0)} till <b>${dec1.format(m.s1)} %</b>`).join(", ") + ".");
    }
    return { etiketter, men };
  }

  function uppdateraFakta() {
    if (!fakta) return;
    if ((fakta.bas !== basAr || fakta.till !== per.till) && basFranAr == null) return byggFakta();
    const a = helAr();
    if (!fk || fk.ar === a) return;
    fk.ar = a;
    const s = fakta.serie, ia = ai(a), ib = ai(basAr), medRef = ref && s !== ref, rn = ref?.namn.toLowerCase();
    fk.nu.attr("x1", fk.fsx(a)).attr("x2", fk.fsx(a));
    for (const p of fk.prickar) { const v = p.l.v[ia]; p.c.attr("cx", fk.fsx(a)).attr("cy", ok(v) ? fk.fsy(v) : -99); }
    for (const [ar_, tr] of fk.rader) tr.classList.toggle("nu", ar_ === a);
    fk.perVy.upd(a);
    const R = fk.rutor, tom_ = a <= basAr;
    const farga = (v, rv) => (!tom_ && medRef ? (v > rv + 0.5 ? UPP : v < rv - 0.5 ? NED : ink.stark) : ink.stark);
    if (LINJE) {
      const V = s[MK], RV = medRef ? ref[MK] : null;
      R.M.v.textContent = tom_ ? talN(V[ia]) : procent1(pct(V[ib], V[ia]));
      R.M.u.textContent = tom_ ? `${a}` : medRef ? `${rn} ${procent1(pct(RV[ib], RV[ia]))}` : periodTxt(a);
      R.M.v.style.color = farga(pct(V[ib], V[ia]), medRef ? pct(RV[ib], RV[ia]) : 0);
      R.antal.v.textContent = tom_ ? "–" : andring(V[ia] - V[ib]);
      R.antal.u.textContent = tom_ ? `${a}` : `${talN(V[ib])} → ${talN(V[ia])}`;
      if (medRef) {
        const an = i => 100 * V[i] / RV[i];
        R.andel.v.textContent = `${andelD(an(ia))} %`;
        R.andel.u.textContent = tom_ ? `${MORD} ${a}` : `${basAr}: ${andelD(an(ib))} %`;
      } else {
        const n = enheter.filter(e => e[MK][ib] > 0 && e[MK][ia] < e[MK][ib]).length;
        R.andel.v.textContent = tom_ ? "–" : tal.format(n);
        R.andel.u.textContent = `av ${antal(enheter.length)}`;
      }
      R.perAr.v.textContent = tom_ ? "–" : procentD(cagr(V[ib], V[ia], ia - ib));
      R.perAr.u.textContent = tom_ ? "" : medRef ? `${rn} ${procentD(cagr(RV[ib], RV[ia], ia - ib))}` : `${basAr}–${a}`;
    } else {
      for (const k of ["Y", "X"]) {
        R[k].v.textContent = tom_ ? talN(s[k][ia]) : procent(pct(s[k][ib], s[k][ia]));
        R[k].u.textContent = tom_ ? `${a}` : `${medRef ? `${rn} ${procent(pct(ref[k][ib], ref[k][ia]))} · ` : ""}${andring(s[k][ia] - s[k][ib])}`;
        R[k].v.style.color = farga(pct(s[k][ib], s[k][ia]), medRef ? pct(ref[k][ib], ref[k][ia]) : 0);
      }
      if (medRef) {
        const an = i => 100 * s.Y[i] / ref.Y[i];
        R.andel.v.textContent = `${andelD(an(ia))} %`;
        R.andel.u.textContent = tom_ ? `${yOrd} ${a}` : `${yOrd} · ${basAr}: ${andelD(an(ib))} %`;
      } else {
        const n = enheter.filter(e => e.Y[ib] > 0 && e.Y[ia] < e.Y[ib]).length;
        R.andel.v.textContent = tom_ ? "–" : tal.format(n);
        R.andel.u.textContent = `av ${antal(enheter.length)}`;
      }
      const kv = i => 100 * s.Y[i] / s.X[i];
      R.kvot.v.textContent = ok(kv(ia)) ? dec1.format(kv(ia)) : "–";
      R.kvot.u.textContent = tom_ ? `${a}` : `${basAr}: ${ok(kv(ib)) ? dec1.format(kv(ib)) : "–"}`;
    }
    if (tom_) { fk.slut.innerHTML = `<span style="color:${ink.svag}">Spela fram tiden eller välj ett senare slutår för att se utvecklingen sedan ${basAr}.</span>`; return; }
    const { etiketter, men } = faktaSlutsats(a);
    fk.slut.innerHTML = `<div class="fk-rubrik" style="margin-bottom:4px">Slutsats ${periodTxt(a)}</div>`
      + (etiketter.length ? `<div style="margin-bottom:5px">${etiketter.join("")}</div>` : "")
      + men.map(m => `<p>${m}</p>`).join("");
  }

  // ── Tidslinjen: två handtag (från–till), uppspelning och källbyten ────────
  let sxT = null;
  function byggSpar() {
    const b = spar.clientWidth || panelBredd - 10;
    sxT = d3.scaleLinear().domain([AR0, AR1]).range([8, b - 8]);
    sparSvg.selectAll("rect.bas").data([0]).join("rect").attr("class", "bas").attr("x", sxT(AR0)).attr("y", 9).attr("width", sxT(AR1) - sxT(AR0)).attr("height", 4).attr("rx", 2).attr("fill", ink.rutnat);
    const steg_ = d3.range(Math.ceil(AR0 / 10) * 10, AR1 + 1, 10).filter(s => s - AR0 > 5 && AR1 - s > 5);
    sparSvg.selectAll("text.st").data([AR0, ...steg_, AR1]).join("text").attr("class", "st")
      .attr("x", d => sxT(d)).attr("y", 35).attr("text-anchor", (d, i, a) => i === 0 ? "start" : i === a.length - 1 ? "end" : "middle")
      .attr("font-family", MONO).attr("font-size", 9.5).attr("fill", ink.svag).text(d => d);
    // Källbyten: små hakar ovanför spåret
    sparSvg.selectAll("g.kb").data(kallByten).join(e => { const gg = e.append("g").attr("class", "kb"); gg.append("path").attr("fill", ink.svag); gg.append("title"); return gg; })
      .call(gg => { gg.select("path").attr("d", d => `M${sxT(d.ar) - 2.5},0h5l-2.5,3.5z`); gg.select("title").text(d => `Källbyte ${d.ar}: ${kbText(d)}`); });
    // Handtagen: fokuserbara, ← → flyttar ett år
    sparSvg.selectAll("circle.h").data([0, 1]).join(e => e.append("circle").attr("class", "h").attr("tabindex", 0).attr("r", 6.5)
      .attr("role", "slider").attr("aria-label", d => (d ? "Periodens sista år" : "Periodens första år"))
      .each(function (d) {
        this.addEventListener("keydown", ev => {
          const steg = ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -1 : ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 1 : 0;
          if (!steg) return;
          ev.preventDefault(); ev.stopPropagation(); stoppa();
          if (d === 0) satPeriod(per.fran + steg, per.till); else satPeriod(per.fran, per.till + steg);
        });
      })).attr("cy", 11).attr("fill", ink.stark).attr("stroke", halo).attr("stroke-width", 1.5);
  }
  function malaSpar() {
    if (!sxT) return;
    // Den valda perioden ljust, den spelade delen mörkt (börjar vid basåret)
    sparSvg.selectAll("rect.per").data([0]).join(e => e.insert("rect", "circle").attr("class", "per")).attr("y", 9).attr("height", 4).attr("rx", 2).attr("fill", ink.linje)
      .attr("x", sxT(per.fran)).attr("width", Math.max(0, sxT(per.till) - sxT(per.fran)));
    const b0 = banStart();
    sparSvg.selectAll("rect.fylld").data([0]).join(e => e.insert("rect", "circle").attr("class", "fylld")).attr("y", 9).attr("height", 4).attr("rx", 2).attr("fill", ink.mjuk)
      .attr("x", sxT(Math.min(b0, ar))).attr("width", Math.max(0, sxT(ar) - sxT(Math.min(b0, ar))));
    sparSvg.selectAll("circle.h").attr("cx", d => sxT(d ? per.till : per.fran)).attr("aria-valuenow", d => (d ? per.till : per.fran));
    // Uppspelningens läge mellan handtagen
    const spelar = ar < per.till - 1e-9;
    sparSvg.selectAll("circle.nu").data(spelar ? [0] : []).join("circle").attr("class", "nu").attr("cy", 11).attr("r", 3.6)
      .attr("fill", halo).attr("stroke", ink.stark).attr("stroke-width", 1.6).attr("pointer-events", "none").attr("cx", sxT(ar));
  }
  const arFran = ev => { const r = spar.getBoundingClientRect(); const sk = r.width / (spar.offsetWidth || r.width); return Math.round(kl(sxT.invert((ev.clientX - r.left) / sk), AR0, AR1)); };
  function dragTill(a) {
    if (drar === 0) satPeriod(Math.min(a, per.till - 1), per.till);
    else satPeriod(per.fran, Math.max(a, per.fran + 1));
  }
  spar.addEventListener("pointerdown", ev => {
    if (!sxT) return;
    ev.preventDefault();
    spar.setPointerCapture(ev.pointerId); stoppa();
    const a = arFran(ev);
    // Närmaste handtaget; utanför perioden det handtag som ligger på den sidan
    drar = a <= per.fran ? 0 : a >= per.till ? 1 : (a - per.fran < per.till - a ? 0 : 1);
    dragTill(a);
  });
  // Draget tas en gång per bildruta (en mus kan skicka hundratals händelser i sekunden)
  let dragAr = null, dragRaf = 0;
  spar.addEventListener("pointermove", ev => {
    if (drar == null) return;
    dragAr = arFran(ev);
    if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; if (drar != null && dragAr != null) dragTill(dragAr); });
  });
  const slapp = () => {
    if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; if (drar != null && dragAr != null) dragTill(dragAr); }
    drar = null; dragAr = null;
  };
  spar.addEventListener("pointerup", slapp);
  spar.addEventListener("pointercancel", slapp);

  function malaPeriod() {
    helaKnapp.classList.toggle("av", per.fran === AR0 && per.till === AR1);
    perText.textContent = `${per.till - per.fran} år · förändring sedan ${per.fran}`;
    spelaKnapp.title = `Spela ${per.fran}–${per.till}`;
    malaSpar(); malaVisa(); malaStartaOm(); malaVis();
  }

  // ── Tid och period ────────────────────────────────────────────────────────
  function stoppa() { clearTimeout(startar); startar = null; timer?.stop(); timer = null; spelaKnapp.textContent = "▶"; }
  function spela(fran, till) {
    stoppa();
    spelaKnapp.textContent = "❚❚";
    // Byts ramen eller basåret glider den över först; sedan börjar tiden gå.
    // Under uppspelningen står axlarna still.
    ar = fran; omrakna();
    const ms = Math.max(1, till - fran) * msPerAr;
    startar = setTimeout(() => { startar = null; timer = d3.timer(t => {
      const k = Math.min(1, t / ms);
      ar = fran + k * (till - fran);
      rita();
      if (k >= 1) { stoppa(); rita(); }
    }); }, domFran || basFranAr != null ? OVERGANG_MS : 0);
  }
  // ▶: spela perioden från början — eller fortsätt där uppspelningen pausades
  function spelaPeriod() { spela(ar >= per.till - 1e-9 || ar < per.fran ? per.fran : ar, per.till); }
  spelaKnapp.addEventListener("click", () => (timer || startar ? stoppa() : spelaPeriod()));
  // Ny period: till-året visas direkt
  function satPeriod(f, t) {
    f = kl(Math.round(f), AR0, AR1 - 1); t = kl(Math.round(t), f + 1, AR1);
    if (f === per.fran && t === per.till && Math.abs(ar - t) < 1e-9 && !timer) return;
    per = { fran: f, till: t }; ar = t;
    omrakna();
  }
  function startaOm() {
    stoppa();
    grupper = []; forhand = null; lyftId = null; hov = null; hovA = null; arHov = null; radHov = null; hornHov = null; vy = null; stangFakta();
    per = { ...P0 }; ar = per.till; vis = { ...VIS0 }; sortering = { k: KOL_K[0], ned: true }; utsnitt = UTSNITT0; riketRetur = false; kommunbanor = BANOR0;
    markerad = null; markAr = null; storlekPop = storlek !== "lika"; hornVisa = hornGr?.namn ?? null; tipsNyckel = null;
    malaStorlek(); malaVis();
    sok.value = ""; stangLista(); tips.style.opacity = 0;
    byggRader(); malaChips(); visaVy();
    omrakna();
  }
  startaOmKnapp.addEventListener("click", startaOm);
  const harAndrats = () => grupper.length > 0 || kommunbanor !== BANOR0 || !!markerad || per.fran !== P0.fran || per.till !== P0.till || utsnitt !== UTSNITT0
    || Math.abs(ar - per.till) > 1e-9 || !!vy || !!timer || !!startar || (LINJE && (vis.skala !== VIS0.skala || vis.tid !== VIS0.tid));
  function malaStartaOm() { startaOmKnapp.classList.toggle("av", !harAndrats()); }

  // Efter varje ändring av period, år eller urval: nytt basår (mjuk övergång i
  // spridningsläget), nytt axelmål och ny panel
  function omrakna() {
    const b = per.fran;
    if (b !== basAr) {
      if (LINJE) { basAr = b; basFranAr = null; bE = 1; }
      else { basFranAr = basAr; basAr = b; basT0 = performance.now(); bE = 0; }
      if (!NIVA && !LINJE) basEt.textContent = `förändring sedan ${b}`;
    }
    nyttMal();
    malaPeriod();
    rita();
  }
  function stegaBas() {
    if (basFranAr == null) { bE = 1; return true; }
    const t = Math.min(1, (performance.now() - basT0) / OVERGANG_MS);
    bE = d3.easeCubicOut(t);
    if (t >= 1) { basFranAr = null; bE = 1; return true; }
    return false;
  }

  // ── Axlar ─────────────────────────────────────────────────────────────────
  // Ramen gäller den valda perioden och står still medan tiden går. Den byts
  // bara när period, visning, utsnitt eller urval ändras — då med en mjuk
  // övergång.
  //   Hela bilden: robust omfång (1–99:e percentilen per år) av alla enheter
  //     över periodens år, utökat så att valda grupper och riket syns helt.
  //   Urvalet: exakt omfång för grupperna (och deras kommuner) och riket.
  const robustCache = new Map();
  function kumRobust(b, t) {
    const nyckel = `${b}|${t}`;
    if (!robustCache.has(nyckel)) {
      let e = KX != null ? [KX, KX, KY ?? Infinity, KY ?? -Infinity] : [Infinity, -Infinity, KY ?? Infinity, KY ?? -Infinity];
      for (let a = b; a <= t; a++) {
        const xs = [], ys = [];
        for (const en of enheter) { const p = idx(en, a, b); if (ok(p[0])) xs.push(p[0]); if (ok(p[1])) ys.push(p[1]); }
        xs.sort(d3.ascending); ys.sort(d3.ascending);
        e = [Math.min(e[0], d3.quantileSorted(xs, 0.01)), Math.max(e[1], d3.quantileSorted(xs, 0.99)), Math.min(e[2], d3.quantileSorted(ys, 0.01)), Math.max(e[3], d3.quantileSorted(ys, 0.99))];
      }
      robustCache.set(nyckel, e);
    }
    return robustCache.get(nyckel);
  }
  // Linjeläget: samma robusta omfång, för värdena i aktuell visning. Varje års
  // percentiler cachas för sig; årlig förändring beror inte på basåret, så när
  // från-handtaget dras räknas bara de år som är nya.
  function linjeRobust(b, t) {
    const nyckel = `L${b}|${t}|${vis.skala}|${vis.tid}`;
    if (!robustCache.has(nyckel)) {
      const ack = vis.tid === "ack";
      let e = [0, 0], Ls = null;
      const vs = new Float64Array(enheter.length);
      for (let a = linjeStart(b); a <= t; a++) {
        const qn = `Q${ack ? b : ""}|${a}|${vis.skala}|${vis.tid}`;
        if (!robustCache.has(qn)) {
          Ls ??= enheter.map(en => lvAr(en, b));
          let n = 0;
          for (const L of Ls) { const v = L[a - AR0]; if (ok(v)) vs[n++] = v; }
          const s = vs.slice(0, n).sort();
          robustCache.set(qn, n ? [d3.quantileSorted(s, 0.01), d3.quantileSorted(s, 0.99)] : null);
        }
        const q = robustCache.get(qn);
        if (q) e = [Math.min(e[0], q[0]), Math.max(e[1], q[1])];
      }
      robustCache.set(nyckel, e);
    }
    return robustCache.get(nyckel);
  }
  const MIN_HALV = 8;           // minsta luft kring 100 — korta perioder blir inte inzoomade brus
  const zoomar = () => utsnitt === "urval" && grupper.length > 0;
  function malDoman() {
    const b = per.fran, slut = Math.max(b, per.till);
    if (LINJE) {
      // Riket och Urval: ramen kring riket och grupperna; Hela Sverige: robust ram för alla
      const e = zoomar() || riketVy() ? [0, 0] : [...linjeRobust(b, slut)];
      const ta = s => { for (let a = linjeStart(b); a <= slut; a++) { const v = lv(s, a, b); if (ok(v)) { e[0] = Math.min(e[0], v); e[1] = Math.max(e[1], v); } } };
      if (ref) ta(ref);
      for (const g_ of grupper) {
        ta(g_.serie);
        if (g_.banor && g_.lista.length > 1 && g_.lista.length <= MAX_MEDETIKETTER) for (const en of g_.lista) ta(en);
      }
      const minst = vis.skala === "relativ" ? 1 : 10;
      if (e[1] - e[0] < 2 * minst) { const m = (e[0] + e[1]) / 2; e[0] = Math.min(e[0], m - minst); e[1] = Math.max(e[1], m + minst); }
      const p = (e[1] - e[0]) * 0.06;
      return { x: [b, slut], y: [e[0] - p, e[1] + p] };
    }
    const ta = (e, p) => (ok(p[0]) && ok(p[1]) ? [Math.min(e[0], p[0]), Math.max(e[1], p[0]), Math.min(e[2], p[1]), Math.max(e[3], p[1])] : e);
    let e = zoomar() ? [KX ?? Infinity, KX ?? -Infinity, KY ?? Infinity, KY ?? -Infinity] : [...kumRobust(b, slut)];
    for (const g_ of grupper) {
      for (const en of g_.lista) for (const p of banaB(en, slut, b)) e = ta(e, p);
      if (g_.lista.length > 1) for (const p of banaB(g_.serie, slut, b)) e = ta(e, p);
    }
    if (ref) for (const p of banaB(ref, slut, b)) e = ta(e, p);
    const luft = (lo, hi, k) => {
      if (!NIVA) { lo = Math.min(lo, bas - MIN_HALV); hi = Math.max(hi, bas + MIN_HALV); }
      else if (k != null) { lo = Math.min(lo, k); hi = Math.max(hi, k); }
      const p = (hi - lo) * 0.06; return [lo - p, hi + p];
    };
    return { x: luft(e[0], e[1], KX), y: luft(e[2], e[3], KY) };
  }
  let dom = null, domFran = null, domMal = null, domT0 = 0, rafPa = false;
  const sammaRam = (p, q) => [0, 1].every(i => Math.abs(p.x[i] - q.x[i]) < 1e-9 && Math.abs(p.y[i] - q.y[i]) < 1e-9);
  function nyttMal({ direkt = false } = {}) {
    const m = malDoman();
    if (!dom || direkt) { dom = m; domMal = m; domFran = null; return; }
    if (domMal && sammaRam(m, domMal)) return;                // ramen står still
    domFran = { x: [...dom.x], y: [...dom.y] }; domMal = m; domT0 = performance.now();
  }
  function stegaDoman() {
    if (!domFran) return true;
    const t = Math.min(1, (performance.now() - domT0) / OVERGANG_MS), e = d3.easeCubicOut(t);
    dom = { x: domFran.x.map((v, i) => lerp(v, domMal.x[i], e)), y: domFran.y.map((v, i) => lerp(v, domMal.y[i], e)) };
    if (t >= 1) { domFran = null; return true; }
    return false;
  }
  // Tickavstånd: minsta steg i 1-2-5-stegen som ger högst 7 streck, valt
  // efter målramen — under en övergång byts steget inte mitt i.
  let stegX = null, stegY = null;
  const valjSteg = dm => TICKSTEG.find(t => (dm[1] - dm[0]) / t <= 7) ?? 50;
  const ticks = (dm, s) => d3.range(Math.ceil(dm[0] / s - 1e-9) * s, dm[1] + 1e-9, s).map(v => Math.round(v / s) * s);
  // Linjeläget: årtal på x, förändring på y
  const arSteg = dm => { const sp = dm[1] - dm[0]; return sp <= 7 ? 1 : sp <= 14 ? 2 : 5; };
  // Axeln i miljoner när ramen når en miljon (rikets faktiska tal i utsnittet Riket)
  const lyFmt = v => {
    if (Math.abs(v) < 1e-9) return "0";
    if (vis.skala === "relativ") return `${tecken(v)}${tal1.format(Math.abs(v))} %`;
    const mn = Math.max(Math.abs(dom.y[0]), Math.abs(dom.y[1])) >= 1e6;
    return mn ? `${tecken(v)}${tal1.format(Math.abs(v) / 1e6)} mn` : `${tecken(v)}${tal.format(Math.abs(v))}`;
  };
  const lvFmt = v => (!ok(v) ? "–" : vis.skala === "relativ" ? (Math.abs(v) >= 10 ? procent(v) : procent1(v)) : andring(v));

  // ── Rendering ─────────────────────────────────────────────────────────────
  function rita() {
    const klarD = stegaDoman(), klarB = stegaBas(), klar = klarD && klarB;
    sx.domain(dom.x); sy.domain(dom.y);
    arText.textContent = `${per.fran}–${helAr()}`;
    malaSpar(); malaStartaOm();
    if (LINJE) {
      stegX = arSteg(domMal.x); stegY = d3.tickStep(domMal.y[0], domMal.y[1], 6);
      ritaAxlarLinje(); ritaLinjer();
    } else {
      stegX = valjSteg(domMal.x); stegY = valjSteg(domMal.y);
      ritaAxlar(); ritaSpridning();
    }
    uppdateraHorn();
    uppdateraRader();
    uppdateraDetalj();
    uppdateraFakta();
    if (!klar && !timer && !rafPa) { rafPa = true; requestAnimationFrame(() => { rafPa = false; rita(); }); }
  }

  function ritaSpridning() {
    const mark = forhand?.koder ?? (hornHov ? new Set(hornFor(helAr(), basAr)[hornHov].map(e => e.kod)) : null) ?? (vy?.typ === "horn" ? vy.koder : null);
    const lyft = lyftId ? grupper.find(g_ => g_.id === lyftId) : vyGrupp();
    const harG = grupper.length > 0;
    // Med en kommun i förgrunden tonas allt annat lätt — det försvinner inte
    const me = markEnhet(), mFarg = me ? fargFor(me.kod) : null;
    const dampa = op => (me ? Math.min(op, 0.5) : op);
    const [x0, x1] = dom.x, [y0, y1] = dom.y;
    punkter.each(function (d) {
      const p = ix(d, ar);
      if (!ok(p[0]) || !ok(p[1])) { d.pos = [-99, -99]; d.r = 0; this.setAttribute("r", 0); return; }
      // Utanför axlarna: läggs vid kanten, ihålig
      const ute = p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1;
      d.pos = [sx(Math.max(x0, Math.min(x1, p[0]))), sy(Math.max(y0, Math.min(y1, p[1])))];
      if (ute) d.pos = [Math.max(3, Math.min(iw - 3, d.pos[0])), Math.max(3, Math.min(ih - 3, d.pos[1]))];
      const gg = gruppFor(d.kod);
      // Radie: efter invånare (yta ∝ folkmängd året som visas), annars lika.
      // Framlyfta punkter får en minsta storlek så att små kommuner syns.
      const rb = storlekPop ? Math.max(R_MIN, rPop(storlekVid(d, ar)) || R_MIN) : 2.6;
      const minst = m => (storlekPop ? Math.max(rb, m) : m);
      let fyll = ink.svag, op = storlekPop ? 0.4 : 0.45, r = rb;
      if (harG) { op = zoomar() ? 0.07 : 0.14; if (gg) { fyll = gg.farg; op = storlekPop ? 0.75 : 0.9; r = minst(3.2); } }
      if (lyft && gg) { if (lyft.koder.has(d.kod)) { op = storlekPop ? 0.85 : 1; r = minst(3.6); fyll = lyft.farg; } else op = 0.35; }
      if (mark) { if (mark.has(d.kod)) { fyll = gg?.farg ?? ink.stark; op = storlekPop ? 0.8 : 0.95; r = minst(3.4); } else op = Math.min(op, 0.06); }
      if (me) { if (d === me) { fyll = mFarg; op = storlekPop ? 0.85 : 1; r = minst(3.6); } else op = dampa(op); }
      // Hovras en rad i panelens lista lyfts den kommunen och resten tonas mer
      if (radHov) { if (d === radHov) { fyll = fargFor(d.kod); op = storlekPop ? 0.9 : 1; r = minst(4); } else op *= 0.3; }
      if (ute && op < 0.1) op = 0;          // tonade punkter utanför axlarna syns inte alls
      d.r = r;
      this.setAttribute("cx", d.pos[0]); this.setAttribute("cy", d.pos[1]); this.setAttribute("r", r);
      // Bubblor får en tunn kant i bakgrundens färg, så att överlappande hålls isär
      this.setAttribute("fill", ute ? "none" : fyll);
      this.setAttribute("stroke", ute ? fyll : storlekPop ? halo : "none");
      this.setAttribute("stroke-width", ute ? 1 : 0.7);
      this.setAttribute("fill-opacity", op); this.setAttribute("stroke-opacity", ute ? op : Math.min(1, op + 0.3));
    });

    // Kommunernas egna banor i gruppens färg — tunna, under gruppens summerade bana
    const medB = [];
    for (const g_ of grupper) if (g_.banor && g_.lista.length > 1) for (const e of g_.lista) medB.push({ id: `${g_.id}|${e.kod}`, e, g: g_ });
    const medOp = d => (d.e === me ? 0 : (lyft ? (lyft === d.g ? 0.65 : 0.2) : 0.45) * (mark && !mark.has(d.e.kod) ? 0.3 : 1) * (me ? 0.65 : 1) * (radHov ? 0.3 : 1));
    gMed.selectAll("path").data(medB, d => d.id).join("path").attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
      .attr("stroke-width", 0.9).attr("stroke", d => d.g.farg).attr("stroke-opacity", medOp).attr("d", d => linje(bana(d.e, ar)));

    const banor_ = [];
    if (ref) banor_.push({ id: "ref", namn: ref.namn, serie: ref, farg: ink.stark, streck: "0.1 3.2", bredd: 1.5, op: 0.8, kursiv: true });
    for (const g_ of grupper) {
      const egenMark = me && g_.id === `e:${me.kod}`;
      banor_.push({ id: g_.id, namn: g_.namn, serie: g_.serie, farg: g_.farg, bredd: g_.lista.length > 1 ? 2.2 : 1.3,
        op: egenMark ? 0.95 : me ? 0.6 : lyft && lyft !== g_ ? 0.4 : 0.95 });
    }
    if (forhand?.serie && !grupper.some(g_ => g_.namn === forhand.namn)) banor_.push({ id: "forhand", namn: forhand.namn, serie: forhand.serie, farg: ink.stark, streck: "4 2", bredd: 1.4, op: 0.85, utanEtikett: true });
    if (radHov) for (const b of banor_) b.op *= 0.4;
    gBan.selectAll("path").data(banor_, d => d.id).join("path").attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
      .attr("stroke", d => d.farg).attr("stroke-width", d => d.bredd).attr("stroke-opacity", d => d.op).attr("stroke-dasharray", d => d.streck ?? null)
      .attr("d", d => linje(bana(d.serie, ar)));
    for (const b of banor_) { const q = ix(b.serie, ar); b.pos = [sx(q[0]), sy(q[1])]; }
    gSp.selectAll("circle").data(banor_, d => d.id).join("circle").attr("r", d => d.id === "ref" ? 3 : 3.8)
      .attr("fill", d => d.farg).attr("fill-opacity", d => d.op).attr("stroke", halo).attr("stroke-width", 1.3)
      .attr("cx", d => d.pos[0]).attr("cy", d => d.pos[1]);
    const etiketter = [...banor_];
    if (medB.length && medB.length <= MAX_MEDETIKETTER) {
      for (const m of medB) if (m.e !== me) etiketter.push({ id: `m:${m.id}`, namn: namnPa(m.e.kod), pos: m.e.pos, farg: m.g.farg, op: medOp(m) > 0.25 ? 0.9 : 0.3, liten: true });
    }
    // Den markerade får en egen etikett — om den inte redan är en egen grupp
    if (me && !grupper.some(g_ => g_.id === `e:${me.kod}`)) etiketter.push({ id: "mark", namn: namnPa(me.kod), pos: me.pos, farg: mFarg, op: 1 });
    ritaSpetsEtiketter(etiketter);
    ritaMarkering(me, mFarg);

    if (hov) {
      // Den hovrade banan ritas överst; den markerade har redan sin egen
      if (hov !== me) hovBana.attr("d", linje(bana(hov, ar))).attr("stroke", fargFor(hov.kod) === ink.stark ? ink.mjuk : fargFor(hov.kod)).attr("opacity", 0.9);
      else hovBana.attr("opacity", 0);
      hovRing.attr("cx", hov.pos[0]).attr("cy", hov.pos[1]).attr("r", (hov.r ?? 2.6) + 4).attr("opacity", 1);
      visaTips(hov);
    } else { hovBana.attr("opacity", 0); hovRing.attr("opacity", 0); }
  }

  // Linjeläget: alla enheter som tunna grå linjer, gruppernas kommuner i
  // gruppens färg, riket och grupperna ovanpå, den markerade överst. Etiketter
  // i en kolumn till höger om linjeslutet (högst värde överst, klammer).
  // Linjelägets punkter för serien s fram till året ar (helår, sist bråkåret)
  function pktL(s) {
    const b = basAr, a = ar, st = linjeStart(b), ut = [];
    for (let k = st; k < a - 1e-9; k++) ut.push([k, lv(s, k, b)]);
    if (a >= st - 1e-9) ut.push([a, lv(s, a, b)]);
    return ut;
  }
  // Geometrins nyckel: allt som flyttar linjerna. Banans d-sträng cachas per
  // serie och nyckel, och attribut skrivs bara när värdet ändrats.
  const geoNyckel = () => `${basAr}|${ar}|${vis.skala}${vis.tid}|${dom.x[0]},${dom.x[1]}|${dom.y[0]},${dom.y[1]}|${riketVy() ? "R" : ""}`;
  let geo = "";
  const dFor = s => { if (s.__dg !== geo) { s.__dg = geo; s.__d = linjeL(pktL(s)) ?? ""; } return s.__d; };
  const satt = (n, k, v) => { const c = (n.__a ??= {}); if (c[k] !== v) { c[k] = v; n.setAttribute(k, v); } };
  // De grå linjerna på canvasen: bara när nyckeln (geometri, opacitet, vilka
  // enheter) ändrats. Varje linje får ett eget streck så att opaciteten
  // adderas där linjerna ligger tätt, som med separata SVG-banor.
  function ritaGra(gra, op, nyckel) {
    if (!duk || (!dukS && !matDuk())) return;
    const nk = `${nyckel}|${op}|${dukS}|${dukK}`;
    if (nk === dukNyckel) return;
    dukNyckel = nk;
    const c = dukCtx, f = dukS * dukK;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, duk.width, duk.height);
    if (!gra.length || op <= 0) return;
    c.setTransform(f, 0, 0, f, f, f);            // ritytans koordinater; 1 enhet klippkant
    c.lineWidth = 0.75; c.lineJoin = "bevel"; c.lineCap = "butt";   // syns inte i 0,75 px, men billigare än runda
    c.strokeStyle = ink.svag; c.globalAlpha = op;
    const b = basAr, a = ar, st = linjeStart(b), ka = Math.floor(a + 1e-9), fr = a - ka;
    const [x0, x1] = dom.x, [y0, y1] = dom.y, ax = iw / (x1 - x0), ay = ih / (y1 - y0);
    // Sträckor klipps mot ett band strax utanför ritytan. Linjer långt utanför
    // skalan (t.ex. mitt i en övergång mellan visningar) ger annars jättelika
    // koordinater som är mycket dyra att rastrera.
    const LO = -4, HI = ih + 4;
    let px = 0, py = 0, har = false, penna = false;
    const till = (X, Y) => {
      if (!har) { px = X; py = Y; har = true; penna = false; return; }
      const ute0 = py < LO ? -1 : py > HI ? 1 : 0, ute1 = Y < LO ? -1 : Y > HI ? 1 : 0;
      if (ute0 && ute0 === ute1) { px = X; py = Y; penna = false; return; }
      let ax_ = px, ay_ = py, bx = X, by = Y;
      if (ute0) { const g_ = ute0 < 0 ? LO : HI, t = (g_ - py) / (Y - py); ax_ = px + t * (X - px); ay_ = g_; }
      if (ute1) { const g_ = ute1 < 0 ? LO : HI, t = (g_ - py) / (Y - py); bx = px + t * (X - px); by = g_; }
      if (!penna || ute0) c.moveTo(ax_, ay_);
      c.lineTo(bx, by);
      penna = !ute1;
      px = X; py = Y;
    };
    for (const e of gra) {
      const L = lvAr(e, b);
      har = false; penna = false;
      c.beginPath();
      for (let k = st; k <= ka; k++) {
        const v = L[k - AR0];
        if (!ok(v)) { har = false; continue; }
        till((k - x0) * ax, ih - (v - y0) * ay);
      }
      if (fr > 1e-9 && har) { const v = lv(e, a, b); if (ok(v)) till((a - x0) * ax, ih - (v - y0) * ay); }
      c.stroke();
    }
  }
  let etNyckel = null;
  function ritaLinjer() {
    const b = basAr, a = ar, st = linjeStart(b);
    geo = geoNyckel();
    const pkt = pktL;
    const hornH = hornHov ?? (vy?.typ === "horn" ? vy.h : null);
    const mark = forhand?.koder ?? (hornHov ? new Set(hornFor(helAr(), b)[hornHov].map(e => e.kod)) : null) ?? (vy?.typ === "horn" ? vy.koder : null);
    const markId = forhand ? `f:${forhand.namn}` : hornHov ? `h:${hornHov}` : vy?.typ === "horn" ? `v:${vy.h}|${vy.ar}|${vy.bas}` : "";
    const markFarg = !forhand && hornH ? (hornH === "upp" ? UPP : NED) : ink.mjuk;
    const lyft = lyftId ? grupper.find(g_ => g_.id === lyftId) : vyGrupp();
    const harG = grupper.length > 0;
    const me = markEnhet(), mFarg = me ? fargFor(me.kod) : null;
    // Enskilda kommuner som är egna grupper ritas som grupplinjer; kommuner i
    // en grupp med ≋ i gruppens färg; övriga grå (markerade av hörn/hovring ovanpå).
    // I utsnittet Riket ritas inga grå linjer, bara de markerade.
    const iEgen = new Set(grupper.filter(g_ => g_.lista.length === 1).map(g_ => g_.lista[0].kod));
    const medlem = new Map();
    for (const g_ of grupper) if (g_.lista.length > 1 && g_.banor) for (const e of g_.lista) if (!iEgen.has(e.kod) && !medlem.has(e.kod)) medlem.set(e.kod, g_);
    const gra = [], graM = [], riket_ = riketVy();
    for (const e of enheter) {
      if (iEgen.has(e.kod) || medlem.has(e.kod)) continue;
      if (mark?.has(e.kod)) graM.push(e); else if (!riket_) gra.push(e);
    }
    const dampa = op => op * (me ? 0.6 : 1) * (radHov ? 0.4 : 1);
    const graOp = mark ? 0.05 : harG ? (zoomar() ? 0.07 : 0.11) : 0.2;
    const rund = s => s.attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    ritaGra(gra, dampa(graOp), `${geo}|${grupper.map(g_ => g_.id + (g_.banor ? "≋" : "")).join(",")}|${markId}`);
    // Hovring lyfter starkt; en öppen lista (hörnet) lugnare
    const opM = dampa(hornHov || forhand ? 0.55 : 0.32);
    gGraM.selectAll("path").data(graM, d => d.kod).join(en => en.append("path").call(rund).attr("stroke-width", 1))
      .each(function (e) { satt(this, "stroke", markFarg); satt(this, "stroke-opacity", opM); satt(this, "d", dFor(e)); });
    const medB = [...medlem].map(([kod, g_]) => ({ id: `${g_.id}|${kod}`, e: enhetMap.get(kod), g: g_ }));
    const medOp = d => (d.e === me ? 0 : (lyft ? (lyft === d.g ? 0.8 : 0.2) : 0.6) * (mark && !mark.has(d.e.kod) ? 0.3 : 1) * (me ? 0.6 : 1) * (radHov ? 0.3 : 1));
    gMed.selectAll("path").data(medB, d => d.id).join(en => en.append("path").call(rund).attr("stroke-width", 1.1))
      .each(function (d) { satt(this, "stroke", d.g.farg); satt(this, "stroke-opacity", medOp(d)); satt(this, "d", dFor(d.e)); });

    const snitt = (n, s) => (vis.skala === "faktisk" && delare(s) > 1 ? `${n}, snitt` : n);
    const banor_ = [];
    if (ref) banor_.push({ id: "ref", namn: snitt(ref.namn, ref), serie: ref, farg: ink.stark, tfarg: ink.mjuk, streck: "0.1 3.4", bredd: riket_ ? 2.2 : 1.8, op: riket_ ? 1 : 0.85, kursiv: true, prio: 3 });
    for (const g_ of grupper) {
      const egenMark = me && g_.id === `e:${me.kod}`;
      banor_.push({ id: g_.id, namn: snitt(g_.namn, g_.serie), serie: g_.serie, farg: g_.farg, bredd: g_.lista.length > 1 ? 2.6 : 2,
        op: egenMark ? 1 : me ? 0.55 : lyft && lyft !== g_ ? 0.35 : 1, prio: 2 });
    }
    if (forhand?.serie && !grupper.some(g_ => g_.namn === forhand.namn)) banor_.push({ id: "forhand", namn: forhand.namn, serie: forhand.serie, farg: ink.stark, streck: "4 2", bredd: 1.4, op: 0.85, utanEtikett: true });
    if (radHov) for (const bn of banor_) bn.op *= 0.4;
    gBan.selectAll("path").data(banor_, d => d.id).join(en => en.append("path").call(rund))
      .each(function (d) {
        satt(this, "stroke", d.farg); satt(this, "stroke-width", d.bredd); satt(this, "stroke-opacity", d.op);
        if (d.streck) satt(this, "stroke-dasharray", d.streck); else if (this.__a["stroke-dasharray"]) { this.removeAttribute("stroke-dasharray"); this.__a["stroke-dasharray"] = null; }
        satt(this, "d", dFor(d.serie));
      });
    const [y0, y1] = dom.y;
    const ankare = v => sy(kl(v, y0, y1));
    for (const bn of banor_) { bn.v = lv(bn.serie, a, b); bn.pos = [sx(a), ok(bn.v) ? ankare(bn.v) : -99]; }
    // De färgade linjerna, för årsstrecket: riket, grupperna, gruppkommunerna
    // (när de har etiketter) och den markerade
    synliga = [
      ...banor_.filter(bn => !bn.utanEtikett).map(bn => ({ id: bn.id, namn: bn.namn, farg: bn.farg, s: bn.serie, kursiv: !!bn.kursiv })),
      ...(medB.length <= MAX_MEDETIKETTER ? medB.filter(m => m.e !== me).map(m => ({ id: `m:${m.id}`, namn: namnPa(m.e.kod), farg: m.g.farg, s: m.e })) : []),
      ...(me && !grupper.some(g_ => g_.id === `e:${me.kod}`) ? [{ id: "mark", namn: namnPa(me.kod), farg: mFarg, s: me }] : [])
    ];
    gSp.selectAll("circle").data(banor_.filter(bn => ok(bn.v) && a >= st - 1e-9), d => d.id).join("circle").attr("r", d => (d.id === "ref" ? 2.8 : 3.4))
      .attr("fill", d => d.farg).attr("fill-opacity", d => d.op).attr("stroke", halo).attr("stroke-width", 1.2)
      .attr("cx", d => d.pos[0]).attr("cy", d => d.pos[1]);

    // Etikettkolumnen
    const pil = v => (v > y1 ? "↑ " : v < y0 ? "↓ " : "");
    const etl = [];
    if (a >= st - 1e-9) {
      for (const bn of banor_) if (!bn.utanEtikett && ok(bn.v)) etl.push({ id: bn.id, text: `${pil(bn.v)}${bn.namn} ${lvFmt(bn.v)}`, ankarY: bn.pos[1], farg: bn.farg, tfarg: bn.tfarg ?? bn.farg, vikt: 500, kursiv: !!bn.kursiv, op: Math.max(0.35, bn.op), prioritet: bn.prio });
      if (medB.length && medB.length <= MAX_MEDETIKETTER) for (const m of medB) {
        if (m.e === me) continue;
        const v = lv(m.e, a, b);
        if (ok(v)) etl.push({ id: `m:${m.id}`, text: `${pil(v)}${namnPa(m.e.kod)} ${lvFmt(v)}`, ankarY: ankare(v), farg: m.g.farg, tfarg: m.g.farg, vikt: 400, op: medOp(m) > 0.25 ? 0.95 : 0.35, prioritet: 1 });
      }
      if (me && !grupper.some(g_ => g_.id === `e:${me.kod}`)) {
        const v = lv(me, a, b);
        if (ok(v)) etl.push({ id: "mark", text: `${pil(v)}${namnPa(me.kod)} ${lvFmt(v)}`, ankarY: ankare(v), farg: mFarg, tfarg: mFarg === ink.stark ? ink.stark : mFarg, vikt: 600, op: 1, prioritet: 4 });
      }
    }
    // Etiketterna placeras och ritas om bara när någon av dem ändrats
    const etN = `${sx(a)}|${etl.map(e => `${e.id}:${e.text}:${Math.round(e.ankarY * 10)}:${e.op}:${e.farg}`).join("|")}`;
    if (etN !== etNyckel) {
      etNyckel = etN;
      const placerade = placeraEtiketter(etl, { yMin: 0, yMax: ih, avstand: ET_AVST, maxBredd: M.right - 22, px: 11 }).map(e => ({ ...e, ankarX: sx(a) }));
      ritaEtiketter(gEt, placerade, { farg: e => e.farg, textfarg: e => e.tfarg, halo, px: 11, vikt: e => e.vikt, kursiv: e => e.kursiv, opacitet: e => e.op, avstand: ET_AVST });
    }
    ritaMarkeringLinje(me, mFarg, pkt);
    ritaHovLinje();
  }
  // Hovringslagret i linjeläget: årsstrecket med prickar och årstips, den
  // hovrade grå linjen och dess ring. Ritas för sig när bara hovringen ändras,
  // så att resten av grafen står orörd.
  //   Årsstrecket följer pekaren över ritytan och snäpper till närmaste år.
  //   Tipset listar året för de färgade linjerna (riket, grupperna,
  //   gruppkommunerna med etikett, den markerade), sorterat efter värdet. Är
  //   pekaren nära en grå linje lyfts den och läggs till i samma tips, så att
  //   det aldrig finns två tips samtidigt.
  function ritaHovLinje() {
    const st = linjeStart(basAr), sista = Math.floor(ar + 1e-9);
    let aH = arHov != null && arHov >= st && arHov <= sista ? arHov : null;
    // En hovrad rad i panelens lista: tipset vid linjeslutet
    if (aH == null && hov && radHov === hov && sista >= st) { aH = sista; const v = lv(hov, sista, basAr); if (ok(v)) hovMy = sy(kl(v, dom.y[0], dom.y[1])); }
    const c = hov ? fargFor(hov.kod) : null;
    if (hov && hov !== markEnhet()) hovBana.attr("d", dFor(hov)).attr("stroke", c === ink.stark ? ink.mjuk : c).attr("stroke-width", 1.8).attr("opacity", 0.95);
    else hovBana.attr("opacity", 0);
    const hv = hov && aH != null ? lv(hov, aH, basAr) : NaN;
    if (ok(hv)) hovRing.attr("cx", sx(aH)).attr("cy", sy(kl(hv, dom.y[0], dom.y[1]))).attr("r", 4.5).attr("opacity", 1);
    else hovRing.attr("opacity", 0);
    if (aH == null) {
      arStreck.attr("opacity", 0); arPrickar.selectAll("circle").remove();
      if (tipsNyckel?.startsWith("y|")) { tips.style.opacity = 0; tipsNyckel = null; }
      return;
    }
    const x_ = sx(aH);
    arStreck.attr("x1", x_).attr("x2", x_).attr("opacity", 1);
    const rader_ = synliga.map(r => ({ ...r, v: lv(r.s, aH, basAr) })).filter(r => ok(r.v));
    arPrickar.selectAll("circle").data(rader_, r => r.id).join("circle").attr("r", r => (r.id === "ref" ? 2.8 : 3.2))
      .attr("fill", r => r.farg).attr("stroke", halo).attr("stroke-width", 1.2)
      .attr("cx", x_).attr("cy", r => sy(kl(r.v, dom.y[0], dom.y[1])));
    visaArsTips(aH, rader_);
  }

  // Markerad kommun: tjock bana överst på en halo och en prick per år. Hovras
  // en årsprick visas året och förändringen dit.
  let markPrickar = [];
  // Lagerordning inom markeringen: årtal, banan (på halo), prickar
  const gmEt = gMark.append("g"), gmBan = gMark.append("g"), gmPr = gMark.append("g");
  if (LINJE) klipp(gmBan);         // linjen klipps, prickarna (inom skalan) ritas hela
  function ritaMarkering(me, c) {
    const d0 = me ? [me] : [];
    const st = Math.min(ar, banStart());
    const rund = s => s.attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    gmBan.selectAll("path.mh").data(d0).join("path").attr("class", "mh").call(rund)
      .attr("stroke", halo).attr("stroke-width", 5.5).attr("stroke-opacity", 0.85).attr("d", e => linje(bana(e, ar)));
    gmBan.selectAll("path.mb").data(d0).join("path").attr("class", "mb").call(rund)
      .attr("stroke", c).attr("stroke-width", 2.4).attr("d", e => linje(bana(e, ar)));
    markPrickar = !me ? [] : d3.range(Math.ceil(st - 1e-9), Math.floor(ar + 1e-9) + 1).map(a => {
      const q = ix(me, a);
      return { a, x: sx(q[0]), y: sy(q[1]) };
    });
    // Årtalet står på utsidan av banans sväng i pricken (bort från grannarnas
    // mittpunkt); går banan rakt står det vinkelrätt mot den
    markPrickar.forEach((d, i) => {
      const fo = markPrickar[i - 1] ?? d, ef = markPrickar[i + 1] ?? d;
      let nx = d.x - (fo.x + ef.x) / 2, ny = d.y - (fo.y + ef.y) / 2, l = Math.hypot(nx, ny);
      if (l < 1.5) {
        const vx = ef.x - fo.x, vy = ef.y - fo.y, lv_ = Math.hypot(vx, vy);
        [nx, ny] = lv_ < 1e-6 ? [1, 0] : [-vy / lv_, vx / lv_];
        if (nx < 0) { nx = -nx; ny = -ny; }
      } else { nx /= l; ny /= l; }
      if (d.x + nx * 10 + 28 > iw || d.x + nx * 10 - 28 < 0) { nx = -nx; ny = -ny; }
      d.et = { x: d.x + nx * 10, y: d.y + ny * 10, a: nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle", dy: ny > 0.35 ? "0.75em" : ny < -0.35 ? "-0.1em" : "0.33em" };
    });
    ritaArtal(c);
  }
  function ritaMarkeringLinje(me, c, pkt) {
    const d0 = me ? [me] : [];
    const rund = s => s.attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
    gmBan.selectAll("path.mh").data(d0).join("path").attr("class", "mh").call(rund)
      .attr("stroke", halo).attr("stroke-width", 5.5).attr("stroke-opacity", 0.85).attr("d", e => linjeL(pkt(e)));
    gmBan.selectAll("path.mb").data(d0).join("path").attr("class", "mb").call(rund)
      .attr("stroke", c).attr("stroke-width", 2.6).attr("d", e => linjeL(pkt(e)));
    const st = linjeStart(basAr);
    markPrickar = !me ? [] : d3.range(st, Math.floor(ar + 1e-9) + 1).map(a => ({ a, v: lv(me, a, basAr) })).filter(d => ok(d.v) && d.v >= dom.y[0] && d.v <= dom.y[1])
      .map(d => ({ a: d.a, x: sx(d.a), y: sy(d.v), et: { x: sx(d.a), y: sy(d.v) - 9, a: "middle", dy: "0" } }));
    ritaArtal(c);
  }
  function ritaArtal(c) {
    gmEt.selectAll("text").data(markPrickar.filter(d => d.a === markAr), d => d.a).join("text")
      .attr("x", d => d.et.x).attr("y", d => d.et.y).attr("text-anchor", d => d.et.a).attr("dy", d => d.et.dy).attr("font-family", MONO).attr("font-size", 9.5)
      .attr("fill", ink.stark).attr("stroke", halo).attr("stroke-width", 3).attr("paint-order", "stroke").text(d => d.a);
    gmPr.selectAll("circle.ap").data(markPrickar, d => d.a).join("circle").attr("class", "ap")
      .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => (d.a === markAr ? 4.4 : 1.9))
      .attr("fill", d => (d.a === markAr ? halo : c)).attr("stroke", c).attr("stroke-width", d => (d.a === markAr ? 1.5 : 0));
    const sista = LINJE ? markPrickar.at(-1) : null;
    const me = markEnhet();
    gmPr.selectAll("circle.ms").data(me && (!LINJE || sista) ? [me] : []).join("circle").attr("class", "ms").attr("r", 4.6)
      .attr("fill", c).attr("stroke", halo).attr("stroke-width", 1.6)
      .attr("cx", e => (LINJE ? sx(ar) : e.pos[0])).attr("cy", e => (LINJE ? sy(kl(lv(e, ar, basAr), dom.y[0], dom.y[1])) : e.pos[1]));
  }

  function ritaAxlar() {
    const xt = ticks(dom.x, stegX), yt = ticks(dom.y, stegY);
    gRut.selectAll("line.vx").data(xt, d => d).join("line").attr("class", "vx").attr("y1", 0).attr("y2", ih).attr("stroke", ink.rutnat)
      .attr("x1", d => Math.round(sx(d)) + 0.5).attr("x2", d => Math.round(sx(d)) + 0.5);
    gRut.selectAll("line.hy").data(yt, d => d).join("line").attr("class", "hy").attr("x1", 0).attr("x2", iw).attr("stroke", ink.rutnat)
      .attr("y1", d => Math.round(sy(d)) + 0.5).attr("y2", d => Math.round(sy(d)) + 0.5);
    // Hårkorset: vid bas i indexläget, vid `kors` (om angivet) i nivåläget
    gRut.selectAll("line.kors").data([0, 1].filter(d => (d ? KY : KX) != null)).join("line").attr("class", "kors").attr("stroke", ink.mjuk).attr("stroke-opacity", 0.5)
      .attr("x1", d => d ? 0 : Math.round(sx(KX)) + 0.5).attr("x2", d => d ? iw : Math.round(sx(KX)) + 0.5)
      .attr("y1", d => d ? Math.round(sy(KY)) + 0.5 : 0).attr("y2", d => d ? Math.round(sy(KY)) + 0.5 : ih);
    // Diagonalen y = x, där axlarna mäter samma sak
    const dg = diagonal ? [Math.max(dom.x[0], dom.y[0]), Math.min(dom.x[1], dom.y[1])] : null;
    gRut.selectAll("line.diag").data(dg && dg[1] > dg[0] ? [dg] : []).join("line").attr("class", "diag").attr("stroke", ink.mjuk)
      .attr("stroke-dasharray", "3 3").attr("stroke-opacity", 0.7)
      .attr("x1", d => sx(d[0])).attr("y1", d => sy(d[0])).attr("x2", d => sx(d[1])).attr("y2", d => sy(d[1]));
    gAx.selectAll("text.tx").data(xt, d => d).join("text").attr("class", "tx").attr("y", ih + 15).attr("text-anchor", "middle")
      .attr("font-family", MONO).attr("font-size", 10.5).attr("fill", d => d === KX ? ink.stark : ink.svag).attr("x", d => sx(d)).text(d => axFmt(d));
    gAx.selectAll("text.ty").data(yt, d => d).join("text").attr("class", "ty").attr("x", -7).attr("dy", "0.34em").attr("text-anchor", "end")
      .attr("font-family", MONO).attr("font-size", 10.5).attr("fill", d => d === KY ? ink.stark : ink.svag).attr("y", d => sy(d)).text(d => axFmt(d));
  }
  function ritaAxlarLinje() {
    // Periodens första och sista år alltid utskrivna, jämna steg däremellan
    const [m0, m1] = domMal.x, luckan = Math.max(1, stegX * 0.6);
    const xt = [m0, ...ticks(domMal.x, stegX).filter(a => a - m0 >= luckan && m1 - a >= luckan), m1]
      .filter((a, i, l) => l.indexOf(a) === i && a >= dom.x[0] - 1e-9 && a <= dom.x[1] + 1e-9);
    const yt = ticks(dom.y, stegY);
    gRut.selectAll("line.hy").data(yt, d => d).join("line").attr("class", "hy").attr("x1", 0).attr("x2", iw).attr("stroke", ink.rutnat)
      .attr("y1", d => Math.round(sy(d)) + 0.5).attr("y2", d => Math.round(sy(d)) + 0.5);
    gRut.selectAll("line.noll").data(dom.y[0] <= 0 && dom.y[1] >= 0 ? [0] : []).join("line").attr("class", "noll").attr("x1", 0).attr("x2", iw)
      .attr("stroke", ink.mjuk).attr("stroke-opacity", 0.55).attr("y1", Math.round(sy(0)) + 0.5).attr("y2", Math.round(sy(0)) + 0.5);
    gRut.selectAll("line.bot").data([0]).join("line").attr("class", "bot").attr("x1", 0).attr("x2", iw).attr("y1", ih + 0.5).attr("y2", ih + 0.5).attr("stroke", ink.linje);
    // Källbyten: prickad lodlinje mellan åren, kort etikett nedtill
    const kb = kallByten.filter(k => k.ar - 0.5 > dom.x[0] && k.ar - 0.5 < dom.x[1]);
    gRut.selectAll("g.kbl").data(kb, d => d.ar).join(e => { const gg = e.append("g").attr("class", "kbl"); gg.append("line"); gg.append("text"); gg.append("title"); return gg; })
      .call(gg => {
        gg.select("line").attr("y1", 0).attr("y2", ih).attr("stroke", ink.svag).attr("stroke-dasharray", "1 3").attr("x1", d => sx(d.ar - 0.5)).attr("x2", d => sx(d.ar - 0.5));
        gg.select("text").attr("x", d => sx(d.ar - 0.5) + 3).attr("y", ih - 4).attr("font-family", MONO).attr("font-size", 9).attr("fill", ink.svag).text(d => kbKort(d));
        gg.select("title").text(d => `${d.ar}: källbyte ${kbText(d)}`);
      });
    gAx.selectAll("text.tx").data(xt, d => d).join("text").attr("class", "tx").attr("y", ih + 17).attr("text-anchor", "middle")
      .attr("font-family", MONO).attr("font-size", 10.5).attr("fill", ink.svag).attr("x", d => sx(d)).text(d => d);
    gAx.selectAll("text.ty").data(yt, d => d).join("text").attr("class", "ty").attr("x", -7).attr("dy", "0.34em").attr("text-anchor", "end")
      .attr("font-family", MONO).attr("font-size", 10.5).attr("fill", d => (Math.abs(d) < 1e-9 ? ink.stark : ink.svag)).attr("y", d => sy(d)).text(d => lyFmt(d));
    yTitel.text(`${MNAMN} · förändring ${vis.tid === "ack" ? `sedan ${per.fran}` : "mot året innan"}${vis.skala === "faktisk" ? ", antal" : ", procent"}`);
  }

  // Etiketter vid banornas spetsar i spridningsläget (OWID-metodik). Varje
  // etikett vill stå på sin spets höjd, till höger om spetsen — eller till
  // vänster om den inte får plats. Bara etiketter som faktiskt krockar bildar
  // ett kluster; inom klustret löses krocken med minsta förflyttning under
  // bevarad ordning (isoton regression, PAV). Under uppspelning glider höjden
  // mjukt mot målet. Kommunbanornas etiketter är mindre och står bara när de är få.
  const etikettY = new Map();
  const ETIKETT_AVST = 13;
  function ritaSpetsEtiketter(banor_) {
    const poster = banor_.filter(b => !b.utanEtikett && b.pos && ok(b.pos[0]) && ok(b.pos[1])).map(b => {
      const text = b.namn.length > 14 ? `${b.namn.slice(0, 13).trimEnd()}…` : b.namn;
      const w = text.length * (b.liten ? 5.5 : 6.1) + 2;           // ungefärlig bredd
      const hoger = b.pos[0] + 8 + w <= iw + M.right - 6;
      return { b, text, w, hoger, x: hoger ? b.pos[0] + 8 : b.pos[0] - 8, y0: b.pos[1] };
    });
    const sida = p => (p.hoger ? [p.x, p.x + p.w] : [p.x - p.w, p.x]);
    // Kluster av krockande etiketter (union–find)
    const far = poster.map((_, i) => i);
    const rot_ = i => (far[i] === i ? i : (far[i] = rot_(far[i])));
    for (let i = 0; i < poster.length; i++) for (let j = i + 1; j < poster.length; j++) {
      const [a0, a1] = sida(poster[i]), [b0, b1] = sida(poster[j]);
      if (a0 < b1 && b0 < a1 && Math.abs(poster[i].y0 - poster[j].y0) < ETIKETT_AVST + 2) far[rot_(i)] = rot_(j);
    }
    for (const kl_ of d3.groups(poster.map((p, i) => ({ p, k: rot_(i) })), d => d.k).map(([, v]) => v.map(d => d.p))) {
      kl_.sort((p, q) => p.y0 - q.y0);
      const ys = pav(kl_.map(p => p.y0), ETIKETT_AVST, 5, ih - 5);
      kl_.forEach((p, i) => { p.mal = ys[i]; });
    }
    for (const p of poster) {
      const forra = etikettY.get(p.b.id);
      p.y = timer && forra != null ? lerp(forra, p.mal, 0.35) : p.mal;
      etikettY.set(p.b.id, p.y);
    }
    gEt.selectAll("g").data(poster, p => p.b.id).join(e => {
      const gg = e.append("g");
      gg.append("path").attr("fill", "none").attr("stroke-width", 0.7);
      gg.append("text").attr("dominant-baseline", "middle")
        .attr("stroke", halo).attr("stroke-width", 3).attr("paint-order", "stroke").attr("stroke-linejoin", "round");
      return gg;
    }).each(function (p) {
      const gg = d3.select(this);
      const flyttad = Math.abs(p.y - p.y0) > 3;
      const kant_ = p.hoger ? p.x - 3 : p.x + 3;
      gg.select("path").attr("stroke", p.b.farg).attr("stroke-opacity", flyttad ? 0.6 * p.b.op : 0)
        .attr("d", `M${p.b.pos[0]},${p.b.pos[1]}L${kant_},${p.y}`);
      gg.select("text").attr("x", p.x).attr("y", p.y).attr("text-anchor", p.hoger ? "start" : "end").text(p.text)
        .attr("font-size", p.b.liten ? 10 : 11).attr("font-weight", p.b.liten ? 400 : 500)
        .attr("font-style", p.b.kursiv ? "italic" : null)
        .attr("fill", p.b.id === "ref" ? ink.mjuk : p.b.liten ? ink.mjuk : ink.stark).attr("fill-opacity", Math.max(0.35, p.b.op));
    });
  }
  function pav(mal, avst, lo, hi) {
    const bl = [];
    mal.forEach((t, i) => {
      bl.push({ s: t - i * avst, n: 1 });
      while (bl.length > 1 && bl.at(-2).s / bl.at(-2).n > bl.at(-1).s / bl.at(-1).n) { const b = bl.pop(), a = bl.pop(); bl.push({ s: a.s + b.s, n: a.n + b.n }); }
    });
    let ut = bl.flatMap(b => Array(b.n).fill(b.s / b.n)).map((v, i) => v + i * avst);
    if (ut.length && ut.at(-1) > hi) { const d = ut.at(-1) - hi; ut = ut.map(v => v - d); }
    if (ut.length && ut[0] < lo) { const d = lo - ut[0]; ut = ut.map(v => v + d); }
    return ut;
  }

  // ── Verktygstips ──────────────────────────────────────────────────────────
  function placeraTips(gx, gy, nedat = false) {
    const rr = rot.getBoundingClientRect(), s = svg.node().getBoundingClientRect();
    const sk = rr.width / rot.offsetWidth || 1, svs = s.width / W;
    const px = ((s.left - rr.left) + (gx + M.left) * svs) / sk, py = ((s.top - rr.top) + (gy + M.top) * svs) / sk;
    const tw = tips.offsetWidth || 220, th = tips.offsetHeight || 90;
    const lx = px + 16 + tw > rot.offsetWidth ? px - 16 - tw : px + 16;
    const ly = nedat ? py + 12 : (py - th - 12 < 0 ? py + 14 : py - th - 12);
    tips.style.transform = `translate(${Math.max(0, lx)}px, ${Math.max(0, ly)}px)`;
    tips.style.opacity = 1;
  }
  let tipsNyckel = null;
  const tipsHuvud = (rubrik, hoger) => `<div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline"><span style="font-weight:600;font-size:12.5px">${rubrik}</span><span style="font-family:${MONO};font-size:10.5px;color:${ink.svag}">${hoger}</span></div>`;
  const tipsGrupper = e => {
    const gg = grupper.filter(g_ => g_.koder.has(e.kod));
    return gg.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:10.5px;color:${ink.mjuk}">${gg.map(g_ => `<span><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${g_.farg};margin-right:4px"></span>${g_.namn}</span>`).join("")}</div>` : "";
  };
  const tipsTillhor = e => {
    const tillhor = grupperingar.map(gr => gr.nyckel(infoMap.get(e.kod) ?? {})).filter(Boolean);
    return tillhor.length ? `<div style="font-size:10.5px;color:${ink.svag};margin:1px 0 6px">${tillhor.join(" · ")}</div>` : "";
  };
  function visaTips(e) {
    const a = helAr(), ia = ai(a), ib = ai(basAr);
    const nyckel = `${e.kod}|${a}|${basAr}|${markerad}|${radHov === e}|${grupper.map(g_ => g_.id).join(",")}`;
    if (nyckel === tipsNyckel && tips.style.opacity === "1") return placeraTips(e.pos[0], e.pos[1]);
    tipsNyckel = nyckel;
    const r_ = (et, V) => `<span style="color:${ink.mjuk}">${et}</span><span style="font-family:${MONO};text-align:right">${niv(V[ia])}</span>`
      + `<span style="font-family:${MONO};text-align:right;color:${ink.mjuk}">${fF(forand(V[ib], V[ia]))} <span style="color:${ink.svag}">(${fran_(V[ib], V[ia])})</span></span>`;
    tips.innerHTML = tipsHuvud(namnPa(e.kod), periodTxt(a)) + tipsTillhor(e)
      + `<div class="tt" style="padding-top:5px;border-top:1px solid ${ink.rutnat}">${r_(raknare.yNamn, e.Y)}${r_(raknare.xNamn, e.X)}</div>`
      + tipsGrupper(e)
      + `<div style="font-size:10px;color:${ink.svag};margin-top:6px">${klickText(e)}</div>`;
    placeraTips(e.pos[0], e.pos[1]);
  }
  // Linjeläget: årstipset. En rad per färgad linje (och den hovrade grå),
  // sorterad efter värdet i aktuell visning. Första talkolumnen är linjens
  // eget värde (det som syns i grafen), den andra den andra tidsvisningen:
  // ackumulerat visar förändringen sedan periodens början och mot året innan,
  // årlig förändring tvärtom. Faktiska tal i antal (snitt per kommun där
  // namnet säger det), relativa i procent.
  const andrL = (s, a, tid) => {
    const V = s[MK], ia = ai(a), ib = tid === "ack" ? ai(basAr) : ia - 1;
    if (tid === "ack" ? a <= basAr : ia <= 0) return NaN;
    return vis.skala === "relativ" ? pct(V[ib], V[ia]) : (V[ia] - V[ib]) / delare(s);
  };
  function visaArsTips(aH, rader_) {
    const hr = hov && !rader_.some(r => r.s === hov) ? { id: "hov", namn: namnPa(hov.kod), farg: fargFor(hov.kod), s: hov, v: lv(hov, aH, basAr), hovrad: true } : null;
    const alla = (hr && ok(hr.v) ? [...rader_, hr] : rader_).map(r => ({ ...r, hovrad: r.hovrad || r.s === hov })).sort((p, q) => q.v - p.v);
    const nyckel = `y|${aH}|${basAr}|${vis.skala}${vis.tid}|${hov?.kod ?? ""}|${riketVy()}|${alla.map(r => r.id).join(",")}`;
    if (nyckel !== tipsNyckel || tips.style.opacity !== "1") {
      tipsNyckel = nyckel;
      const ack = vis.tid === "ack", annan = ack ? "arlig" : "ack";
      const kolA = ack ? `sedan ${basAr}` : `mot ${aH - 1}`, kolB = ack ? `mot ${aH - 1}` : `sedan ${basAr}`;
      const prick = r => (r.id === "ref"
        ? `<span style="display:inline-block;width:10px;border-top:2px dotted ${ink.stark};margin-right:6px;vertical-align:middle"></span>`
        : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.farg};margin-right:6px;vertical-align:middle"></span>`);
      const rad_ = r => {
        const bg = r.hovrad ? `background:${tonad};` : "";
        return `<span style="${bg}color:${ink.stark};${r.kursiv ? "font-style:italic;" : ""}${r.hovrad ? "font-weight:600;" : ""}max-width:170px;overflow:hidden;text-overflow:ellipsis;padding:1px 2px">${prick(r)}${r.namn}</span>`
          + `<span style="${bg}font-family:${MONO};text-align:right;font-weight:600;padding:1px 2px">${lvFmt(r.v)}</span>`
          + `<span style="${bg}font-family:${MONO};text-align:right;color:${ink.mjuk};padding:1px 2px">${lvFmt(andrL(r.s, aH, annan))}</span>`;
      };
      const sv_ = t => `<span style="color:${ink.svag};font-size:9.5px;text-align:right">${t}</span>`;
      tips.innerHTML = tipsHuvud(`${aH}`, `${MNAMN.toLowerCase()}, ${vis.skala === "relativ" ? "procent" : "antal"}`)
        + `<div class="tt" style="margin-top:5px;padding-top:5px;border-top:1px solid ${ink.rutnat};column-gap:10px"><span></span>${sv_(kolA)}${sv_(kolB)}${alla.map(rad_).join("")}</div>`
        + (hov ? `<div style="margin-top:6px;padding-top:5px;border-top:1px solid ${ink.rutnat}">${tipsTillhor(hov).replace("margin:1px 0 6px", "margin:0")}<div style="font-size:10px;color:${ink.svag};margin-top:3px">${klickText(hov)}</div></div>` : "");
    }
    placeraTips(sx(aH), hovMy);
  }
  const klickText = e => (radHov === e ? "Klicka på raden för att se år för år"
    : e.kod === markerad ? "Hovra över årsprickarna för år för år · klicka för att släppa"
    : gruppFor(e.kod) || vy?.typ === "horn" || grupper.length >= MAX ? `Klicka för att lyfta fram ${LINJE ? "linjen" : "banan"}` : `Klicka för att ${LINJE ? "färga" : "rita"} och lyfta fram ${LINJE ? "linjen" : "banan"}`);
  // Tips för en årsprick på den markerade banan/linjen: året (nivå och
  // förändring mot året innan) och utvecklingen sedan periodens första år,
  // jämförd med gruppen och riket.
  function visaArTips(e, d) {
    const a = d.a;
    const nyckel = `ar|${e.kod}|${a}|${basAr}|${grupper.map(g_ => g_.id).join(",")}`;
    if (nyckel === tipsNyckel && tips.style.opacity === "1") return placeraTips(d.x, d.y);
    tipsNyckel = nyckel;
    const ia = ai(a), ip = ai(a - 1), ib = ai(basAr), forst = a <= AR0;
    const grp = grupper.find(g_ => g_.lista.length > 1 && g_.koder.has(e.kod));
    const kol_ = [{ namn: namnPa(e.kod), s: e, farg: fargFor(e.kod) }, ...(grp ? [{ namn: grp.kort ?? grp.namn, s: grp.serie, farg: grp.farg }] : []), ...(ref ? [{ namn: ref.namn, s: ref, farg: ink.mjuk }] : [])];
    const ar1 = (et, V) => `<span style="color:${ink.mjuk}">${et}</span><span style="font-family:${MONO};text-align:right">${niv(V[ia])}</span>`
      + `<span style="font-family:${MONO};text-align:right;color:${ink.mjuk}">${forst ? "–" : LINJE ? `${andring(V[ia] - V[ip])} · ${procent1(pct(V[ip], V[ia]))}` : fF1(forand(V[ip], V[ia]))}</span>`;
    let html = `<div style="display:flex;justify-content:space-between;gap:14px;align-items:baseline"><span style="font-weight:600;font-size:12.5px">${namnPa(e.kod)}</span><span style="font-family:${MONO};font-size:12px;font-weight:600">${a}</span></div>`
      + `<div class="tt" style="margin-top:5px;padding-top:5px;border-top:1px solid ${ink.rutnat}"><span></span><span style="color:${ink.svag};font-size:9.5px;text-align:right">${a}</span><span style="color:${ink.svag};font-size:9.5px;text-align:right">${forst ? "" : `mot ${a - 1}`}</span>${MATT.map(k => ar1(mNamn(k), e[k])).join("")}</div>`;
    if (a > basAr) {
      const cell = (i, txt) => `<span style="font-family:${MONO};text-align:right;color:${i === 0 ? ink.stark : ink.mjuk};${i === 0 ? "font-weight:600" : ""}">${txt}</span>`;
      const rader_ = LINJE
        ? [["Antal", q => andring(q[MK][ia] - q[MK][ib])], ["Procent", q => procent1(pct(q[MK][ib], q[MK][ia]))]]
        : MATT.map(k => [mNamn(k), q => fF(forand(q[k][ib], q[k][ia]))]);
      html += `<div style="margin-top:7px;padding-top:5px;border-top:1px solid ${ink.rutnat};font-size:10.5px;color:${ink.mjuk}">Förändring <span style="font-family:${MONO};color:${ink.svag}">${basAr}–${a}</span></div>`
        + `<div style="display:grid;grid-template-columns:auto repeat(${kol_.length},auto);column-gap:12px;row-gap:1px;align-items:baseline;margin-top:3px;font-size:10.5px">`
        + `<span></span>${kol_.map(k => `<span style="text-align:right;font-size:9.5px;color:${k.farg};max-width:84px;overflow:hidden;text-overflow:ellipsis">${k.namn}</span>`).join("")}`
        + rader_.map(([et, fn]) => `<span style="color:${ink.mjuk}">${et}</span>${kol_.map((k, i) => cell(i, fn(k.s))).join("")}`).join("") + `</div>`;
    }
    tips.innerHTML = html;
    placeraTips(d.x, d.y);
  }

  // ── Markering ─────────────────────────────────────────────────────────────
  function lyftFram(kod) {
    markerad = kod; markAr = null; tipsNyckel = null;
    malaMarkRader(); rita();
  }
  // Klick på en punkt/linje: en kommun utan bana får en (som egen grupp) och
  // lyfts fram; en som redan syns lyfts fram; klick på den markerade släpper den.
  function klickaEnhet(e) {
    if (markerad === e.kod) return lyftFram(null);
    if (!gruppFor(e.kod) && vy?.typ !== "horn" && grupper.length < MAX) {
      grupper.push(nyGrupp(katalogMap.get(`e:${e.kod}`)));
      markerad = e.kod; markAr = null; tipsNyckel = null;
      return grupperAndrade();
    }
    lyftFram(e.kod);
  }
  function malaMarkRader() { for (const v of rader) if (v.gid) v.r.classList.toggle("mark", v.gid === `e:${markerad}`); }

  // ── Hovring och klick i grafen ────────────────────────────────────────────
  // Nästan dolda enheter går inte att hovra: i ett hörns lista bara hörnets,
  // inzoomat på urvalet bara urvalets, i Riket inga. I hela bilden syns, och
  // nås, alla.
  const dold = d => {
    if (d.kod === markerad || gruppFor(d.kod) || forhand?.koder.has(d.kod)) return false;
    return vy?.typ === "horn" ? !vy.koder.has(d.kod) : riketVy() || (grupper.length > 0 && zoomar());
  };
  function narmast(ev) {
    const [mx, my] = d3.pointer(ev, g.node());
    let bast = null, avst = 12;
    // Avståndet räknas till bubblans kant; ligger pekaren inne i flera vinner
    // den minsta (den som ligger överst), så att små kommuner går att nå
    punkter.each(d => {
      if (dold(d) || !d.r) return;
      const r = d.r ?? 2.6, a = Math.max(0, Math.hypot(d.pos[0] - mx, d.pos[1] - my) - r) + r * 0.02;
      if (a < avst) { avst = a; bast = d; }
    });
    return bast;
  }
  // Linjeläget: linjen närmast pekaren i höjd, vid årtalet under pekaren
  function narmastLinje(ev) {
    const [mx, my] = d3.pointer(ev, g.node());
    const st = linjeStart(basAr);
    if (mx < -4 || mx > sx(ar) + 6 || my < -4 || my > ih + 4 || ar < st) return null;
    const aH = kl(Math.round(sx.invert(mx)), st, Math.floor(ar + 1e-9));
    let bast = null, avst = 7;
    for (const e of enheter) {
      if (dold(e)) continue;
      const v = lv(e, aH, basAr);
      if (!ok(v) || v < dom.y[0] || v > dom.y[1]) continue;
      const d = Math.abs(sy(v) - my);
      if (d < avst) { avst = d; bast = e; }
    }
    return bast ? { e: bast, a: aH } : null;
  }
  // Linjeläget: året under pekaren (snäpper till närmaste helår i perioden)
  function arUnder(mx, my) {
    const st = linjeStart(basAr);
    if (mx < -4 || mx > sx(ar) + 6 || my < -4 || my > ih + 4 || ar < st) return null;
    return kl(Math.round(sx.invert(mx)), st, Math.floor(ar + 1e-9));
  }
  svg.on("pointermove", ev => {
    if (ev.target.closest?.(".horn")) {
      if (LINJE && (arHov != null || hov)) { arHov = null; hov = null; hovA = null; ritaHovLinje(); }
      return;
    }
    // Årsprickarna på den markerade banan går före punkterna/linjerna
    const [mx, my] = d3.pointer(ev, g.node());
    let pr = null, av = 7;
    for (const d of markPrickar) { const s = Math.hypot(d.x - mx, d.y - my); if (s < av && (LINJE || d.a !== helAr())) { av = s; pr = d; } }
    if (pr) {
      hov = null; svg.style("cursor", "default");
      if (LINJE && arHov != null) { arHov = null; ritaHovLinje(); }
      if (markAr !== pr.a) { markAr = pr.a; if (!timer) rita(); }
      return visaArTips(markEnhet(), pr);
    }
    if (markAr != null) { markAr = null; tips.style.opacity = 0; if (!timer) rita(); }
    if (LINJE) {
      // Årsstrecket följer pekaren; en grå linje nära pekaren lyfts och läggs i årstipset
      const r = narmastLinje(ev);
      hov = r?.e ?? null; hovA = r?.a ?? null; hovMy = my;
      arHov = arUnder(mx, my);
      svg.style("cursor", hov ? "pointer" : "default");
      if (!timer) ritaHovLinje();          // bara hovringslagret ändras
      return;
    }
    const e = narmast(ev);
    if (e === hov) return;
    hov = e;
    if (!e) tips.style.opacity = 0;
    svg.style("cursor", e ? "pointer" : "default");
    if (!timer) rita();
  }).on("pointerleave", () => {
    if (!hov && markAr == null && arHov == null) return;
    hov = null; hovA = null; markAr = null; arHov = null; tips.style.opacity = 0; tipsNyckel = null; if (!timer) rita();
  }).on("click", ev => {
    if (ev.target.closest?.(".horn") || markAr != null) return;
    // Linjeläget: den linje som är framlyft av hovringen är den som klickas
    const e = LINJE ? (hov ?? narmastLinje(ev)?.e) : narmast(ev);
    if (e) klickaEnhet(e); else if (markerad) lyftFram(null);    // klick i tomma ytan släpper markeringen
  });

  // ── Start och styrning ────────────────────────────────────────────────────
  const nod = rot;
  nod.period = (fran, till) => { stoppa(); satPeriod(fran ?? per.fran, till ?? per.till); };
  nod.ar = a => { stoppa(); satPeriod(per.fran, a); };
  nod.spela = (fran, till) => { if (fran != null) { per = { fran: kl(fran, AR0, AR1 - 1), till: kl(till ?? AR1, kl(fran, AR0, AR1 - 1) + 1, AR1) }; spela(per.fran, per.till); } else spelaPeriod(); };
  nod.visning = o => satVis(o ?? {});
  nod.utsnitt = u => satUtsnitt(u);
  nod.lagg = (n, o) => vaxla(katalog.find(k => k.namn === n), o);
  nod.rensa = rensa;
  nod.startaOm = startaOm;
  nod.markera = kod => lyftFram(kod ?? null);
  nod.snap = () => { domFran = null; basFranAr = null; dom = malDoman(); domMal = dom; rita(); };

  byggRader(); malaChips(); malaStorlek(); malaVis(); nyttMal({ direkt: true }); malaPeriod();
  rita();
  requestAnimationFrame(() => { byggSpar(); malaSpar(); matDuk(); rita(); });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { byggSpar(); malaSpar(); }).observe(spar);
  // Canvasen följer skärmens och presentationens skala
  if (duk) {
    const omDuk = () => { if (rot.isConnected && matDuk() && dukNyckel == null) rita(); };
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(omDuk).observe(kol);
    window.addEventListener("resize", omDuk);
  }
  return nod;
}

function el(tagg, attr = {}, text = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
