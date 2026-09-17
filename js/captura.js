'use strict';

import { parseImporte } from './ui.js';
import { comercioBonito } from './state.js';
import { hoyISO } from './calc.js';

/* =====================================================================
   La entrada desde el Atajo de iOS.

   El Atajo abre la app con el pago en la propia dirección. Aceptamos la
   información en el fragmento (detrás de #) y también en la consulta
   (detrás de ?), pero el fragmento es el bueno: un navegador NUNCA lo
   manda al servidor, así que tu importe y tu comercio no salen del
   móvil ni siquiera al pedir la página.

     https://.../#i=12,50 €&t=Visa ··4242&c=Mercadona

   Nada más leerlo se borra de la barra de direcciones: si recargas, el
   pago no se apunta dos veces, y nadie que mire tu historial ve dónde
   compraste.
   ===================================================================== */

/* Cada dato admite varios nombres: el corto para que el Atajo quede
   legible, y el largo en español y en inglés por si lo escribes a mano. */
const ALIAS = {
  importe:  ['i', 'importe', 'amount', 'cantidad'],
  comercio: ['c', 'comercio', 'merchant', 'tienda', 'nombre'],
  fecha:    ['f', 'fecha', 'date'],
  cuenta:   ['t', 'tarjeta', 'cuenta', 'card', 'account'],
  nota:     ['n', 'nota', 'note'],
};

const PENDIENTE = 'zas.pendiente.v1';
const RECIENTES = 'zas.recientes.v1';

/* Todos los nombres juntos. Con ellos se sabe dónde empieza cada dato
   aunque el valor de delante lleve un '&': Atajos mete el texto tal cual,
   sin codificar, y un comercio como 'H&M' partiría la dirección en dos. */
const NOMBRES = Object.values(ALIAS).flat();
const INICIO_DE_DATO = new RegExp(`(?:^|&)(${NOMBRES.join('|')})=`, 'gi');

function trocea(texto) {
  const datos = new Map();
  const marcas = [...texto.matchAll(INICIO_DE_DATO)];

  marcas.forEach((m, k) => {
    const desde = m.index + m[0].length;
    const hasta = k + 1 < marcas.length ? marcas[k + 1].index : texto.length;
    const clave = m[1].toLowerCase();
    /* Si un nombre se repite, vale el primero, como en URLSearchParams */
    if (!datos.has(clave)) datos.set(clave, descodifica(texto.slice(desde, hasta)));
  });
  return datos;
}

/* Descodifica solo las secuencias %XX válidas. Un '50% dto' escrito a pelo
   haría fallar a decodeURIComponent con todo; así se queda como venía. */
function descodifica(s) {
  return s.replace(/(?:%[0-9a-f]{2})+/gi, (trozo) => {
    try {
      return decodeURIComponent(trozo);
    } catch (e) {
      return trozo;
    }
  });
}

function primero(params, nombres) {
  for (const n of nombres) {
    const v = params.get(n);
    if (v != null && v !== '') return v;
  }
  return null;
}

/* ---------- Fechas ----------
   Atajos puede dar la fecha de mil formas según el idioma del móvil.
   Reconocemos las tres que salen en la práctica y, si ninguna cuadra,
   nos quedamos con hoy: mejor un día aproximado que perder el pago. */
