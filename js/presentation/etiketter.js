// =============================================================================
// ETIKETTER — etikettkolumnen vid linjeslut (3KHV-dragningen)
// =============================================================================
//
// Port av hosrapports etikettsystem (hosrapport/app/src/charts/karna/etiketter.ts
// och ritstil.ts → kopplingD). Alla etiketter står i en kolumn till höger om
// linjernas slut, sorterade efter linjeslutets höjd (högst värde överst) och
// minst `avstand` px isär. Etiketter som krockar slås ihop till block som
// centreras kring sina linjeslut (minsta kvadratavvikelse) och hålls inom
// [yMin, yMax]. Ryms inte alla tas de med lägst prioritet bort först. Ett namn
// som inte ryms bryts på två rader, annars kortas det med ellips.
//
// En etikett som flyttats från sitt linjeslut får en klammer: vågrätt ut från
// linjeslutet, lodrätt till etikettens höjd, vågrätt in till texten.
//
//   placeraEtiketter(lista, { yMin, yMax, avstand, maxBredd, px, vikt })
//     lista: [{ id, text, ankarY, prioritet? }] → [{ ...e, y, rader }]
//   klammer(ankarX, ankarY, y, { knack, slut }) → path-d
//   ritaEtiketter(g, placerade, { x, farg, halo, px, vikt, avstand })
//     d3-join av klammer + text i gruppen g (en <g> per etikett, nyckel id)
//   textbredd(text, px, vikt) → px (canvas)
// =============================================================================

const SANS = "Inter, system-ui, sans-serif";
let ctx = null;

export function textbredd(text, px = 11, vikt = 500) {
  if (typeof document === "undefined") return text.length * px * 0.56;
  ctx ??= document.createElement("canvas").getContext("2d");
  ctx.font = `${vikt} ${px}px ${SANS}`;
  return ctx.measureText(text).width;
}

function kortaText(text, max, px, vikt) {
  if (textbredd(text, px, vikt) <= max) return text;
  let t = text;
  while (t.length > 1 && textbredd(`${t}…`, px, vikt) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// Hela texten, två rader som båda ryms, eller kortad med ellips
export function etikettRader(text, max, px = 11, vikt = 500) {
  if (!isFinite(max) || textbredd(text, px, vikt) <= max) return [text];
  const ord = text.split(" ");
  let bast = null, bastBredd = Infinity;
  for (let i = 1; i < ord.length; i++) {
    const rader = [ord.slice(0, i).join(" "), ord.slice(i).join(" ")];
    const b = Math.max(...rader.map(r => textbredd(r, px, vikt)));
    if (b <= max && b < bastBredd) { bast = rader; bastBredd = b; }
  }
  return bast ?? [kortaText(text, max, px, vikt)];
}

export function placeraEtiketter(lista, { yMin, yMax, avstand = 14, maxBredd = Infinity, px = 11, vikt = 500 } = {}) {
  const rader = new Map(lista.map(e => [e, etikettRader(e.text, maxBredd, px, vikt)]));
  const h = e => (rader.get(e)?.length ?? 1) * avstand;
  const prio = e => e.prioritet ?? 0;
  let kvar = [...lista];
  const ryms = l => l.length <= 1 || l.reduce((s, e) => s + h(e), 0) - avstand <= yMax - yMin;
  while (!ryms(kvar)) {
    const lagst = kvar.reduce((a, b) => (prio(b) < prio(a) ? b : a));
    kvar = kvar.filter(e => e !== lagst);
  }
  const sorterade = kvar.slice().sort((a, b) => a.ankarY - b.ankarY || prio(b) - prio(a));

  const forskjut = m => {
    const ut = [0];
    for (let i = 1; i < m.length; i++) ut.push(ut[i - 1] + (h(m[i - 1]) + h(m[i])) / 2);
    return ut;
  };
  const ideal = b => {
    const m = b.medlemmar, off = b.avstand, n = m.length;
    const medel = m.reduce((s, e, i) => s + e.ankarY - off[i], 0) / n;
    const lo = yMin + (h(m[0]) - avstand) / 2;
    const hi = yMax - off[n - 1] - (h(m[n - 1]) - avstand) / 2;
    return Math.max(lo, Math.min(hi, medel));
  };
  const botten = b => b.start + b.avstand[b.avstand.length - 1] + h(b.medlemmar[b.medlemmar.length - 1]) / 2;
  const topp = b => b.start - h(b.medlemmar[0]) / 2;

  const block = [];
  for (const e of sorterade) {
    const nytt = { start: 0, medlemmar: [e], avstand: [0] };
    nytt.start = ideal(nytt);
    block.push(nytt);
    while (block.length > 1) {
      const b = block[block.length - 1], a = block[block.length - 2];
      if (botten(a) <= topp(b) + 1e-6) break;
      a.medlemmar = a.medlemmar.concat(b.medlemmar);
      a.avstand = forskjut(a.medlemmar);
      a.start = ideal(a);
      block.pop();
    }
  }
  const ut = [];
  for (const b of block) b.medlemmar.forEach((e, i) => ut.push({ ...e, y: b.start + b.avstand[i], rader: rader.get(e) ?? [e.text] }));
  return ut;
}

// Klammern: ut från linjeslutet, ned/upp till etiketten, in till texten
export function klammer(ankarX, ankarY, y, { knack = 7, slut = 13 } = {}) {
  if (Math.abs(y - ankarY) < 1.5) return `M${ankarX + 3},${ankarY}H${ankarX + slut}`;
  return `M${ankarX + 3},${ankarY}H${ankarX + knack}V${y}H${ankarX + slut}`;
}

// placerade: utdata från placeraEtiketter, med ankarX (linjeslutets x) per etikett.
// farg: e => färg; textfarg: e => färg (standard = farg); vikt: e => vikt.
export function ritaEtiketter(g, placerade, {
  farg = () => "#0D0D0D", textfarg = null, halo = "#fff", px = 11, vikt = () => 500,
  avstand = 14, knack = 7, slut = 13, kursiv = () => false, opacitet = () => 1
} = {}) {
  const tf = textfarg ?? farg;
  return g.selectAll("g.etikett").data(placerade, e => e.id).join(en => {
    const gg = en.append("g").attr("class", "etikett");
    gg.append("path").attr("fill", "none").attr("stroke-width", 0.8);
    gg.append("text").attr("stroke", halo).attr("stroke-width", 3).attr("paint-order", "stroke").attr("stroke-linejoin", "round");
    return gg;
  }).attr("opacity", opacitet).each(function (e) {
    const p = this.querySelector("path"), t = this.querySelector("text");
    p.setAttribute("d", klammer(e.ankarX, e.ankarY, e.y, { knack, slut }));
    p.setAttribute("stroke", farg(e));
    p.setAttribute("stroke-opacity", "0.7");
    const x = e.ankarX + slut + 3;
    const y0 = e.y - ((e.rader.length - 1) * avstand) / 2;
    t.setAttribute("x", x);
    t.setAttribute("font-size", px);
    t.setAttribute("font-weight", vikt(e));
    t.setAttribute("font-style", kursiv(e) ? "italic" : "normal");
    t.setAttribute("fill", tf(e));
    t.setAttribute("dominant-baseline", "middle");
    t.textContent = "";
    e.rader.forEach((r, i) => {
      const ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      ts.setAttribute("x", x);
      ts.setAttribute("y", y0 + i * avstand);
      ts.textContent = r;
      t.appendChild(ts);
    });
  });
}
