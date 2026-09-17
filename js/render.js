'use strict';

import {
  avanceDelMes, euros, estadoTope, nombreDia, nombreMes, porDias, resumenMes,
} from './calc.js';
import {
  ICONOS, TIPOS_CUENTA, categoria, cuenta, reglasOrdenadas, state,
} from './state.js';
import { $, icono, limpiar, plural } from './ui.js';

/* =====================================================================
   Pintado. Cada función recibe dónde pintar y qué, y devuelve nodos: ni
   guarda estado ni escucha eventos. Quien la llama pone los `onclick`.
   ===================================================================== */

/* ---------- Piezas sueltas ---------- */

function puntoCategoria(catId) {
  const cat = categoria(catId);
  const el = document.createElement('span');
  el.className = 'punto';
  el.style.setProperty('--hue', cat ? cat.hue : 220);
  el.append(icono(cat ? cat.icono : 'otros'));
  return el;
}

/** Un chip seleccionable. `valor` es lo que devuelve al elegirlo. */
function chip(texto, { iconoId, hue, elegido, valor, clase = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `chip ${clase}`.trim();
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', elegido ? 'true' : 'false');
  b.dataset.valor = valor ?? '';
  if (hue != null) b.style.setProperty('--hue', hue);
  if (iconoId) b.append(icono(iconoId));

  const s = document.createElement('span');
  s.textContent = texto;
  b.append(s);
  return b;
}

/** Fila de chips que se comporta como un grupo de radio de verdad:
    una sola elección, y las flechas mueven entre opciones. */
export function chipsElegibles(cont, opciones, elegido, alElegir) {
  limpiar(cont);

  for (const o of opciones) {
    const b = chip(o.nombre, {
      iconoId: o.icono,
      hue: o.hue,
      elegido: o.id === elegido,
      valor: o.id,
      clase: o.clase,
    });
    b.addEventListener('click', () => alElegir(o.id, b));
    cont.append(b);
  }

  /* Solo lo marcado entra en el recorrido del tabulador; dentro se anda
     con las flechas. Es como se comporta un grupo de radio nativo. */
  const marcado = cont.querySelector('[aria-checked="true"]');
  for (const b of cont.children) b.tabIndex = b === marcado ? 0 : -1;
  if (!marcado && cont.firstElementChild) cont.firstElementChild.tabIndex = 0;

  cont.onkeydown = (e) => {
    const teclas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const paso = teclas[e.key];
    if (!paso) return;

    e.preventDefault();
    const items = [...cont.children];
    const i = items.indexOf(document.activeElement);
    const siguiente = items[(i + paso + items.length) % items.length];
    siguiente.focus();
    siguiente.click();
  };
}

export const opcionesCategoria = () =>
  state.categorias.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono, hue: c.hue }));

export const opcionesCuenta = () =>
  state.cuentas.map((c) => ({
    id: c.id,
    nombre: c.ultimos ? `${c.nombre} ··${c.ultimos}` : c.nombre,
    icono: TIPOS_CUENTA.find((t) => t.id === c.tipo)?.icono || 'tarjeta',
    hue: c.hue,
  }));

function vacio(iconoId, titulo, texto, boton) {
  const el = document.createElement('div');
  el.className = 'vacio';
  el.append(icono(iconoId));

  const h = document.createElement('h2');
  h.textContent = titulo;
  el.append(h);

  const p = document.createElement('p');
  p.textContent = texto;
  el.append(p);

  if (boton) el.append(boton);
  return el;
}

function tarjeta(titulo, extra) {
  const art = document.createElement('div');
  art.className = 'tarjeta';

  if (titulo) {
    const h = document.createElement('div');
    h.className = 'tarjeta-titulo';

    const t = document.createElement('span');
    t.textContent = titulo;
    h.append(t);

    if (extra) {
      const e = document.createElement('span');
      e.className = 'secundario';
      e.textContent = extra;
      h.append(e);
    }
    art.append(h);
  }
  return art;
}

/* ---------- Pantalla de movimientos ---------- */

