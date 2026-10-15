// =============================================================================
// KONTROLLER — reglage och flikar för 3KHV-dragningens interaktiva bilder
// =============================================================================
//
// Samma formspråk som banor.js (piller, tunn ram, mono för tal). Stilen läggs
// in en gång i dokumentet (klasser .kt-*), så att modulerna fungerar både i
// dragningen och på testsidor.
//
//   segment({ val: [{ id, etikett, titel? }], varde, vidByte, etikett? })
//     → el · el.varde() · el.satt(id, { tyst })
//   kryss({ val: [{ id, etikett, farg?, pa? }], vidByte, etikett? })
//     → el · el.valda() · el.satt(ids, { tyst })
//   arsreglage({ min, max, fran, till, vidByte, etikett?, minSpann?, bredd?, brott? })
//     → el · el.period() → { fran, till } · el.satt(fran, till, { tyst })
//     Två handtag. Dra närmaste handtag, klicka på spåret för att flytta det
//     närmaste, eller fokusera ett handtag och använd ← →. Perioden skrivs ut.
//     brott: [{ ar, etikett }] — små hakar ovanför spåret (källbyten).
//   flikar(poster: [{ etikett, bygg: () => Node }], { steg = true })
//     → el · el.visa(i)
//     Innehållet byggs först när fliken visas (moduler som mäter sin bredd
//     behöver vara synliga). steg: varje flik efter den första blir ett
//     osynligt Reveal-fragment, så → bläddrar till nästa flik. Klick på en
//     flik synkar fragmenten. I utskriftsläget läggs inga steg till.
//     Bilden får automatiskt en stegmarkör (se nedan).
//   stegmarkor(nod) → uppdatera()            (tillägg rev 1)
//     Liten markör uppe till höger på bilden, i höjd med rubriken: "STEG 2 av 3"
//     (Plex Mono för talen; inte "2 / 3", som förväxlas med sidnumret) och en
//     prick per steg, där det aktiva steget är ett längre
//     grönt streck och passerade steg är halvtonade. Räknar alla fragment på
//     bilden (unika data-fragment-index + 1), så den fungerar för flikar,
//     ytstod.fragmentsteg och vanliga Reveal-fragment på samma bild. En markör
//     per bild, hur många moduler som än anropar. Prickarna går att klicka på.
//     Visas inte med färre än två steg, utan Reveal eller i utskriftsläget.
//     flikar() och ytstod.fragmentsteg() anropar den själva.
//
// Reveal fångar piltangenterna på dokumentet — handtagen stoppar dem.
// =============================================================================

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const STIL = `
.kt-rad { display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; font:12px/1.3 Inter, system-ui, sans-serif; color:#2F3632; }
.kt-grupp { display:inline-flex; align-items:center; gap:6px; }
.kt-et { font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:#59615D; white-space:nowrap; }
.kt-par { display:inline-flex; border:1px solid rgba(13,13,13,.14); border-radius:999px; padding:1px; gap:1px; }
.kt-par button { border:0; background:transparent; color:#59615D; font:500 11px/1 Inter, system-ui, sans-serif; padding:4px 10px; border-radius:999px; cursor:pointer; white-space:nowrap; }
.kt-par button:hover { color:#0D0D0D; }
.kt-par button.pa { background:rgba(10,20,15,.09); color:#0D0D0D; }
.kt-par button:disabled { opacity:.35; cursor:default; }
.kt-kryss { display:inline-flex; flex-wrap:wrap; gap:4px; }
.kt-kryss button { display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(13,13,13,.14); background:transparent; color:#59615D; font:500 11px/1 Inter, system-ui, sans-serif; padding:4px 10px 4px 7px; border-radius:999px; cursor:pointer; white-space:nowrap; }
.kt-kryss button i { width:10px; height:10px; border-radius:2px; border:1.5px solid var(--c, #59615D); box-sizing:border-box; }
.kt-kryss button.pa { color:#0D0D0D; border-color:rgba(13,13,13,.3); background:rgba(10,20,15,.04); }
.kt-kryss button.pa i { background:var(--c, #59615D); }
.kt-ar { display:inline-flex; align-items:center; gap:8px; }
.kt-ar svg { display:block; overflow:visible; cursor:pointer; touch-action:none; }
.kt-ar .kt-period { font:600 12px/1 ${MONO}; color:#0D0D0D; font-variant-numeric:tabular-nums; min-width:76px; }
.kt-ar circle.h { cursor:grab; outline:none; }
.kt-ar circle.h:focus { stroke:#00AB60; stroke-width:2.5; }
.kt-flikar { display:flex; flex-direction:column; gap:10px; width:100%; }
.kt-flikrad { display:flex; gap:2px; border-bottom:1px solid rgba(13,13,13,.12); }
.kt-flikrad button { border:0; background:transparent; font:500 13px/1.2 Inter, system-ui, sans-serif; color:#59615D; padding:6px 14px 7px; cursor:pointer; border-bottom:2.5px solid transparent; margin-bottom:-1px; white-space:nowrap; }
.kt-flikrad button:hover { color:#0D0D0D; }
.kt-flikrad button.pa { color:#00664D; border-bottom-color:#00AB60; }
.kt-flikrad button .n { font:600 10px/1 ${MONO}; color:#9AA19C; margin-right:6px; }
.kt-flikrad button.pa .n { color:#00AB60; }
.kt-flikyta { min-height:0; }
`;

