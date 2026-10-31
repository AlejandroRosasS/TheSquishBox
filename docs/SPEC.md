# SPEC — Tienda desde Instagram (multi-marca)

Producto: tomar el Instagram de una marca y convertirlo en una web que vende, con un admin para operar. Una sola base de código y N marcas (tenants). El primer tenant de este paquete es **The Squish Box** (@the.squish.box, Lima). Después se suma **The Bloom Studio**.

La fuente de verdad visual son las pantallas en `screens/`. El catálogo y la marca salen de `tenants/squish/`.

---

## 1. Multi-marca

- Todo lo que cambia entre marcas vive en `tenants/<slug>/`: `tenant.json` (nombre, logo, fuentes, paletas, contacto, pagos, entrega, si tiene "pedido especial") y `catalog.json` (líneas, productos, variantes, modelos, tips).
- Nada específico de una marca va en el código: ni nombres, ni colores, ni copy de producto.
- La tienda resuelve el tenant por dominio en producción y por variable `TENANT=squish` en local.
- Cada tenant tiene 8 tokens de color editables (bg, surface, primary, onPrimary, accent, text, text2, border). Los derivados (hover, soft, line, overlay, focus…) se calculan con `color-mix` como en `screens/bloom.css`.
- El admin tiene una paleta neutra fija (`--a-*`) y NO cambia con la marca.
- El "pedido especial" es configurable por tenant. En Bloom es "A medida" (arreglo personalizado). En Squish es "Para tu fiesta" (cotizar mini box para invitados). Es el mismo flujo con otros campos y otro copy.

## 2. Tienda pública (prioridad: móvil, tráfico desde Instagram)

| Ruta | Pantalla (screens/) | Qué hace |
|---|---|---|
| `/` | S-Home (M-Home = móvil) | Hero, destacados estilo historias de IG, accesos por línea, productos, "¿Qué hay dentro?", modelos que te pueden tocar, squishy tips, banda "Para tu fiesta", footer |
| `/tienda` | S-Catalogo | Grilla con filtro por línea (chips en móvil, sidebar en desktop) y orden |
| `/p/[slug]` | S-Producto / D-Agotado | Galería, selector de variante (2/3 squishies), cantidad, agregar al carrito. Si está agotado: "Avísame cuando vuelva" y CTA al pedido especial |
| `/fiesta` | S-Medida / D-MedidaOK | Formulario del pedido especial → confirmación "Te escribimos por WhatsApp con tu cotización" |
| carrito (drawer) | D-CarritoDrawer, D-CarritoVacio | Se abre al agregar; cambio de variante y cantidad |
| `/carrito` | S-Carrito | Vista completa del carrito |
| `/checkout` | S-Checkout / D-PagoError | Datos, entrega (delivery por distrito o recojo acordado), mensaje de regalo, pago Culqi (tarjeta, Yape). Error de pago con reintento |
| `/pedido/[id]` | S-Confirmacion | Resumen, pasos siguientes, nota de cartilla e intercambio |
| 404 | S-404 | |

Las variantes de la tienda son pantallas completas con dos layouts. Los archivos `M-*` y `D-*` del canvas solo envuelven las `S-*` con props (`mobile`, `agotado`, `enviado`, `error`, `mode`), así que la referencia de contenido son las `S-*`.

## 3. Admin (`/admin`, móvil y desktop)

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Login | A-Login | Acceso del equipo |
| Inicio | A-Inicio | KPIs del día, pedidos por atender, alertas de stock |
| Pedidos | A-Pedidos, A-Pedido | Lista con filtros por estado. El detalle permite cambiar estado, escribir por WhatsApp y cobrar la diferencia de delivery |
| Pedidos para fiestas | A-Solicitudes | Bandeja de pedidos especiales y respuesta con cotización |
| Productos | A-Productos, A-Editor | Productos agrupados por línea con orden configurable; editor de precio, stock por variante y fotos |
| Instagram | A-Importar, A-Borradores | Grilla de posts sincronizada (contenido heredado de IG); convertir un post en producto es MANUAL (precio, stock, línea) |
| Notificaciones | A-Notificaciones | Alertas al equipo en cada venta (WhatsApp / correo) |
| Ajustes | A-Ajustes | Tarifas de delivery por distrito, recojo, pagos, datos de la marca |
| Apariencia | A-Apariencia | Elegir una paleta predefinida o editar los 8 tokens, con chequeo de contraste y vista previa |
| Ventas y márgenes | A-Ventas | Ventas de TODOS los canales (web, Instagram, ferias, otros) con costos y márgenes; ranking por contribución y unidades; filtro por línea; costos fijos de ferias |
| Registrar venta | A-VentaNueva | Carga manual de ventas fuera de la web (feria, DM, otros) |

Estados de pedido: Nuevo → En preparación → Listo → Entregado (también Cancelado). Estados de pago: Pagado, Diferencia pendiente, Devuelto. Estados de producto: Publicado, Borrador, Stock bajo, Agotado.

Flujos clave (ver F-Mapa, F1-Alerta y F2-Tienda en el canvas):
1. Llega una venta web → alerta inmediata al equipo → el equipo prepara el pedido y avanza el estado.
2. Post nuevo en IG → aparece en el admin → el equipo lo convierte en producto → sale publicado en la tienda.

## 4. Fases sugeridas

