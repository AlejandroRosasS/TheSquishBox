# Paquete de entrega — The Squish Box (tenant 1 del producto "IG → tienda")

```
squish-handoff/
├── CLAUDE.md            reglas para Claude Code (va a la raíz del repo)
├── SPEC.md              qué construir: rutas, pantallas, admin, fases, pendientes
├── screens/             60 pantallas del canvas (.dc.html) + bloom.css (tokens y componentes)
├── img/                 18 fotos de @the.squish.box (capturas de IG, baja resolución)
└── tenants/squish/      tenant.json (marca, paletas, pagos, entrega) + catalog.json (productos)
```

## Uso con Claude Code

```bash
npx create-next-app@latest tienda-ig --ts --app --eslint --no-tailwind --src-dir
cd tienda-ig
mkdir docs && unzip ~/Downloads/squish-handoff.zip -d /tmp/h && cp -r /tmp/h/squish-handoff/* docs/
mv docs/CLAUDE.md ./CLAUDE.md
claude
```

Primer prompt sugerido:

> Lee CLAUDE.md y docs/SPEC.md. Haz la Fase 1: la tienda pública de The Squish Box (TENANT=squish) con datos de docs/tenants/squish, siguiendo docs/screens (S-Home, S-Catalogo, S-Producto, carrito drawer, S-Carrito, S-Checkout simulado, S-Confirmacion, S-404). Móvil primero. Sin base de datos ni Culqi todavía.

Luego: `npm run dev` → http://localhost:3000

## Ojo
- Los `.dc.html` no se abren bien en el navegador fuera del canvas: son referencia para leer, no páginas listas.
- Los precios son referenciales salvo Mini Box Halloween (S/ 25). Ver `SPEC.md` §5.
