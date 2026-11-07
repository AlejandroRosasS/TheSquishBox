-- Inventario (parte 1): proveedores, insumos y movimientos de stock.
-- Diseño: Claude Doc «Cotizador y stock para The Bloom Studio». Módulo genérico, se activa por marca.
--
-- El stock y el costo promedio ponderado NO se guardan: se calculan repasando los movimientos en orden
-- (src/lib/inventory.ts). Así el historial es la única fuente de verdad y nunca se descuadra.
--   compra:  costo nuevo = (stock × costo actual + monto pagado) / (stock + unidades buenas)
--   resto:   sale o entra al costo promedio vigente y no lo cambia.
-- Todo es solo del equipo de la marca (RLS con is_member); la tienda pública no lee nada de aquí.

create table if not exists public.inv_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.inv_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  origin text not null default 'nacional' check (origin in ('nacional', 'importado')),
  lead_days integer check (lead_days is null or lead_days >= 0),   -- tiempo de entrega en días
  contact text,
  note text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inv_suppliers_tenant on public.inv_suppliers (tenant_id);

create table if not exists public.inv_supplies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text,                         -- texto libre de la marca: «Flor», «Follaje», «Empaque»…
  unit text not null default 'unidad',   -- unidad de uso (la de la receta y del stock): tallo, vara, pliego…
  -- Unidades de compra: [{"name": "paquete", "factor": 25}] → 1 paquete = 25 unidades de uso.
  purchase_units jsonb not null default '[]',
  min_stock numeric(12,3) check (min_stock is null or min_stock >= 0),
  shelf_days integer check (shelf_days is null or shelf_days > 0),       -- vida útil desde la compra
  waste_pct numeric(5,2) check (waste_pct is null or (waste_pct >= 0 and waste_pct < 100)),
  photos jsonb not null default '[]',    -- fotos de la biblioteca de la marca (mismo formato que productos)
  note text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inv_supplies_tenant on public.inv_supplies (tenant_id);

create table if not exists public.inv_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  supply_id uuid not null references public.inv_supplies(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'waste', 'adjust', 'use')),
  qty numeric(12,3) not null,            -- en unidades de uso; + entra, − sale. En compras: unidades buenas.
  amount numeric(12,2),                  -- solo compras: monto total pagado (S/)
  supplier_id uuid references public.inv_suppliers(id) on delete set null,
  purchase_qty numeric(12,3),            -- solo compras: cantidad en la unidad de compra (p. ej. 4)
  purchase_unit text,                    -- solo compras: «paquete»
  bad_qty numeric(12,3),                 -- solo compras: unidades de uso que llegaron malas (merma al recibir)
  receipt text,                          -- foto de la boleta (opcional)
  note text,
  happened_on date not null default ((now() at time zone 'America/Lima')::date),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint inv_movements_purchase check (kind <> 'purchase' or (qty >= 0 and amount is not null and amount >= 0))
);
create index if not exists inv_movements_tenant_day on public.inv_movements (tenant_id, happened_on, created_at);
create index if not exists inv_movements_supply on public.inv_movements (supply_id);

alter table public.inv_settings enable row level security;
alter table public.inv_suppliers enable row level security;
alter table public.inv_supplies enable row level security;
alter table public.inv_movements enable row level security;

drop policy if exists "inventario: equipo" on public.inv_settings;
create policy "inventario: equipo" on public.inv_settings for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
drop policy if exists "inventario: equipo" on public.inv_suppliers;
create policy "inventario: equipo" on public.inv_suppliers for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
drop policy if exists "inventario: equipo" on public.inv_supplies;
create policy "inventario: equipo" on public.inv_supplies for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
drop policy if exists "inventario: equipo" on public.inv_movements;
create policy "inventario: equipo" on public.inv_movements for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
