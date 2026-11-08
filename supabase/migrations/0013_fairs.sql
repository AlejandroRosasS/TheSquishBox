-- Ferias y eventos: nombre, lugar, fechas (días de Perú, ambos incluidos) y costos fijos (stand, movilidad, etc.).
-- Las ventas manuales con canal «feria» se asignan solas a la feria vigente en su fecha,
-- vengan del admin, de un CSV o del bot de Telegram (lo hace un trigger en la base).
-- Si dos ferias se cruzan, gana la que empezó más tarde.

create table public.fairs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  place text,
  starts_on date not null,
  ends_on date not null,
  -- [{"label": "Stand", "amount": 250}, {"label": "Movilidad", "amount": 50}]
  costs jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint fairs_range check (ends_on >= starts_on)
);
create index fairs_tenant_range on public.fairs (tenant_id, starts_on, ends_on);

alter table public.fairs enable row level security;
create policy "ferias: equipo" on public.fairs for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

alter table public.manual_sales
  add column if not exists fair_id uuid references public.fairs(id) on delete set null;
create index if not exists manual_sales_fair on public.manual_sales (fair_id);

-- Feria vigente de una marca en un momento (día de Perú).
create or replace function public.fair_on(t uuid, at_time timestamptz)
returns uuid language sql stable security definer set search_path = public as $$
  select f.id from public.fairs f
   where f.tenant_id = t
     and (at_time at time zone 'America/Lima')::date between f.starts_on and f.ends_on
   order by f.starts_on desc, f.created_at desc
   limit 1;
$$;
revoke all on function public.fair_on(uuid, timestamptz) from public;

-- Al guardar una venta: si es de feria y no trae feria, se asigna la vigente; si no es de feria, no lleva feria.
create or replace function public.manual_sales_assign_fair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.channel <> 'feria' then
    new.fair_id := null;
  elsif new.fair_id is null
     or (tg_op = 'UPDATE' and new.sold_at is distinct from old.sold_at and new.fair_id is not distinct from old.fair_id) then
    new.fair_id := public.fair_on(new.tenant_id, new.sold_at);
  end if;
  return new;
end $$;

drop trigger if exists manual_sales_assign_fair on public.manual_sales;
create trigger manual_sales_assign_fair
  before insert or update of channel, sold_at, fair_id on public.manual_sales
  for each row execute function public.manual_sales_assign_fair();

-- Al crear una feria o cambiar sus fechas: suelta las ventas que quedaron fuera
-- (se reasignan a otra feria vigente si la hay) y toma las ventas de feria sin asignar de sus días.
create or replace function public.fairs_relink_sales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    update public.manual_sales s set fair_id = null
     where s.fair_id = new.id
       and (s.sold_at at time zone 'America/Lima')::date not between new.starts_on and new.ends_on;
  end if;
  update public.manual_sales s set fair_id = new.id
   where s.tenant_id = new.tenant_id and s.channel = 'feria' and s.fair_id is null
     and (s.sold_at at time zone 'America/Lima')::date between new.starts_on and new.ends_on;
  return null;
end $$;

drop trigger if exists fairs_relink_sales on public.fairs;
create trigger fairs_relink_sales
  after insert or update of starts_on, ends_on on public.fairs
  for each row execute function public.fairs_relink_sales();
