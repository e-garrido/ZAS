'use strict';

import {
  euros, hoyISO, mesActual, nombreDia, partesImporte, sumaMeses,
} from './js/calc.js';
import {
  ICONO_DEFECTO, TIPOS_CUENTA, anotaCategoria, anotaCuenta, anotaGasto, borraCategoria,
  borraCuenta, borraGasto, categoria, cuenta, cuentaHabitual, editaCategoria, editaCuenta,
  editaGasto, exporta, importa, load, olvidaRegla, recuperaGasto, save, state, sugerencia,
} from './js/state.js';
import {
  apuntaReciente, cuentaQueEncaja, guardaPendiente, leeDeUrl, leePendiente, limpiaUrl,
  olvidaPendiente, pareceRepetido,
} from './js/captura.js';
import {
  chipsElegibles, opcionesCategoria, opcionesCuenta, pintaAjustes, pintaIconos,
  pintaMovimientos, pintaResumen,
} from './js/render.js';
import {
  $, $$, abreHoja, aplicaTema, aviso, cierraHoja, haptic, hojaCierraAlTocarFuera,
  limpiar, parseImporte, plural, ponImporte,
} from './js/ui.js';

/* =====================================================================
   Zas — el hilo que une todo.

   Aquí no se calcula ni se pinta: se decide qué pasa cuando tocas algo.
   ===================================================================== */

const vista = {
  pantalla: 'movimientos',
  mes: mesActual(),
};

/* El pago que está ahora mismo en la ventana de cristal */
let pago = null;
let cuentaAtras = null;

/* ---------- Arranque ---------- */
function arranca() {
  const { nuevo } = load();
  aplicaTema(state.tema);

  conectaPestanias();
  conectaMeses();
  conectaHojas();
  conectaPago();
  conectaFormularios();

  pinta();
  atiendeAlAtajo();
  atiendeAccesoDirecto();
  registraServicio();

  /* La primera vez, la guía del Atajo es lo único que hace falta leer.
     Salvo que ya haya otra hoja abierta: las hojas no se apilan. */
  if (nuevo) {
    setTimeout(() => {
      if (!document.querySelector('dialog[open]')) muestraGuiaAtajo();
    }, 700);
  }
}

/* El acceso directo del icono ("Apuntar un gasto") entra con ?nuevo=1 */
function atiendeAccesoDirecto() {
  if (!new URLSearchParams(location.search).has('nuevo')) return;
  history.replaceState(null, '', location.pathname);
  if (!pago) abreGasto();
}

/* ---------- Navegación ---------- */
function conectaPestanias() {
  for (const b of $$('.tab')) {
    b.addEventListener('click', () => {
      if (vista.pantalla === b.dataset.ir) return;
      vista.pantalla = b.dataset.ir;
      haptic();
      pinta();
    });
  }
}

function conectaMeses() {
  for (const b of $$('[data-mes]')) {
    b.addEventListener('click', () => {
      vista.mes = sumaMeses(vista.mes, Number(b.dataset.mes));
      haptic();
      pinta();
    });
  }
}

function pinta() {
  for (const sec of $$('.pantalla')) {
    sec.hidden = sec.dataset.pantalla !== vista.pantalla;
  }
  for (const b of $$('.tab')) {
    const activa = b.dataset.ir === vista.pantalla;
    b.classList.toggle('tab--activa', activa);
    if (activa) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }

  /* El botón de apuntar a mano estorba en ajustes */
  $('#btn-nuevo').hidden = vista.pantalla === 'ajustes';

  /* Nunca hacia el futuro: no puedes haber gastado lo que aún no gastaste */
  const hayFuturo = vista.mes < mesActual();
  for (const b of $$('[data-mes="1"]')) b.disabled = !hayFuturo;

  if (vista.pantalla === 'movimientos') {
    pintaMovimientos(vista.mes, { alTocarGasto: abreGasto, alPedirAtajo: muestraGuiaAtajo });
  } else if (vista.pantalla === 'resumen') {
    pintaResumen(vista.mes, { alTocarCategoria: (id) => id && abreCategoria(id) });
  } else {
    pintaAjustes(ACCIONES_AJUSTES);
  }
}

/* =====================================================================
   La ventana del pago
   ===================================================================== */

