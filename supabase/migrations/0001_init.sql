-- Esquema inicial multi-marca (Fase 3).
-- Todo cuelga de tenant_id. Lectura pública solo de lo publicado; escritura solo para el equipo de cada marca.

create extension if not exists pgcrypto;

-- ───────────────────────── Marcas ─────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  domains text[] not null default '{}',
  order_seq integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_members m where m.tenant_id = t and m.user_id = auth.uid());
$$;

-- ─────────── Documentos de la tienda (borrador / publicado) ───────────
-- kind: tenant (datos de marca), storefront (textos), seo, appearance (paleta),
--       settings (tarifas, recojo, datos de la tienda), notifications (alertas).
create table public.site_docs (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('tenant','storefront','seo','appearance','settings','notifications')),
  stage text not null check (stage in ('draft','published')),
  body jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, kind, stage)
);

-- ───────────────────────── Catálogo ─────────────────────────
create table public.product_lines (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  name text not null,
  position integer not null default 0,
  primary key (tenant_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  line text,
  badge text,
  status text not null default 'draft' check (status in ('published','sold_out','draft')),
  kind text not null default 'simple' check (kind in ('simple','options')),
  options_label text,                -- pregunta del selector; null = la de los textos de la tienda
  description text not null default '',
  images text[] not null default '{}',
  position integer not null default 0,
  ig_post_id text,
  ig_images text[] not null default '{}',     -- lo último que trajo Instagram
  photos_synced boolean not null default true, -- false = la marca reemplazó las fotos de IG
  extra jsonb not null default '{}',  -- opciones del admin: modo de stock, alerta de stock bajo, SEO…
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  key text not null,
  label text not null,
  price numeric(10,2) not null check (price >= 0),
  price_is_reference boolean not null default false,
  stock integer,  -- null = sin control de stock
  image text,     -- foto opcional de esta opción (una de las fotos del producto)
  position integer not null default 0,
  unique (product_id, key)
);

-- ─────────── Fotos de la marca (subidas o traídas de Instagram) ───────────
create table public.media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  src text not null,                 -- URL pública o ruta
  origin text not null check (origin in ('ig','upload')),
  ig_media_id text,
  width integer,
  height integer,
  alt text not null default '',
  frames jsonb not null default '{}', -- encuadre por formato: {"4:5":{x,y,zoom}, "16:9":{...}}
  created_at timestamptz not null default now()
);
create index media_tenant on public.media (tenant_id, created_at desc);

-- ───────────────────────── Pedidos ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number integer not null,
  -- store = compra en la tienda; party = pedido para fiesta (llega como solicitud y se cotiza). Todo vive en Pedidos.
  kind text not null default 'store' check (kind in ('store','party')),
  status text not null default 'new'
    check (status in ('new','quoted','accepted','preparing','ready','delivered','cancelled')),
  payment_method text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  customer jsonb not null,       -- nombre, celular, correo, comprobante
  delivery jsonb not null,       -- modo, distrito, dirección, referencia, fecha
  items jsonb not null default '[]', -- copia de nombre, variante, precio y cantidad al momento de comprar
  party jsonb,                   -- solo fiestas: cantidad, tamaño, temática, fecha, ideas, fotos de referencia
  proposal text,                 -- solo fiestas: propuesta enviada al cliente
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2),
  delivery_cost numeric(10,2),   -- costo real, lo registra el equipo
  total numeric(10,2) not null default 0,
  gift_message text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index orders_tenant_created on public.orders (tenant_id, created_at desc);

create table public.order_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,            -- created, paid, status, note, alert
  text text not null,
  author uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.manual_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null,
  items jsonb not null,
  total numeric(10,2) not null,
  note text,
  sold_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- ───────────────────────── Permisos (RLS) ─────────────────────────
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.site_docs enable row level security;
alter table public.product_lines enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.manual_sales enable row level security;
alter table public.media enable row level security;

-- Público (tienda)
create policy "tenants: lectura pública" on public.tenants for select using (true);
create policy "docs: publicados son públicos" on public.site_docs for select
  using (stage = 'published' and kind in ('tenant','storefront','seo','appearance') or public.is_member(tenant_id));
create policy "líneas: lectura pública" on public.product_lines for select using (true);
create policy "productos: visibles al público" on public.products for select
  using (status <> 'draft' or public.is_member(tenant_id));
create policy "variantes: lectura pública" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status <> 'draft' or public.is_member(p.tenant_id))));

