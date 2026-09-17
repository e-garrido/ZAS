'use strict';

import { hoyISO, redondea } from './calc.js';

/* =====================================================================
   Estado, persistencia y copia de seguridad.

   Todo vive en el móvil. `localStorage` guarda el bloque entero en una
   sola clave: son unos pocos cientos de gastos, cabe de sobra y evita
   tener que coser trozos al arrancar.
   ===================================================================== */

const CLAVE = 'zas.datos.v1';
const FORMATO = 1;

export const state = {
  categorias: [],
  cuentas: [],
  gastos: [],
  /* comercio normalizado -> { categoria, cuenta, veces }
     Es lo que hace que el segundo Mercadona ya venga relleno. */
  reglas: {},
  tema: 'auto', // 'auto' | 'light' | 'dark'
  /* Con esto puesto, un pago con regla conocida se guarda solo tras un
     par de segundos si no lo tocas. Apagado de fábrica: mejor que la
     primera impresión sea que tú mandas. */
  autoguardar: false,
};

/* ---------- Iconos ----------
   Cada id apunta a un <symbol> del sprite de index.html y lleva su tono.
   El tono viaja con el icono para que una categoría nueva nazca ya con
   color sin que tengas que elegirlo. */
export const ICONOS = [
  { id: 'super',    hue: 140, nombre: 'Supermercado' },
  { id: 'comida',   hue: 22,  nombre: 'Comer fuera' },
  { id: 'cafe',     hue: 32,  nombre: 'Café' },
  { id: 'copas',    hue: 300, nombre: 'Copas' },
  { id: 'transporte', hue: 210, nombre: 'Transporte' },
  { id: 'gasolina', hue: 6,   nombre: 'Gasolina' },
  { id: 'coche',    hue: 200, nombre: 'Coche' },
  { id: 'casa',     hue: 175, nombre: 'Casa' },
  { id: 'luz',      hue: 46,  nombre: 'Suministros' },
  { id: 'compras',  hue: 265, nombre: 'Compras' },
  { id: 'ropa',     hue: 330, nombre: 'Ropa' },
  { id: 'tech',     hue: 245, nombre: 'Tecnología' },
  { id: 'ocio',     hue: 285, nombre: 'Ocio' },
  { id: 'deporte',  hue: 120, nombre: 'Deporte' },
  { id: 'salud',    hue: 350, nombre: 'Salud' },
  { id: 'belleza',  hue: 315, nombre: 'Belleza' },
  { id: 'suscripcion', hue: 255, nombre: 'Suscripciones' },
  { id: 'viaje',    hue: 195, nombre: 'Viajes' },
  { id: 'regalo',   hue: 340, nombre: 'Regalos' },
  { id: 'mascota',  hue: 18,  nombre: 'Mascotas' },
  { id: 'estudios', hue: 230, nombre: 'Estudios' },
  { id: 'otros',    hue: 220, nombre: 'Otros' },
];

export const ICONO_DEFECTO = 'otros';
const POR_ID = new Map(ICONOS.map((i) => [i.id, i]));

export const iconoValido = (id) => (POR_ID.has(id) ? id : ICONO_DEFECTO);
export const hueDeIcono = (id) => (POR_ID.get(id) || POR_ID.get(ICONO_DEFECTO)).hue;

/* ---------- Tipos de cuenta ---------- */
export const TIPOS_CUENTA = [
  { id: 'tarjeta',  nombre: 'Tarjeta',  icono: 'tarjeta' },
  { id: 'cuenta',   nombre: 'Cuenta',   icono: 'banco' },
  { id: 'efectivo', nombre: 'Efectivo', icono: 'efectivo' },
];

/* ---------- Punto de partida ----------
   Ocho categorías y una tarjeta. Suficiente para apuntar el primer pago
   sin pasar por ajustes, y poco como para no estorbar al que quiera las
   suyas. */
