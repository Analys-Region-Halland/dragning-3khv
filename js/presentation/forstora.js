// =============================================================================
// FÖRSTORA — en knapp nere till vänster som förstorar valfri del av en bild
// =============================================================================
//
//   forstoring({ skala = 2 })   anropas en gång i uppsättningscellen
//
// Klick på "⤢ Förstora" → markören blir ett förstoringsglas → klick på den del
// av bilden man vill se → bilden förstoras runt den punkten. Reglage, hovring och
// tips fungerar som vanligt i förstorat läge (modulerna räknar om skalan med
// getBoundingClientRect). Återställ med knappen, Esc eller bildbyte.
// Utskrift och PDF-export påverkas inte. Reveals inbyggda Alt+klick finns kvar.
// =============================================================================

const STIL = `
.fs-knapp { position:fixed; left:58px; bottom:14px; z-index:40; display:inline-flex; align-items:center; gap:6px;
  font: 500 12px/1 Inter, system-ui, sans-serif; color:#2F3632; background:rgba(255,255,255,.85);
  border:1px solid rgba(13,13,13,.14); border-radius:999px; padding:6px 11px 6px 9px; cursor:pointer;
  box-shadow:0 4px 14px -10px rgba(0,0,0,.45); transition:background-color .15s, color .15s, opacity .2s; }
.fs-knapp:hover { background:#fff; color:#00664D; border-color:#00AB60; }
.fs-knapp .ik { font-size:14px; line-height:1; }
.fs-knapp.sikta { background:#00664D; color:#fff; border-color:#00664D; }
.fs-knapp.dold { opacity:0; pointer-events:none; }
.reveal.fs-siktar .slides section.present { cursor:zoom-in; }
.reveal .slides section.fs-zoom { transition: transform .35s ease; }
`;

export function forstoring({ skala = 2 } = {}) {
  if (typeof document === "undefined" || document.getElementById("fs-stil")) return;
  const Rv = () => window.Reveal;
  const utskrift = () => /print-pdf|view=print/i.test(location.search);
  if (utskrift()) return;
  const s = document.createElement("style"); s.id = "fs-stil"; s.textContent = STIL; document.head.appendChild(s);

  const knapp = document.createElement("button");
  knapp.type = "button";
  knapp.className = "fs-knapp";
  knapp.title = "Förstora en del av bilden (Esc återställer)";
  const mala = () => {
    knapp.innerHTML = zoomad ? `<span class="ik">⤡</span>Återställ` : siktar ? `<span class="ik">⌖</span>Klicka i bilden` : `<span class="ik">⤢</span>Förstora`;
    knapp.classList.toggle("sikta", siktar);
    document.querySelector(".reveal")?.classList.toggle("fs-siktar", siktar);
  };
  let siktar = false, zoomad = null;

  function aterstall() {
    if (zoomad) { zoomad.style.transform = ""; zoomad.style.transformOrigin = ""; const z = zoomad; setTimeout(() => z.classList.remove("fs-zoom"), 400); }
    zoomad = null; siktar = false; mala();
  }
  function zooma(sektion, ev) {
    const r = sektion.getBoundingClientRect();
    const k = r.width / sektion.offsetWidth || 1;          // Reveals egen skalning
    const x = (ev.clientX - r.left) / k, y = (ev.clientY - r.top) / k;
    sektion.classList.add("fs-zoom");
    sektion.style.transformOrigin = `${x}px ${y}px`;
    sektion.style.transform = `scale(${skala})`;
    zoomad = sektion; siktar = false; mala();
  }

  knapp.addEventListener("click", ev => {
    ev.stopPropagation();
    if (zoomad) aterstall();
    else { siktar = !siktar; mala(); }
    knapp.blur();
  });
  // Siktklicket fångas före modulerna (capture), så att det inte också trycker på ett reglage
  document.addEventListener("click", ev => {
    if (!siktar) return;
    const sektion = Rv()?.getCurrentSlide?.();
    if (!sektion || !sektion.contains(ev.target)) return;
    ev.preventDefault(); ev.stopPropagation();
    zooma(sektion, ev);
  }, true);
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && (zoomad || siktar)) { ev.preventDefault(); ev.stopImmediatePropagation(); aterstall(); }
  }, true);

  const koppla = (n = 0) => {
    const R = Rv();
    if (!R?.on || !document.querySelector(".reveal")) { if (n < 100) setTimeout(() => koppla(n + 1), 80); return; }
    document.querySelector(".reveal").appendChild(knapp);
    const visa = () => {
      const sl = R.getCurrentSlide?.();
      knapp.classList.toggle("dold", !sl || R.getIndices?.().h === 0);
    };
    R.on("slidechanged", () => { aterstall(); visa(); });
    R.on("overviewshown", () => aterstall());
    visa(); mala();
  };
  koppla();
}
