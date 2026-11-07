/* Catálogo para colaboradores (solo lectura) */
(async () => {
  const $ = s => document.querySelector(s);
  const { cat, pre } = await P2P.cargar();
  const precios = {};
  for (const p of cat.productos) precios[p.id] = P2P.normaliza(pre.productos && pre.productos[p.id]);

  const nombreSub = {};
  for (const c of cat.categorias) for (const s of c.subcategorias) nombreSub[c.id + '/' + s.id] = s.nombre;
  const contar = (c, s) => cat.productos.filter(p => p.categoria === c && (!s || p.subcategoria === s)).length;

  const estado = { gama: cat.categorias[0].id, sub: '', q: '', orden: 'nombre' };
  const h = location.hash.slice(1).split('/');
  if (cat.categorias.some(c => c.id === h[0])) { estado.gama = h[0]; estado.sub = h[1] || ''; }

  if (pre.actualizado) $('#actualizado').textContent = 'Precios actualizados el ' + P2P.fecha(pre.actualizado);

  /* Gamas */
  const gamas = $('#gamas');
  for (const c of cat.categorias) {
    const b = document.createElement('button');
    b.className = 'gama'; b.type = 'button'; b.dataset.id = c.id;
    b.innerHTML = `<img src="${P2P.IMAGEN_GAMA[c.id]}" alt="" loading="eager"><span class="gama__txt"><strong>${P2P.esc(c.nombre)}</strong><span>${contar(c.id)} productos</span></span>`;
    b.addEventListener('click', () => { estado.gama = c.id; estado.sub = ''; pintar(); document.querySelector('.panel').scrollIntoView({ behavior: 'smooth' }); });
    gamas.appendChild(b);
  }

  $('#buscar').addEventListener('input', e => { estado.q = e.target.value.trim().toLowerCase(); pintarLista(); });
  $('#ordenar').addEventListener('change', e => { estado.orden = e.target.value; pintarLista(); });

  function pintar() {
    history.replaceState(null, '', '#' + estado.gama + (estado.sub ? '/' + estado.sub : ''));
    gamas.querySelectorAll('.gama').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === estado.gama));
    const c = cat.categorias.find(x => x.id === estado.gama);
    const tabs = $('#subtabs'); tabs.innerHTML = '';
    const opciones = [{ id: '', nombre: 'Todos' }, ...c.subcategorias];
    for (const s of opciones) {
      const t = document.createElement('button');
      t.className = 'subtab'; t.type = 'button'; t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', s.id === estado.sub);
      t.innerHTML = `${P2P.esc(s.nombre)}<b>${contar(c.id, s.id)}</b>`;
      t.addEventListener('click', () => { estado.sub = s.id; pintar(); });
      tabs.appendChild(t);
    }
    pintarLista();
  }

  function seleccion() {
    let l = cat.productos.filter(p => p.categoria === estado.gama && (!estado.sub || p.subcategoria === estado.sub));
    if (estado.q) l = cat.productos.filter(p => p.nombre.toLowerCase().includes(estado.q));
    const k = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      margen: (a, b) => P2P.margenOnline(precios[b.id], 'peninsula').eur - P2P.margenOnline(precios[a.id], 'peninsula').eur,
      pvp: (a, b) => precios[b.id].pvp - precios[a.id].pvp
    }[estado.orden];
    return l.slice().sort(k);
  }

  function pintarKpis(l) {
    const con = l.filter(p => P2P.tienePrecio(precios[p.id]));
    const conC = l.filter(p => P2P.tieneComercio(precios[p.id]));
    const media = (arr, f) => { const v = arr.map(f).filter(x => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const mo = media(con, p => P2P.margenOnline(precios[p.id], 'peninsula').pct);
    const mc = media(conC, p => P2P.margenComercio(precios[p.id], 'tienda').pct);
    $('#kpis').innerHTML = `
      <div class="kpi"><span>Productos en esta vista</span><strong>${l.length}</strong></div>
      <div class="kpi"><span>Con precios cargados</span><strong>${con.length}</strong><small>de ${l.length}</small></div>
      <div class="kpi kpi--online"><span>Margen online medio, Península</span><strong>${mo === null ? '—' : P2P.pct(mo)}</strong></div>
      <div class="kpi"><span>Margen medio en tiendas</span><strong>${mc === null ? '—' : P2P.pct(mc)}</strong></div>`;
  }

  const clase = v => v > 0 ? 'pos' : v < 0 ? 'neg' : 'cero';
  const tpl = $('#tpl-producto');

  function tarjeta(p) {
    const pr = precios[p.id];
    const n = tpl.content.firstElementChild.cloneNode(true);
    const img = n.querySelector('.prod__foto img'); img.src = p.imagen; img.alt = p.nombre;
    const c = cat.categorias.find(x => x.id === p.categoria);
    n.querySelector('.prod__ruta').textContent = `${c.nombre} / ${nombreSub[p.categoria + '/' + p.subcategoria]}`;
    n.querySelector('.prod__nombre').textContent = p.nombre;
    const est = n.querySelector('.prod__estado');
    if (P2P.tienePrecio(pr)) { est.textContent = 'Precios disponibles'; est.classList.add('prod__estado--ok'); }
    else est.textContent = 'Precios pendientes';

    n.querySelector('[data-k="fabrica"]').textContent = P2P.eur(pr.fabrica);
    n.querySelector('[data-k="pvp"]').textContent = P2P.eur(pr.pvp);

    const tb = n.querySelector('.zonas tbody');
    for (const z of P2P.ZONAS) {
      const m = P2P.margenOnline(pr, z.id);
      const e = pr.envio[z.id];
      let barra;
      if (pr.pvp > 0) {
        const tot = Math.max(pr.pvp, pr.fabrica + e);
        const w = v => (Math.max(v, 0) / tot * 100).toFixed(2) + '%';
        const f = Math.min(pr.fabrica, tot), eDentro = Math.max(Math.min(e, pr.pvp - f), 0), exceso = Math.max(pr.fabrica + e - pr.pvp, 0);
        barra = `<div class="barra" role="img" aria-label="Fábrica ${P2P.eur(pr.fabrica)}, envío ${P2P.eur(e)}, margen ${P2P.eur(m.eur)}">
          <i class="f" style="width:${w(f)}"></i><i class="e" style="width:${w(eDentro)}"></i>${m.eur >= 0 ? `<i class="m" style="width:${w(m.eur)}"></i>` : `<i class="x" style="width:${w(exceso)}" title="Pérdida"></i>`}</div>`;
      } else barra = '<div class="barra barra--vacia" aria-hidden="true"></div>';
      tb.insertAdjacentHTML('beforeend', `<tr><th scope="row" style="font-weight:400;color:inherit;font-size:14px">${z.nombre}</th>
        <td class="eur">${P2P.eur(e)}</td>
        <td class="eur ${clase(m.eur)}"><b>${P2P.eur(m.eur)}</b><small>${m.pct === null ? '—' : P2P.pct(m.pct)}</small></td>
        <td>${barra}</td></tr>`);
    }

    const tt = n.querySelector('.tarifa tbody');
    for (const ca of P2P.CANALES) {
      const m = P2P.margenComercio(pr, ca.id);
      tt.insertAdjacentHTML('beforeend', `<tr><td>${ca.nombre}</td><td class="eur">${P2P.eur(pr.comercio[ca.id])}</td>
        <td class="eur ${clase(m.eur)}">${P2P.eur(m.eur)}<small>${m.pct === null ? '—' : P2P.pct(m.pct)}</small></td></tr>`);
    }
    n.querySelector('[data-k="pvp_recomendado"]').textContent = P2P.eur(pr.comercio.pvp_recomendado);
    n.querySelector('[data-k="uds_caja"]').textContent = pr.comercio.uds_caja || '—';
    n.querySelector('[data-k="pedido_minimo"]').textContent = pr.comercio.pedido_minimo ? pr.comercio.pedido_minimo + ' uds' : '—';
    return n;
  }

  function pintarLista() {
    const l = seleccion();
    pintarKpis(l);
    const lista = $('#lista'); lista.innerHTML = '';
    if (!l.length) { lista.innerHTML = '<p class="vacio">Ningún producto coincide con la búsqueda. Prueba con otra palabra o elige una gama.</p>'; return; }
    const frag = document.createDocumentFragment();
    l.forEach(p => frag.appendChild(tarjeta(p)));
    lista.appendChild(frag);
  }

  pintar();
})();
