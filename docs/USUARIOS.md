# Usuarios y accesos del panel

**Admin › Usuarios** muestra quién entra al panel de la marca, con su perfil y si ya aceptó la invitación.

| Perfil | Qué puede hacer |
|---|---|
| Dueño | Todo el panel, más invitar, cambiar perfiles, quitar accesos y mandar enlaces de contraseña |
| Administrador | Todo el panel (tienda, textos, apariencia, ajustes). Ve el equipo, no lo cambia |
| Ventas | Pedidos, productos, inventario, ventas, Instagram y reclamaciones |

La marca siempre tiene al menos un Dueño: el último no se puede quitar ni bajar de perfil.

## Cómo funciona

- **Invitar:** se crea la cuenta y le llega un correo con un enlace a `/admin/clave` para crear su contraseña. También aparece el enlace para copiarlo o mandarlo por WhatsApp. Si la persona ya tiene cuenta (por ejemplo, en otra marca), solo se le da acceso y se le avisa.
- **Reenviar invitación / Enlace de contraseña:** manda un enlace nuevo; el anterior deja de servir.
- **Quitar acceso:** la persona deja de entrar al panel de esta marca al instante. Si nunca usó la invitación, se borra la cuenta.
- **¿Olvidaste tu contraseña?** en la pantalla de ingreso: solo manda correo si la cuenta es del equipo de esa marca (la respuesta en pantalla es la misma siempre).
- **Mi perfil** (abajo en el menú): nombre, cambiar contraseña y cerrar sesión en todos los dispositivos.

Todo lo hace el servidor (`src/app/admin/team-actions.ts`) con `SUPABASE_SECRET_KEY`; la tabla `tenant_members` no se puede escribir desde el navegador.

## Configuración

1. Migración `supabase/migrations/0015_team.sql` (perfiles Administrador y Ventas, y que Ventas no pueda cambiar textos, apariencia ni ajustes).
2. Correos: usan Resend, el mismo de las alertas (`RESEND_API_KEY`, `ALERTS_FROM_EMAIL`). Sin Resend, los manda Supabase con su remitente de prueba, que tiene límite por hora; en ese caso:
   - En Supabase › Authentication › URL Configuration › Redirect URLs agrega `https://demo.thesquishbox.com/admin/clave` y `https://demo.thebloomstudioperu.com/admin/clave` (y los dominios finales cuando se lancen).
3. Opcional: Supabase › Authentication › Email › *Email OTP Expiration* define cuánto dura el enlace (por defecto 1 hora; hasta 24 horas).
