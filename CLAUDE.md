# Zas

PWA de control de gastos inspirada en Brim. Pagas con Apple Pay acercando el
iPhone, una automatización de Atajos abre Zas con el importe, la tarjeta y el
comercio, y una hoja de cristal pide solo **en qué** (categoría) y **con qué**
(tarjeta o cuenta).

Este archivo resume las decisiones y el estado del proyecto para seguir en una
sesión nueva, sin el historial de la conversación en la que se creó
(17 de septiembre de 2026).

## Decisiones del usuario

No reabrirlas salvo que el usuario lo pida.

- **Nombre:** Zas.
- **Privacidad ante todo:** los datos no salen del móvil. Sin servidor, sin
  cuenta, sin backend. El pago entra por el fragmento de la URL (detrás de
  `#`, que el navegador nunca manda al servidor) y se guarda en `localStorage`.
- **Alcance de la v1:** ventana de captura, categorías y tarjetas propias,
  reglas por comercio, resumen del mes y tope por categoría. Todo hecho.
- **Proyecto independiente:** no se mezcla con ningún otro proyecto.
- **GitHub lo gestiona el usuario:** él crea el repo y sube. No hacer commit ni
  push salvo que lo pida.
- **Idioma:** el usuario escribe en español; la app, el código y los
  comentarios también van en español.

## Estado

- v1 completa y probada en local (ver «Pruebas»).
- **Falta probarla en un iPhone real:** el aspecto del cristal y el Atajo de
  punta a punta.
- **Sin publicar.** Para usarla desde el iPhone tiene que estar en `https`
  (GitHub Pages, Cloudflare Pages o similar).
- Repo en GitHub: `e-garrido/ZAS` (privado), enlazado como `origin`, rama `main`.

## Stack y convenciones

- HTML, CSS y JavaScript con módulos ES. **Sin compilación, sin dependencias y
  sin frameworks:** se sirve tal cual desde cualquier servidor estático.
- Todo con nombres en español: funciones, variables, clases CSS, ids y
  comentarios (`abrePago`, `.hoja-panel`, `#pago-guardar`).
- Los comentarios explican el **porqué**, no el qué.
- El DOM se construye con `createElement` y `textContent`. Nunca `innerHTML`
  con datos del usuario.
- Estética iOS. Los tokens de diseño están en `:root` de `styles.css`, con
  paleta clara y oscura. El tema es automático o forzado con `data-theme` en
  `<html>`.
- Iconos: un sprite SVG dentro de `index.html` (`<symbol id="i-…">`), que se
  pinta con `icono(id)` de `js/ui.js`.

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Pantallas, hojas (`<dialog>`) y sprite de iconos |
| `styles.css` | Tokens, componentes, hojas y el cristal |
| `app.js` | Orquesta: navegación, ventana del pago (`abrePago`, `guardaPago`), formularios, ajustes, guía del Atajo |
| `js/calc.js` | Funciones puras: fechas (`'YYYY-MM-DD'`, meses `'YYYY-MM'`), euros, `resumenMes`, `porDias`, `estadoTope` |
| `js/state.js` | Estado, `load` y `save`, categorías, cuentas, gastos, reglas (`sugerencia`, `aprende`, `normalizaComercio`), exportar e importar |
| `js/captura.js` | Leer el pago de la URL (`leeDeUrl`), pago pendiente, pagos repetidos, emparejar tarjeta |
| `js/render.js` | Pinta Gastos, Resumen y Ajustes; `chipsElegibles` hace chips que se comportan como un grupo de radio |
| `js/ui.js` | `$`, avisos, hojas (`abreHoja`, `cierraHoja`), tema, `parseImporte` |
| `sw.js` | Red primero para el código y caché primero para los iconos |
| `manifest.webmanifest`, `icons/` | Lo que hace la PWA instalable |
| `ATAJO.md` | Guía para el usuario: cómo montar la automatización |
| `README.md` | Presentación del proyecto |
| `pruebas/` | Herramientas solo para local, en `.gitignore` (ver «Pruebas») |

## Modelo de datos

`localStorage['zas.datos.v1']`:

