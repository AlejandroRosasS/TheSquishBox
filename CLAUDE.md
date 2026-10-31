# Reglas del proyecto (para Claude Code)

Contexto: tienda online + admin multi-marca, generada a partir del Instagram de cada marca. Lee `docs/SPEC.md` antes de empezar cualquier tarea.

## Fuente de verdad
- **Diseño:** `docs/screens/*.dc.html` + `docs/screens/bloom.css`. Las pantallas son mockups de un editor de diseño: usa su HTML como referencia de estructura, clases y copy, pero NO copies su runtime (`support.js`, `<x-dc>`, `<dc-import>`, `<sc-for>`, `<sc-if>`, `{{…}}`, `class Component extends DCLogic`). Reimplementa con componentes del framework.
- **Datos:** `docs/tenants/<slug>/tenant.json` y `catalog.json`. Copia `tenants/` a la raíz del proyecto (o a `src/tenants/`) y léelo desde ahí.
- **Imágenes:** `docs/img/` → cópialas a `public/tenants/<slug>/`.

## Reglas
1. Multi-marca desde el día 1: cero strings, colores o precios de una marca en el código. Todo sale del tenant.
2. Estilos: conserva los tokens CSS (`--bg`, `--surface`, `--primary`, `--on-primary`, `--accent`, `--text`, `--text-2`, `--border` + derivados con `color-mix`) y los nombres de componentes de `bloom.css` (puedes renombrar `.bloom` → `.store` y el archivo a `store.css`). Los tokens se inyectan en `:root`/`.store` desde `tenant.json` (paleta activa).
3. El admin usa su propia paleta neutra (`--a-*`) y no cambia con el tenant.
4. Móvil primero: la tienda se diseñó para tráfico desde Instagram. Respeta los breakpoints (760 px y 980 px) que usa `bloom.css`.
5. Accesibilidad como en las pantallas: botones y links reales, labels visibles, foco visible, áreas táctiles ≥ 44 px.
6. Idioma: español de Perú, tuteo. Moneda: `S/ 69.00` (PEN).
7. No inventes datos de negocio. Lo que esté como placeholder (`[dominio por definir]`, `+51 9XX…`, `priceIsReference: true`) se muestra tal cual o queda en configuración.
8. Trabaja por fases (SPEC §4). Al terminar cada fase: `npm run build` sin errores y explica qué ver en `http://localhost:3000`.
9. Antes de cambiar la arquitectura, agregar dependencias pesadas o tocar algo fuera de la fase actual, pregunta.
10. Commits pequeños y descriptivos por pantalla o feature.