export function pintaMovimientos(mes, { alTocarGasto, alPedirAtajo }) {
  const res = resumenMes(state.gastos, mes);

  $('#mov-mes').textContent = nombreMes(mes);
  $('#mov-total').textContent = euros(res.total);

  const pie = $('#mov-pie');
  limpiar(pie);
  if (res.numero) {
    pie.append(
      document.createTextNode(
        `${res.numero} ${plural(res.numero, 'gasto', 'gastos')} · ${euros(res.media)} de media`
      )
    );
  }

  const cont = limpiar($('#mov-lista'));

  if (!res.numero) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--primario';
    btn.textContent = 'Montar el Atajo';
    btn.addEventListener('click', alPedirAtajo);

    cont.append(
      vacio(
        'rayo',
        'Aquí no hay nada todavía',
        'Cuando pagues con el móvil, el Atajo abrirá Zas con el importe puesto y solo tendrás que tocar la categoría.',
        btn
      )
    );
    return;
  }

  /* Los gastos sin categoría van arriba del todo: son los que piden algo */
  const sueltos = res.gastos.filter((g) => !g.categoria);
  if (sueltos.length) {
    const t = tarjeta(
      `Sin clasificar`,
      `${sueltos.length} ${plural(sueltos.length, 'gasto', 'gastos')}`
    );
    for (const g of sueltos) t.append(filaGasto(g, alTocarGasto));
    cont.append(t);
  }

  for (const grupo of porDias(res.gastos)) {
    const bloque = document.createElement('section');

    const cab = document.createElement('div');
    cab.className = 'dia-cabecera';

    const nombre = document.createElement('span');
    nombre.className = 'dia-nombre';
    nombre.textContent = nombreDia(grupo.dia);
    cab.append(nombre);

    const total = document.createElement('span');
    total.className = 'dia-total';
    total.textContent = euros(grupo.total);
    cab.append(total);

    bloque.append(cab);

    const t = tarjeta();
    for (const g of grupo.gastos) t.append(filaGasto(g, alTocarGasto));
    bloque.append(t);
    cont.append(bloque);
  }
}

function filaGasto(g, alTocar) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gasto';
  b.append(puntoCategoria(g.categoria));

  const texto = document.createElement('div');
  texto.className = 'gasto-texto';

  const com = document.createElement('div');
  com.className = 'gasto-comercio';
  com.textContent = g.comercio || 'Sin comercio';
  texto.append(com);

  const det = document.createElement('div');
  det.className = 'gasto-detalle';

  const cat = categoria(g.categoria);
  const catEl = document.createElement('span');
  if (cat) {
    catEl.textContent = cat.nombre;
  } else {
    catEl.className = 'sin-cat';
    catEl.textContent = 'Sin categoría';
  }
  det.append(catEl);

  const cta = cuenta(g.cuenta);
  if (cta) {
    const sep = document.createElement('span');
    sep.className = 'separa';
    sep.textContent = '·';
    det.append(sep);

    const c = document.createElement('span');
    c.textContent = cta.ultimos ? `${cta.nombre} ··${cta.ultimos}` : cta.nombre;
    det.append(c);
  }

  /* El rayo distingue lo que entró solo de lo que apuntaste a mano */
  if (g.origen === 'atajo') {
    const rayo = icono('rayo', 'icono icono--sm gasto-atajo');
    rayo.setAttribute('role', 'img');
    rayo.setAttribute('aria-label', 'apuntado por el Atajo');
    rayo.removeAttribute('aria-hidden');
    det.append(rayo);
  }

  texto.append(det);
  b.append(texto);

  const imp = document.createElement('div');
  imp.className = 'gasto-importe';
  imp.textContent = euros(g.importe);
  b.append(imp);

  b.addEventListener('click', () => alTocar(g));
  return b;
}

/* ---------- Pantalla de resumen ---------- */