1. **Tienda con datos fijos**: lee `tenants/squish/*.json`, sin base de datos. Carrito en estado local. Checkout simulado.
2. **Admin con datos de ejemplo**: todas las pantallas navegables.
3. **Datos reales**: base de datos (multi-tenant por `tenant_id`), autenticación del admin, Culqi, alertas e importación desde Instagram.
4. **Segundo tenant**: Bloom, para probar que agregar una marca es solo configuración.

## 5. Pendientes con la marca (no inventar)

- Precios reales (en `catalog.json` hay `priceIsReference: true`; solo Mini Box Halloween es real).
- Dominio, WhatsApp y tarifas de delivery.
- Fotos en alta resolución (las de `img/` son capturas de IG).

## 6. Inventario de pantallas del canvas

| Página | Archivo | Título |
|---|---|---|
| ds | `Main.dc.html` | Design system · Paleta original (fucsia) |
| ds | `DS-Neon.dc.html` | Design system · Paleta Neón |
| tienda | `M-Home.dc.html` | Home · móvil |
| tienda | `M-Catalogo.dc.html` | Catálogo · móvil |
| tienda | `M-Producto.dc.html` | Producto · móvil |
| tienda | `M-Agotado.dc.html` | Producto agotado · móvil |
| tienda | `M-Medida.dc.html` | Para tu fiesta · móvil |
| tienda | `M-MedidaOK.dc.html` | Fiesta: solicitud enviada · móvil |
| tienda | `M-CarritoDrawer.dc.html` | Carrito drawer · móvil |
| tienda | `M-Carrito.dc.html` | Carrito · móvil |
| tienda | `M-CarritoVacio.dc.html` | Carrito vacío · móvil |
| tienda | `M-Checkout.dc.html` | Checkout · móvil |
| tienda | `M-PagoError.dc.html` | Error de pago · móvil |
| tienda | `M-Confirmacion.dc.html` | Confirmación · móvil |
| tienda | `M-404.dc.html` | 404 · móvil |
| tienda | `S-Home.dc.html` | Home · desktop |
| tienda | `S-Catalogo.dc.html` | Catálogo · desktop |
| tienda | `S-Producto.dc.html` | Producto · desktop |
| tienda | `D-Agotado.dc.html` | Producto agotado · desktop |
| tienda | `S-Medida.dc.html` | Para tu fiesta · desktop |
| tienda | `D-MedidaOK.dc.html` | Fiesta: solicitud enviada · desktop |
| tienda | `S-Carrito.dc.html` | Carrito · desktop |
| tienda | `D-CarritoDrawer.dc.html` | Carrito drawer · desktop |
| tienda | `D-CarritoVacio.dc.html` | Carrito vacío · desktop |
| tienda | `S-Checkout.dc.html` | Checkout · desktop |
| tienda | `D-PagoError.dc.html` | Error de pago · desktop |
| tienda | `S-Confirmacion.dc.html` | Confirmación · desktop |
| tienda | `S-404.dc.html` | 404 · desktop |
| admin | `AM-Login.dc.html` | Login · celular |
| admin | `AM-Inicio.dc.html` | Inicio · celular |
| admin | `AM-Pedidos.dc.html` | Pedidos · celular |
| admin | `AM-Pedido.dc.html` | Detalle de pedido · celular |
| admin | `AM-Solicitudes.dc.html` | Pedidos para fiestas · celular |
| admin | `AM-Productos.dc.html` | Productos · celular |
| admin | `AM-Editor.dc.html` | Editor de producto · celular |
| admin | `AM-Importar.dc.html` | Instagram · posts · celular |
| admin | `AM-Borradores.dc.html` | Convertir post en producto · celular |
| admin | `AM-Notificaciones.dc.html` | Notificaciones · celular |
| admin | `AM-Ajustes.dc.html` | Ajustes y tarifas · celular |
| admin | `AM-Apariencia.dc.html` | Apariencia · celular |
| admin | `AM-Ventas.dc.html` | Ventas y márgenes · celular |
| admin | `AM-VentaNueva.dc.html` | Registrar venta · celular |
| admin | `A-Login.dc.html` | Login · desktop |
| admin | `A-Inicio.dc.html` | Inicio · desktop |
| admin | `A-Pedidos.dc.html` | Pedidos · desktop |
| admin | `A-Pedido.dc.html` | Detalle de pedido · desktop |
| admin | `A-Solicitudes.dc.html` | Pedidos para fiestas · desktop |
| admin | `A-Productos.dc.html` | Productos · desktop |
| admin | `A-Editor.dc.html` | Editor de producto · desktop |
| admin | `A-Importar.dc.html` | Instagram · posts · desktop |
| admin | `A-Borradores.dc.html` | Convertir post en producto · desktop |
| admin | `A-Notificaciones.dc.html` | Notificaciones · desktop |
| admin | `A-Ajustes.dc.html` | Ajustes y tarifas · desktop |
| admin | `A-Apariencia.dc.html` | Apariencia · desktop |
| admin | `A-Ventas.dc.html` | Ventas y márgenes · desktop |
| admin | `A-VentaNueva.dc.html` | Registrar venta · desktop |
| flujos | `F-Mapa.dc.html` | Mapa de flujos (empieza aquí) |
| flujos | `F1-Alerta.dc.html` | Flujo 1 · alerta recibida |
| flujos | `F2-TiendaM.dc.html` | Flujo 2 · tienda actualizada (móvil) |
| flujos | `F2-Tienda.dc.html` | Flujo 2 · tienda actualizada (desktop) |