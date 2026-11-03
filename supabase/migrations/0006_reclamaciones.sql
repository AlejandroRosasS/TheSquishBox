-- Libro de reclamaciones virtual (INDECOPI, D. S. 011-2011-PCM y modificatorias).
-- Cada hoja lleva un número correlativo por marca y por año (000001-2026) y guarda una copia
-- de los datos del proveedor tal como estaban al presentarse. Se conserva al menos 2 años.

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  year integer not null,
  number integer not null,
  code text not null,
  kind text not null check (kind in ('reclamo','queja')),
  consumer jsonb not null,          -- {name, docType, docNumber, address, phone, email, guardian}
  item jsonb not null,              -- {type: producto|servicio, description, amount, orderNumber}
  detail text not null,
  request text not null,
  provider jsonb not null,          -- {legalName, ruc, address} al momento de la hoja
  status text not null default 'open' check (status in ('open','answered')),
  response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, year, number)
);
create index complaints_tenant_created on public.complaints (tenant_id, created_at desc);

alter table public.complaints enable row level security;
-- Solo el equipo de la marca ve y responde. El público entra únicamente por la función de abajo.
create policy "reclamos: equipo ve" on public.complaints for select using (public.is_member(tenant_id));
create policy "reclamos: equipo responde" on public.complaints for update using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
grant select on public.complaints to authenticated;
grant update (status, response, responded_at) on public.complaints to authenticated;

-- Registrar una hoja desde la tienda (sin login). Devuelve {id, code, created_at, provider}.
create or replace function public.file_complaint(tenant_slug text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t uuid;
  y integer := extract(year from (now() at time zone 'America/Lima'))::int;
  n integer;
  biz jsonb;
  prov jsonb;
  rec public.complaints;
  c jsonb := coalesce(p->'consumer', '{}');
begin
  select id into t from public.tenants where slug = tenant_slug;
  if t is null then raise exception 'Marca no encontrada'; end if;
  if p->>'kind' not in ('reclamo','queja') then raise exception 'Elige reclamo o queja'; end if;
  if length(trim(coalesce(c->>'name',''))) < 3 or length(trim(coalesce(c->>'docNumber',''))) < 6
     or length(trim(coalesce(c->>'address',''))) < 5 or coalesce(c->>'email','') !~ '^\S+@\S+\.\S+$'
     or length(trim(coalesce(p->>'detail',''))) < 10 or length(trim(coalesce(p->>'request',''))) < 3 then
    raise exception 'Faltan datos obligatorios';
  end if;
  if length(p::text) > 20000 then raise exception 'La hoja es demasiado larga'; end if;

  -- Datos del proveedor: los publicados por la marca; si aún no los publicó, los que muestra la tienda.
  select body->'business' into biz from public.site_docs
    where tenant_id = t and kind = 'storefront' and stage = 'published';
  prov := jsonb_build_object(
    'legalName', coalesce(nullif(biz->>'legalName',''), p->'provider'->>'legalName', ''),
    'ruc',       coalesce(nullif(biz->>'ruc',''),       p->'provider'->>'ruc', ''),
    'address',   coalesce(nullif(biz->>'address',''),   p->'provider'->>'address', ''));

  -- Correlativo sin huecos por marca y año.
  perform pg_advisory_xact_lock(hashtext('complaints:' || t::text || ':' || y));
  select coalesce(max(number), 0) + 1 into n from public.complaints where tenant_id = t and year = y;

  insert into public.complaints (tenant_id, year, number, code, kind, consumer, item, detail, request, provider)
  values (t, y, n, lpad(n::text, 6, '0') || '-' || y, p->>'kind', c, coalesce(p->'item', '{}'),
          trim(p->>'detail'), trim(p->>'request'), prov)
  returning * into rec;

  return jsonb_build_object('id', rec.id, 'code', rec.code, 'created_at', rec.created_at, 'provider', rec.provider);
end $$;

revoke all on function public.file_complaint(text, jsonb) from public;
grant execute on function public.file_complaint(text, jsonb) to anon, authenticated;