function stil() {
  if (typeof document === "undefined" || document.getElementById("kt-stil")) return;
  const s = document.createElement("style");
  s.id = "kt-stil";
  s.textContent = STIL;
  document.head.appendChild(s);
}

function el(tagg, attr = {}, html = null) {
  const e = document.createElement(tagg);
  for (const [k, v] of Object.entries(attr)) if (v != null) e.setAttribute(k, v);
  if (html != null) e.innerHTML = html;
  return e;
}

// Reveal skalar duken med transform — räkna om skärm-px till duk-px
function skala(nod) {
  const r = nod.getBoundingClientRect();
  return r.width / (nod.offsetWidth || r.width) || 1;
}

// ── Segment (ett val av flera) ──────────────────────────────────────────────
export function segment({ val, varde = val[0]?.id, vidByte = () => {}, etikett = null }) {
  stil();
  const rot = el("span", { class: "kt-grupp" });
  if (etikett) rot.appendChild(el("span", { class: "kt-et" }, etikett));
  const par = el("span", { class: "kt-par", role: "radiogroup" });
  let nu = varde;
  const knappar = val.map(v => {
    const b = el("button", { type: "button", title: v.titel ?? null, "data-id": v.id }, v.etikett);
    b.addEventListener("click", () => satt(v.id));
    par.appendChild(b);
    return b;
  });
  function mala() { knappar.forEach(b => b.classList.toggle("pa", b.dataset.id === String(nu))); }
  function satt(id, { tyst = false } = {}) {
    if (String(id) === String(nu)) return;
    nu = val.find(v => String(v.id) === String(id))?.id ?? nu;
    mala();
    if (!tyst) vidByte(nu);
  }
  mala();
  rot.appendChild(par);
  rot.varde = () => nu;
  rot.satt = satt;
  rot.inaktivera = (id, av = true) => { const b = knappar.find(b => b.dataset.id === String(id)); if (b) b.disabled = av; };
  return rot;
}

// ── Kryss (flera val) ───────────────────────────────────────────────────────
export function kryss({ val, vidByte = () => {}, etikett = null, minst = 1 }) {
  stil();
  const rot = el("span", { class: "kt-grupp" });
  if (etikett) rot.appendChild(el("span", { class: "kt-et" }, etikett));
  const lista = el("span", { class: "kt-kryss" });
  const valda = new Set(val.filter(v => v.pa !== false).map(v => v.id));
  const knappar = val.map(v => {
    const b = el("button", { type: "button", "aria-pressed": "false", style: v.farg ? `--c:${v.farg}` : null }, `<i></i>${v.etikett}`);
    b.addEventListener("click", () => {
      if (valda.has(v.id)) { if (valda.size <= minst) return; valda.delete(v.id); } else valda.add(v.id);
      mala(); vidByte([...valda]);
    });
    lista.appendChild(b);
    return [v.id, b];
  });
  function mala() { knappar.forEach(([id, b]) => { b.classList.toggle("pa", valda.has(id)); b.setAttribute("aria-pressed", valda.has(id)); }); }
  mala();
  rot.appendChild(lista);
  rot.valda = () => val.map(v => v.id).filter(id => valda.has(id));
  rot.satt = (ids, { tyst = false } = {}) => { valda.clear(); ids.forEach(i => valda.add(i)); mala(); if (!tyst) vidByte(rot.valda()); };
  return rot;
}