function parseFecha(valor) {
  const s = String(valor || '').trim();
  if (!s) return hoyISO();

  // 2026-09-17 o 2026-09-17T14:03:00
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 17/9/2026 o 17-09-26
  const es = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (es) {
    const [, d, m, a] = es;
    const anio = a.length === 2 ? `20${a}` : a;
    return `${anio}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Cualquier otra cosa que Date sepa leer
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? hoyISO() : hoyISO(d);
}

/** Lee el pago de una dirección. Devuelve null si ahí no venía ninguno. */
export function leeDeUrl(url = location.href) {
  const u = new URL(url);

  /* El fragmento puede venir como '#i=1&c=x' o como '#/ruta?i=1&c=x'. Lo
     de delante del '?' solo es ruta si no lleva datos: así un comercio
     que se llame '¿Qué?' no se toma por una ruta. */
  let fragmento = u.hash.replace(/^#\/?/, '');
  const conRuta = fragmento.match(/^[^=&]*\?(.*)$/);
  if (conRuta) fragmento = conRuta[1];

  for (const params of [trocea(fragmento), trocea(u.search.slice(1))]) {
    const bruto = primero(params, ALIAS.importe);
    if (bruto == null) continue;

    const importe = parseImporte(bruto);
    if (importe == null || importe <= 0) continue;

    return {
      importe,
      comercio: comercioBonito(primero(params, ALIAS.comercio) || ''),
      fecha: parseFecha(primero(params, ALIAS.fecha)),
      /* El Atajo manda el NOMBRE de la tarjeta, no su id: lo emparejamos
         luego contra tus cuentas, que él no tiene por qué conocer. */
      cuentaTexto: (primero(params, ALIAS.cuenta) || '').trim(),
      nota: (primero(params, ALIAS.nota) || '').trim(),
      origen: 'atajo',
    };
  }

  return null;
}

/** Borra el pago de la barra de direcciones sin recargar ni dejar rastro
    en el historial. A partir de aquí, recargar no apunta nada. */
export function limpiaUrl() {
  const limpia = location.pathname;
  history.replaceState(null, '', limpia);
}

/* ---------- El pago a medio apuntar ----------
   Mientras la ventana está abierta el pago vive aquí. Si cierras la app
   sin querer, al volver sigue estando: es la red que compensa que el
   Atajo solo llame una vez. */

export function guardaPendiente(pago) {
  try {
    localStorage.setItem(PENDIENTE, JSON.stringify({ ...pago, visto: Date.now() }));
  } catch (e) {
    /* Sin espacio no pasa nada grave: el pago sigue en pantalla */
  }
}

export function leePendiente() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDIENTE) || 'null');
    if (!p || typeof p.importe !== 'number') return null;

    /* Pasada una semana ya no sabrías de qué pago hablamos */
    if (Date.now() - (p.visto || 0) > 7 * 86400000) {
      olvidaPendiente();
      return null;
    }
    return p;
  } catch (e) {
    return null;
  }
}

export function olvidaPendiente() {
  try {
    localStorage.removeItem(PENDIENTE);
  } catch (e) {}
}

/* ---------- Repetidos ----------
   Dos pagos idénticos seguidos casi siempre son el mismo: el Atajo que
   se disparó dos veces, o tú que volviste a abrir el enlace. En vez de
   decidirlo nosotros, avisamos y que elija quien lo pagó. */

const HUELLA = (p) => `${p.importe}|${p.comercio.toLowerCase()}|${p.fecha}`;

export function pareceRepetido(pago, minutos = 10) {
  try {
    const previos = JSON.parse(sessionStorage.getItem(RECIENTES) || '[]');
    const limite = Date.now() - minutos * 60000;
    return previos.some((r) => r.huella === HUELLA(pago) && r.cuando > limite);
  } catch (e) {
    return false;
  }
}

export function apuntaReciente(pago) {
  try {
    const previos = JSON.parse(sessionStorage.getItem(RECIENTES) || '[]');
    previos.push({ huella: HUELLA(pago), cuando: Date.now() });
    sessionStorage.setItem(RECIENTES, JSON.stringify(previos.slice(-20)));
  } catch (e) {}
}

/* ---------- Emparejar la tarjeta ----------
   El Atajo dice "Visa ··4242" o "Apple Card"; tú tienes una cuenta que
   se llama "Visa". Buscamos de lo más exigente a lo más flexible y, si
   nada encaja, devolvemos null y lo eliges tú. */
export function cuentaQueEncaja(texto, cuentas) {
  const s = String(texto || '').toLowerCase().trim();
  if (!s || !cuentas.length) return null;

  const limpio = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const digitos = (limpio.match(/\d{4}/g) || []).pop();

  /* 1. Los cuatro últimos números no mienten */
  if (digitos) {
    const porNumero = cuentas.find((c) => c.ultimos && c.ultimos === digitos);
    if (porNumero) return porNumero.id;
  }

  const nombres = cuentas.map((c) => ({
    id: c.id,
    nombre: String(c.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  }));

  /* 2. Mismo nombre */
  const exacto = nombres.find((c) => c.nombre && c.nombre === limpio);
  if (exacto) return exacto.id;

  /* 3. Uno contiene al otro: "Visa" dentro de "visa ··4242" */
  const dentro = nombres.find(
    (c) => c.nombre.length >= 3 && (limpio.includes(c.nombre) || c.nombre.includes(limpio))
  );
  return dentro ? dentro.id : null;
}