/** Mira si el Atajo ha traído algo, ya sea al abrir o estando abierta */
function atiendeAlAtajo() {
  const deUrl = leeDeUrl();
  if (deUrl) {
    limpiaUrl();

    if (pareceRepetido(deUrl)) {
      aviso('Ese mismo pago acaba de entrar. ¿Lo apunto otra vez?', {
        accion: 'Sí, apúntalo',
        alPulsar: () => abrePago(deUrl),
        duracion: 9000,
      });
      return;
    }
    abrePago(deUrl);
    return;
  }

  /* Nada en la dirección: ¿quedó algo a medias de la vez anterior? */
  const pendiente = leePendiente();
  if (pendiente) abrePago(pendiente, { recuperado: true });
}

/* Si la PWA ya estaba abierta, iOS cambia el fragmento sin recargar */
window.addEventListener('hashchange', atiendeAlAtajo);

function abrePago(datos, { recuperado = false } = {}) {
  cancelaCuentaAtras();

  const previa = sugerencia(datos.comercio);
  pago = {
    ...datos,
    categoria: datos.categoria ?? previa.categoria,
    /* La tarjeta que dijo el Atajo manda sobre lo que recordemos */
    cuenta:
      datos.cuenta ??
      cuentaQueEncaja(datos.cuentaTexto, state.cuentas) ??
      previa.cuenta,
    recordada: previa.recordada,
    veces: previa.veces,
  };
  guardaPendiente(pago);

  const hoja = $('#hoja-pago');
  $('#pago-etiqueta-texto').textContent = recuperado ? 'Se quedó a medias' : 'Pago detectado';

  pintaImporte();
  pintaComercio();
  pintaCuando();
  pintaMemoria();
  pintaElecciones();
  actualizaGuardar();

  abreHoja(hoja);
  haptic(14);

  /* Si ya sabemos de sobra qué es esto, el botón se pulsa solo */
  if (state.autoguardar && pago.recordada && pago.categoria && !recuperado) {
    arrancaCuentaAtras();
  }
}

function pintaImporte() {
  const { entero, decimales } = partesImporte(pago.importe);
  $('#pago-entero').textContent = entero;
  $('#pago-decimales').textContent = `,${decimales}`;
}

function pintaComercio() {
  const b = $('#pago-comercio');
  b.textContent = pago.comercio || 'Toca para escribir el comercio';
  b.classList.toggle('pago-comercio--vacio', !pago.comercio);
}

function pintaCuando() {
  const el = limpiar($('#pago-cuando'));

  const dia = document.createElement('span');
  dia.className = 'dia';
  dia.textContent = nombreDia(pago.fecha);
  el.append(dia);

  if (pago.cuentaTexto && !cuentaQueEncaja(pago.cuentaTexto, state.cuentas)) {
    /* El Atajo nombró una tarjeta que no tienes dada de alta: lo decimos
       en vez de callarlo, porque explica por qué no viene marcada. */
    el.append(document.createTextNode(` · el Atajo dijo «${pago.cuentaTexto}»`));
  }
}

function pintaMemoria() {
  const el = $('#pago-memoria');
  if (!pago.recordada || !pago.categoria) {
    el.hidden = true;
    return;
  }

  const cat = categoria(pago.categoria);
  $('#pago-memoria-texto').textContent =
    pago.veces === 1
      ? `La otra vez fue ${cat.nombre}`
      : `Las ${pago.veces} veces anteriores fue ${cat.nombre}`;
  el.hidden = false;
}

function pintaElecciones() {
  chipsElegibles($('#pago-categorias'), opcionesCategoria(), pago.categoria, (id) => {
    if (!pago) return;
    cancelaCuentaAtras();
    pago.categoria = pago.categoria === id ? null : id;
    guardaPendiente(pago);
    pintaElecciones();
    actualizaGuardar();
    haptic();
  });

  chipsElegibles($('#pago-cuentas'), opcionesCuenta(), pago.cuenta, (id) => {
    if (!pago) return;
    cancelaCuentaAtras();
    pago.cuenta = pago.cuenta === id ? null : id;
    guardaPendiente(pago);
    pintaElecciones();
    haptic();
  });
}

function actualizaGuardar() {
  const btn = $('#pago-guardar');
  const listo = pago.categoria != null;
  $('#pago-guardar-texto').textContent = listo ? 'Guardar' : 'Elige en qué';
  btn.disabled = !listo;
}

/* ---------- Guardado solo ----------
   Tres segundos y una barra que se vacía. No es magia escondida: se ve
   cuánto queda y cualquier toque la para. */
