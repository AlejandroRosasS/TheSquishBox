# Importación desde Instagram

Los posts de la marca llegan solos a **Admin › Instagram**. El equipo elige cuáles se venden y los convierte en producto (borrador o publicado). Las fotos y el texto se mantienen sincronizados con Instagram.

## Cómo funciona

1. **Conectar** (`/api/instagram/connect` → Instagram → `/api/instagram/callback`): la marca inicia sesión (Facebook o Instagram) y comparte su cuenta profesional con la app. Se guarda el token de usuario del sistema de su portfolio en `ig_accounts` (solo lo lee el servidor; según la configuración, no vence) y se traen todos los posts.
2. **Sincronizar**: botón «Sincronizar ahora» (`POST /api/instagram/sync`) y cron (`GET /api/instagram/cron`). Meta no avisa cuando hay posts nuevos, así que se revisa periódicamente.
3. **Bandeja** (`ig_posts`): cada post queda como *Nuevo* (parece producto), *Contenido* (tips, sorteos, modelos), *En tienda* (ya es producto) u oculto.
4. **Convertir en producto**: nombre, precio, opciones y línea vienen sugeridos desde el caption (`src/lib/instagram/caption.ts`). **Nunca se inventa un precio**: si el caption no lo dice, queda vacío. El producto se crea con `ig_post_id` = id del post en Meta.

### Qué toca la sincronización

| Campo | ¿Se actualiza solo? |
|---|---|
| Fotos de Instagram (`ig_images`) | Siempre |
| Fotos de la tienda (`images`) | Solo si la marca no las reemplazó por fotos propias (`photos_synced`) |
| Descripción | Solo si nadie la editó (sigue igual al caption anterior) |
| Nombre, precio, opciones, stock, línea | Nunca |
| Post borrado en Instagram | Se marca «Borrado en IG» en la bandeja; el producto no se toca |

Las fotos se copian al bucket `media` (`media/<slug>/ig/<id>.jpg`) porque las URLs de Meta vencen, y aparecen en la biblioteca de Fotos. De los reels se guarda la portada.

## Configuración (una vez)

### 1. App de Meta (Unified login)

Desde fines de 2026 las apps nuevas solo pueden usar **"Instagram API setup with Unified login"** (Facebook Login for Business con una configuración). No hace falta página de Facebook, pero sí un **portfolio comercial**: uno para la app (el de la plataforma) y uno por marca (donde está su cuenta de Instagram).

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) › **Crear app** › caso de uso «Administrar mensajes y contenido en Instagram». Conéctala al portfolio de la plataforma.
2. **Casos de uso › Personalizar › API setup with Unified login**:
   - **Crear nueva configuración**: token de usuario del sistema, caducidad «Nunca». Permiso necesario: `instagram_basic` (los de anuncios no hacen falta).
   - **URL de redireccionamiento**: `https://demo.thesquishbox.com/api/instagram/callback` (y la del dominio final cuando se lance) › Guardar.
   - Copia el **ID de configuración**.
3. **Configuración de la app › Básica**: copia el **ID de la app** y la **clave secreta**.
4. Mientras la app no pase la Revisión, solo pueden conectar personas con rol en la app (tú como administrador). Para abrirlo a otras marcas: acceso avanzado de `instagram_basic` (Revisión de la app), app en modo Live y Verificación del negocio.

Docs: [Instagram API with Unified login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/).

### 2. Variables (Vercel › Settings › Environment Variables, y `.env` en local)

| Variable | De dónde |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase › Project Settings › API Keys › Secret |
| `META_APP_ID`, `META_APP_SECRET` | Paso 1.3 |
| `META_CONFIG_ID` | Paso 1.2 (o pon la "URL de inicio de sesión" completa en `META_LOGIN_URL` y se leen de ahí el ID de la app y el config_id) |
| `CRON_SECRET` | Cualquier texto largo al azar |
| `INSTAGRAM_REDIRECT_URI` | Opcional; si no, `<dominio>/api/instagram/callback` |

### 3. Base de datos

Aplica `supabase/migrations/0003_instagram.sql` (después de 0001 y 0002).

### 4. Revisión automática

- `vercel.json` programa un **escaneo completo diario** (09:00 UTC = 4 a. m. en Lima). El plan gratis de Vercel solo permite crons diarios.
- Para revisar **cada 15 minutos** sin pagar, usa el cron de Supabase (Database › Extensions: activa `pg_cron` y `pg_net`) y corre en el SQL Editor:

```sql
select cron.schedule('ig-squish', '*/15 * * * *', $$
  select net.http_get(
    url := 'https://demo.thesquishbox.com/api/instagram/cron',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```

## Probar en local sin Meta

Con `IG_MOCK=1` (más Supabase y `SUPABASE_SECRET_KEY` en `.env`), «Conectar Instagram» no sale a Meta: conecta una cuenta de prueba y trae los posts de ejemplo de `src/tenants/<slug>/admin-demo.json` con sus fotos de `public/`. Así se prueba todo el flujo: bandeja, convertir, borradores y sincronización.

Pruebas del lector de captions: `npm test`.

## Si falla la conexión

Con tu sesión del admin abierta, entra a `/api/instagram/connect?check=1`. Muestra (sin secretos) el ID de la app y el config_id que está usando el servidor, la URL de regreso y si Meta reconoce la app con esa clave secreta. Recuerda que en Vercel los cambios de variables recién se aplican en el siguiente despliegue.
