# Alertas de pedidos nuevos

Cada pedido de la tienda y cada pedido especial (fiestas) le avisa al equipo por **Telegram**, **correo** y **WhatsApp**. La marca elige canales, destinatarios y qué avisos recibe en **Admin › Ajustes › Notificaciones**.

## Por qué no se pierde ningún aviso

1. **El aviso se programa junto con el pedido.** Un trigger de la base (`orders_enqueue_alerts`, en `supabase/migrations/0004_alerts.sql`) lee la configuración de la marca y deja una fila por destinatario en `alert_outbox`, en la misma transacción que guarda el pedido. Si el pedido se guardó, su aviso está en cola. Si la configuración tiene un problema, el pedido se guarda igual y queda anotado en su actividad.
2. **Se envía al toque y se reintenta.** Apenas se guarda el pedido, la tienda llama a `POST /api/alerts/dispatch`. Si un canal falla, se reintenta a 1, 2, 5, 15 y 30 minutos, y luego cada vez más espaciado hasta unas 28 horas. Si un envío se corta a la mitad, el aviso vuelve a la cola a los 2 minutos.
3. **Hay respaldos.** El cron (cada minuto, ver abajo) y el panel (cada vez que recarga Pedidos) también envían lo que quede pendiente.
4. **Todo queda a la vista.** La actividad de cada pedido dice «Aviso enviado por Telegram a …» o por qué falló. Notificaciones muestra los últimos avisos y avisa si alguno no llegó en las últimas 24 horas, o si ningún canal está activo.

**Pagos con tarjeta (Culqi):** el pedido se crea antes de cobrar, así que su aviso sale recién cuando el pago queda aprobado (migración `0007_alerts_paid.sql`). Los cobros rechazados o abandonados no avisan. Los pedidos especiales usan el mismo interruptor de «Nuevo pedido».

Los errores que no se arreglan reintentando (correo mal escrito, número sin WhatsApp, bot sacado del grupo) se marcan como fallidos de inmediato.

## Cuentas (una para toda la plataforma)

Las cuentas son de la plataforma, no de cada marca: un bot de Telegram, un remitente de correo y un número de WhatsApp. El nombre de la marca va dentro del mensaje. Todo va en **Vercel › Settings › Environment Variables** (y en `.env` en local). Nunca en el código ni en el chat.

| Variable | Para qué |
|---|---|
| `SUPABASE_SECRET_KEY` | Ya está por Instagram. Sin ella los avisos se quedan en cola sin enviarse. |
| `CRON_SECRET` | Ya está por Instagram. Protege el cron de avisos. |
| `SITE_URL` | Opcional. Dominio del link «Ver en el panel», por ejemplo `https://demo.thesquishbox.com`. Si no está, se usa el dominio desde el que se llamó. |
| `TELEGRAM_BOT_TOKEN` | Telegram |
| `RESEND_API_KEY`, `ALERTS_FROM_EMAIL` | Correo |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE` | WhatsApp |

Un canal sin sus variables aparece como «Falta configurar» en Notificaciones. Los demás funcionan igual.

### Telegram (gratis, 5 minutos)

**Un bot por marca.** Cada proyecto de Vercel tiene su `TELEGRAM_BOT_TOKEN`. Cada despliegue envía por Telegram solo los avisos de su marca (`TENANT`) y su webhook solo atiende a su marca; el correo y WhatsApp sí los puede enviar cualquier despliegue.

1. En Telegram, abre **@BotFather** › `/newbot`. Ponle un nombre (por ejemplo «Alertas de pedidos») y un usuario que termine en `bot`.
2. Copia el token que te da y guárdalo como `TELEGRAM_BOT_TOKEN`.
3. El webhook se configura solo: la primera vez que alguien toca **Vincular chat o grupo** en producción, la app apunta el bot a `https://<dominio>/api/telegram/webhook` (con una clave que sale del token). En local y en vistas previas sigue leyendo con `getUpdates`.
4. Para que el bot reciba CSV dentro de un **grupo**: en @BotFather › `/setprivacy` › elige el bot › **Disable**. Si no, en grupos solo ve los comandos (en un chat privado con el bot funciona siempre).

Para vincular un chat, entra a Notificaciones › Telegram › **Vincular chat o grupo**, abre el link en el celular y toca **Iniciar**. Para un grupo, usa «Agregar a un grupo» y elige el grupo del equipo. El bot responde «Listo» y aparece en la lista.

### Ventas manuales por Telegram

Cualquier chat vinculado a una marca puede cargar ventas manuales:

1. `/prompt`: el bot manda las instrucciones con el catálogo, precios y campañas de hoy, para pegarlas en Claude o ChatGPT.
2. La IA devuelve un CSV (formato de Admin › Ventas › Importar ventas). Se le manda al bot pegado como texto o como archivo `.csv`.
3. El bot responde con el resumen (ventas nuevas, total, campañas, filas con error, ventas ya cargadas) y los botones **Registrar** / **Cancelar**. Nada se guarda antes de tocar Registrar.

