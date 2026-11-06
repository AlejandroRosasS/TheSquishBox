# Pagos con tarjeta (Culqi)

Cada marca cobra con **su propia cuenta de Culqi**. La plataforma nunca recibe el dinero.
Yape y Plin siguen siendo manuales en el MVP; Culqi solo se usa para tarjeta.

## Cómo funciona

1. En el checkout el cliente elige **Tarjeta** y toca *Pagar con tarjeta*.
2. El pedido se crea en la base (`place_order`): el precio, el stock y el delivery los calcula la base.
3. Se abre **Culqi Checkout** (ventana segura de Culqi). El cliente escribe su tarjeta allí; nuestra web nunca la ve. Culqi devuelve un token `tkn_…`.
4. El navegador manda el token a `POST /api/culqi/charge`. El servidor cobra con la **llave secreta** de la marca y el **monto del pedido en la base** (nunca el del navegador).
5. Si el banco pide verificación (3DS), la tienda abre Culqi 3DS y reintenta el mismo cobro.
6. Pagado: el pedido queda `payment_status = paid`, con `payment_ref = chr_…` y una línea en la actividad.
   Rechazado: queda `failed`, el cliente ve el error de pago y puede reintentar el **mismo** pedido (no se duplica).
7. Respaldo: Culqi avisa a `POST /api/culqi/webhook`. Como Culqi no firma los eventos, el servidor solo toma el id del cobro y lo vuelve a consultar a Culqi con la llave secreta antes de marcar el pedido. También registra devoluciones.

## Configurar una marca

1. Migración `supabase/migrations/0005_culqi.sql` aplicada en Supabase.
2. Variable `SUPABASE_SECRET_KEY` en Vercel (servidor). Es la misma que usa Instagram.
3. Admin › Ajustes › **Pago con tarjeta · Culqi**: pegar la llave pública y la secreta (CulqiPanel › Desarrollo › API Keys), prender *Cobrar con tarjeta* y guardar.
   La llave secreta se guarda en la tabla `payment_accounts`, que el navegador no puede leer.
4. CulqiPanel › Eventos › Webhook: pegar la URL que muestra el admin (`https://<dominio>/api/culqi/webhook`) y marcar los eventos de cargos y devoluciones.

Sin cuenta activa, la tienda con base de datos **no muestra** la opción de tarjeta.
Sin base de datos (modo demo), el pago con tarjeta sigue simulado.

## Pruebas (llaves `pk_test_` / `sk_test_`)

| Caso | Tarjeta | Vence | CVV |
|---|---|---|---|
| Aprobada (Visa) | 4111 1111 1111 1111 | 09/30 | 123 |
| Aprobada (Mastercard) | 5111 1111 1111 1118 | 12/30 | 039 |
| Fondos insuficientes | 4000 0400 0000 0008 | 03/30 | 295 |
| CVV incorrecto | 5400 0200 0000 0003 | 07/30 | 203 |
| 3DS con desafío (correo review@culqi.com) | 4456 5300 0000 1096 | 07/30 | 111 |

## Pendiente

- Pedidos con tarjeta abandonados (el cliente cierra Culqi y no vuelve) quedan *Pago por confirmar* con el stock reservado; el equipo los cancela desde Pedidos. Más adelante: vencerlos solos.
- Yape en línea vía Culqi, cuando Culqi lo confirme para la cuenta.

## Conciliación de cobros (Admin › Ventas › Cobros Culqi)

- Cada cobro de la tienda web va a Culqi con descripción `Tienda web · Pedido 0002` y metadata `canal=web`, `tenant`, `order_id`, `order_number`. Así se distingue de lo que la marca cobre con la misma cuenta en otros sitios.
- `/admin/ventas/culqi` lista los cobros aprobados del mes (consulta `GET /v2/charges` con la llave secreta de la marca, en el servidor) y los separa en: **Tienda web** (cobro = `orders.payment_ref`), **Web · revisar** (marcado como web pero el pedido no figura pagado con ese cobro) y **Otro canal**.
- Comisión y neto se leen del cobro si Culqi los reporta (`total_fee`, `fee_details`, `transfer_amount`); si no, salen con «—» y se completan con el EECC de CulqiPanel. El CSV exportado se cruza con el reporte de Culqi por el id `chr_…`.
- Si Culqi no deja listar la cuenta, la pantalla consulta solo los cobros de los pedidos de la web.
- No usa tablas nuevas: no hay migración.