function arrancaCuentaAtras() {
  const btn = $('#pago-guardar');
  const barra = document.createElement('span');
  barra.className = 'pago-cuenta-atras';
  btn.append(barra);

  $('#pago-guardar-texto').textContent = 'Guardando…';
  cuentaAtras = setTimeout(() => {
    cuentaAtras = null;
    guardaPago();
  }, 3000);

  /* Cualquier toque dentro de la hoja significa "espera, que miro" */
  $('#pago-panel').addEventListener('pointerdown', cancelaCuentaAtras, { once: true });
}

function cancelaCuentaAtras() {
  if (cuentaAtras) {
    clearTimeout(cuentaAtras);
    cuentaAtras = null;
  }
  const barra = $('.pago-cuenta-atras');
  if (barra) barra.remove();
  if (pago) actualizaGuardar();
}

function guardaPago() {
  if (!pago || pago.categoria == null) return;

  const gasto = anotaGasto({
    importe: pago.importe,
    comercio: pago.comercio,
    fecha: pago.fecha,
    categoria: pago.categoria,
    cuenta: pago.cuenta,
    nota: pago.nota,
    origen: pago.origen || 'atajo',
  });

  apuntaReciente(pago);
  olvidaPendiente();
  cierraPago();

  haptic(18);
  const cat = categoria(gasto.categoria);
  aviso(`${euros(gasto.importe)} en ${cat.nombre}`, {
    tipo: 'exito',
    accion: 'Deshacer',
    alPulsar: () => {
      borraGasto(gasto.id);
      pinta();
      aviso('Borrado');
    },
  });

  /* Un pago de otro mes no se ve si estás mirando este */
  vista.mes = pago.fecha.slice(0, 7);
  pinta();
}

function cierraPago() {
  cancelaCuentaAtras();
  pago = null;
  cierraHoja($('#hoja-pago'));
}

function conectaPago() {
  /* Cerrar la hoja sin guardar ni descartar deja el pago pendiente: si la
     cierras sin querer, no has perdido el gasto. Guardar y Descartar ya lo
     han olvidado antes de llegar aquí, así que a ellos no les sale esto. */
  $('#hoja-pago').addEventListener('close', () => {
    cancelaCuentaAtras();
    pago = null;

    const pendiente = leePendiente();
    if (pendiente) {
      aviso('Lo dejo pendiente para luego', {
        accion: 'Volver',
        alPulsar: () => abrePago(pendiente, { recuperado: true }),
      });
    }
  });

  $('#pago-guardar').addEventListener('click', guardaPago);

  $('#pago-descartar').addEventListener('click', () => {
    olvidaPendiente();
    if (pago) apuntaReciente(pago);
    cierraPago();
    aviso('Pago descartado');
  });

  /* --- Corregir el importe --- */
  const importeBtn = $('#pago-importe');
  const importeCampo = $('#pago-importe-campo');

  importeBtn.addEventListener('click', () => {
    cancelaCuentaAtras();
    ponImporte(importeCampo, pago.importe);
    importeBtn.hidden = true;
    importeCampo.hidden = false;
    importeCampo.focus();
    importeCampo.select();
  });

  const cierraImporte = () => {
    const n = parseImporte(importeCampo.value);
    if (pago && n != null && n > 0) {
      pago.importe = n;
      guardaPendiente(pago);
      pintaImporte();
    }
    importeCampo.hidden = true;
    importeBtn.hidden = false;
  };

  importeCampo.addEventListener('blur', cierraImporte);
  importeCampo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); importeCampo.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); importeCampo.value = ''; importeCampo.blur(); }
  });

  /* --- Corregir el comercio --- */
  const comercioBtn = $('#pago-comercio');
  const comercioCampo = $('#pago-comercio-campo');

  comercioBtn.addEventListener('click', () => {
    cancelaCuentaAtras();
    comercioCampo.value = pago.comercio;
    comercioBtn.hidden = true;
    comercioCampo.hidden = false;
    comercioCampo.focus();
    comercioCampo.select();
  });

  const cierraComercio = () => {
    comercioCampo.hidden = true;
    comercioBtn.hidden = false;
    if (!pago) return;

    const antes = pago.comercio;
    pago.comercio = comercioCampo.value.trim();
    pintaComercio();

    /* Otro comercio puede tener otra memoria: la volvemos a consultar */
    if (pago.comercio !== antes) {
      const previa = sugerencia(pago.comercio);
      pago.recordada = previa.recordada;
      pago.veces = previa.veces;
      if (previa.recordada && previa.categoria) pago.categoria = previa.categoria;
      pintaMemoria();
      pintaElecciones();
      actualizaGuardar();
    }
    guardaPendiente(pago);
  };

  comercioCampo.addEventListener('blur', cierraComercio);
  comercioCampo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); comercioCampo.blur(); }
  });
}

