-- Inventario (parte 2): recetas por opción de producto, reglas de precio y cotizaciones.
-- Diseño: Claude Doc «Cotizador y stock para The Bloom Studio».

-- Reglas de precio de la marca:
-- {"mode": "margin" | "multiplier", "margin": 50, "multiplier": 3, "rounding": "none" | "sol" | "9" | "10", "igv": false}
alter table public.inv_settings add column if not exists pricing jsonb not null default '{}';

-- Receta de una opción de producto (mismas claves que catalog_private.costs: slug del producto y key de la opción).
-- lines: [{"supply": "<uuid del insumo>", "qty": 12, "optional": "Con florero"?}]
--   optional = parte que el cliente puede pedir o no (se cotiza con y sin).
create table if not exists public.inv_recipes (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product text not null,
  variant text not null,
  lines jsonb not null default '[]',
  extra_cost numeric(10,2) not null default 0 check (extra_cost >= 0),   -- consumibles sin stock (grapas, cinta floral)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, product, variant)
);

-- Cotizaciones a medida (bodas, eventos, pedidos por DM). Guardan el cálculo del momento:
-- el precio de la flor cambia, por eso tienen vigencia.
-- lines: [{"kind": "recipe", "product", "variant", "name", "qty", "optionals": ["Con florero"]}
--         | {"kind": "supply", "supply", "name", "qty"}]
create table if not exists public.inv_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  client text,
  lines jsonb not null default '[]',
  extra_cost numeric(10,2) not null default 0,
  cost numeric(10,2) not null,             -- costo total calculado (insumos + merma + extras)
  suggested numeric(10,2) not null,        -- precio sugerido con las reglas de precio
  price numeric(10,2) not null,            -- precio que se ofrece al cliente
  valid_until date,
  status text not null default 'open' check (status in ('open', 'accepted', 'lost')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists inv_quotes_tenant on public.inv_quotes (tenant_id, created_at desc);

alter table public.inv_recipes enable row level security;
alter table public.inv_quotes enable row level security;
drop policy if exists "inventario: equipo" on public.inv_recipes;
create policy "inventario: equipo" on public.inv_recipes for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
drop policy if exists "inventario: equipo" on public.inv_quotes;
create policy "inventario: equipo" on public.inv_quotes for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
