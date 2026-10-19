/*
 * Configuración y datos simulados del prototipo.
 * Todo lo editable (marca, teléfono, moneda, separación) vive en SOLARES_CFG.
 * El plano se genera de forma determinista (misma semilla → mismo plano en cada carga).
 */
window.SOLARES_CFG = {
  companyName: 'Solaris',
  logoText: 'Solaris',
  projectFull: 'Altavista · Etapa 2',
  location: 'Santiago, República Dominicana',
  eyebrow: 'Proyecto residencial · Etapa 2 · Santiago',
  currency: 'RD$',
  currencyLocale: 'es-DO',
  contactPhone: '+1 809-888-9999', // destino de «Abrir WhatsApp»; vacío = solo «Copiar solicitud»
  sep: 10000, // separación por solar
  heroImage: './assets/hero.svg' // ilustración ficticia; cámbiala por una foto real, p. ej. './assets/hero.jpg'
};

window.buildSolaresData = function () {
  const W = 1800, H = 1200, cols = 5, rows = 4, OMx = 155, OMy = 165;
  const cellW = (W - 2 * OMx) / cols, cellH = (H - 2 * OMy) / rows;
  let seed = 20260419;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  const PI = Math.PI;

  // Retícula deformada: los nodos son las intersecciones de calles.
  const nodes = [];
  for (let r = 0; r <= rows; r++) {
    nodes[r] = [];
    for (let c = 0; c <= cols; c++) {
      let x = OMx + c * cellW, y = OMy + r * cellH;
      x += Math.sin((r / rows) * PI * 1.25 + 0.6) * cellW * 0.17 + Math.sin((c / cols) * PI * 0.8) * 20 + (rnd() - 0.5) * 20;
      y += Math.sin((c / cols) * PI * 1.15 + 0.3) * cellH * 0.17 + Math.cos((r / rows) * PI * 0.9) * 18 + (rnd() - 0.5) * 20;
      nodes[r][c] = { x: +x.toFixed(1), y: +y.toFixed(1) };
    }
  }

  const greenCells = new Set(['0,4', '1,2', '2,0', '3,3']);
  const greenLabels = ['Área verde', 'Parque central', 'Amenidades', 'Plaza'];
  const shoelace = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return Math.abs(s) / 2; };
  const lots = [], greens = [], manzList = [];
  let counter = 101, mIdx = 0, gi = 0;
  const RATE = 2349, AF = 0.047;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const TL = nodes[r][c], TR = nodes[r][c + 1], BR = nodes[r + 1][c + 1], BL = nodes[r + 1][c];
      const cen = { x: (TL.x + TR.x + BR.x + BL.x) / 4, y: (TL.y + TR.y + BR.y + BL.y) / 4 };
      const ins = 0.13;
      const sTL = P(TL, cen, ins), sTR = P(TR, cen, ins), sBR = P(BR, cen, ins), sBL = P(BL, cen, ins);
      const key = r + ',' + c;
      if (greenCells.has(key)) {
        greens.push({ points: [sTL, sTR, sBR, sBL].map(p => p.x + ',' + p.y).join(' '), tx: +cen.x.toFixed(1), ty: +(cen.y + 5).toFixed(1), label: greenLabels[gi++ % greenLabels.length] });
        continue;
      }
      mIdx++; const manz = 'M' + mIdx; manzList.push(manz);
      const manzRate = RATE * (0.88 + rnd() * 0.3);
      const ncols = ri(4, 7);
      const ws = []; let tot = 0; for (let i = 0; i < ncols; i++) { const w = 0.7 + rnd() * 0.65; ws.push(w); tot += w; }
      const fr = [0]; let acc = 0; for (let i = 0; i < ncols; i++) { acc += ws[i] / tot; fr.push(acc); }
      const single = rnd() < 0.16; const gmid = 0.46 + rnd() * 0.08;
      const grows = single ? [[0, 1]] : [[0, gmid], [gmid, 1]];
      for (let gg = 0; gg < grows.length; gg++) {
        const ga = grows[gg][0], gb = grows[gg][1];
        for (let i = 0; i < ncols; i++) {
          const fa = fr[i], fb = fr[i + 1];
          const corners = [[fa, ga], [fb, ga], [fb, gb], [fa, gb]].map(a => { const top = P(TL, TR, a[0]), bot = P(BL, BR, a[0]); return P(top, bot, a[1]); });
          const lc = { x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4, y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4 };
          const q = corners.map(p => P(p, lc, 0.07));
          const area = Math.max(180, Math.min(620, Math.round(shoelace(q) * AF / 5) * 5));
          const corner = (i === 0 || i === ncols - 1); const tipo = corner ? 'Esquina' : 'Estándar';
          if (counter === 131) counter++;
          const id = 'E2-' + counter; counter++;
          const roll = rnd(); const estado = roll < 0.84 ? 'disponible' : (roll < 0.975 ? 'reservado' : 'vendido');
          const precio = Math.round(area * manzRate * (corner ? 1.08 : 1) / 100) * 100;
          lots.push({ id, manzana: manz, tipo, areaM2: area, precioDop: precio, separacionDop: 10000, estado, cx: +lc.x.toFixed(1), cy: +lc.y.toFixed(1), points: q.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') });
        }
      }
    }
  }

  // Solar de referencia del brief: E2-131 con valores exactos.
  const m7 = lots.filter(l => l.manzana === 'M7'); const t = m7[Math.floor(m7.length / 2)] || lots[0];
  t.id = 'E2-131'; t.tipo = 'Estándar'; t.areaM2 = 300; t.precioDop = 704700; t.separacionDop = 10000; t.estado = 'disponible';

  const byId = {}; lots.forEach(l => byId[l.id] = l);
  const counts = { disponible: 0, reservado: 0, vendido: 0, total: lots.length }; lots.forEach(l => counts[l.estado]++);
  const areaTotal = lots.reduce((a, l) => a + l.areaM2, 0);
  manzList.sort((a, b) => +a.slice(1) - +b.slice(1));

  // Contorno del desarrollo
  const planCen = { x: W / 2, y: H / 2 }; const ring = [];
  for (let c = 0; c <= cols; c++) ring.push(nodes[0][c]);
  for (let r = 1; r <= rows; r++) ring.push(nodes[r][cols]);
  for (let c = cols - 1; c >= 0; c--) ring.push(nodes[rows][c]);
  for (let r = rows - 1; r >= 1; r--) ring.push(nodes[r][0]);
  const devHullPts = ring.map(p => P(p, planCen, -0.1)).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');

  // Avenidas principales y rotonda
  const avenues = [
    nodes[2].map(n => n.x.toFixed(1) + ',' + n.y.toFixed(1)).join(' '),
    nodes.map(row => row[2]).map(n => n.x.toFixed(1) + ',' + n.y.toFixed(1)).join(' ')
  ];
  const rc = nodes[2][2]; const roundabout = { cx: +rc.x.toFixed(1), cy: +rc.y.toFixed(1), r1: 30, r2: 15 };

  return { W, H, lots, byId, greens, manzList, counts, areaTotal, devHullPts, avenues, roundabout, viewBox: '0 0 ' + W + ' ' + H };
};