export function pintaResumen(mes, { alTocarCategoria }) {
  const res = resumenMes(state.gastos, mes);
  const avance = avanceDelMes(mes);

  $('#res-mes').textContent = nombreMes(mes);
  $('#res-total').textContent = euros(res.total);

  const comp = limpiar($('#res-comparacion'));
  if (res.diferencia == null) {
    comp.textContent = res.numero ? 'el primer mes con datos' : '';
  } else if (res.diferencia === 0) {
    comp.textContent = 'lo mismo que el mes pasado';
  } else {
    const sube = res.diferencia > 0;
    const marca = document.createElement('span');
    marca.className = sube ? 'sube' : 'baja';
    marca.textContent = `${sube ? '+' : '−'}${euros(Math.abs(res.diferencia))}`;
    comp.append(marca, document.createTextNode(' respecto al mes pasado'));
  }

  const cont = limpiar($('#res-cuerpo'));

  if (!res.numero) {
    cont.append(vacio('grafico', 'Nada que resumir', 'En este mes no hay ningún gasto apuntado.'));
    return;
  }

  /* --- Por categoría, de más a menos --- */
  const conTope = state.categorias.filter((c) => c.tope > 0).length;
  const tCat = tarjeta('En qué se ha ido', conTope ? `${conTope} con tope` : '');

  const filas = state.categorias
    .map((c) => ({ cat: c, gastado: res.porCategoria.get(c.id) || 0 }))
    .filter((f) => f.gastado > 0 || f.cat.tope > 0)
    .sort((a, b) => b.gastado - a.gastado);

  /* La barra más larga marca la escala cuando no hay topes que comparar */
  const maximo = Math.max(...filas.map((f) => f.cat.tope || f.gastado), 1);

  for (const f of filas) {
    tCat.append(filaBarra(f.cat, f.gastado, maximo, avance, alTocarCategoria));
  }

  const sinCat = res.porCategoria.get('sin') || 0;
  if (sinCat > 0) {
    tCat.append(
      filaBarra(
        { id: null, nombre: 'Sin categoría', icono: 'otros', hue: 40, tope: 0 },
        sinCat, maximo, avance, null
      )
    );
  }
  cont.append(tCat);

  /* --- Por tarjeta --- */
  if (state.cuentas.length > 1) {
    const tCta = tarjeta('Con qué se ha pagado');
    const maxCta = Math.max(...[...res.porCuenta.values()], 1);

    for (const c of state.cuentas) {
      const gastado = res.porCuenta.get(c.id) || 0;
      if (!gastado) continue;
      tCta.append(
        filaBarra(
          { ...c, icono: TIPOS_CUENTA.find((t) => t.id === c.tipo)?.icono || 'tarjeta', tope: 0 },
          gastado, maxCta, avance, null
        )
      );
    }
    cont.append(tCta);
  }

  /* --- Dónde más veces --- */
  const porComercio = new Map();
  for (const g of res.gastos) {
    const k = g.comercio || 'Sin comercio';
    const p = porComercio.get(k) || { veces: 0, total: 0 };
    porComercio.set(k, { veces: p.veces + 1, total: p.total + g.importe });
  }

  const top = [...porComercio.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  if (top.length > 1) {
    const tCom = tarjeta('Dónde más');
    for (const [nombre, d] of top) {
      const fila = document.createElement('div');
      fila.className = 'aj-fila aj-fila--estatico';

      const texto = document.createElement('div');
      texto.className = 'aj-fila-texto';

      const n = document.createElement('div');
      n.className = 'aj-fila-nombre';
      n.textContent = nombre;
      texto.append(n);

      const p = document.createElement('div');
      p.className = 'aj-fila-pie';
      p.textContent = `${d.veces} ${plural(d.veces, 'vez', 'veces')}`;
      texto.append(p);

      fila.append(texto);

      const imp = document.createElement('div');
      imp.className = 'gasto-importe';
      imp.textContent = euros(d.total);
      fila.append(imp);

      tCom.append(fila);
    }
    cont.append(tCom);
  }
}

function filaBarra(cat, gastado, maximo, avance, alTocar) {
  const estado = estadoTope(gastado, cat.tope, avance);

  const el = document.createElement(alTocar ? 'button' : 'div');
  el.className = 'fila-barra';
  if (alTocar) el.type = 'button';
  else el.classList.add('aj-fila--estatico');
  el.style.setProperty('--hue', cat.hue);

  const p = document.createElement('span');
  p.className = 'punto';
  p.style.setProperty('--hue', cat.hue);
  p.append(icono(cat.icono));
  el.append(p);

  const texto = document.createElement('div');
  texto.className = 'barra-texto';

  const nombre = document.createElement('div');
  nombre.className = 'barra-nombre';

  const n = document.createElement('span');
  n.textContent = cat.nombre;
  nombre.append(n);

  if (estado.hayTope) {
    const nota = document.createElement('span');
    nota.className = `nota nota--${estado.nivel}`;
    nota.textContent =
      estado.nivel === 'pasado'
        ? `${euros(Math.abs(estado.resto))} de más`
        : `quedan ${euros(estado.resto)}`;
    nombre.append(nota);
  }
  texto.append(nombre);

  const via = document.createElement('div');
  via.className = 'barra-via';

  const valor = document.createElement('div');
  valor.className = 'barra-valor';
  if (estado.nivel === 'pasado' || estado.nivel === 'rapido') {
    valor.classList.add(`barra-valor--${estado.nivel}`);
  }
  const base = estado.hayTope ? cat.tope : maximo;
  valor.style.width = `${Math.min(100, (gastado / base) * 100)}%`;
  via.append(valor);

  /* Con tope, una marca dice por dónde deberías ir a estas alturas del mes */
  if (estado.hayTope && avance > 0.05 && avance < 0.97) {
    const hoy = document.createElement('div');
    hoy.className = 'barra-hoy';
    hoy.style.left = `${avance * 100}%`;
    hoy.title = 'por aquí vas de mes';
    via.append(hoy);
  }

  texto.append(via);
  el.append(texto);

  const cifra = document.createElement('div');
  cifra.className = 'barra-cifra';
  cifra.textContent = euros(gastado);
  el.append(cifra);

  if (alTocar) el.addEventListener('click', () => alTocar(cat.id));
  return el;
}

/* ---------- Pantalla de ajustes ---------- */

export function pintaAjustes(acciones) {
  const cont = limpiar($('#aj-cuerpo'));

  cont.append(bloqueAtajo(acciones));
  cont.append(bloqueCategorias(acciones));
  cont.append(bloqueCuentas(acciones));

  const reglas = reglasOrdenadas();
  if (reglas.length) cont.append(bloqueReglas(reglas, acciones));

  cont.append(bloqueApariencia(acciones));
  cont.append(bloqueDatos(acciones));
}

function grupo(etiqueta) {
  const g = document.createElement('section');
  g.className = 'aj-grupo';

  const h = document.createElement('h2');
  h.className = 'aj-etiqueta';
  h.textContent = etiqueta;
  g.append(h);
  return g;
}

function fila({ nombre, pie, iconoId, hue, alTocar, chevron = true }) {
  const el = document.createElement(alTocar ? 'button' : 'div');
  el.className = 'aj-fila';
  if (alTocar) el.type = 'button';
  else el.classList.add('aj-fila--estatico');

  if (iconoId) {
    const p = document.createElement('span');
    p.className = 'punto';
    p.style.setProperty('--hue', hue ?? 220);
    p.append(icono(iconoId));
    el.append(p);
  }

  const texto = document.createElement('div');
  texto.className = 'aj-fila-texto';

  const n = document.createElement('div');
  n.className = 'aj-fila-nombre';
  n.textContent = nombre;
  texto.append(n);

  if (pie) {
    const p = document.createElement('div');
    p.className = 'aj-fila-pie';
    p.textContent = pie;
    texto.append(p);
  }
  el.append(texto);

  if (alTocar && chevron) {
    el.append(icono('adelante', 'icono icono--chevron'));
    el.addEventListener('click', alTocar);
  } else if (alTocar) {
    el.addEventListener('click', alTocar);
  }
  return el;
}

function bloqueAtajo(acciones) {
  const g = grupo('Cómo entran los gastos');
  const t = tarjeta();

  t.append(
    fila({
      nombre: 'Montar el Atajo de iOS',
      pie: 'Para que al pagar se abra Zas con el importe puesto',
      iconoId: 'rayo',
      hue: 212,
      alTocar: acciones.alPedirAtajo,
    })
  );

  /* El guardado solo: solo tiene sentido si ya hay reglas aprendidas */
  const f = fila({
    nombre: 'Guardar solo lo conocido',
    pie: state.autoguardar
      ? 'Un comercio ya visto se apunta tras 3 segundos'
      : 'Siempre esperará a que toques Guardar',
    iconoId: 'reloj',
    hue: 150,
    chevron: false,
  });

  const palanca = document.createElement('button');
  palanca.type = 'button';
  palanca.className = 'palanca';
  palanca.setAttribute('role', 'switch');
  palanca.setAttribute('aria-checked', state.autoguardar ? 'true' : 'false');
  palanca.setAttribute('aria-label', 'Guardar solo los pagos ya conocidos');
  palanca.addEventListener('click', acciones.alCambiarAutoguardar);
  f.append(palanca);
  t.append(f);

  g.append(t);
  return g;
}

function bloqueCategorias(acciones) {
  const g = grupo('Categorías');
  const t = tarjeta();

  for (const c of state.categorias) {
    t.append(
      fila({
        nombre: c.nombre,
        pie: c.tope > 0 ? `tope de ${euros(c.tope)} al mes` : 'sin tope',
        iconoId: c.icono,
        hue: c.hue,
        alTocar: () => acciones.alEditarCategoria(c.id),
      })
    );
  }

  t.append(
    fila({ nombre: 'Añadir categoría', iconoId: 'mas', hue: 220, alTocar: acciones.alNuevaCategoria })
  );

  g.append(t);
  return g;
}

function bloqueCuentas(acciones) {
  const g = grupo('Tarjetas y cuentas');
  const t = tarjeta();

  for (const c of state.cuentas) {
    t.append(
      fila({
        nombre: c.ultimos ? `${c.nombre} ··${c.ultimos}` : c.nombre,
        pie: TIPOS_CUENTA.find((x) => x.id === c.tipo)?.nombre || 'Tarjeta',
        iconoId: TIPOS_CUENTA.find((x) => x.id === c.tipo)?.icono || 'tarjeta',
        hue: c.hue,
        alTocar: () => acciones.alEditarCuenta(c.id),
      })
    );
  }

  t.append(
    fila({ nombre: 'Añadir tarjeta o cuenta', iconoId: 'mas', hue: 220, alTocar: acciones.alNuevaCuenta })
  );

  g.append(t);
  return g;
}

/* Las más usadas, a la vista; el resto, a un toque. Sin eso no habría
   forma de olvidar la regla equivocada de un comercio al que vas poco. */
const REGLAS_A_LA_VISTA = 12;

function bloqueReglas(reglas, acciones) {
  const g = grupo('Lo que Zas ya se sabe');
  const t = tarjeta(null);

  for (const r of reglas.slice(0, REGLAS_A_LA_VISTA)) t.append(filaRegla(r, acciones));

  const resto = reglas.slice(REGLAS_A_LA_VISTA);
  if (resto.length) {
    const verMas = fila({
      nombre: `Ver ${resto.length} ${plural(resto.length, 'comercio', 'comercios')} más`,
      iconoId: 'abajo',
      hue: 220,
      chevron: false,
      alTocar: () => verMas.replaceWith(...resto.map((r) => filaRegla(r, acciones))),
    });
    t.append(verMas);
  }

  g.append(t);
  return g;
}

function filaRegla(r, acciones) {
  const cat = categoria(r.categoria);
  const f = fila({
    nombre: r.nombre,
    pie: `${cat ? cat.nombre : 'sin categoría'} · ${r.veces} ${plural(r.veces, 'vez', 'veces')}`,
    iconoId: cat ? cat.icono : 'otros',
    hue: cat ? cat.hue : 220,
    chevron: false,
  });

  const olvidar = document.createElement('button');
  olvidar.type = 'button';
  olvidar.className = 'icono-btn';
  olvidar.setAttribute('aria-label', `Olvidar la regla de ${r.nombre}`);
  olvidar.append(icono('cerrar'));
  olvidar.addEventListener('click', () => acciones.alOlvidarRegla(r.clave, r.nombre));
  f.append(olvidar);

  return f;
}

function bloqueApariencia(acciones) {
  const g = grupo('Aspecto');
  const t = tarjeta();

  const f = document.createElement('div');
  f.className = 'aj-fila aj-fila--estatico';

  const texto = document.createElement('div');
  texto.className = 'aj-fila-texto';

  const n = document.createElement('div');
  n.className = 'aj-fila-nombre';
  n.textContent = 'Tema';
  texto.append(n);
  f.append(texto);

  const seg = document.createElement('div');
  seg.className = 'segmentado';
  for (const [valor, etiqueta] of [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = etiqueta;
    b.setAttribute('aria-pressed', state.tema === valor ? 'true' : 'false');
    b.addEventListener('click', () => acciones.alCambiarTema(valor));
    seg.append(b);
  }
  f.append(seg);

  t.append(f);
  g.append(t);
  return g;
}

function bloqueDatos(acciones) {
  const g = grupo('Tus datos');
  const t = tarjeta();

  t.append(
    fila({
      nombre: 'Guardar una copia',
      pie: `${state.gastos.length} ${plural(state.gastos.length, 'gasto', 'gastos')} en este móvil`,
      iconoId: 'descargar',
      hue: 200,
      alTocar: acciones.alExportar,
    })
  );

  t.append(
    fila({
      nombre: 'Recuperar una copia',
      pie: 'Sustituye todo lo que hay ahora',
      iconoId: 'subir',
      hue: 260,
      alTocar: acciones.alImportar,
    })
  );

  g.append(t);

  const nota = document.createElement('p');
  nota.className = 'aj-etiqueta';
  nota.style.fontWeight = '500';
  nota.textContent =
    'Todo vive en este móvil. Zas no tiene servidor: ni tus importes ni dónde compras salen de aquí.';
  g.append(nota);

  return g;
}

/* ---------- Rejilla de iconos ---------- */
export function pintaIconos(cont, elegido, alElegir) {
  limpiar(cont);

  for (const ic of ICONOS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icono-opcion';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', ic.id === elegido ? 'true' : 'false');
    b.setAttribute('aria-label', ic.nombre);
    b.title = ic.nombre;
    b.style.setProperty('--hue', ic.hue);
    b.append(icono(ic.id));
    b.addEventListener('click', () => alElegir(ic.id));
    cont.append(b);
  }
}
