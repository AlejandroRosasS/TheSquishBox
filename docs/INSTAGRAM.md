# Importación desde Instagram

Los posts de la marca llegan solos a **Admin › Instagram**. El equipo elige cuáles se venden y los convierte en producto (borrador o publicado). Las fotos y el texto se mantienen sincronizados con Instagram.

## Cómo funciona

1. **Conectar** (`/api/instagram/connect` → Instagram → `/api/instagram/callback`): la marca autoriza la app con su cuenta profesional. Se guarda un token de 60 días en `ig_accounts` (solo lo lee el servidor) y se traen todos los posts.
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

### 1. App de Meta

1. En [developers.facebook.com](https://developers.facebook.com/apps) › **Crear app** › caso de uso «Administrar mensajes y contenido en Instagram» (tipo Empresa).
2. En **Instagram › Configuración de la API con inicio de sesión de Instagram**:
   - Copia el **ID de la app de Instagram** y la **clave secreta de la app de Instagram** (no son los de Facebook).
   - En «Configurar inicio de sesión para empresas», agrega la URL de redirección: `https://demo.thesquishbox.com/api/instagram/callback` (y la del dominio final cuando se lance).
3. En **Roles de la app › Evaluadores de Instagram**, agrega `@the.squish.box` (y `@thebloomstudio...` para Bloom). Desde la app de Instagram de cada cuenta: Configuración › Apps y sitios web › Invitaciones de evaluador › Aceptar.
4. Las cuentas deben ser **profesionales** (empresa o creador).

Con eso alcanza para Squish y Bloom (acceso estándar, cuentas evaluadoras). Para abrirlo a marcas que no son evaluadoras hace falta la Revisión de la app (permiso `instagram_business_basic`) y la Verificación del negocio.

### 2. Variables (Vercel › Settings › Environment Variables, y `.env` en local)

| Variable | De dónde |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase › Project Settings › API Keys › Secret |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Paso 1.2 |
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
