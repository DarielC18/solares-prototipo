/* Solaris — lógica del prototipo (JS nativo, sin dependencias). */
(function () {
  'use strict';

  const cfg = window.SOLARES_CFG;
  const D = window.buildSolaresData();
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat(cfg.currencyLocale, { maximumFractionDigits: 0 });
  const money = (n) => cfg.currency + nf.format(Math.round(n));

  const emptyForm = () => ({ nombre: '', whatsapp: '', email: '', ciudad: '', metodo: '', coment: '' });
  const S = {
    screen: 'landing', viewMode: 'mapa',
    query: '', fType: 'todos', fManz: 'todos', fStatus: 'todos',
    selected: [], detailId: null, zoomed: false,
    flow: null, months: 36,
    form: emptyForm(), errors: {}, ref: '', toast: '', visitOpen: false
  };

  /* ---------- helpers de estado ---------- */
  const statusLabel = (e) => e === 'disponible' ? 'Disponible' : e === 'reservado' ? 'Reservado' : 'Vendido';
  const badgeCls = (e, sel) => sel ? 'sel' : e;
  const fillFor = (l, sel) => sel ? '#16B8D0' : l.estado === 'reservado' ? '#D6A65D' : l.estado === 'vendido' ? '#C9574C' : '#D3DEE5';
  const strokeFor = (l, sel) => sel ? '#0b8197' : l.estado === 'reservado' ? '#b2823f' : l.estado === 'vendido' ? '#9C3F36' : '#9FB0BB';
  const labelColor = (l, sel) => sel ? '#06323a' : l.estado === 'disponible' ? '#3a4a56' : l.estado === 'reservado' ? '#4a3a12' : '#FBEDEA';
  const isSel = (id) => S.selected.includes(id);

  function matched(l) {
    if (S.fStatus !== 'todos' && l.estado !== S.fStatus) return false;
    if (S.fType !== 'todos' && l.tipo !== S.fType) return false;
    if (S.fManz !== 'todos' && l.manzana !== S.fManz) return false;
    const q = S.query.trim().toLowerCase();
    if (q) { const hay = (l.id + ' ' + l.areaM2 + ' ' + l.areaM2 + ' m² ' + l.manzana + ' ' + l.tipo).toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  }

  function totals() {
    const lots = S.selected.map(id => D.byId[id]).filter(Boolean);
    const precioTotal = lots.reduce((a, l) => a + l.precioDop, 0);
    const sepTotal = lots.reduce((a, l) => a + l.separacionDop, 0);
    const saldo = precioTotal - sepTotal;
    const cuota = (m) => lots.length ? Math.round(saldo / m) : 0;
    return { lots, precioTotal, sepTotal, saldo, cuota };
  }

  function setState(patch) {
    Object.assign(S, patch);
    render(patch);
  }

  /* ---------- SVG ---------- */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  const lotEls = {}, labelEls = {};
  let mapSvg, mapGroup;

  function buildMap() {
    mapSvg = $('map');
    mapSvg.setAttribute('viewBox', D.viewBox);
    const defs = el('defs', {}, mapSvg);
    const rg = el('radialGradient', { id: 'mg', cx: '50%', cy: '42%', r: '70%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#16222c' }, rg);
    el('stop', { offset: '100%', 'stop-color': '#0b1117' }, rg);
    const pat = el('pattern', { id: 'grid', width: 60, height: 60, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M60 0H0V60', fill: 'none', stroke: '#1d2a35', 'stroke-width': 0.7 }, pat);

    mapGroup = el('g', {}, mapSvg);
    el('rect', { x: -600, y: -600, width: 3200, height: 2600, fill: 'url(#mg)' }, mapGroup);
    el('rect', { x: -600, y: -600, width: 3200, height: 2600, fill: 'url(#grid)' }, mapGroup);
    el('polygon', { points: D.devHullPts, fill: '#1B2732', stroke: '#1B2732', 'stroke-width': 48, 'stroke-linejoin': 'round' }, mapGroup);
    D.avenues.forEach(pts => {
      el('polyline', { points: pts, fill: 'none', stroke: '#2a3a48', 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mapGroup);
      el('polyline', { points: pts, fill: 'none', stroke: '#4a5d6b', 'stroke-width': 1.5, 'stroke-dasharray': '10 12', 'stroke-linecap': 'round' }, mapGroup);
    });
    D.greens.forEach(g => {
      el('polygon', { points: g.points, fill: '#2c4537', stroke: '#3d5e4b', 'stroke-width': 1.5 }, mapGroup);
      const t = el('text', { x: g.tx, y: g.ty, fill: '#9cc4a6', 'font-size': 15, 'font-family': 'Space Grotesk,sans-serif', 'font-weight': 600, 'text-anchor': 'middle', style: 'pointer-events:none' }, mapGroup);
      t.textContent = g.label;
    });
    const rb = D.roundabout;
    el('circle', { cx: rb.cx, cy: rb.cy, r: rb.r1, fill: 'none', stroke: '#2a3a48', 'stroke-width': 20 }, mapGroup);
    el('circle', { cx: rb.cx, cy: rb.cy, r: rb.r2, fill: '#2c4537', stroke: '#3d5e4b', 'stroke-width': 1.5 }, mapGroup);

    const lotsG = el('g', { class: 'lots' }, mapGroup);
    const labelsG = el('g', { class: 'labels' }, mapGroup);
    D.lots.forEach(l => {
      lotEls[l.id] = el('polygon', { points: l.points, 'data-id': l.id }, lotsG);
      const t = el('text', { x: l.cx, y: l.cy + 3, 'font-size': 8.5, 'font-family': 'JetBrains Mono,monospace', 'text-anchor': 'middle' }, labelsG);
      t.textContent = l.id;
      labelEls[l.id] = t;
    });
  }

  function buildHero() {
    document.querySelectorAll('[data-cfg]').forEach(n => { n.textContent = cfg[n.dataset.cfg]; });
    if (cfg.heroImage) {
      const img = document.createElement('img');
      img.src = cfg.heroImage; img.alt = 'Vista residencial del proyecto';
      img.onload = () => document.querySelector('.photo-ph').remove();
      document.querySelector('.photo-frame').insertBefore(img, document.querySelector('.photo-tag'));
    }
    const stats = [
      [String(D.counts.disponible), 'solares disponibles'],
      [money(cfg.sep), 'separación por solar'],
      ['36', 'meses sin intereses (demo)'],
      [new Intl.NumberFormat(cfg.currencyLocale).format(D.areaTotal) + ' m²', 'en solares (muestra)']
    ];
    $('heroStats').innerHTML = stats.map(s => '<div class="statc"><div class="v">' + esc(s[0]) + '</div><div class="k">' + esc(s[1]) + '</div></div>').join('');
    const pi = $('piSvg');
    pi.setAttribute('viewBox', D.viewBox);
    el('polygon', { points: D.devHullPts, fill: '#1B2732', stroke: '#1B2732', 'stroke-width': 46, 'stroke-linejoin': 'round' }, pi);
    D.greens.forEach(g => el('polygon', { points: g.points, fill: '#2c4537' }, pi));
    D.lots.forEach((l, i) => el('polygon', { points: l.points, fill: i % 14 === 0 ? '#16B8D0' : '#D3DEE5', stroke: '#7d8f9c', 'stroke-width': 1.1 }, pi));
  }

  function buildSelects() {
    $('fType').innerHTML = [['todos', 'Todos los tipos'], ['Estándar', 'Estándar'], ['Esquina', 'Esquina']]
      .map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('');
    $('fManz').innerHTML = '<option value="todos">Todas las manzanas</option>' + D.manzList.map(m => '<option value="' + m + '">' + m + '</option>').join('');
  }

  /* ---------- pan / zoom ---------- */
  let tx = 0, ty = 0, scale = 1;
  const pointers = new Map();
  let dragging = false, moved = false, pinchDist = 0, start = null, hoverId = null;

  const applyTransform = () => mapGroup.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + scale + ')');
  // Unidades del viewBox por píxel de pantalla (preserveAspectRatio="meet")
  const sf = () => { const r = mapSvg.getBoundingClientRect(); return r.width && r.height ? Math.max(D.W / r.width, D.H / r.height) : 1; };
  function clamp() {
    scale = Math.max(0.6, Math.min(6, scale));
    const pad = D.W * 0.45;
    tx = Math.max(D.W - D.W * scale - pad, Math.min(pad, tx));
    ty = Math.max(D.H - D.H * scale - pad, Math.min(pad, ty));
  }
  // Convierte un punto de pantalla a coordenadas del viewBox (respeta el letterboxing de "meet").
  function toView(cx, cy) {
    const r = mapSvg.getBoundingClientRect();
    const k = Math.min(r.width / D.W, r.height / D.H) || 1;
    const ox = (r.width - D.W * k) / 2, oy = (r.height - D.H * k) / 2;
    return { x: (cx - r.left - ox) / k, y: (cy - r.top - oy) / k };
  }
  function zoomAt(cx, cy, f) {
    const v = toView(cx, cy);
    const ns = Math.max(0.6, Math.min(6, scale * f)); const k = ns / scale;
    tx = v.x - (v.x - tx) * k; ty = v.y - (v.y - ty) * k; scale = ns;
    clamp(); applyTransform();
  }
  // Píxeles de pantalla por unidad del viewBox a escala 1
  const baseK = () => { const r = mapSvg.getBoundingClientRect(); return Math.min(r.width / D.W, r.height / D.H) || 1; };
  const narrow = () => window.innerWidth <= 860;
  // Etiquetas visibles cuando el texto alcanza un tamaño legible en pantalla
  function maybeZoom() { const z = scale * baseK() > 1.25; if (z !== S.zoomed) setState({ zoomed: z }); }
  function centerZoom(f) { const r = mapSvg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); maybeZoom(); }
  // En pantallas altas y estrechas el plano queda en una franja: se amplía para llenar el alto.
  function fit() {
    const r = mapSvg.getBoundingClientRect(); const k = baseK();
    scale = r.height && D.H * k < 0.6 * r.height ? Math.min(2.2, 0.75 * r.height / (D.H * k)) : 1;
    tx = (D.W - D.W * scale) / 2; ty = (D.H - D.H * scale) / 2;
    clamp(); applyTransform(); maybeZoom();
  }
  function focusLot(l) {
    const r = mapSvg.getBoundingClientRect();
    scale = Math.min(6, Math.max(3.4, 1.45 / baseK()));
    // En móvil la ficha ocupa la parte baja: el solar se centra en el tercio superior.
    const v = toView(r.left + r.width / 2, r.top + r.height * (narrow() ? 0.3 : 0.5));
    tx = v.x - l.cx * scale; ty = v.y - l.cy * scale;
    clamp(); applyTransform(); maybeZoom();
  }

  const idAt = (x, y) => { const n = document.elementFromPoint(x, y); const id = n && n.getAttribute ? n.getAttribute('data-id') : null; return id && D.byId[id] && n.closest('#map') ? id : null; };

  function updateHover(cx, cy) {
    const tip = $('tip'); const id = idAt(cx, cy);
    if (id) {
      const l = D.byId[id];
      if (hoverId !== id) { tip.innerHTML = '<b>' + esc(l.id) + '</b> · ' + esc(l.tipo) + ' · ' + l.areaM2 + ' m²'; hoverId = id; }
      const wrap = tip.parentElement.getBoundingClientRect();
      tip.style.display = 'block';
      let x = cx - wrap.left + 14; const y = cy - wrap.top + 16;
      if (x + tip.offsetWidth > wrap.width - 8) x = cx - wrap.left - tip.offsetWidth - 12;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    } else hideTip();
  }
  function hideTip() { $('tip').style.display = 'none'; hoverId = null; }

  function bindMap() {
    mapSvg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { dragging = true; moved = false; start = { x: e.clientX, y: e.clientY, tx, ty }; }
      try { mapSvg.setPointerCapture(e.pointerId); } catch (x) { /* noop */ }
    });
    mapSvg.addEventListener('pointermove', (e) => {
      if (pointers.size === 0) { if (e.pointerType === 'mouse') updateHover(e.clientX, e.clientY); return; }
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const p = [...pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist) zoomAt((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, d / pinchDist);
        pinchDist = d; moved = true; return;
      }
      if (dragging) {
        const k = sf();
        tx = start.tx + (e.clientX - start.x) * k; ty = start.ty + (e.clientY - start.y) * k;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) { moved = true; mapSvg.classList.add('dragging'); hideTip(); }
        clamp(); applyTransform();
      }
    });
    const up = (e) => {
      const wasMoved = moved;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) {
        dragging = false; mapSvg.classList.remove('dragging');
        if (!wasMoved && e.type === 'pointerup') {
          const id = idAt(e.clientX, e.clientY);
          if (id) setState({ detailId: id }); else if (S.detailId) setState({ detailId: null });
        }
        maybeZoom();
      }
    };
    mapSvg.addEventListener('pointerup', up);
    mapSvg.addEventListener('pointercancel', up);
    mapSvg.addEventListener('pointerleave', hideTip);
    mapSvg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89); maybeZoom(); }, { passive: false });
  }

  /* ---------- render ---------- */
  function renderScreen() {
    $('landing').hidden = S.screen !== 'landing';
    $('explorer').hidden = S.screen !== 'explorer';
    $('mapwrap').hidden = S.viewMode !== 'mapa';
    $('list').hidden = S.viewMode !== 'lista';
    document.querySelectorAll('.vtoggle button').forEach(b => {
      const on = b.dataset.v === S.viewMode;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    });
  }

  function renderFilters() {
    const dot = { disponible: '#D3DEE5', reservado: '#D6A65D', vendido: '#C9574C', todos: '#16B8D0' };
    $('chips').innerHTML = [['disponible', 'Disponibles', D.counts.disponible], ['reservado', 'Reservados', D.counts.reservado], ['vendido', 'Vendidos', D.counts.vendido], ['todos', 'Todos', D.counts.total]]
      .map(a => '<button class="chipx' + (S.fStatus === a[0] ? ' on' : '') + '" data-act="chip" data-key="' + a[0] + '" aria-pressed="' + (S.fStatus === a[0]) + '"><span class="dotc" style="background:' + dot[a[0]] + '"></span>' + a[1] + ' <span class="n">' + a[2] + '</span></button>').join('');
    $('fType').value = S.fType; $('fManz').value = S.fManz;
    if ($('search').value !== S.query) $('search').value = S.query;
    const n = D.lots.filter(matched).length;
    const label = n + (n === 1 ? ' solar' : ' solares');
    $('resultPill').textContent = label; $('piCount').textContent = label;
  }

  function renderLots() {
    mapSvg.classList.toggle('zoomed', S.zoomed);
    D.lots.forEach(l => {
      const sel = isSel(l.id), m = matched(l), p = lotEls[l.id];
      p.setAttribute('fill', fillFor(l, sel)); p.setAttribute('stroke', strokeFor(l, sel));
      p.setAttribute('stroke-width', sel ? 2.6 : 0.8); p.setAttribute('fill-opacity', m ? 1 : 0.12);
      const t = labelEls[l.id];
      t.setAttribute('fill', labelColor(l, sel)); t.style.display = m ? '' : 'none';
    });
  }

  function renderDetail() {
    const d = S.detailId ? D.byId[S.detailId] : null;
    if (!d) { $('detail').innerHTML = ''; return; }
    const sel = isSel(d.id), avail = d.estado === 'disponible';
    let act;
    if (avail && !sel) act = '<button class="btnx btn-cta btn-sm" style="flex:1" data-act="add-detail">Agregar a mi selección</button>';
    else if (sel) act = '<span class="in-sel">✓ En tu selección</span><button class="btnx btn-ghostx btn-sm" data-act="remove-detail">Quitar</button>';
    else act = '<button class="btnx btn-ghostx btn-sm" style="flex:1" data-act="close-detail">Cerrar</button>';
    const html =
      '<div class="detailx' + (sel ? ' sel' : '') + '" role="region" aria-label="Ficha del solar ' + esc(d.id) + '">' +
        '<div class="dx-head"><div><div class="dx-id">' + esc(d.id) + '</div><div class="dx-meta">Manzana ' + d.manzana + ' · ' + d.tipo + ' · ' + d.areaM2 + ' m²</div></div>' +
        '<span class="badgex ' + badgeCls(d.estado, sel) + '">' + statusLabel(d.estado) + '</span></div>' +
        '<div class="dx-body">' +
          '<div class="dx-row"><span class="l">Superficie</span><span class="v">' + d.areaM2 + ' m²</span></div>' +
          '<div class="dx-row"><span class="l">Precio</span><span class="v big">' + money(d.precioDop) + '</span></div>' +
          '<div class="dx-row"><span class="l">Separación</span><span class="v">' + money(d.separacionDop) + '</span></div>' +
          (avail ? '<div class="dx-row"><span class="l">Cuota estimada · 36 meses</span><span class="v">' + money(Math.round((d.precioDop - d.separacionDop) / 36)) + '</span></div>' : '') +
        '</div>' +
        '<div class="dx-act">' + act + '</div>' +
      '</div>';
    // Solo re-animar cuando cambia de solar
    const cur = $('detail').firstElementChild;
    if (cur && cur.dataset.id === d.id) { cur.outerHTML = html; $('detail').firstElementChild.style.animation = 'none'; }
    else $('detail').innerHTML = html;
    $('detail').firstElementChild.dataset.id = d.id;
  }

  function renderSelPill() {
    const t = totals();
    if (!t.lots.length) { $('selpill').innerHTML = ''; return; }
    const txt = t.lots.length + ' ' + (t.lots.length === 1 ? 'solar' : 'solares') + ' · ' + money(t.precioTotal);
    const cur = $('selpill').querySelector('.sc');
    if (cur) { cur.textContent = txt; return; }
    $('selpill').innerHTML = '<div class="selpill"><div><div class="sc">' + txt + '</div><div class="ss">Tu selección</div></div>' +
      '<button class="btnx btn-cta btn-sm" data-act="open-selection">Ver selección →</button></div>';
  }

  function renderList() {
    if (S.viewMode !== 'lista') return;
    const rows = D.lots.filter(matched).sort((a, b) => (a.id > b.id ? 1 : -1));
    if (!rows.length) { $('list').innerHTML = '<div class="empty">No hay solares que coincidan con estos filtros. Prueba a cambiar el estado, el tipo o la manzana.</div>'; return; }
    const hull = '<polygon points="' + D.devHullPts + '" fill="#273642" stroke="#273642" stroke-width="40" stroke-linejoin="round"></polygon>';
    $('list').innerHTML = '<div class="list-grid">' + rows.map(l => {
      const sel = isSel(l.id);
      return '<article class="lcardx">' +
        '<div class="ltop">' +
          '<div class="lthumb"><svg viewBox="' + D.viewBox + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + hull +
            '<polygon class="me" points="' + l.points + '" fill="' + fillFor(l, sel) + '" stroke="#16B8D0" stroke-width="22"></polygon></svg></div>' +
          '<div class="lmain">' +
            '<div class="h"><span class="id">' + esc(l.id) + '</span><span class="badgex ' + badgeCls(l.estado, sel) + '">' + statusLabel(l.estado) + '</span></div>' +
            '<div class="m">Manzana ' + l.manzana + ' · ' + l.tipo + '</div>' +
            '<div class="msub">' + l.areaM2 + ' m²</div>' +
            '<div class="p">' + money(l.precioDop) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="a">' +
          '<button class="btnx btn-out btn-sm" style="flex:1" data-act="list-locate" data-id="' + l.id + '">Ver en el mapa</button>' +
          (l.estado === 'disponible' ? '<button class="btnx btn-cta btn-sm" style="flex:1" data-act="list-select" data-id="' + l.id + '">' + (sel ? 'Quitar' : 'Seleccionar') + '</button>' : '') +
        '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  function buildMessage(t) {
    const f = S.form;
    const lines = t.lots.map(l => '- ' + l.id + ' · ' + l.manzana + ' · ' + l.areaM2 + ' m² · ' + money(l.precioDop)).join('\n');
    let msg = 'SOLICITUD DE RESERVA · ' + cfg.projectFull + '\n';
    msg += 'Referencia: ' + (S.ref || 'DEMO-2026-0000') + '\n\n';
    msg += 'Cliente: ' + (f.nombre || '—') + '\nWhatsApp: ' + (f.whatsapp || '—') + '\n';
    if (f.email.trim()) msg += 'Correo: ' + f.email + '\n';
    if (f.ciudad.trim()) msg += 'Ciudad: ' + f.ciudad + '\n';
    msg += '\nSolares:\n' + (lines || '- (sin solares)') + '\n\n';
    msg += 'Precio total: ' + money(t.precioTotal) + '\nSeparación: ' + money(t.sepTotal) + '\nSaldo estimado: ' + money(t.saldo) + '\n';
    msg += 'Plan: ' + S.months + ' cuotas estimadas de ' + money(t.cuota(S.months)) + ' (sin intereses en esta demo)\n';
    msg += 'Pago de separación: ' + (f.metodo || '—') + '\n';
    if (f.coment.trim()) msg += 'Comentarios: ' + f.coment + '\n';
    msg += '\nSolicitud de demostración, pendiente de confirmación por la empresa.';
    return msg;
  }

  const field = (key, label, type, ph, opt) => {
    const err = S.errors[key];
    return '<div class="fieldx"><label for="f-' + key + '">' + label + '</label>' +
      '<input class="inx" id="f-' + key + '" type="' + type + '" data-field="' + key + '" value="' + esc(S.form[key]) + '" placeholder="' + ph + '"' + (opt || '') + (err ? ' aria-invalid="true" aria-describedby="e-' + key + '"' : '') + '>' +
      (err ? '<div class="errx" id="e-' + key + '">' + esc(err) + '</div>' : '') + '</div>';
  };

  function renderFlow() {
    $('flow').hidden = !S.flow;
    if (!S.flow) return;
    const dr = $('drawer'); const keep = dr.dataset.step === S.flow ? dr.scrollTop : 0;
    const t = totals(); let h = '';
    if (S.flow === 'step1') {
      h += '<div class="dh"><div class="ek">Paso 1 de 2</div><h2 id="flowTitle">Tu selección</h2><div class="prog"><span class="s on"></span><span class="s"></span></div></div><div class="db">';
      h += t.lots.map(l => '<div class="rrow"><div><div class="id">' + esc(l.id) + '</div><div class="m">Manzana ' + l.manzana + ' · ' + l.tipo + ' · ' + l.areaM2 + ' m²</div></div>' +
        '<div style="display:flex;align-items:center;gap:12px"><span class="p">' + money(l.precioDop) + '</span><button class="btnx btn-ghostx btn-sm rm" data-act="remove-sel" data-id="' + l.id + '">Quitar</button></div></div>').join('');
      if (!t.lots.length) h += '<div class="empty" style="padding:18px;margin:0">Selección vacía. Agrega al menos un solar para continuar.</div>';
      h += '<button class="addmore" data-act="add-another">+ Agregar otro solar</button>';
      h += '<div class="q">¿En cuántos meses quieres pagar?</div><div class="plans" role="radiogroup" aria-label="Plazo">' +
        [12, 24, 36].map(m => '<button class="plan' + (S.months === m ? ' on' : '') + '" role="radio" aria-checked="' + (S.months === m) + '" data-act="month" data-m="' + m + '"><div class="pm">' + m + ' meses</div><div class="pc">' + money(t.cuota(m)) + '</div><div class="pp">por mes</div></button>').join('') + '</div>';
      h += '<div class="plan-note">Hasta 36 meses sin intereses (condición ilustrativa para esta demo).</div>';
      h += '<div class="brk"><div class="r"><span>Precio total</span><span class="v">' + money(t.precioTotal) + '</span></div>' +
        '<div class="r"><span>Separación</span><span class="v">' + money(t.sepTotal) + '</span></div>' +
        '<div class="r"><span>Saldo a financiar</span><span class="v">' + money(t.saldo) + '</span></div>' +
        '<div class="r tot"><span>Cuota del plan (' + S.months + ' meses)</span><span class="v">' + money(t.cuota(S.months)) + '</span></div></div>';
      h += '<div class="note">No pagas nada ahora. Esta solicitud se prepara para que un asesor te contacte y coordine el siguiente paso.</div></div>';
      h += '<div class="df"><button class="btnx btn-out" style="flex:1" data-act="close-flow">Cerrar</button><button class="btnx btn-cta" style="flex:2" data-act="continue"' + (t.lots.length ? '' : ' disabled') + '>Continuar</button></div>';
    } else if (S.flow === 'step2') {
      const f = S.form, er = S.errors;
      h += '<div class="dh"><div class="ek">Paso 2 de 2</div><h2 id="flowTitle">Tus datos</h2><div class="prog"><span class="s on"></span><span class="s on"></span></div></div><div class="db">';
      h += field('nombre', 'Nombre y apellido *', 'text', 'Tu nombre completo', ' autocomplete="name"');
      h += field('whatsapp', 'WhatsApp *', 'tel', '+1 809 000 0000', ' autocomplete="tel" inputmode="tel"');
      h += field('email', 'Correo (opcional)', 'email', 'tucorreo@ejemplo.com', ' autocomplete="email"');
      h += field('ciudad', 'Ciudad y país (opcional)', 'text', 'Santiago, República Dominicana');
      h += '<div class="fieldx"><span class="lbl" id="l-metodo">¿Cómo prefieres pagar la separación? *</span><div class="segx" role="radiogroup" aria-labelledby="l-metodo">' +
        ['Transferencia', 'Efectivo en oficina'].map(v => '<button class="segopt' + (f.metodo === v ? ' on' : '') + '" role="radio" aria-checked="' + (f.metodo === v) + '" data-act="metodo" data-v="' + v + '">' + v + '</button>').join('') + '</div>' +
        (er.metodo ? '<div class="errx">' + esc(er.metodo) + '</div>' : '') +
        (f.metodo === 'Transferencia' ? '<div class="note" style="margin-top:10px">¿Ya realizaste una transferencia? Podrás adjuntar el comprobante cuando el asesor te contacte. En esta demo no se sube ningún archivo.</div>' : '') + '</div>';
      h += '<div class="fieldx"><label for="f-coment">Comentarios (opcional)</label><textarea class="inx" id="f-coment" rows="3" data-field="coment" placeholder="Algo que debamos saber…">' + esc(f.coment) + '</textarea></div>';
      h += '<div class="note">Estos datos no se almacenan ni se envían a ningún servidor durante esta demo.</div></div>';
      h += '<div class="df"><button class="btnx btn-out" style="flex:1" data-act="back">Atrás</button><button class="btnx btn-cta" style="flex:2" data-act="submit">Enviar reserva</button></div>';
    } else {
      const wa = buildMessage(t);
      const digits = cfg.contactPhone.replace(/\D/g, '');
      h += '<div class="dh"><div class="ek">Solicitud preparada</div><h2 id="flowTitle">Lista para WhatsApp</h2></div><div class="db">';
      h += '<span class="refx">⬡ ' + esc(S.ref) + '</span>';
      h += '<p class="done-p">Esta es la vista previa del mensaje que se enviaría a un asesor. Revísalo y cópialo o ábrelo en WhatsApp.</p>';
      h += '<div class="msgx">' + esc(wa) + '</div>';
      h += '<div class="donenote">Esto es una simulación. No se ha reservado, bloqueado ni cobrado ningún solar.</div></div>';
      h += '<div class="df"><button class="btnx btn-out btn-sm" data-act="copy">Copiar solicitud</button>' +
        (digits.length >= 8 ? '<a class="btnx btn-cta btn-sm" href="https://wa.me/' + digits + '?text=' + encodeURIComponent(wa) + '" target="_blank" rel="noopener" style="flex:1">Abrir WhatsApp</a>' : '') +
        '<button class="btnx btn-ghostx btn-sm" data-act="close-flow">Volver</button><button class="btnx btn-ghostx btn-sm" data-act="start-over">Empezar de nuevo</button></div>';
    }
    dr.innerHTML = h; dr.dataset.step = S.flow; dr.scrollTop = keep;
  }

  function renderToast() { const t = $('toast'); t.hidden = !S.toast; t.textContent = S.toast; }

  const FLOW_KEYS = ['flow', 'months', 'selected', 'errors', 'ref', 'form'];
  function render(patch) {
    renderScreen();
    renderFilters();
    if (S.screen === 'explorer') { renderLots(); renderDetail(); renderSelPill(); renderList(); }
    if (!patch || FLOW_KEYS.some(k => k in patch)) renderFlow();
    $('visit').hidden = !S.visitOpen;
    renderToast();
  }

  /* ---------- acciones ---------- */
  let toastTimer;
  function showToast(t) { setState({ toast: t }); clearTimeout(toastTimer); toastTimer = setTimeout(() => setState({ toast: '' }), 2200); }
  function copyText(text) {
    const done = () => showToast('Solicitud copiada');
    const fallback = () => {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); ok ? done() : showToast('No se pudo copiar'); }
      catch (e) { showToast('No se pudo copiar'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback); else fallback();
  }
  function goExplorer() { setState({ screen: 'explorer', visitOpen: false }); window.scrollTo(0, 0); fit(); }
  function locate(id) { setState({ viewMode: 'mapa', detailId: id }); requestAnimationFrame(() => focusLot(D.byId[id])); }

  function onSubmit() {
    const f = S.form, er = {};
    if (!f.nombre.trim()) er.nombre = 'Ingresa tu nombre y apellido.';
    if (!f.whatsapp.trim()) er.whatsapp = 'Ingresa tu número de WhatsApp.';
    if (!f.metodo) er.metodo = 'Elige cómo pagarás la separación.';
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) er.email = 'Correo no válido.';
    if (Object.keys(er).length) {
      setState({ errors: er });
      const first = $('drawer').querySelector('[aria-invalid="true"]'); if (first) first.focus();
      return;
    }
    setState({ ref: 'DEMO-2026-' + String(1000 + Math.floor(Math.random() * 9000)), flow: 'done', errors: {} });
  }

  function startOver() {
    setState({ screen: 'explorer', viewMode: 'mapa', query: '', fType: 'todos', fManz: 'todos', fStatus: 'todos', selected: [], detailId: null, flow: null, months: 36, form: emptyForm(), errors: {}, ref: '' });
    fit(); showToast('Prototipo reiniciado');
  }

  const actions = {
    'go-explorer': goExplorer,
    'go-landing': () => setState({ screen: 'landing' }),
    'open-visit': () => setState({ visitOpen: true }),
    'close-visit': () => setState({ visitOpen: false }),
    'visit-explore': goExplorer,
    'view': (b) => { setState({ viewMode: b.dataset.v }); hideTip(); },
    'chip': (b) => setState({ fStatus: b.dataset.key }),
    'zoom-in': () => centerZoom(1.3),
    'zoom-out': () => centerZoom(0.77),
    'fit': fit,
    'add-detail': () => { const id = S.detailId; if (D.byId[id] && D.byId[id].estado === 'disponible' && !isSel(id)) setState({ selected: [...S.selected, id] }); },
    'remove-detail': () => setState({ selected: S.selected.filter(x => x !== S.detailId) }),
    'close-detail': () => setState({ detailId: null }),
    'open-selection': () => { if (S.selected.length) setState({ flow: 'step1' }); },
    'list-locate': (b) => locate(b.dataset.id),
    'list-select': (b) => { const id = b.dataset.id; setState({ selected: isSel(id) ? S.selected.filter(x => x !== id) : [...S.selected, id], detailId: id }); },
    'remove-sel': (b) => setState({ selected: S.selected.filter(x => x !== b.dataset.id) }),
    'add-another': () => setState({ flow: null }),
    'close-flow': () => setState({ flow: null }),
    'month': (b) => setState({ months: +b.dataset.m }),
    'continue': () => { if (S.selected.length) setState({ flow: 'step2' }); },
    'back': () => setState({ flow: 'step1' }),
    'metodo': (b) => setState({ form: Object.assign({}, S.form, { metodo: b.dataset.v }), errors: Object.assign({}, S.errors, { metodo: '' }) }),
    'submit': onSubmit,
    'copy': () => copyText(buildMessage(totals())),
    'start-over': startOver
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    // Los overlays solo se cierran al pulsar fuera del panel
    if (b.classList.contains('ovl') && e.target !== b) return;
    if (b.disabled) return;
    const fn = actions[b.dataset.act]; if (fn) fn(b);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'search') {
      const v = t.value; setState({ query: v });
      const m = D.lots.find(l => l.id.toLowerCase() === v.trim().toLowerCase());
      if (m) locate(m.id);
      return;
    }
    const k = t.dataset && t.dataset.field;
    if (k) {
      // Sin re-render: conserva el foco y el cursor mientras se escribe
      S.form[k] = t.value;
      if (S.errors[k]) { S.errors[k] = ''; t.removeAttribute('aria-invalid'); const er = $('e-' + k); if (er) er.remove(); }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'fType') setState({ fType: e.target.value });
    if (e.target.id === 'fManz') setState({ fManz: e.target.value });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (S.visitOpen) setState({ visitOpen: false });
    else if (S.flow) setState({ flow: null });
    else if (S.detailId && S.screen === 'explorer') setState({ detailId: null });
  });

  /* ---------- init ---------- */
  buildHero();
  buildSelects();
  buildMap();
  bindMap();
  applyTransform();
  render();
})();
