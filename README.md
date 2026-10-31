# Tienda IG — tienda pública multi-marca

Fase 1 del MVP: tienda pública de **The Squish Box** con datos fijos (sin base de datos). Ver `CLAUDE.md` y `docs/SPEC.md`.

## Correr en local

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # debe terminar sin errores
```

Variables (`.env`):

- `TENANT=squish` — marca activa. En producción se resolverá por dominio (Fase 3).
- `NEXT_PUBLIC_DEMO=1` — muestra el selector de paletas abajo a la izquierda (solo demo; en Fase 2 vive en Admin › Apariencia).

## Qué ver

| Ruta | Pantalla |
|---|---|
| `/` | Home |
| `/tienda` (`?linea=cumple`) | Catálogo con filtro por línea y precio, y orden |
| `/p/mini-box-cumple` | Producto con variantes (2 / 3 squishies) |
| `/p/mini-box-halloween` | Producto agotado + "Avísame cuando vuelva" |
| carrito (drawer) | Se abre al agregar o con el ícono de la bolsa |
| `/carrito` | Carrito completo o vacío |
| `/checkout` | Checkout simulado. El código de Yape `000000` muestra el error de pago |
| `/pedido/0001` | Confirmación (el pedido se guarda en el navegador) |
| `/fiesta` | Pedido especial "Para tu fiesta" + confirmación |
| cualquier otra | 404 |

## Cómo está armado

- `src/tenants/<slug>/` — `tenant.json` y `catalog.json` (copiados del handoff) + `storefront.json` (textos e imágenes de la tienda que en los mockups estaban escritos a mano). Registro en `src/tenants/index.ts`.
- `public/tenants/<slug>/img/` — fotos de la marca.
- `src/app/store.css` — `bloom.css` del handoff renombrado a `.store`, sin colores de marca: los 8 tokens, los colores de marca y las fuentes se inyectan desde el tenant (`src/lib/theme.ts`).
- Carrito y pedidos en `localStorage` (Fase 1). Pago simulado: en Fase 3 se conecta Culqi / Yape manual.
- Next.js 16 con Cache Components (por defecto): lo que depende de la URL o de la fecha va dentro de `<Suspense>` o en el cliente.