```js
{
  formato: 1,
  categorias: [{ id, nombre, icono, hue, tope }],   // tope 0 = sin tope
  cuentas:    [{ id, nombre, tipo, ultimos, hue }],  // tipo: 'tarjeta' | 'cuenta' | 'efectivo'
  gastos:     [{ id, importe, comercio, fecha, categoria, cuenta, nota, origen, creado }],
  reglas:     { [comercioNormalizado]: { categoria, cuenta, mostrado, veces } },
  tema: 'auto',          // 'auto' | 'light' | 'dark'
  autoguardar: false,
}
```

- Importes en euros con dos decimales; se redondea en cada suma.
- `origen` vale `'atajo'` o `'manual'`.
- `zas.pendiente.v1` guarda el pago abierto en la ventana que aún no se ha
  guardado. Si se cierra la app, vuelve a salir con el cartel «Se quedó a
  medias». Caduca a los 7 días.
- `sessionStorage['zas.recientes.v1']` sirve para avisar de pagos repetidos:
  mismo importe, comercio y fecha en menos de 10 minutos.
- Borrar una categoría o una cuenta no borra sus gastos: se quedan sin ella.

## Cómo entra un pago

La dirección que abre el Atajo:

```
https://DOMINIO/#i=[Importe]&t=[Tarjeta]&c=[Comercio]
```

- **Nombres aceptados:**
  - importe: `i`, `importe`, `amount`, `cantidad`
  - comercio: `c`, `comercio`, `merchant`, `tienda`, `nombre`
  - tarjeta: `t`, `tarjeta`, `cuenta`, `card`, `account`
  - fecha: `f`, `fecha`, `date`
  - nota: `n`, `nota`, `note`

  Solo el importe es obligatorio.
- Se lee del fragmento y también de la consulta (`?`), pero se recomienda `#`.
- **Atajos mete el texto sin codificar.** `trocea()` solo corta donde aparece
  `&nombre-conocido=`, así que `H&M`, `#` o `%` dentro de un valor llegan
  enteros. `descodifica()` solo traduce las secuencias `%XX` válidas.
- `parseImporte()` acepta cualquier formato regional: el último separador con
  una o dos cifras detrás es el decimal. Así, `1.234,56 €` y `US$1,234.56` dan
  lo mismo, y `1.200` es mil doscientos.
- Nada más leer el pago se borra de la barra con `history.replaceState`, para
  que recargar no lo duplique. Se escucha `hashchange` por si la app ya estaba
  abierta.
- La tarjeta se empareja por los cuatro últimos números; si no, por nombre
  exacto; si no, por nombre contenido (`cuentaQueEncaja`).
- `normalizaComercio` quita tildes, símbolos y códigos de tienda:
  `MERCADONA A-38` da `mercadona` y `H&M` da `h m`. En eso se apoyan las
  reglas.
- Con una regla conocida, la ventana viene precategorizada («Las 5 veces
  anteriores fue Súper»). Con `autoguardar` activo, se guarda sola a los
  3 segundos salvo que se toque algo.

## Lo comprobado sobre Atajos (iOS)

Contrastado con la documentación de Apple y con guías de terceros:

- El disparador **Transacción** salta «cada vez que se acerca el dispositivo»:
  solo pagos NFC en tienda. Las compras online con Apple Pay no lo activan.
- La entrada del atajo trae **importe, comercio, tarjeta o pase, y nombre**
  (en inglés: Amount, Merchant, Card or Pass, Name). **No trae fecha**, así
  que Zas usa la del momento en que se abre.
- Las variables se insertan eligiendo «Entrada del atajo» y volviendo a tocarla
  para escoger el dato.
- El importe llega formateado, con la moneda y los separadores de la región.
- Ajustes recomendados: «Ejecutar inmediatamente» activado y «Notificar al
  ejecutarse» desactivado.
- Hay informes (iOS 18) de que, con algunos bancos, el disparador no salta o
  caduca.
- **Sin confirmar:**
  - qué hace «Abrir URL» con el móvil bloqueado (puede pedir desbloquearlo);
  - los nombres exactos en español de las variables (`ATAJO.md` da también los
    ingleses).

