-- Reseñas de productos (todas las marcas).
-- Solo reseñan clientes reales: cada reseña entra por un link único (review_requests.token) que el equipo
-- genera desde un pedido web entregado o a mano para un cliente de feria/Instagram. No hay formulario abierto.
-- Toda reseña entra 'pending'; el equipo la aprueba u oculta en Admin › Reseñas. Al público (y a Google)
-- solo llegan las aprobadas.
--
-- Correr UNA vez en Supabase › SQL Editor. Es seguro antes del merge: no cambia nada de lo que ya funciona.

begin;

-- ───────── Pedidos: fecha de entrega y «No pedir reseña» ─────────
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists review_blocked boolean not null default false;

-- delivered_at se marca solo al pasar a 'delivered' (lo usa el correo automático a los 3 días).
-- Los pedidos entregados antes de esta migración quedan sin fecha: no reciben correo automático,
-- pero igual se les puede pedir reseña con el botón de WhatsApp.
create or replace function public.set_order_delivered_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end $$;

drop trigger if exists orders_set_delivered_at on public.orders;
create trigger orders_set_delivered_at before update of status on public.orders
  for each row execute function public.set_order_delivered_at();

-- ───────── Pedidos de reseña (un link por cliente) ─────────
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  order_id uuid references public.orders(id) on delete cascade,   -- null = link generado a mano (feria, Instagram)
  customer jsonb not null default '{}',                            -- nombre, celular, correo
  items jsonb not null default '[]',                               -- [{ "productId": "<uuid>", "name": "…" }]
  whatsapp_at timestamptz,                                         -- el equipo abrió el WhatsApp con el link
  email_at timestamptz,                                            -- salió el correo automático
  submitted_at timestamptz,                                        -- el cliente envió su reseña
  expires_at timestamptz not null default now() + interval '90 days',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists review_requests_order on public.review_requests (order_id) where order_id is not null;
create index if not exists review_requests_tenant on public.review_requests (tenant_id, created_at desc);

-- ───────── Reseñas ─────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid references public.review_requests(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1500),
  author_name text not null check (char_length(author_name) between 1 and 60),  -- como el cliente quiere aparecer
  verified boolean not null default false,                                      -- true = vino de un pedido web
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  reply text check (char_length(reply) <= 1500),                                -- respuesta pública de la marca
  replied_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (request_id, product_id)                                               -- una reseña por producto por link
);
create index if not exists reviews_product on public.reviews (product_id, created_at desc) where status = 'approved';
create index if not exists reviews_tenant on public.reviews (tenant_id, status, created_at desc);

-- Promedio y cantidad por producto. security_invoker: respeta RLS, así el público solo cuenta las aprobadas.
create or replace view public.product_ratings with (security_invoker = true) as
  select tenant_id, product_id, count(*)::integer as review_count, round(avg(rating), 2) as rating_avg
  from public.reviews where status = 'approved'
  group by tenant_id, product_id;

-- ───────── Permisos ─────────
alter table public.review_requests enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "pedidos de reseña: equipo" on public.review_requests;
create policy "pedidos de reseña: equipo" on public.review_requests for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
revoke all on public.review_requests from anon;

drop policy if exists "reseñas: aprobadas son públicas" on public.reviews;
create policy "reseñas: aprobadas son públicas" on public.reviews for select
  using (status = 'approved' or public.is_member(tenant_id));
drop policy if exists "reseñas: equipo modera" on public.reviews;
create policy "reseñas: equipo modera" on public.reviews for update
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
drop policy if exists "reseñas: equipo borra" on public.reviews;
create policy "reseñas: equipo borra" on public.reviews for delete using (public.is_member(tenant_id));
-- Nadie inserta directo: solo submit_review() con un link válido.
revoke insert on public.reviews from anon, authenticated;
-- El público ve solo lo que se muestra en la tienda.
revoke all on public.reviews from anon;
grant select (id, tenant_id, product_id, rating, body, author_name, verified, status, reply, replied_at, created_at)
  on public.reviews to anon;
grant select on public.product_ratings to anon, authenticated;