/* =====================================================================
   Alta y edición a mano
   ===================================================================== */

let gastoEditando = null;
let gastoElegido = { categoria: null, cuenta: null };

function abreGasto(g = null) {
  gastoEditando = g;

  const hoja = $('#hoja-gasto');
  $('#gasto-titulo').textContent = g ? 'Editar gasto' : 'Nuevo gasto';
  ponImporte($('#gasto-importe'), g ? g.importe : '');
  $('#gasto-comercio').value = g ? g.comercio : '';
  $('#gasto-fecha').value = g ? g.fecha : hoyISO();
  $('#gasto-fecha').max = hoyISO();

  /* Sugerencias de comercio: los que ya conoce, sin repetir */
  const lista = limpiar($('#lista-comercios'));
  for (const nombre of comerciosConocidos()) {
    const o = document.createElement('option');
    o.value = nombre;
    lista.append(o);
  }

  gastoElegido = {
    categoria: g ? g.categoria : null,
    cuenta: g ? g.cuenta : cuentaHabitual(),
  };

  const repinta = () => {
    chipsElegibles($('#gasto-categorias'), opcionesCategoria(), gastoElegido.categoria, (id) => {
      gastoElegido.categoria = gastoElegido.categoria === id ? null : id;
      repinta();
      haptic();
    });
    chipsElegibles($('#gasto-cuentas'), opcionesCuenta(), gastoElegido.cuenta, (id) => {
      gastoElegido.cuenta = gastoElegido.cuenta === id ? null : id;
      repinta();
      haptic();
    });
  };
  repinta();

  /* Al escribir un comercio conocido, la categoría se rellena sola */
  $('#gasto-comercio').oninput = (e) => {
    if (gastoElegido.categoria) return;
    const previa = sugerencia(e.target.value);
    if (previa.recordada && previa.categoria) {
      gastoElegido.categoria = previa.categoria;
      repinta();
    }
  };

  $('#gasto-borrar').hidden = !g;
  abreHoja(hoja, { campo: !g });
}

function comerciosConocidos() {
  const vistos = new Map();
  for (const g of state.gastos) {
    if (g.comercio) vistos.set(g.comercio.toLowerCase(), g.comercio);
  }
  return [...vistos.values()].sort();
}

/* =====================================================================
   Categorías y cuentas
   ===================================================================== */

let catEditando = null;
let catIcono = ICONO_DEFECTO;

function abreCategoria(id = null) {
  const cat = id ? categoria(id) : null;
  catEditando = cat;
  catIcono = cat ? cat.icono : ICONO_DEFECTO;

  $('#cat-titulo').textContent = cat ? 'Editar categoría' : 'Nueva categoría';
  $('#cat-nombre').value = cat ? cat.nombre : '';
  ponImporte($('#cat-tope'), cat && cat.tope ? cat.tope : '');
  $('#cat-borrar').hidden = !cat;

  const repinta = () =>
    pintaIconos($('#cat-iconos'), catIcono, (ic) => {
      catIcono = ic;
      repinta();
      haptic();
    });
  repinta();

  abreHoja($('#hoja-categoria'), { campo: !cat });
}

let ctaEditando = null;
let ctaTipo = 'tarjeta';

function abreCuenta(id = null) {
  const cta = id ? cuenta(id) : null;
  ctaEditando = cta;
  ctaTipo = cta ? cta.tipo : 'tarjeta';

  $('#cta-titulo').textContent = cta ? 'Editar tarjeta' : 'Nueva tarjeta';
  $('#cta-nombre').value = cta ? cta.nombre : '';
  $('#cta-ultimos').value = cta ? cta.ultimos : '';
  $('#cta-borrar').hidden = !cta;

  const repinta = () =>
    chipsElegibles(
      $('#cta-tipos'),
      TIPOS_CUENTA.map((t) => ({ ...t, hue: 215 })),
      ctaTipo,
      (id2) => { ctaTipo = id2; repinta(); haptic(); }
    );
  repinta();

  abreHoja($('#hoja-cuenta'), { campo: !cta });
}