function datosIniciales() {
  return {
    categorias: [
      { id: 'c-super',   nombre: 'Súper',        icono: 'super',       hue: 140, tope: 0 },
      { id: 'c-comida',  nombre: 'Comer fuera',  icono: 'comida',      hue: 22,  tope: 0 },
      { id: 'c-transp',  nombre: 'Transporte',   icono: 'transporte',  hue: 210, tope: 0 },
      { id: 'c-casa',    nombre: 'Casa',         icono: 'casa',        hue: 175, tope: 0 },
      { id: 'c-ocio',    nombre: 'Ocio',         icono: 'ocio',        hue: 285, tope: 0 },
      { id: 'c-compras', nombre: 'Compras',      icono: 'compras',     hue: 265, tope: 0 },
      { id: 'c-salud',   nombre: 'Salud',        icono: 'salud',       hue: 350, tope: 0 },
      { id: 'c-subs',    nombre: 'Suscripciones', icono: 'suscripcion', hue: 255, tope: 0 },
    ],
    cuentas: [
      { id: 'a-tarjeta', nombre: 'Tarjeta', tipo: 'tarjeta', ultimos: '', hue: 215 },
    ],
    gastos: [],
    reglas: {},
  };
}

/* ---------- Identificadores ----------
   `randomUUID` no existe fuera de https; el respaldo basta porque solo
   tiene que ser único dentro de este móvil. */