// ── Årsreglage (från–till) ──────────────────────────────────────────────────
export function arsreglage({
  min, max, fran = min, till = max, vidByte = () => {}, etikett = "Period",
  minSpann = 1, bredd = 210, brott = []
}) {
  stil();
  const NS = "http://www.w3.org/2000/svg";
  const rot = el("span", { class: "kt-ar" });
  if (etikett) rot.appendChild(el("span", { class: "kt-et" }, etikett));
  const H = 30, P = 8;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", bredd); svg.setAttribute("height", H);
  const text = el("span", { class: "kt-period" });
  rot.append(svg, text);
  const x = a => P + ((a - min) / Math.max(1, max - min)) * (bredd - 2 * P);
  const ar = px => Math.round(min + ((px - P) / (bredd - 2 * P)) * (max - min));
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); svg.appendChild(e); return e; };
  mk("rect", { x: P, y: 10, width: bredd - 2 * P, height: 4, rx: 2, fill: "rgba(13,13,13,.12)" });
  for (const b of brott) {
    const p = mk("path", { d: `M${x(b.ar) - 2.5},3h5l-2.5,3.5z`, fill: "#9AA19C" });
    const t = document.createElementNS(NS, "title"); t.textContent = b.etikett ?? `Källbyte ${b.ar}`; p.appendChild(t);
  }
  const fylld = mk("rect", { y: 10, height: 4, rx: 2, fill: "#2F3632" });
  // Årtal under spåret: start, varje decennium, slut
  const steg = [];
  // (avståndet räknas i px — på ett smalt reglage krockar annars t.ex. 2020 och 2025)
  for (let a = Math.ceil(min / 10) * 10; a <= max; a += 10) if (x(a) - x(min) > 30 && x(max) - x(a) > 30) steg.push(a);
  [min, ...steg, max].forEach((a, i, l) => mk("text", { x: x(a), y: 28, "text-anchor": i === 0 ? "start" : i === l.length - 1 ? "end" : "middle", "font-family": MONO, "font-size": 9, fill: "#9AA19C" }).textContent = a);
  const h0 = mk("circle", { class: "h", cy: 12, r: 6.5, fill: "#0D0D0D", stroke: "#fff", "stroke-width": 1.5, tabindex: 0 });
  const h1 = mk("circle", { class: "h", cy: 12, r: 6.5, fill: "#0D0D0D", stroke: "#fff", "stroke-width": 1.5, tabindex: 0 });
  let f = fran, t = till;
  function mala() {
    h0.setAttribute("cx", x(f)); h1.setAttribute("cx", x(t));
    fylld.setAttribute("x", x(f)); fylld.setAttribute("width", Math.max(0, x(t) - x(f)));
    text.textContent = `${f}–${t}`;
  }
  function satt(a, b, { tyst = false } = {}) {
    a = Math.max(min, Math.min(max - minSpann, Math.round(a)));
    b = Math.max(a + minSpann, Math.min(max, Math.round(b)));
    if (a === f && b === t) return;
    f = a; t = b; mala();
    if (!tyst) vidByte({ fran: f, till: t });
  }
  const pos = ev => { const r = svg.getBoundingClientRect(); return (ev.clientX - r.left) / skala(svg); };
  let drar = null;
  svg.addEventListener("pointerdown", ev => {
    ev.preventDefault(); ev.stopPropagation();
    svg.setPointerCapture(ev.pointerId);
    const a = ar(pos(ev));
    drar = Math.abs(a - f) <= Math.abs(a - t) && !(a > t) ? 0 : 1;
    if (a < f) drar = 0;
    drar === 0 ? satt(a, t) : satt(f, a);
  });
  svg.addEventListener("pointermove", ev => {
    if (drar == null) return;
    const a = ar(pos(ev));
    drar === 0 ? satt(a, t) : satt(f, a);
  });
  const slapp = () => { drar = null; };
  svg.addEventListener("pointerup", slapp);
  svg.addEventListener("pointercancel", slapp);
  for (const [h, i] of [[h0, 0], [h1, 1]]) {
    h.addEventListener("keydown", ev => {
      const d = ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -1 : ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 1 : 0;
      if (!d) return;
      ev.preventDefault(); ev.stopPropagation();
      i === 0 ? satt(f + d, t) : satt(f, t + d);
    });
  }
  mala();
  rot.period = () => ({ fran: f, till: t });
  rot.satt = satt;
  return rot;
}

