/* Panel interno: edición de precios y publicación en GitHub */
(() => {
  const REPO = 'pixel2pixel-official/productosbulgaria';
  const RUTA = 'data/precios.json';
  const API = `https://api.github.com/repos/${REPO}`;
  const K_TOKEN = 'p2p-gh-token', K_BORRADOR = 'p2p-precios-borrador';
  const $ = s => document.querySelector(s);

  const CAMPOS = [
    { k: 'fabrica', n: 'Precio de fábrica', g: 'o' },
    { k: 'pvp', n: 'Precio de venta online', g: 'o' },
    ...P2P.ZONAS.map(z => ({ k: 'envio.' + z.id, n: 'Envío ' + z.nombre, g: 'o' })),
    { calc: 'peninsula' }, { calc: 'canarias' },
    { k: 'comercio.tienda', n: 'Precio tiendas', g: 'c' },
    { k: 'comercio.supermercado', n: 'Precio supermercados', g: 'c' },
    { k: 'comercio.gran_superficie', n: 'Precio grandes superficies', g: 'c' },
    { k: 'comercio.pvp_recomendado', n: 'PVP recomendado', g: 'c' },
    { k: 'comercio.uds_caja', n: 'Unidades por caja', g: 'c', int: true },
    { k: 'comercio.pedido_minimo', n: 'Pedido mínimo (uds)', g: 'c', int: true }
  ];
  const editables = CAMPOS.filter(c => c.k);

  let token = null, cat = null, precios = {}, original = '', sha = null, actualizado = null;
  const get = (o, k) => k.split('.').reduce((a, b) => a[b], o);
  const set = (o, k, v) => { const p = k.split('.'); const u = p.pop(); p.reduce((a, b) => a[b], o)[u] = v; };

  /* ---------- utilidades ---------- */
  function aviso(txt, error = false) {
    const a = $('#aviso'); a.textContent = txt; a.className = 'aviso' + (error ? ' aviso--error' : ''); a.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => a.hidden = true, error ? 7000 : 4000);
  }
  const b64dec = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));
  const b64enc = s => btoa(unescape(encodeURIComponent(s)));
  async function gh(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) }, cache: 'no-store' });
    if (!r.ok) { const e = new Error((await r.json().catch(() => ({}))).message || r.statusText); e.status = r.status; throw e; }
    return r.json();
  }
  const serial = () => JSON.stringify(precios);
  const hayCambios = () => serial() !== original;

  /* ---------- acceso ---------- */
  async function entrar(t, recordar) {
    token = t;
    const repo = await gh('');
    if (!repo.permissions || !repo.permissions.push) throw new Error('El token no tiene permiso de escritura en el repositorio.');
    if (recordar) localStorage.setItem(K_TOKEN, t); else sessionStorage.setItem(K_TOKEN, t);
    const u = await gh('/../../../user').catch(() => null);
    if (u && u.login) $('#usuario').textContent = u.login;
    await cargarDatos();
    $('#acceso').hidden = true; $('#editor').hidden = false; $('#salir').hidden = false;
  }
  $('#form-acceso').addEventListener('submit', async e => {
    e.preventDefault(); $('#error-acceso').textContent = '';
    try { await entrar($('#token').value.trim(), $('#recordar').checked); }
    catch (err) { token = null; $('#error-acceso').textContent = err.status === 401 ? 'Token no válido o caducado.' : 'No se pudo entrar: ' + err.message; }
  });
  $('#salir').addEventListener('click', () => {
    if (hayCambios() && !confirm('Hay cambios sin guardar. ¿Desconectar igualmente?')) return;
    localStorage.removeItem(K_TOKEN); sessionStorage.removeItem(K_TOKEN); location.reload();
  });

  /* ---------- datos ---------- */
  async function cargarDatos() {
    cat = await fetch('../data/productos.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
    const f = await gh('/contents/' + RUTA);
    sha = f.sha;
    const pre = JSON.parse(b64dec(f.content));
    actualizado = pre.actualizado;
    precios = {};
    for (const p of cat.productos) precios[p.id] = P2P.normaliza(pre.productos && pre.productos[p.id]);
    original = serial();
    const b = localStorage.getItem(K_BORRADOR);
    if (b && b !== original) {
      try {
        const d = JSON.parse(b);
        if (confirm('Hay cambios sin publicar guardados en este navegador. ¿Quieres recuperarlos?')) {
          for (const id of Object.keys(precios)) if (d[id]) precios[id] = P2P.normaliza(d[id]);
        } else localStorage.removeItem(K_BORRADOR);
      } catch { localStorage.removeItem(K_BORRADOR); }
    }
    montarFiltros(); pintar(); estado();
  }

  /* ---------- filtros ---------- */
  function montarFiltros() {
    const g = $('#f-gama');
    for (const c of cat.categorias) g.insertAdjacentHTML('beforeend', `<option value="${c.id}">${P2P.esc(c.nombre)}</option>`);
    g.addEventListener('change', () => { subs(); pintar(); });
    $('#f-sub').addEventListener('change', pintar);
    $('#f-q').addEventListener('input', pintar);
    $('#f-pend').addEventListener('change', pintar);
    const mc = $('#m-campo');
    editables.forEach(c => mc.insertAdjacentHTML('beforeend', `<option value="${c.k}">${c.n}</option>`));
    subs();
  }
  function subs() {
    const s = $('#f-sub'), c = cat.categorias.find(x => x.id === $('#f-gama').value);
    s.innerHTML = '<option value="">Todas</option>' + (c ? c.subcategorias.map(x => `<option value="${x.id}">${P2P.esc(x.nombre)}</option>`).join('') : '');
    s.disabled = !c;
  }
  function visibles() {
    const g = $('#f-gama').value, s = $('#f-sub').value, q = $('#f-q').value.trim().toLowerCase(), pend = $('#f-pend').checked;
    return cat.productos.filter(p => (!g || p.categoria === g) && (!s || p.subcategoria === s) && (!q || p.nombre.toLowerCase().includes(q)) && (!pend || !P2P.tienePrecio(precios[p.id])));
  }

  /* ---------- tabla ---------- */
  const fmtIn = (v, int) => v ? (int ? String(v) : v.toFixed(2).replace('.', ',')) : '';
  function celdaCalc(p, zona) {
    const m = P2P.margenOnline(p, zona);
    if (!p.pvp) return '<span class="cero">—</span>';
    return `<span class="${m.eur > 0 ? 'pos' : m.eur < 0 ? 'neg' : 'cero'}">${P2P.eur(m.eur)}<small>${m.pct === null ? '' : P2P.pct(m.pct)}</small></span>`;
  }
  function pintar() {
    const l = visibles();
    $('#n-visibles').textContent = l.length;
    const cuerpo = $('#cuerpo'); cuerpo.innerHTML = '';
    if (!l.length) { cuerpo.innerHTML = `<tr><td colspan="16" style="padding:40px;text-align:center;color:var(--gris-600)">Ningún producto coincide con los filtros.</td></tr>`; return; }
    let grupo = '';
    const html = [];
    for (const p of l) {
      const c = cat.categorias.find(x => x.id === p.categoria), s = c.subcategorias.find(x => x.id === p.subcategoria);
      const gk = c.id + '/' + s.id;
      if (gk !== grupo) {
        grupo = gk;
        const n = l.filter(x => x.categoria === c.id && x.subcategoria === s.id).length;
        html.push(`<tr class="sec"><td colspan="16">${P2P.esc(c.nombre)} / ${P2P.esc(s.nombre)}<small>${n} productos</small></td></tr>`);
      }
      const pr = precios[p.id];
      const tds = CAMPOS.map(f => f.calc
        ? `<td class="calc c-online" data-calc="${f.calc}">${celdaCalc(pr, f.calc)}</td>`
        : `<td${f.g === 'o' ? ' class="c-online"' : ''}><input data-id="${p.id}" data-k="${f.k}" ${f.int ? 'class="int" inputmode="numeric"' : 'inputmode="decimal"'} value="${fmtIn(get(pr, f.k), f.int)}" placeholder="0" aria-label="${P2P.esc(f.n)}, ${P2P.esc(p.nombre)}"></td>`).join('');
      html.push(`<tr data-row="${p.id}"><td class="prod"><img src="../${p.imagen}" alt="" loading="lazy"><span>${P2P.esc(p.nombre)}</span></td>${tds}</tr>`);
    }
    cuerpo.innerHTML = html.join('');
    marcarModificados();
  }
  let base = null;
  function marcarModificados() {
    base = base || JSON.parse(original);
    document.querySelectorAll('#cuerpo input').forEach(i => i.classList.toggle('mod', get(precios[i.dataset.id], i.dataset.k) !== get(base[i.dataset.id], i.dataset.k)));
  }

  $('#cuerpo').addEventListener('input', e => {
    const i = e.target; if (!i.dataset.k) return;
    const raw = i.value.replace(/\s/g, '').replace(',', '.');
    let v = raw === '' ? 0 : parseFloat(raw);
    if (!isFinite(v) || v < 0) { i.setCustomValidity('Número no válido'); return; }
    i.setCustomValidity('');
    if (i.classList.contains('int')) v = Math.round(v); else v = Math.round(v * 100) / 100;
    set(precios[i.dataset.id], i.dataset.k, v);
    const tr = i.closest('tr');
    tr.querySelectorAll('[data-calc]').forEach(td => td.innerHTML = celdaCalc(precios[i.dataset.id], td.dataset.calc));
    base = base || JSON.parse(original);
    i.classList.toggle('mod', v !== get(base[i.dataset.id], i.dataset.k));
    guardarBorrador(); estado();
  });
  $('#cuerpo').addEventListener('change', e => {
    const i = e.target; if (!i.dataset.k) return;
    const int = i.classList.contains('int');
    i.value = fmtIn(get(precios[i.dataset.id], i.dataset.k), int);
  });
  /* Enter baja a la fila siguiente, como en una hoja de cálculo */
  $('#cuerpo').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.dataset.k) return;
    e.preventDefault();
    const col = [...e.target.closest('tr').querySelectorAll('input')].indexOf(e.target);
    let tr = e.target.closest('tr').nextElementSibling;
    while (tr && !tr.dataset.row) tr = tr.nextElementSibling;
    if (tr) tr.querySelectorAll('input')[col].focus();
  });

  function guardarBorrador() { if (hayCambios()) localStorage.setItem(K_BORRADOR, serial()); else localStorage.removeItem(K_BORRADOR); }
  function estado() {
    const e = $('#estado');
    base = base || JSON.parse(original);
    const n = Object.keys(precios).filter(id => JSON.stringify(precios[id]) !== JSON.stringify(base[id])).length;
    const con = Object.values(precios).filter(P2P.tienePrecio).length;
    if (n) { e.textContent = `${n} producto${n > 1 ? 's' : ''} con cambios sin publicar`; e.className = 'estado estado--cambios'; }
    else { e.textContent = `${con} de ${cat.productos.length} con precio` + (actualizado ? `, publicado el ${P2P.fecha(actualizado)}` : ''); e.className = 'estado'; }
    $('#guardar').disabled = !n;
  }

  /* ---------- relleno masivo ---------- */
  $('#m-aplicar').addEventListener('click', () => {
    const k = $('#m-campo').value, raw = $('#m-valor').value.replace(',', '.').trim();
    const v = parseFloat(raw);
    if (!isFinite(v) || v < 0) { aviso('Escribe un valor numérico válido.', true); return; }
    const solo = $('#m-vacios').checked;
    const f = editables.find(c => c.k === k);
    let n = 0;
    for (const p of visibles()) {
      if (solo && get(precios[p.id], k)) continue;
      set(precios[p.id], k, f.int ? Math.round(v) : Math.round(v * 100) / 100); n++;
    }
    pintar(); guardarBorrador(); estado();
    aviso(`${f.n}: aplicado a ${n} productos.`);
  });

  /* ---------- guardar ---------- */
  $('#guardar').addEventListener('click', async () => {
    const btn = $('#guardar'); btn.disabled = true; btn.textContent = 'Publicando…';
    try {
      const actual = await gh('/contents/' + RUTA);
      if (actual.sha !== sha && !confirm('Alguien ha publicado precios desde que abriste el panel. Si continúas, se sustituirán por los tuyos. ¿Continuar?')) throw new Error('Publicación cancelada.');
      const ahora = new Date().toISOString();
      const datos = { actualizado: ahora, productos: precios };
      const r = await gh('/contents/' + RUTA, { method: 'PUT', body: JSON.stringify({ message: 'Actualizar precios ' + ahora.slice(0, 16).replace('T', ' '), content: b64enc(JSON.stringify(datos, null, 1) + '\n'), sha: actual.sha }) });
      sha = r.content.sha; actualizado = ahora; original = serial(); base = null;
      localStorage.removeItem(K_BORRADOR);
      marcarModificados(); estado();
      aviso('Precios publicados. El catálogo se actualiza en 1 o 2 minutos.');
    } catch (err) { aviso(err.message === 'Publicación cancelada.' ? err.message : 'No se pudo publicar: ' + err.message, true); estado(); }
    finally { btn.textContent = 'Guardar y publicar'; }
  });

  $('#descargar').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ actualizado, productos: precios }, null, 1)], { type: 'application/json' }));
    a.download = 'precios-agiva-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  });
  window.addEventListener('beforeunload', e => { if (cat && hayCambios()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- inicio ---------- */
  const guardado = localStorage.getItem(K_TOKEN) || sessionStorage.getItem(K_TOKEN);
  if (guardado) entrar(guardado, !!localStorage.getItem(K_TOKEN)).catch(() => { token = null; $('#acceso').hidden = false; $('#error-acceso').textContent = 'La sesión guardada ya no es válida. Introduce el token de nuevo.'; });
  else $('#acceso').hidden = false;
})();