export function nuevoId(prefijo = 'g') {
  const azar = crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${Date.now().toString(36)}-${azar}`;
}

/* ---------- Comercios ----------
   'MERCADONA A-38', 'Mercadona 1234' y 'mercadona' son el mismo sitio.
   Quitamos tildes, símbolos y las coletillas numéricas que mete el TPV
   para que la regla acierte la segunda vez. */
export function normalizaComercio(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    /* Códigos de tienda: el número, y la letra suelta que suele ir delante
       ('A-38', 'B12', 'nº 4'). Si la letra se quedara, 'Mercadona A-38' y
       'Mercadona' parecerían dos sitios distintos. Solo cae la letra que va
       pegada a un número, así que 'H&M' sobrevive entera. */
    .replace(/\b[a-z]?\s*\d[a-z0-9]*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deja el nombre presentable: 'MERCADONA S.A.' -> 'Mercadona S.A.' */
export function comercioBonito(nombre) {
  const s = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  /* Si viene todo en mayúsculas es cosa del TPV, no una decisión */
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    /* Tras '&' también: 'H&M' y 'Pull&Bear', no 'H&m' */
    .replace(/(^|[\s'.&/-])([a-záéíóúñ])/g, (_, sep, letra) => sep + letra.toUpperCase());
}

/* ---------- Búsquedas ---------- */
export const categoria = (id) => state.categorias.find((c) => c.id === id) || null;
export const cuenta = (id) => state.cuentas.find((a) => a.id === id) || null;

/** Categoría y cuenta que le tocan a un comercio según lo que hiciste
    antes. Sin regla, la cuenta más usada últimamente ya es buena apuesta. */
export function sugerencia(comercio) {
  const regla = state.reglas[normalizaComercio(comercio)];
  if (regla) {
    return {
      categoria: categoria(regla.categoria) ? regla.categoria : null,
      cuenta: cuenta(regla.cuenta) ? regla.cuenta : cuentaHabitual(),
      recordada: true,
      veces: regla.veces || 1,
    };
  }
  return { categoria: null, cuenta: cuentaHabitual(), recordada: false, veces: 0 };
}

/** La cuenta con la que más has pagado en los últimos 30 movimientos */
export function cuentaHabitual() {
  const primera = state.cuentas[0]?.id || null;
  const recientes = state.gastos.slice(-30);
  if (!recientes.length) return primera;

  const usos = new Map();
  for (const g of recientes) {
    if (g.cuenta) usos.set(g.cuenta, (usos.get(g.cuenta) || 0) + 1);
  }
  const top = [...usos.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && cuenta(top[0]) ? top[0] : primera;
}

/** Aprende del gasto recién guardado para que el próximo venga hecho */
export function aprende(comercio, cat, cta) {
  const clave = normalizaComercio(comercio);
  if (!clave || !cat) return;

  const previa = state.reglas[clave];
  state.reglas[clave] = {
    categoria: cat,
    cuenta: cta || previa?.cuenta || null,
    /* El mostrado es el último que escribiste: si corriges la tilde, se queda */
    mostrado: String(comercio || '').trim(),
    veces: (previa?.veces || 0) + 1,
  };
}

/* ---------- Altas y bajas ---------- */
export function anotaGasto({ importe, comercio, fecha, categoria: cat, cuenta: cta, nota, origen }) {
  const gasto = {
    id: nuevoId('g'),
    importe: redondea(importe),
    comercio: String(comercio || '').trim(),
    fecha: fecha || hoyISO(),
    categoria: cat || null,
    cuenta: cta || null,
    nota: String(nota || '').trim(),
    origen: origen === 'atajo' ? 'atajo' : 'manual',
    creado: new Date().toISOString(),
  };
  state.gastos.push(gasto);
  aprende(gasto.comercio, gasto.categoria, gasto.cuenta);
  save();
  return gasto;
}

export function editaGasto(id, cambios) {
  const g = state.gastos.find((x) => x.id === id);
  if (!g) return null;

  Object.assign(g, cambios);
  if (cambios.importe != null) g.importe = redondea(cambios.importe);
  aprende(g.comercio, g.categoria, g.cuenta);
  save();
  return g;
}

export function borraGasto(id) {
  const i = state.gastos.findIndex((g) => g.id === id);
  if (i < 0) return null;
  const [fuera] = state.gastos.splice(i, 1);
  save();
  return fuera;
}

/** Devuelve el gasto a su sitio tras un "deshacer" */
export function recuperaGasto(gasto) {
  if (!gasto || state.gastos.some((g) => g.id === gasto.id)) return;
  state.gastos.push(gasto);
  save();
}

/* ---------- Categorías ---------- */
export function anotaCategoria({ nombre, icono, tope }) {
  const cat = {
    id: nuevoId('c'),
    nombre: String(nombre || '').trim() || 'Sin nombre',
    icono: iconoValido(icono),
    hue: hueDeIcono(icono),
    tope: redondea(tope || 0),
  };
  state.categorias.push(cat);
  save();
  return cat;
}

export function editaCategoria(id, cambios) {
  const c = categoria(id);
  if (!c) return null;
  Object.assign(c, cambios);
  if (cambios.icono) {
    c.icono = iconoValido(cambios.icono);
    c.hue = hueDeIcono(c.icono);
  }
  if (cambios.tope != null) c.tope = redondea(cambios.tope);
  save();
  return c;
}

/** Al borrar una categoría, sus gastos no se van: se quedan sin etiqueta
    y salen agrupados en "Sin categoría", donde puedes recolocarlos. */
export function borraCategoria(id) {
  state.categorias = state.categorias.filter((c) => c.id !== id);
  for (const g of state.gastos) if (g.categoria === id) g.categoria = null;
  for (const [k, r] of Object.entries(state.reglas)) {
    if (r.categoria === id) delete state.reglas[k];
  }
  save();
}

/* ---------- Cuentas ---------- */
export function anotaCuenta({ nombre, tipo, ultimos, hue }) {
  const cta = {
    id: nuevoId('a'),
    nombre: String(nombre || '').trim() || 'Sin nombre',
    tipo: TIPOS_CUENTA.some((t) => t.id === tipo) ? tipo : 'tarjeta',
    ultimos: String(ultimos || '').replace(/\D/g, '').slice(-4),
    hue: Number.isFinite(hue) ? hue : 215,
  };
  state.cuentas.push(cta);
  save();
  return cta;
}

export function editaCuenta(id, cambios) {
  const c = cuenta(id);
  if (!c) return null;
  Object.assign(c, cambios);
  if (cambios.ultimos != null) c.ultimos = String(cambios.ultimos).replace(/\D/g, '').slice(-4);
  save();
  return c;
}

export function borraCuenta(id) {
  state.cuentas = state.cuentas.filter((c) => c.id !== id);
  for (const g of state.gastos) if (g.cuenta === id) g.cuenta = null;
  for (const r of Object.values(state.reglas)) if (r.cuenta === id) r.cuenta = null;
  save();
}

/** Mueve un elemento de una lista a otra posición (arrastrar y soltar) */
export function reordena(lista, desde, hasta) {
  const arr = state[lista];
  if (!arr || desde === hasta) return;
  const [item] = arr.splice(desde, 1);
  arr.splice(hasta, 0, item);
  save();
}

/* ---------- Reglas ---------- */
export function olvidaRegla(clave) {
  delete state.reglas[clave];
  save();
}

/** Las reglas ordenadas por uso, para poder repasarlas en ajustes */
export function reglasOrdenadas() {
  return Object.entries(state.reglas)
    .map(([clave, r]) => ({ clave, ...r, nombre: r.mostrado || clave }))
    .sort((a, b) => (b.veces || 0) - (a.veces || 0));
}

/* ---------- Persistencia ---------- */
export function save() {
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({
        formato: FORMATO,
        categorias: state.categorias,
        cuentas: state.cuentas,
        gastos: state.gastos,
        reglas: state.reglas,
        tema: state.tema,
        autoguardar: state.autoguardar,
      })
    );
    return true;
  } catch (e) {
    /* Cuota llena o modo privado: no se pierde la sesión, solo el guardado */
    return false;
  }
}

export function load() {
  let datos = null;
  try {
    datos = JSON.parse(localStorage.getItem(CLAVE) || 'null');
  } catch (e) {
    datos = null;
  }

  const base = datosIniciales();
  const nuevo = !datos;

  state.categorias = Array.isArray(datos?.categorias) ? datos.categorias : base.categorias;
  state.cuentas = Array.isArray(datos?.cuentas) ? datos.cuentas : base.cuentas;
  state.gastos = Array.isArray(datos?.gastos) ? datos.gastos.map(sanea) : base.gastos;
  state.reglas = datos?.reglas && typeof datos.reglas === 'object' ? datos.reglas : base.reglas;
  state.tema = ['auto', 'light', 'dark'].includes(datos?.tema) ? datos.tema : 'auto';
  state.autoguardar = datos?.autoguardar === true;

  return { nuevo };
}

/* Un gasto venido de una copia ajena puede traer basura: lo dejamos en
   una forma que el resto del código pueda dar por buena sin comprobar. */
function sanea(g) {
  return {
    id: g.id || nuevoId('g'),
    importe: redondea(g.importe),
    comercio: String(g.comercio || '').trim(),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) ? g.fecha : hoyISO(),
    categoria: g.categoria || null,
    cuenta: g.cuenta || null,
    nota: String(g.nota || ''),
    origen: g.origen === 'atajo' ? 'atajo' : 'manual',
    creado: g.creado || new Date().toISOString(),
  };
}

/* ---------- Copia de seguridad ---------- */
export function exporta() {
  return JSON.stringify(
    {
      app: 'zas',
      formato: FORMATO,
      exportado: new Date().toISOString(),
      categorias: state.categorias,
      cuentas: state.cuentas,
      gastos: state.gastos,
      reglas: state.reglas,
    },
    null,
    2
  );
}

/** Reemplaza todo por lo que traiga el archivo. Devuelve qué ha entrado
    o el motivo por el que no se ha tocado nada. */
export function importa(texto) {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    return { ok: false, error: 'El archivo no es una copia de Zas.' };
  }

  if (!datos || !Array.isArray(datos.gastos) || !Array.isArray(datos.categorias)) {
    return { ok: false, error: 'A la copia le faltan los gastos o las categorías.' };
  }

  state.categorias = datos.categorias;
  state.cuentas = Array.isArray(datos.cuentas) ? datos.cuentas : [];
  state.gastos = datos.gastos.map(sanea);
  state.reglas = datos.reglas && typeof datos.reglas === 'object' ? datos.reglas : {};
  save();

  return { ok: true, gastos: state.gastos.length, categorias: state.categorias.length };
}