Fuentes:
- [Transaction triggers in Shortcuts — Apple](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)
- [Apple Pay automation — Graham Haley](https://grahamhaley.co.uk/2024/11/19/apple-pay-automation/)
- [Transaction timeouts — Apple Developer Forums](https://developer.apple.com/forums/thread/765516)

## El cristal y las hojas

- **`.cristal`:** `backdrop-filter: blur(40px) saturate(190%)`, el tinte
  `--cristal-tinte` y un borde especular de 1px hecho con `::before` y una
  máscara.
- **Respaldo sólido:** se usa si no hay `backdrop-filter` o con
  `prefers-reduced-transparency: reduce`.
- **Hojas:** son `<dialog>` modales con animación de subida y bajada.
  - `abreHoja(dialog, { campo })` lleva el foco al primer campo solo si
    `campo` es verdadero, al crear algo. Si no, lo lleva a la hoja entera, para
    que no salte el teclado al editar.
  - `cierraHoja` anima la salida y se anula si la hoja se vuelve a abrir a
    mitad.
- **Pestañas y botón `+`:** se ocultan mientras hay una hoja abierta
  (`body:has(.hoja[open])`).
- **Movimiento:** se respeta `prefers-reduced-motion`.

## Pruebas

**Lógica** (94 casos: importes, URL, reglas, meses, topes y persistencia):

```sh
node pruebas/logica.mjs
```

**En el navegador:**

```sh
python3 -m http.server 8000
```

- `http://localhost:8000/#i=12,50&t=Visa&c=Mercadona` abre la ventana del pago.
- `http://localhost:8000/pruebas/sembrar.html` carga un mes de datos de
  ejemplo. Pregunta antes de pisar lo que haya; `?forzar` se salta la
  pregunta.

**Capturas automáticas** con Firefox sin pantalla. Firefox hace la captura en
el evento `load`. Por eso `pruebas/servidor.py` añade `/__pausa?ms=N`, una
imagen que tarda y retiene ese evento. `pruebas/pantalla.html` abre la app en
un marco, toca una pestaña y espera:

```sh
python3 pruebas/servidor.py &          # puerto 8778
mkdir -p /tmp/zas-perfil
MOZ_HEADLESS=1 MOZ_ENABLE_WAYLAND=0 LIBGL_ALWAYS_SOFTWARE=1 \
  firefox --headless --no-remote --profile /tmp/zas-perfil \
  --window-size=430,932 --screenshot=/tmp/zas.png \
  "http://127.0.0.1:8778/pruebas/pantalla.html?p=resumen"
```

- **Parámetros de `pantalla.html`:** `?p=resumen` o `?p=ajustes` elige la
  pestaña, y `?ms=N` alarga la espera. Lo que vaya detrás de `#` pasa a la app,
  por ejemplo un pago.
- **El cristal no se ve:** Firefox sin pantalla **no pinta `backdrop-filter`**
  y la hoja sale transparente. `?cristal=simulado` lo aproxima con
  `filter: blur()` detrás.
- **Modo oscuro:** crea `user.js` en el perfil con
  `user_pref("ui.systemUsesDarkTheme", 1);`.
- **Un puerto, un origen:** cada puerto es un origen distinto, así que hay que
  sembrar datos en el mismo puerto que se captura.

## Publicar

- Sirve cualquier hosting estático con `https`. El service worker solo se
  registra en `https` o en `localhost`.
- El service worker solo borra las cachés que empiezan por `zas-`. Si se
  publica en un `usuario.github.io` que aloja otras PWA, todas comparten
  origen, y sus service workers podrían borrar la caché de Zas. Los datos no
  se tocan.
- Al añadir archivos al sitio, añádelos a `ARCHIVOS` en `sw.js` y sube
  `VERSION`.

## Pendiente e ideas

- Probar en el iPhone: el cristal, el Atajo con el banco del usuario y el
  comportamiento con el móvil bloqueado.
- Publicar en `https`.
- Ideas sin decidir: exportar a CSV, buscar y filtrar gastos, notas en la
  ventana del pago (el modelo ya tiene `nota`).
- Detalle conocido: al olvidar una regla, la lista desplegada de «Lo que Zas ya
  se sabe» vuelve a plegarse.
