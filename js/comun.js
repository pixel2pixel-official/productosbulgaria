/* Utilidades comunes: catálogo y gestión */
const P2P = (() => {
  const ZONAS = [
    { id: 'alicante', nombre: 'Provincia de Alicante' },
    { id: 'peninsula', nombre: 'Península' },
    { id: 'baleares', nombre: 'Baleares' },
    { id: 'canarias', nombre: 'Canarias' },
    { id: 'ceuta_melilla', nombre: 'Ceuta y Melilla' }
  ];
  const CANALES = [
    { id: 'tienda', nombre: 'Tiendas' },
    { id: 'supermercado', nombre: 'Supermercados' },
    { id: 'gran_superficie', nombre: 'Grandes superficies' }
  ];
  const IMAGEN_GAMA = {
    rosas: 'img/recursos/rosas.webp', frutas: 'img/recursos/frutas.webp',
    aceitunas: 'img/recursos/aceitunas.webp', sentidos: 'img/recursos/sentidos.webp',
    flor: 'img/recursos/flor.webp', intimo: 'img/recursos/intimo.webp'
  };

  const fmtEur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  const fmtPct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 });
  const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const eur = v => fmtEur.format(num(v));
  const pct = v => fmtPct.format(v);

  function vacio() {
    return {
      fabrica: 0, pvp: 0,
      envio: { alicante: 0, peninsula: 0, baleares: 0, canarias: 0, ceuta_melilla: 0 },
      comercio: { tienda: 0, supermercado: 0, gran_superficie: 0, pvp_recomendado: 0, uds_caja: 0, pedido_minimo: 0 }
    };
  }
  function normaliza(p) {
    const v = vacio(); p = p || {};
    v.fabrica = num(p.fabrica); v.pvp = num(p.pvp);
    for (const z of ZONAS) v.envio[z.id] = num(p.envio && p.envio[z.id]);
    for (const k of Object.keys(v.comercio)) v.comercio[k] = num(p.comercio && p.comercio[k]);
    return v;
  }
  /* Margen online = PVP − fábrica − envío de la zona (sin IVA) */
  function margenOnline(p, zona) {
    const m = p.pvp - p.fabrica - p.envio[zona];
    return { eur: m, pct: p.pvp > 0 ? m / p.pvp : null };
  }
  /* Margen comercio = precio del canal − fábrica */
  function margenComercio(p, canal) {
    const pr = p.comercio[canal];
    const m = pr - p.fabrica;
    return { eur: m, pct: pr > 0 ? m / pr : null };
  }
  const tienePrecio = p => p.fabrica > 0 && p.pvp > 0;
  const tieneComercio = p => p.fabrica > 0 && CANALES.some(c => p.comercio[c.id] > 0);

  async function cargar(base = '') {
    const t = Date.now();
    const [cat, pre] = await Promise.all([
      fetch(`${base}data/productos.json?v=${t}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`${base}data/precios.json?v=${t}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { productos: {} })
    ]);
    return { cat, pre };
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = iso => iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : null;

  return { ZONAS, CANALES, IMAGEN_GAMA, num, eur, pct, vacio, normaliza, margenOnline, margenComercio, tienePrecio, tieneComercio, cargar, esc, fecha };
})();