// ── Flikar ──────────────────────────────────────────────────────────────────
export function flikar(poster, { steg = true } = {}) {
  stil();
  const rot = el("div", { class: "kt-flikar" });
  const rad = el("div", { class: "kt-flikrad", role: "tablist" });
  const yta = el("div", { class: "kt-flikyta" });
  rot.append(rad, yta);
  const sidor = poster.map(() => { const s = el("div", { role: "tabpanel", style: "display:none" }); yta.appendChild(s); return s; });
  const byggd = poster.map(() => false);
  let nu = -1;
  const knappar = poster.map((p, i) => {
    const b = el("button", { type: "button", role: "tab" }, `<span class="n">${i + 1}</span>${p.etikett}`);
    b.addEventListener("click", () => { visa(i); synka(); });
    rad.appendChild(b);
    return b;
  });
  function visa(i) {
    i = Math.max(0, Math.min(poster.length - 1, i));
    if (i === nu) return;
    nu = i;
    sidor.forEach((s, j) => { s.style.display = j === i ? "" : "none"; });
    knappar.forEach((b, j) => { b.classList.toggle("pa", j === i); b.setAttribute("aria-selected", j === i); });
    if (!byggd[i]) {
      byggd[i] = true;
      const p = poster[i];
      const n = p.bygg ? p.bygg() : p.nod;
      if (n) sidor[i].appendChild(n);
    }
  }

  // Steg i presentationen (samma mönster som banor.js)
  const Rv = () => (typeof window !== "undefined" ? window.Reveal : null);
  const utskrift = () => /print-pdf|view=print/i.test(location.search) || !!Rv()?.isPrintView?.();
  const iBild = () => { const s = Rv()?.getCurrentSlide?.(); return !!s && s.contains(rot); };
  let spann = [], synkar = false;
  function synka() {
    if (!spann.length || !iBild()) return;
    const mal = nu - 1;
    const nuv = spann.reduce((m, s, i) => (s.classList.contains("visible") ? i : m), -1);
    if (mal === nuv) return;
    synkar = true;
    try { Rv().navigateFragment(mal); } finally { synkar = false; }
  }
  function koppla() {
    const R = Rv();
    if (!steg || poster.length < 2 || !R?.on || spann.length || utskrift()) return;
    spann = poster.slice(1).map((_, i) => { const s = el("span", { class: "fragment kt-steg", "data-fragment-index": i, "aria-hidden": "true", style: "display:none" }); rot.appendChild(s); return s; });
    const pa = (ev, visas) => {
      if (synkar) return;
      if (!rot.isConnected) { R.off("fragmentshown", v_); R.off("fragmenthidden", d_); return; }
      const egna = (ev.fragments ?? [ev.fragment]).map(f => spann.indexOf(f)).filter(i => i >= 0);
      if (!egna.length) return;
      visa(visas ? Math.max(...egna) + 1 : Math.min(...egna));
    };
    const v_ = ev => pa(ev, true), d_ = ev => pa(ev, false);
    R.on("fragmentshown", v_); R.on("fragmenthidden", d_);
    if (iBild()) R.syncFragments?.();
    stegmarkor(rot);
  }
  visa(0);
  // Fragmenten måste finnas innan Reveal räknar bildens steg — koppla när noden
  // hamnat i dokumentet
  if (typeof window !== "undefined") {
    const forsok = (n = 0) => { if (rot.isConnected) koppla(); else if (n < 50) setTimeout(() => forsok(n + 1), 60); };
    setTimeout(() => forsok(), 0);
  }
  rot.visa = i => { visa(i); synka(); };
  return rot;
}

// ── Stegmarkör (rev 1) ──────────────────────────────────────────────────────
// En per bild, uppe till höger i rubrikens höjd. Färgen ärvs från bilden
// (fungerar på ljusa och mörka teman); bara det aktiva steget har egen färg.
const SM_STIL = `
.kt-sm { position:absolute; right:0; top:22px; z-index:6; display:flex; align-items:center; gap:10px; font:500 11px/1 ${MONO}; color:inherit; user-select:none; transform:translateY(-50%); transition:opacity .25s ease; }
.kt-sm.av { opacity:0; pointer-events:none; }
.kt-sm .kt-sm-tal { font-variant-numeric:tabular-nums; white-space:nowrap; font-size:12px; }
.kt-sm .kt-sm-tal i { font:500 9.5px/1 Inter, system-ui, sans-serif; font-style:normal; letter-spacing:.09em; text-transform:uppercase; opacity:.5; margin-right:6px; }
.kt-sm .kt-sm-tal b { font-weight:600; color:#00664D; }
.kt-sm .kt-sm-tal span { opacity:.45; }
.kt-sm .kt-sm-rad { display:flex; align-items:center; gap:5px; }
.kt-sm .kt-sm-rad button { all:unset; box-sizing:border-box; display:block; width:7px; height:7px; border-radius:4px; background:currentColor; opacity:.18; cursor:pointer; transition:width .35s ease, opacity .35s ease, background-color .35s ease; }
.kt-sm .kt-sm-rad button:hover { opacity:.5; }
.kt-sm .kt-sm-rad button.forbi { opacity:.42; }
.kt-sm .kt-sm-rad button.nu { width:24px; opacity:1; background:#00AB60; }
.reveal.has-dark-background .kt-sm .kt-sm-tal b, .kt-sm.mork .kt-sm-tal b { color:#C1E8C4; }
`;