-- Equipo de la marca
create policy "miembros: ver mi equipo" on public.tenant_members for select using (public.is_member(tenant_id));
create policy "tenants: equipo edita" on public.tenants for update using (public.is_member(id));
create policy "docs: equipo escribe" on public.site_docs for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "líneas: equipo escribe" on public.product_lines for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "productos: equipo escribe" on public.products for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "variantes: equipo escribe" on public.product_variants for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "pedidos: equipo" on public.orders for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "actividad: equipo" on public.order_events for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "media: lectura pública" on public.media for select using (true);
create policy "media: equipo escribe" on public.media for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy "ventas: equipo" on public.manual_sales for all using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- ─────────── Crear pedido desde la tienda (sin login) ───────────
-- Los precios se recalculan aquí desde la base: el navegador solo manda qué y cuánto.
-- p: { items:[{variant_id, qty}], payment_method, customer:{…}, delivery:{mode, district,…}, gift_message }
create or replace function public.place_order(tenant_slug text, p jsonb)
returns table (order_id uuid, order_number integer, order_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
  it jsonb;
  v record;
  q integer;
  lines jsonb := '[]';
  sub numeric := 0;
  fee numeric;
  rates jsonb;
  num integer;
  oid uuid;
begin
  select * into t from public.tenants where slug = tenant_slug;
  if not found then raise exception 'Marca no encontrada'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'El carrito está vacío';
  end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 50 then raise exception 'Cantidad inválida'; end if;
    select pv.id, pv.label, pv.price, pv.stock, pr.name, pr.slug, pr.status
      into v
      from public.product_variants pv join public.products pr on pr.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid and pv.tenant_id = t.id
      for update of pv;
    if not found or v.status <> 'published' then raise exception 'Producto no disponible'; end if;
    if v.stock is not null then
      if v.stock < q then raise exception 'Sin stock suficiente de %', v.name; end if;
      update public.product_variants set stock = stock - q where id = v.id;
    end if;
    sub := sub + v.price * q;
    lines := lines || jsonb_build_object('variant_id', v.id, 'product', v.slug, 'name', v.name,
                                         'variant', v.label, 'price', v.price, 'qty', q);
  end loop;

  if p->'delivery'->>'mode' = 'delivery' then
    select body->'deliveryRates' into rates from public.site_docs
      where tenant_id = t.id and kind = 'settings' and stage = 'published';
    fee := nullif(rates->>(p->'delivery'->>'district'), '')::numeric;
  end if;

  update public.tenants set order_seq = order_seq + 1 where id = t.id returning order_seq into num;

  insert into public.orders (tenant_id, number, payment_method, customer, delivery, items, subtotal, delivery_fee, total, gift_message)
  values (t.id, num, coalesce(p->>'payment_method', 'yape'), coalesce(p->'customer', '{}'), coalesce(p->'delivery', '{}'),
          lines, sub, fee, sub + coalesce(fee, 0), nullif(p->>'gift_message', ''))
  returning id into oid;

  insert into public.order_events (tenant_id, order_id, kind, text) values (t.id, oid, 'created', 'Pedido creado desde la tienda');

  return query select oid, num, sub + coalesce(fee, 0);
end $$;

-- Pedido para fiesta: entra como pedido (kind 'party', estado 'new') sin precio; el equipo lo cotiza en Pedidos.
-- p: { customer:{…}, delivery:{district, date}, party:{qty, size, theme, extras, idea, refs[]} }
create or replace function public.place_party_request(tenant_slug text, p jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare t uuid; num integer; oid uuid;
begin
  select id into t from public.tenants where slug = tenant_slug;
  if t is null then raise exception 'Marca no encontrada'; end if;
  update public.tenants set order_seq = order_seq + 1 where id = t returning order_seq into num;
  insert into public.orders (tenant_id, number, kind, customer, delivery, party)
  values (t, num, 'party', coalesce(p->'customer', '{}'), coalesce(p->'delivery', '{}'), coalesce(p->'party', '{}'))
  returning id into oid;
  insert into public.order_events (tenant_id, order_id, kind, text) values (t, oid, 'created', 'Solicitud de fiesta recibida');
  return num;
end $$;

revoke all on function public.place_order(text, jsonb) from public;
revoke all on function public.place_party_request(text, jsonb) from public;
grant execute on function public.place_order(text, jsonb) to anon, authenticated;
grant execute on function public.place_party_request(text, jsonb) to anon, authenticated;

-- ─────────── Fotos (Storage) ───────────
-- Bucket público "media", una carpeta por marca: media/<tenant_slug>/<uuid>.jpg
create or replace function public.is_member_slug(s text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_members m join public.tenants t on t.id = m.tenant_id
                 where t.slug = s and m.user_id = auth.uid());
$$;

insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;
create policy "media: equipo sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_member_slug((storage.foldername(name))[1]));
create policy "media: equipo actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_member_slug((storage.foldername(name))[1]));
create policy "media: equipo borra" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_member_slug((storage.foldername(name))[1]));
