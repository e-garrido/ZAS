'use strict';

/* =====================================================================
   Fechas, importes y cuentas.

   Todo lo que aquí se calcula es puro: entra un dato, sale un número.
   Ni toca el DOM ni lee el estado global, así que se puede probar solo.
   ===================================================================== */

/* ---------- Fechas ----------
   Trabajamos con dos formas: la fecha completa 'YYYY-MM-DD' y la clave
   de mes 'YYYY-MM'. Ambas son texto ordenable: comparar dos meses es
   comparar dos cadenas, sin sustos de zonas horarias. */

export const hoyISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const claveMes = (iso) => String(iso || '').slice(0, 7);

export const mesActual = (d = new Date()) => claveMes(hoyISO(d));

/* Suma (o resta) meses a una clave 'YYYY-MM' sin desbordarse de mes */
export function sumaMeses(clave, n) {
  const [a, m] = String(clave).split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 'septiembre' o 'septiembre de 2025' si no es el año en curso */
export function nombreMes(clave, anioActual = new Date().getFullYear()) {
  const [a, m] = String(clave).split('-').map(Number);
  const nombre = MESES[m - 1] || '';
  return a === anioActual ? nombre : `${nombre} de ${a}`;
}

/** 'hoy', 'ayer', 'martes 16' o '16 de agosto' según lo lejos que quede */
export function nombreDia(iso, hoy = hoyISO()) {
  if (iso === hoy) return 'hoy';
  if (iso === diaAnterior(hoy)) return 'ayer';

  const d = fecha(iso);
  const dias = Math.round((fecha(hoy) - d) / 86400000);
  if (dias > 0 && dias < 7) return `${DIAS[d.getDay()]} ${d.getDate()}`;
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/* Mediodía: así ningún cambio de hora nos mueve el día de sitio */
export const fecha = (iso) => new Date(`${iso}T12:00:00`);

export function diaAnterior(iso) {
  const d = fecha(iso);
  d.setDate(d.getDate() - 1);
  return hoyISO(d);
}

/** Cuántos días tiene el mes de esa clave */
export function diasDelMes(clave) {
  const [a, m] = String(clave).split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

/** Qué parte del mes llevamos gastada, de 0 a 1. Sirve para saber si vas
    adelantado o no: el mes 12 ya ha consumido el 40% de septiembre. */
export function avanceDelMes(clave, hoy = hoyISO()) {
  if (claveMes(hoy) > clave) return 1;
  if (claveMes(hoy) < clave) return 0;
  return fecha(hoy).getDate() / diasDelMes(clave);
}

/* ---------- Dinero ----------
   Los importes se guardan en euros con dos decimales, no en céntimos.
   Redondeamos en cada suma para que 0.1 + 0.2 no acabe en 0.30000000004. */

export const redondea = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const suma = (nums) => redondea(nums.reduce((t, n) => t + (Number(n) || 0), 0));

const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const EUR_CORTO = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 12,5 -> '12,50 €'. Con `corto`, 1234,56 -> '1235 €' (para ejes y chips) */
export const euros = (n, corto = false) =>
  (corto ? EUR_CORTO : EUR).format(Number(n) || 0);

/** Separa el importe en partes para poder pintar los decimales pequeños */
export function partesImporte(n) {
  const [entero, decimales = '00'] = redondea(Math.abs(n)).toFixed(2).split('.');
  return {
    signo: n < 0 ? '−' : '',
    entero: new Intl.NumberFormat('es-ES').format(Number(entero)),
    decimales,
  };
}

/* ---------- Agregados ----------
   Un solo recorrido por los gastos del mes y de ahí salen todos los
   totales que pinta la pantalla de resumen. */

export const gastosDelMes = (gastos, clave) =>
  gastos.filter((g) => claveMes(g.fecha) === clave);

/** Suma por la propiedad que se le diga: 'categoria' o 'cuenta' */
export function totalPor(gastos, campo) {
  const mapa = new Map();
  for (const g of gastos) {
    const k = g[campo] || 'sin';
    mapa.set(k, redondea((mapa.get(k) || 0) + g.importe));
  }
  return mapa;
}

/** Resumen completo de un mes: total, reparto y comparación con el anterior */
export function resumenMes(gastos, clave) {
  const delMes = gastosDelMes(gastos, clave);
  const anterior = gastosDelMes(gastos, sumaMeses(clave, -1));
  const total = suma(delMes.map((g) => g.importe));
  const totalAnterior = suma(anterior.map((g) => g.importe));

  return {
    clave,
    total,
    totalAnterior,
    /* La diferencia en seco; sin mes anterior no hay nada que comparar */
    diferencia: anterior.length ? redondea(total - totalAnterior) : null,
    numero: delMes.length,
    media: delMes.length ? redondea(total / delMes.length) : 0,
    porCategoria: totalPor(delMes, 'categoria'),
    porCuenta: totalPor(delMes, 'cuenta'),
    gastos: delMes,
  };
}

/** Agrupa una lista en tramos por día, del más reciente al más antiguo */
export function porDias(gastos) {
  const mapa = new Map();
  for (const g of gastos) {
    if (!mapa.has(g.fecha)) mapa.set(g.fecha, []);
    mapa.get(g.fecha).push(g);
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dia, lista]) => ({
      dia,
      /* Dentro del día, lo último apuntado va arriba */
      gastos: lista.sort((a, b) => (a.creado || '') < (b.creado || '') ? 1 : -1),
      total: suma(lista.map((g) => g.importe)),
    }));
}

/** Estado de un tope: cuánto va gastado, cuánto queda y si va desbocado.
    `avance` es la parte del mes transcurrida: con ella sabemos si el 60%
    gastado el día 5 es un problema o si el 60% el día 25 va bien. */
export function estadoTope(gastado, tope, avance = 1) {
  if (!tope) return { hayTope: false, gastado, parte: 0, nivel: 'sin' };

  const parte = gastado / tope;
  const nivel =
    parte >= 1 ? 'pasado'
    : parte > avance + 0.15 ? 'rapido'
    : parte >= 0.85 ? 'cerca'
    : 'bien';

  return {
    hayTope: true,
    gastado,
    tope,
    resto: redondea(tope - gastado),
    parte,
    nivel,
  };
}
