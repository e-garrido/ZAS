# Zas

El gasto, apuntado de un toque.

Pagas con el móvil, tu iPhone avisa a Zas con el importe y el comercio, y sale
una ventana en la que solo tienes que decir **en qué** y **con qué**. Lo demás
ya viene puesto.

Inspirado en [Brim](https://apps.apple.com/pe/app/control-de-gastos-brim/id6754203889),
pero como PWA y sin servidor.

## Cómo funciona

```
Pagas con Apple Pay
        ↓
La automatización «Transacción» de Atajos lo detecta
        ↓
Abre Zas con el pago en el fragmento de la dirección (#…)
        ↓
Ventana de cristal:  12,50 €  ·  Mercadona
                     [Súper]  [Visa ··4242]   →  Guardar
```

Ver [ATAJO.md](ATAJO.md) para montarlo paso a paso.

## Dónde viven tus datos

En tu móvil, y en ningún otro sitio. Zas no tiene servidor, ni cuenta, ni
registro: es una página estática y un `localStorage`. Los datos del pago
llegan detrás de la almohadilla de la dirección, que es la parte que un
navegador nunca manda al servidor.

Para llevártelos a otro móvil: Ajustes → *Guardar una copia*, y en el otro
→ *Recuperar una copia*.

## Qué tiene

- **Ventana de captura** con el importe y el comercio ya puestos, corregibles
  de un toque.
- **Memoria por comercio**: el segundo Mercadona viene precategorizado.
- **Categorías y tarjetas propias**, con icono, color y los cuatro últimos
  números de la tarjeta.
- **Topes por categoría**, con una marca de por dónde deberías ir a estas
  alturas del mes.
- **Resumen mensual**: reparto por categoría y por tarjeta, comparación con el
  mes anterior y dónde gastas más.
- Funciona sin conexión, tema claro y oscuro, y se instala en la pantalla de
  inicio.

## Montarlo en local

No hay nada que compilar. Cualquier servidor estático vale:

```sh
python3 -m http.server 8000
```

Y abrir `http://localhost:8000`. Para probar la ventana del pago sin pagar:

```
http://localhost:8000/#i=12,50&t=Visa&c=Mercadona
```

El service worker solo se registra en `https` o en `localhost`.

Para verla llena, `http://localhost:8000/pruebas/sembrar.html` carga un mes
de gastos de ejemplo (pregunta antes de pisar lo que haya). La carpeta
`pruebas/` no se sube al repo.

## Estructura

```
index.html      pantallas, hojas y el sprite de iconos
styles.css      tokens, componentes y el cristal
app.js          qué pasa cuando tocas algo
js/calc.js      fechas, importes y agregados (todo puro)
js/state.js     estado, persistencia, categorías, tarjetas y reglas
js/captura.js   leer el pago que trae el Atajo
js/render.js    pintar las pantallas
js/ui.js        hojas, avisos, tema y piezas sueltas
sw.js           red primero para el código, caché para los iconos
```