-- ───────── Alertas: evento «Nueva reseña» ─────────
alter table public.alert_outbox add column if not exists request_id uuid references public.review_requests(id) on delete cascade;
alter table public.alert_outbox drop constraint if exists alert_outbox_event_check;
alter table public.alert_outbox add constraint alert_outbox_event_check
  check (event in ('order_new','party_new','review_new'));

-- Interruptor: notifications.events.review_new (prendido si no existe).
create or replace function public.enqueue_review_alerts(rq public.review_requests)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ch text;
  r jsonb;
begin
  select body into cfg from public.site_docs
    where tenant_id = rq.tenant_id and kind = 'notifications' and stage = 'published';
  if cfg is null or not coalesce((cfg->'events'->>'review_new')::boolean, true) then return; end if;
  foreach ch in array array['telegram','email','whatsapp'] loop
    if coalesce((cfg->'channels'->ch->>'on')::boolean, false)
       and jsonb_typeof(cfg->'channels'->ch->'recipients') = 'array' then
      for r in select * from jsonb_array_elements(cfg->'channels'->ch->'recipients') loop
        if coalesce(r->>'to', '') <> '' then
          insert into public.alert_outbox (tenant_id, order_id, request_id, event, channel, recipient, label)
          values (rq.tenant_id, rq.order_id, rq.id, 'review_new', ch, r->>'to', coalesce(r->>'label', r->>'to'));
        end if;
      end loop;
    end if;
  end loop;
exception when others then
  null; -- Un problema con el aviso nunca debe impedir que la reseña se guarde.
end $$;

-- ───────── Funciones públicas (la página del link) ─────────
-- Lo que necesita la página /resena/<token>: marca, primer nombre del cliente y productos (con los ya reseñados).
create or replace function public.get_review_request(req_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tenant', t.slug,
    'customer', split_part(btrim(coalesce(rq.customer->>'name', '')), ' ', 1),
    'expired', rq.expires_at < now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', i->>'productId',
        'name', i->>'name',
        'done', exists (select 1 from public.reviews v where v.request_id = rq.id and v.product_id::text = i->>'productId')))
      from jsonb_array_elements(rq.items) i), '[]'::jsonb))
  from public.review_requests rq
  join public.tenants t on t.id = rq.tenant_id
  where rq.token = req_token;
$$;

-- p = { "name": "Ana R.", "reviews": [{ "productId": "<uuid>", "rating": 5, "body": "…" }] }
-- Devuelve cuántas reseñas nuevas guardó (las repetidas se ignoran).
create or replace function public.submit_review(req_token text, p jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  rq public.review_requests;
  r jsonb;
  pid uuid;
  stars integer;
  who text := left(btrim(coalesce(p->>'name', '')), 60);
  n integer := 0;
begin
  select * into rq from public.review_requests where token = req_token;
  if rq.id is null or rq.expires_at < now() then raise exception 'link_invalido'; end if;
  if who = '' then raise exception 'falta_nombre'; end if;
  if jsonb_typeof(p->'reviews') is distinct from 'array' then raise exception 'sin_resenas'; end if;

  for r in select * from jsonb_array_elements(p->'reviews') loop
    begin
      pid := (r->>'productId')::uuid;
      stars := (r->>'rating')::integer;
    exception when others then
      continue;
    end;
    if stars between 1 and 5
       and exists (select 1 from jsonb_array_elements(rq.items) i where i->>'productId' = pid::text)
       and exists (select 1 from public.products x where x.id = pid and x.tenant_id = rq.tenant_id) then
      insert into public.reviews (tenant_id, request_id, product_id, rating, body, author_name, verified)
      values (rq.tenant_id, rq.id, pid, stars, nullif(left(btrim(coalesce(r->>'body', '')), 1500), ''), who, rq.order_id is not null)
      on conflict (request_id, product_id) do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;

  if n > 0 then
    update public.review_requests set submitted_at = now() where id = rq.id;
    perform public.enqueue_review_alerts(rq);
  end if;
  return n;
end $$;

revoke all on function public.enqueue_review_alerts(public.review_requests) from public, anon, authenticated;
revoke all on function public.get_review_request(text) from public;
revoke all on function public.submit_review(text, jsonb) from public;
grant execute on function public.get_review_request(text) to anon, authenticated;
grant execute on function public.submit_review(text, jsonb) to anon, authenticated;

commit;