function smStil() {
  if (typeof document === "undefined" || document.getElementById("kt-sm-stil")) return;
  const s = document.createElement("style");
  s.id = "kt-sm-stil";
  s.textContent = SM_STIL;
  document.head.appendChild(s);
}

export function stegmarkor(nod) {
  const R = typeof window !== "undefined" ? window.Reveal : null;
  const noop = () => {};
  if (!R?.on || !nod?.closest) return noop;
  if (/print-pdf|view=print/i.test(location.search) || R.isPrintView?.()) return noop;
  const bild = nod.closest("section");
  if (!bild) return noop;
  smStil();
  let m = bild.querySelector(":scope > .kt-sm");
  if (m?.uppdatera) { m.uppdatera(); return m.uppdatera; }

  m = el("div", { class: "kt-sm av", "aria-hidden": "true" });
  const tal = el("span", { class: "kt-sm-tal" });
  const rad = el("span", { class: "kt-sm-rad" });
  m.append(tal, rad);
  bild.appendChild(m);
  let sist = "";

  function lage() {
    // Unika fragmentindex på bilden (Reveal numrerar om dem i ordning)
    const fr = [...bild.querySelectorAll(".fragment")].filter(f => !f.closest(".kt-sm"));
    const index = [...new Set(fr.map(f => f.getAttribute("data-fragment-index") ?? "x"))]
      .sort((a, b) => (+a) - (+b));
    const visade = index.filter(i => fr.some(f => (f.getAttribute("data-fragment-index") ?? "x") === i && f.classList.contains("visible"))).length;
    return { antal: index.length + 1, nu: visade + 1 };
  }

  function placera() {
    const h = bild.querySelector(":scope > h2, :scope > h1, h2");
    if (h && h.offsetHeight) m.style.top = `${h.offsetTop + h.offsetHeight / 2}px`;
  }

  function uppdatera() {
    if (!m.isConnected) return;
    const { antal, nu } = lage();
    const nyckel = `${antal}:${nu}`;
    if (nyckel === sist) return;
    sist = nyckel;
    m.classList.toggle("av", antal < 2);
    if (antal < 2) return;
    placera();
    // "Steg 2 av 3" — inte "2 / 3", som skulle förväxlas med sidnumret
    tal.innerHTML = `<i>Steg</i><b>${nu}</b><span> av ${antal}</span>`;
    if (rad.children.length !== antal) {
      rad.replaceChildren(...Array.from({ length: antal }, (_, i) => {
        const b = el("button", { type: "button", tabindex: "-1", title: `Steg ${i + 1} av ${antal}` });
        b.addEventListener("click", ev => {
          ev.stopPropagation();
          const s = R.getCurrentSlide?.();
          if (s === bild) R.navigateFragment(i - 1);
        });
        return b;
      }));
    }
    [...rad.children].forEach((b, i) => {
      b.classList.toggle("nu", i === nu - 1);
      b.classList.toggle("forbi", i < nu - 1);
    });
  }

  const vid = () => {
    if (!m.isConnected) { ["fragmentshown", "fragmenthidden", "slidechanged", "ready"].forEach(e => R.off(e, vid)); return; }
    uppdatera();
    // Dolda bilder (display:none) har ingen rubrikhöjd: placera när bilden visas
    if (R.getCurrentSlide?.() === bild) placera();
  };
  ["fragmentshown", "fragmenthidden", "slidechanged", "ready"].forEach(e => R.on(e, vid));
  m.uppdatera = () => { sist = ""; uppdatera(); };
  // Rubriken kan få sin slutliga höjd först när typsnitten laddats
  document.fonts?.ready?.then(() => { if (m.isConnected) placera(); });
  m.uppdatera();
  return m.uppdatera;
}
