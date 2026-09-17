'use strict';

/* =====================================================================
   Piezas de interfaz reutilizables: atajos al DOM, importes con coma,
   avisos, hojas accesibles y tema.
   ===================================================================== */

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const sinMovimiento = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(ms = 10) {
  if (navigator.vibrate && !sinMovimiento()) navigator.vibrate(ms);
}

/* ---------- Importes ----------
   Un <input type="number"> descarta "12,50" con el teclado español, así
   que usamos texto con teclado decimal y normalizamos aquí.

   Atajos no manda un número: manda el importe ya formateado según la
   región del iPhone, con su moneda. '12,50 €', '€12.50', '1.234,56 €' o
   'US$1,234.56' tienen que salir bien, estés donde estés. */
export function parseImporte(valor) {
  /* Fuera símbolos, códigos de moneda y espacios de cualquier tipo */
  const s = String(valor ?? '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return null;

  /* El separador decimal es el ÚLTIMO, y solo si le siguen una o dos
     cifras: '1.234,56' y '1,234.56' valen lo mismo. Si no, todos son de
     miles: '1.200' es mil doscientos, no uno con dos. */
  const m = s.match(/^(.*)[.,](\d{1,2})$/);
  const norm = m ? `${m[1].replace(/[.,]/g, '')}.${m[2]}` : s.replace(/[.,]/g, '');
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Escribe un número en un input de texto con la coma española */
export function ponImporte(input, v) {
  input.value = v ? String(v).replace('.', ',') : '';
}

/* ---------- Avisos ---------- */
let avisoActual = null;

export function aviso(mensaje, opciones = {}) {
  const { tipo = 'info', accion, alPulsar, duracion = accion ? 6000 : 3200 } = opciones;
  const cont = $('#avisos');
  if (!cont) return;

  if (avisoActual) avisoActual.remove();

  const el = document.createElement('div');
  el.className = `aviso aviso--${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');

  const texto = document.createElement('span');
  texto.className = 'aviso-texto';
  texto.textContent = mensaje;
  el.append(texto);

  if (accion && alPulsar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'aviso-accion';
    btn.textContent = accion;
    btn.addEventListener('click', () => {
      alPulsar();
      cierra();
    });
    el.append(btn);
  }

  cont.append(el);
  avisoActual = el;

  let fuera;
  const cierra = () => {
    clearTimeout(fuera);
    if (avisoActual !== el) return;
    avisoActual = null;
    el.classList.add('aviso--sale');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    /* Sin animaciones el evento no llega nunca: red de seguridad */
    setTimeout(() => el.remove(), 400);
  };

  fuera = setTimeout(cierra, duracion);
  return cierra;
}

/* ---------- Hojas ----------
   Una hoja es un <dialog> que sube desde abajo. Usamos el diálogo nativo
   porque ya trae el foco atrapado, el fondo inerte y el cierre con Esc;
   lo único que ponemos nosotros es la animación de salida.
   ===================================================================== */

export function abreHoja(dialog, { campo = false } = {}) {
  if (!dialog) return;

  /* Pillada a media salida (llega otro pago justo cuando se cerraba): se
     anula la salida y la hoja vuelve a subir con lo nuevo. */
  if (dialog.classList.contains('hoja--sale')) {
    dialog.classList.remove('hoja--sale');
    return;
  }
  if (dialog.open) return;

  /* ¿Dónde va el foco? Con `campo`, al primer campo: es lo que quieres al
     crear algo nuevo. Sin él, a la hoja entera: así no salta el teclado al
     editar, ni aparece marcado un botón que no has tocado, y el lector de
     pantalla anuncia el título. */
  dialog.toggleAttribute('autofocus', !campo);
  dialog.showModal();
}

export function cierraHoja(dialog) {
  if (!dialog || !dialog.open || dialog.classList.contains('hoja--sale')) return;

  if (sinMovimiento()) {
    dialog.close();
    return;
  }

  dialog.classList.add('hoja--sale');
  /* Aquí llegan el fin de la animación y el temporizador de respaldo; solo
     el primero cierra. Y si entretanto se ha vuelto a abrir, se queda. */
  const fin = () => {
    if (!dialog.classList.contains('hoja--sale')) return;
    dialog.classList.remove('hoja--sale');
    dialog.close();
  };
  dialog.addEventListener('animationend', fin, { once: true });
  setTimeout(fin, 350);
}

/** Cerrar tocando fuera y arrastrando el tirador hacia abajo */
export function hojaCierraAlTocarFuera(dialog) {
  dialog.addEventListener('pointerdown', (e) => {
    /* El <dialog> ocupa toda la pantalla; el panel es su hijo. Si el
       toque cae fuera del panel, es que ha caído en el fondo. */
    const panel = dialog.querySelector('.hoja-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const dentro =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!dentro) cierraHoja(dialog);
  });

  const tirador = dialog.querySelector('.hoja-tirador');
  if (tirador) arrastraParaCerrar(dialog, tirador);
}

/* Arrastrar el tirador: la hoja sigue al dedo y se va si bajas lo bastante */
function arrastraParaCerrar(dialog, tirador) {
  const panel = dialog.querySelector('.hoja-panel');
  if (!panel) return;

  let inicio = null;

  tirador.addEventListener('pointerdown', (e) => {
    inicio = e.clientY;
    tirador.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  });

  tirador.addEventListener('pointermove', (e) => {
    if (inicio == null) return;
    /* Hacia arriba no se mueve: la hoja no crece, solo se va */
    const dy = Math.max(0, e.clientY - inicio);
    panel.style.transform = `translateY(${dy}px)`;
  });

  const suelta = (e) => {
    if (inicio == null) return;
    const dy = Math.max(0, e.clientY - inicio);
    inicio = null;
    panel.style.transition = '';
    panel.style.transform = '';
    if (dy > 110) {
      haptic(8);
      cierraHoja(dialog);
    }
  };

  tirador.addEventListener('pointerup', suelta);
  tirador.addEventListener('pointercancel', suelta);
}

/* ---------- Tema ---------- */
export function aplicaTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'auto') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema);

  /* La barra de estado de iOS se pinta con esto; hay que leerlo ya
     resuelto porque en 'auto' depende del ajuste del sistema. */
  const color = getComputedStyle(raiz).getPropertyValue('--bg').trim();
  const meta = $('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute('content', color);
}

/* ---------- Cifras que suben ----------
   Animar el total del mes deja claro que ha cambiado. Con "reducir
   movimiento" puesto, salta directamente al número final. */
export function animaCifra(el, desde, hasta, pinta, ms = 420) {
  if (sinMovimiento() || desde === hasta) {
    pinta(el, hasta);
    return;
  }

  const t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    /* Frena al final: se lee mejor el número que llega que el que arranca */
    const suave = 1 - Math.pow(1 - p, 3);
    pinta(el, desde + (hasta - desde) * suave);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* ---------- Varios ---------- */

/** Pone un <use> del sprite dentro de un contenedor */
export function icono(id, clase = 'icono') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', clase);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${id}`);
  svg.append(use);
  return svg;
}

/** 'gasto', 'gastos' sin tener que repetir el ternario por todas partes */
export const plural = (n, uno, varios) => (n === 1 ? uno : varios);

export function limpiar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}
