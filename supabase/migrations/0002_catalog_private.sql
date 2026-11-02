-- Datos internos del catálogo que el público no debe ver: costos por opción y notas de cada línea.
-- Una fila por marca. Solo la lee y escribe el equipo de la marca.
create table public.catalog_private (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  costs jsonb not null default '{}',      -- {"<slug del producto>": {"<key de la opción>": 34}}
  line_notes jsonb not null default '{}', -- {"<id de la línea>": "Todo el año"}
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.catalog_private enable row level security;
create policy "catálogo interno: equipo" on public.catalog_private for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
