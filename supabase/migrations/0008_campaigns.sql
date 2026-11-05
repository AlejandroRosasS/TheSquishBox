-- Campañas de oferta: un nombre, una fecha de inicio y fin, y el precio de oferta de cada opción durante ese rango.
-- La tienda y el checkout usan el precio de la campaña vigente; fuera del rango vuelve el precio regular.
-- Si dos campañas vigentes tienen la misma opción, gana el precio más bajo.
-- Cada línea del pedido guarda el precio regular y la campaña con la que se vendió (para Ventas y márgenes).

create table public.price_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- {"<slug del producto>": {"<key de la opción>": 59}}  (mismo formato que catalog_private.costs)
  prices jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint price_campaigns_range check (ends_at > starts_at)
);
create index price_campaigns_tenant_range on public.price_campaigns (tenant_id, ends_at);

alter table public.price_campaigns enable row level security;
create policy "campañas: equipo" on public.price_campaigns for all
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- Precio de campaña vigente de una opción (null = sin campaña). Devuelve también cuál campaña.
create or replace function public.campaign_price(t uuid, product_slug text, variant_key text, at_time timestamptz default now())
returns table (campaign_id uuid, campaign_name text, price numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, (c.prices -> product_slug ->> variant_key)::numeric
    from public.price_campaigns c
   where c.tenant_id = t and c.starts_at <= at_time and c.ends_at > at_time
     and jsonb_typeof(c.prices -> product_slug -> variant_key) = 'number'
   order by (c.prices -> product_slug ->> variant_key)::numeric, c.starts_at desc
   limit 1;
$$;
revoke all on function public.campaign_price(uuid, text, text, timestamptz) from public;

-- Para la tienda (sin sesión): campañas vigentes y cuándo cambia el próximo precio (para refrescar el caché).
-- No muestra campañas futuras: el público no ve una oferta antes de que empiece.
create or replace function public.store_campaigns(tenant_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select id from public.tenants where slug = tenant_slug)
  select jsonb_build_object(
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'prices', c.prices) order by c.starts_at)
        from public.price_campaigns c, t
       where c.tenant_id = t.id and c.starts_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'next_change', (
      select min(x) from (
        select c.starts_at as x from public.price_campaigns c, t where c.tenant_id = t.id and c.starts_at > now()
        union all
        select c.ends_at from public.price_campaigns c, t where c.tenant_id = t.id and c.ends_at > now()
      ) s)
  );
$$;
revoke all on function public.store_campaigns(text) from public;
grant execute on function public.store_campaigns(text) to anon, authenticated;

-- Pedido desde la tienda: igual que en 0001, pero con el precio de campaña vigente.
-- Cada línea guarda list_price (precio regular), campaign_id y campaign (nombre) cuando aplica una campaña.
create or replace function public.place_order(tenant_slug text, p jsonb)
returns table (order_id uuid, order_number integer, order_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
  it jsonb;
  v record;
  camp_id uuid;
  camp_name text;
  camp_price numeric;
  q integer;
  unit numeric;
  line jsonb;
  lines jsonb := '[]';
  sub numeric := 0;
  fee numeric;
  rates jsonb;
  num integer;
  new_id uuid;
begin
  select * into t from public.tenants where slug = tenant_slug;
  if not found then raise exception 'Marca no encontrada'; end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'El carrito está vacío';
  end if;

  for it in select * from jsonb_array_elements(p->'items') loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 50 then raise exception 'Cantidad inválida'; end if;
    select pv.id, pv.key, pv.label, pv.price, pv.stock, pr.name, pr.slug, pr.status
      into v
      from public.product_variants pv join public.products pr on pr.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid and pv.tenant_id = t.id
      for update of pv;
    if not found or v.status <> 'published' then raise exception 'Producto no disponible'; end if;
    if v.stock is not null then
      if v.stock < q then raise exception 'Sin stock suficiente de %', v.name; end if;
      update public.product_variants set stock = stock - q where id = v.id;
    end if;
    camp_id := null; camp_name := null; camp_price := null;
    select cp.campaign_id, cp.campaign_name, cp.price into camp_id, camp_name, camp_price
      from public.campaign_price(t.id, v.slug, v.key) cp;
    -- Una «oferta» más cara que el precio regular no se aplica.
    if camp_price is null or camp_price >= v.price then camp_id := null; camp_price := null; end if;
    unit := coalesce(camp_price, v.price);
    sub := sub + unit * q;
    line := jsonb_build_object('variant_id', v.id, 'product', v.slug, 'name', v.name,
                               'variant', v.label, 'price', unit, 'qty', q);
    if camp_id is not null then
      line := line || jsonb_build_object('list_price', v.price, 'campaign_id', camp_id, 'campaign', camp_name);
    end if;
    lines := lines || line;
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
  returning id into new_id;

  insert into public.order_events (tenant_id, order_id, kind, text) values (t.id, new_id, 'created', 'Pedido creado desde la tienda');

  return query select new_id, num, sub + coalesce(fee, 0);
end $$;
