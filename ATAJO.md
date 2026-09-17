# Que el gasto se apunte solo

Zas no vigila tu cuenta ni se conecta a tu banco. Quien se entera de que has
pagado es tu propio iPhone, y él se lo cuenta a Zas. Esto se monta una vez y
ya no se vuelve a tocar.

## Lo que vas a montar

```
Pagas acercando el móvil al datáfono
        ↓
Atajos lo detecta (automatización «Transacción»)
        ↓
Abre:  https://TU-DIRECCIÓN/#i=12,50 €&t=Visa ··4242&c=Mercadona
        ↓
Zas sale con el importe puesto  →  tocas la categoría  →  guardado
```

## Paso a paso

1. Abre la app **Atajos** y ve a la pestaña **Automatización**.
2. Toca **+** y elige el disparador **Transacción**.
3. Selecciona tus tarjetas. Deja todas las categorías y no filtres comercios.
4. Marca **Ejecutar inmediatamente** y deja sin marcar **Notificar al
   ejecutarse**, para que no te pregunte nada cada vez.
5. Pulsa **Siguiente**, crea una **automatización en blanco** y añade la
   acción **Abrir URL**.
6. Escribe esta dirección, cambiando `TU-DIRECCIÓN` por donde tengas Zas:

   ```
   https://TU-DIRECCIÓN/#i=[Importe]&t=[Tarjeta]&c=[Comercio]
   ```

7. Lo que va entre corchetes son **variables**, no texto. En cada hueco:
   toca, elige **Entrada del atajo**, y vuelve a tocar esa misma variable para
   escoger qué dato de la transacción quieres. Según el idioma del iPhone los
   verás como:

   | Hueco       | Qué elegir                 | En inglés       |
   |-------------|----------------------------|-----------------|
   | `[Importe]` | el importe                 | *Amount*        |
   | `[Tarjeta]` | la tarjeta o pase          | *Card or Pass*  |
   | `[Comercio]`| el comercio                | *Merchant*      |

   Ese doble toque (primero Entrada del atajo, luego el dato) es lo que más
   cuesta la primera vez.

Hecho. El próximo café que pagues con el móvil abrirá Zas.

No hace falta codificar nada: Atajos mete el texto tal cual y Zas se apaña
aunque el comercio lleve `&`, `#` o `%` (un `H&M` llega entero).

## Lo que entiende Zas

Cada dato admite un nombre corto y otros largos, por si escribes enlaces a
mano:

| Dato     | Nombres que valen                        | Ejemplo        |
|----------|------------------------------------------|----------------|
| Importe  | `i`, `importe`, `amount`, `cantidad`     | `12,50 €`      |
| Comercio | `c`, `comercio`, `merchant`, `tienda`    | `Mercadona`    |
| Tarjeta  | `t`, `tarjeta`, `cuenta`, `card`         | `Visa ··4242`  |
| Fecha    | `f`, `fecha`, `date`                     | `2026-09-17`   |
| Nota     | `n`, `nota`, `note`                      | `con Marta`    |

Solo el **importe** es obligatorio. La transacción de Atajos **no trae
fecha**, así que Zas usa la del momento en que se abre; `f` queda para
enlaces que escribas tú.

El importe se lee venga como venga, porque Atajos lo manda ya formateado según
la región del iPhone: `12,50 €`, `€12.50`, `1.234,56 €` o `US$1,234.56`.

## Por qué la almohadilla importa

Fíjate en que los datos van detrás de `#`, no de `?`. No es un capricho:

- Lo que va detrás de `?` **viaja al servidor** en cada petición y acaba en
  los registros de quien aloje la página.
- Lo que va detrás de `#` **nunca sale del navegador**. Es cómo funciona la
  web, no un ajuste que se pueda cambiar.

Así que tu importe y el sitio donde compraste no salen del móvil ni siquiera
al abrir la página. Zas también acepta `?`, pero entonces esa promesa deja de
ser cierta.

Y en cuanto Zas lee el pago, lo borra de la barra de direcciones: no se queda
en el historial ni se apunta otra vez si recargas.

## Cosas que conviene saber

**Solo salta al pagar acercando el móvil.** El disparador es «cada vez que se
acerca el dispositivo» a un datáfono. Las compras por internet con Apple Pay
no lo activan; esas apúntalas con el botón **+**.

**Pruébalo con tu banco antes de fiarte.** Con algunas tarjetas, Wallet tarda
en enterarse del pago y la automatización no llega a saltar. Es cosa de iOS y
del banco, no de Zas: haz una compra pequeña y mira si se abre.

**Con el móvil bloqueado puede pedirte desbloquear.** Apple Pay se usa a
menudo sin desbloquear, y puede que iOS no abra la página hasta que lo hagas.

**Si cierras la ventana sin guardar, no se pierde.** El pago se queda
esperando y vuelve a salir al abrir Zas, con el cartel «Se quedó a medias».
Tienes una semana para atenderlo. Lo que no puede recuperar Zas es un pago
cuya dirección nunca llegó a abrirse.

**Da de alta tus tarjetas con los cuatro últimos números** (Ajustes → Tarjetas
y cuentas). Así Zas empareja lo que dice el Atajo con tu tarjeta sin que la
toques.

**El segundo Mercadona ya viene hecho.** La primera vez eliges la categoría; a
partir de ahí Zas la recuerda y solo confirmas. Si además activas *Guardar
solo lo conocido* en Ajustes, los comercios de siempre se apuntan solos tras
tres segundos, y cualquier toque lo detiene.

## Probar sin pagar nada

Abre esta dirección en el móvil (o en el navegador del ordenador) y verás la
ventana igual que si hubieras pagado:

```
https://TU-DIRECCIÓN/#i=12,50 €&t=Visa&c=Mercadona
```