Las ventas quedan en `manual_sales` con `source = 'telegram'`. Si el chat recibe avisos de más de una marca, el bot no carga ventas ahí (hay que usar un chat por marca).

### Correo con [Resend](https://resend.com) (gratis hasta 3 000 correos al mes)

1. Crea la cuenta y entra a **Domains › Add domain**: `thesquishbox.com` (mientras no haya dominio de plataforma).
2. Agrega en Namecheap los registros DNS que te muestra (MX, SPF y DKIM) y espera a que diga *Verified*.
3. **API Keys › Create** con permiso *Sending access*. Guárdala como `RESEND_API_KEY`.
4. `ALERTS_FROM_EMAIL` = `alertas@thesquishbox.com`. El remitente sale como «Nombre de la marca <alertas@…>».

### WhatsApp (Cloud API de Meta)

Se usa la misma app de Meta de Instagram.

1. App de Meta › **Agregar caso de uso › Conectar con clientes por WhatsApp**. Elige el portfolio de la plataforma.
2. Agrega un **número para alertas**. Tiene que ser un número que **no** esté usando la app de WhatsApp (un chip nuevo sirve). Mientras tanto puedes probar con el número de prueba que da Meta: solo envía a 5 números que registres ahí.
3. Copia el **ID del número de teléfono** como `WHATSAPP_PHONE_NUMBER_ID`.
4. Token: en **Configuración del negocio › Usuarios del sistema**, usa el usuario del sistema, asígnale la cuenta de WhatsApp y genera un token con `whatsapp_business_messaging` (caducidad «Nunca»). Guárdalo como `WHATSAPP_TOKEN`.
5. **Plantilla.** WhatsApp solo deja escribir primero con una plantilla aprobada. En **Administrador de WhatsApp › Plantillas › Crear**:
   - Categoría **Utilidad**, nombre `alerta_pedido`, idioma **Español**.
   - Cuerpo: `Hola, tienes un aviso de {{1}}: {{2}}. Detalle: {{3}}. Revisa el panel para atenderlo.`
   - Ejemplos: `The Squish Box` · `Nuevo pedido #0042 · S/ 69.00` · `Ana · Delivery a Miraflores · 2 productos`.
   - Cuando esté aprobada, guarda `WHATSAPP_TEMPLATE=alerta_pedido`.

   Las variables son siempre {{1}} marca, {{2}} título del aviso y {{3}} resumen en una línea. Si el idioma no es `es`, ponlo en `WHATSAPP_TEMPLATE_LANG`.

Costo: Meta cobra cada plantilla de utilidad que se envía (en Perú, unos centavos de dólar por mensaje). Telegram y correo son gratis.

## Base de datos

Aplica `supabase/migrations/0004_alerts.sql` después de 0001, 0002 y 0003, y `0007_alerts_paid.sql` después de 0005. Crea:

- `alert_outbox`: la cola de avisos. El equipo la puede leer; solo el servidor la escribe.
- `telegram_link_codes`: códigos para vincular chats de Telegram. Solo el servidor.
- `sales_imports` (0010): CSV de ventas recibidos por el bot, esperando Registrar/Cancelar. Solo el servidor.
- El trigger `orders_enqueue_alerts` y la función `claim_alerts`, que solo puede llamar el servidor.

La configuración vive en `site_docs` (kind `notifications`, stage `published`), que solo ve el equipo de la marca.

## Cron cada minuto (Supabase)

El plan gratis de Vercel solo permite un cron diario (está en `vercel.json` como último respaldo). Para revisar cada minuto, usa el cron de Supabase (Database › Extensions: `pg_cron` y `pg_net`, los mismos de Instagram) y corre esto en el SQL Editor:

```sql
select cron.schedule('alertas', '* * * * *', $$
  select net.http_get(
    url := 'https://demo.thesquishbox.com/api/alerts/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```

Haz un cron **por marca** (cada uno con la URL y el `CRON_SECRET` de su proyecto): como cada marca tiene su bot, los reintentos de Telegram de una marca solo los puede hacer su propio despliegue. Guarda el secreto en Vault (`select vault.create_secret('<CRON_SECRET>', 'cron_secret_bloom');`) y usa `(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_bloom')` en vez del texto.

Cuando la tienda pase al dominio final, cambia la URL con `cron.unschedule('alertas')` y vuelve a crearlo.

## Probar

1. Configura al menos un canal y entra a Notificaciones. El canal debe decir «Conectado» después de agregar un destinatario.
2. Toca **Enviar prueba**: llega un mensaje de prueba a cada destinatario de ese canal, o un aviso con el error.
3. Haz un pedido en la tienda y mira su actividad en Pedidos: debe decir «Aviso enviado por …».