/* =====================================================================
   Formularios
   ===================================================================== */

function conectaFormularios() {
  $('#btn-nuevo').addEventListener('click', () => abreGasto());

  /* --- Gasto --- */
  $('#gasto-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const importe = parseImporte($('#gasto-importe').value);
    if (importe == null || importe <= 0) {
      aviso('Ese importe no me cuadra', { tipo: 'error' });
      $('#gasto-importe').focus();
      return;
    }

    const datos = {
      importe,
      comercio: $('#gasto-comercio').value,
      fecha: $('#gasto-fecha').value || hoyISO(),
      categoria: gastoElegido.categoria,
      cuenta: gastoElegido.cuenta,
    };

    if (gastoEditando) editaGasto(gastoEditando.id, datos);
    else anotaGasto({ ...datos, origen: 'manual' });

    vista.mes = datos.fecha.slice(0, 7);
    cierraHoja($('#hoja-gasto'));
    pinta();
    aviso(gastoEditando ? 'Cambiado' : `${euros(importe)} apuntado`, { tipo: 'exito' });
  });

  $('#gasto-borrar').addEventListener('click', () => {
    if (!gastoEditando) return;
    const fuera = borraGasto(gastoEditando.id);
    cierraHoja($('#hoja-gasto'));
    pinta();
    aviso('Gasto borrado', {
      accion: 'Deshacer',
      alPulsar: () => { recuperaGasto(fuera); pinta(); },
    });
  });

  /* --- Categoría --- */
  $('#cat-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const nombre = $('#cat-nombre').value.trim();
    if (!nombre) return;

    const tope = parseImporte($('#cat-tope').value) || 0;

    if (catEditando) editaCategoria(catEditando.id, { nombre, icono: catIcono, tope });
    else anotaCategoria({ nombre, icono: catIcono, tope });

    cierraHoja($('#hoja-categoria'));
    pinta();
  });

  $('#cat-borrar').addEventListener('click', () => {
    if (!catEditando) return;

    const usados = state.gastos.filter((g) => g.categoria === catEditando.id).length;
    const aviso1 = usados
      ? `Borrar «${catEditando.nombre}»? Los ${usados} ${plural(usados, 'gasto', 'gastos')} que tiene se quedarán sin categoría, pero no se borran.`
      : `Borrar «${catEditando.nombre}»?`;

    if (!confirm(aviso1)) return;

    borraCategoria(catEditando.id);
    cierraHoja($('#hoja-categoria'));
    pinta();
    aviso('Categoría borrada');
  });

  /* --- Cuenta --- */
  $('#cta-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const nombre = $('#cta-nombre').value.trim();
    if (!nombre) return;

    const ultimos = $('#cta-ultimos').value;

    if (ctaEditando) editaCuenta(ctaEditando.id, { nombre, tipo: ctaTipo, ultimos });
    else anotaCuenta({ nombre, tipo: ctaTipo, ultimos, hue: 200 + state.cuentas.length * 35 });

    cierraHoja($('#hoja-cuenta'));
    pinta();
  });

  $('#cta-borrar').addEventListener('click', () => {
    if (!ctaEditando) return;
    if (state.cuentas.length === 1) {
      aviso('Deja al menos una tarjeta o cuenta', { tipo: 'error' });
      return;
    }
    if (!confirm(`Borrar «${ctaEditando.nombre}»? Sus gastos se quedan, pero sin tarjeta.`)) return;

    borraCuenta(ctaEditando.id);
    cierraHoja($('#hoja-cuenta'));
    pinta();
  });
}

function conectaHojas() {
  for (const hoja of $$('.hoja')) {
    hojaCierraAlTocarFuera(hoja);
    for (const b of hoja.querySelectorAll('[data-cerrar]')) {
      b.addEventListener('click', () => cierraHoja(hoja));
    }
  }
}

/* =====================================================================
   Ajustes
   ===================================================================== */

const ACCIONES_AJUSTES = {
  alPedirAtajo: () => muestraGuiaAtajo(),

  alCambiarAutoguardar: () => {
    state.autoguardar = !state.autoguardar;
    save();
    pinta();
    haptic();
  },

  alNuevaCategoria: () => abreCategoria(),
  alEditarCategoria: (id) => abreCategoria(id),
  alNuevaCuenta: () => abreCuenta(),
  alEditarCuenta: (id) => abreCuenta(id),

  alOlvidarRegla: (clave, nombre) => {
    olvidaRegla(clave);
    pinta();
    aviso(`Zas ya no recuerda ${nombre}`);
  },

  alCambiarTema: (tema) => {
    state.tema = tema;
    save();
    aplicaTema(tema);
    pinta();
  },

  alExportar: exportaCopia,
  alImportar: importaCopia,
};

async function exportaCopia() {
  const texto = exporta();
  const nombre = `zas-${hoyISO()}.json`;
  const archivo = new File([texto], nombre, { type: 'application/json' });

  /* En iOS, compartir deja elegir dónde guardarlo; la descarga directa
     acaba en un sitio que luego no encuentras. */
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Copia de Zas' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
      /* Si compartir falla por lo que sea, seguimos con la descarga */
    }
  }

  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  aviso('Copia guardada', { tipo: 'exito' });
}

function importaCopia() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';

  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;

    if (!confirm('Esto sustituye todos tus gastos por los de la copia. ¿Sigo?')) return;

    const res = importa(await f.text());
    if (!res.ok) {
      aviso(res.error, { tipo: 'error' });
      return;
    }

    vista.mes = mesActual();
    aplicaTema(state.tema);
    pinta();
    aviso(`${res.gastos} ${plural(res.gastos, 'gasto', 'gastos')} recuperados`, { tipo: 'exito' });
  });

  input.click();
}

/* =====================================================================
   La guía del Atajo
   ===================================================================== */

function muestraGuiaAtajo() {
  const base = `${location.origin}${location.pathname}`;
  const cuerpo = limpiar($('#atajo-cuerpo'));

  const html = `
    <p>Tu iPhone puede avisar a Zas cada vez que pagas acercando el móvil.
    Se monta una vez y ya no vuelves a tocarlo.</p>

    <h3>En la app Atajos</h3>
    <ol>
      <li>Pestaña <strong>Automatización</strong> → <strong>+</strong> →
      <strong>Transacción</strong>.</li>
      <li>Elige tus tarjetas, marca <strong>Ejecutar inmediatamente</strong> y
      deja sin marcar <strong>Notificar al ejecutarse</strong>.</li>
      <li>Crea una automatización en blanco con la acción
      <strong>Abrir URL</strong> y esta dirección:</li>
    </ol>

    <code></code>

    <p>Lo que va entre corchetes son <strong>variables</strong>, no texto. Toca
    en cada hueco, elige <strong>Entrada del atajo</strong> y vuelve a tocarla
    para escoger el importe, la tarjeta o el comercio (en inglés salen como
    <em>Amount</em>, <em>Card or Pass</em> y <em>Merchant</em>).</p>

    <h3>Por qué va detrás de la almohadilla</h3>
    <p>Lo que va después del <strong>#</strong> nunca sale del navegador hacia
    el servidor. Tu importe y dónde compras se quedan en el móvil.</p>

    <h3>Conviene saber</h3>
    <ul>
      <li>Solo salta al pagar <strong>acercando el móvil</strong> a un datáfono.
      Las compras por internet con Apple Pay no lo disparan.</li>
      <li>El Atajo no manda la fecha: Zas pone la del momento en que se abre.</li>
      <li>Si pagas con el móvil bloqueado, puede que iOS te pida desbloquearlo
      antes de abrir Zas.</li>
      <li>Con algunos bancos, Wallet tarda en enterarse del pago y la
      automatización no llega a saltar. Haz una compra de prueba antes de
      fiarte.</li>
      <li>Si cierras la ventana sin guardar, el pago te espera la próxima vez
      que abras Zas.</li>
      <li>Da de alta tus tarjetas con sus <strong>cuatro últimos números</strong>
      y Zas sabrá con cuál pagaste.</li>
    </ul>
  `;

  cuerpo.innerHTML = html;
  cuerpo.querySelector('code').textContent = `${base}#i=[Importe]&t=[Tarjeta]&c=[Comercio]`;
  abreHoja($('#hoja-atajo'));
}

/* =====================================================================
   Service worker
   ===================================================================== */

function registraServicio() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  navigator.serviceWorker.register('sw.js').catch(() => {
    /* Sin service worker la app va igual; solo no funciona sin conexión */
  });
}

arranca();
