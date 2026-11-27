-- ─────────── Tope de unidades por precio de campaña ───────────
-- Opcional, por opción: «solo 20 unidades a S/ 49». Al venderse esas unidades, la opción vuelve
-- sola a su precio regular (o al de otra campaña vigente que tenga cupo), aunque la campaña siga activa.
--
-- price_campaigns.limits: {"<slug del producto>": {"<key de la opción>": 20}}  (mismo formato que prices).
-- Sin número = sin tope (como hasta ahora).
--
-- Cuentan como vendidas a precio de campaña:
--   - las líneas de pedidos de la tienda con esa campaña, salvo pedidos cancelados (cancelar libera las unidades);
--   - las líneas de ventas manuales (Admin › Ventas, CSV, Telegram) con esa campaña.
-- Si un pedido pide más unidades que las que quedan, se parte en dos líneas: las que quedan a precio
-- de oferta y el resto a precio regular.
--
-- Es la misma place_order de 0016_min_qty.sql con el reparto por tope. No toca pedidos ni campañas existentes.

alter table public.price_campaigns add column if not exists limits jsonb not null default '{}';

-- Unidades ya vendidas a precio de una campaña, de una opción.
create or replace function public.campaign_units_sold(camp uuid, product_slug text, variant_key text)
returns integer language sql stable security definer set search_path = public as $$
  with c as (select id, tenant_id, starts_at from public.price_campaigns where id = camp),
  vid as (
    select pv.id::text as id
      from public.product_variants pv join public.products pr on pr.id = pv.product_id, c
     where pv.tenant_id = c.tenant_id and pr.slug = product_slug and pv.key = variant_key
  )
  select (
    coalesce((
      select sum((x->>'qty')::int)
        from public.orders o, c, jsonb_array_elements(o.items) x
       where o.tenant_id = c.tenant_id and o.kind = 'store' and o.status <> 'cancelled'
         and x->>'campaign_id' = c.id::text and x->>'variant_id' in (select id from vid)
    ), 0)
    + coalesce((
      select sum((x->>'qty')::int)
        from public.manual_sales m, c, jsonb_array_elements(m.items) x
       where m.tenant_id = c.tenant_id
         and x->>'campaign_id' = c.id::text and x->>'product' = product_slug and x->>'variant' = variant_key
    ), 0)
  )::int;
$$;
revoke all on function public.campaign_units_sold(uuid, text, text) from public;

-- {"<slug>": {"<key>": unidades que quedan}} solo de las opciones con tope.
create or replace function public.campaign_left(camp uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(p.key, p.left_by_key), '{}'::jsonb)
    from public.price_campaigns c,
         lateral (
           select pr.key, jsonb_object_agg(v.key, greatest(0, (v.value #>> '{}')::numeric::int - public.campaign_units_sold(c.id, pr.key, v.key))) as left_by_key
             from jsonb_each(case when jsonb_typeof(c.limits) = 'object' then c.limits else '{}'::jsonb end) pr,
                  jsonb_each(case when jsonb_typeof(pr.value) = 'object' then pr.value else '{}'::jsonb end) v
            where jsonb_typeof(v.value) = 'number'
            group by pr.key
         ) p
   where c.id = camp;
$$;
revoke all on function public.campaign_left(uuid) from public;

-- Para el admin: vendidas por opción en una campaña (solo el equipo de la marca).
create or replace function public.campaign_sold(camp uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.price_campaigns;
  res jsonb := '{}';
  pr record;
  v record;
begin
  select * into c from public.price_campaigns where id = camp;
  if not found or not public.is_member(c.tenant_id) then return '{}'::jsonb; end if;
  for pr in select key, value from jsonb_each(case when jsonb_typeof(c.prices) = 'object' then c.prices else '{}'::jsonb end) loop
    if jsonb_typeof(pr.value) <> 'object' then continue; end if;
    for v in select key from jsonb_each(pr.value) loop
      res := jsonb_set(res, array[pr.key], coalesce(res->pr.key, '{}'::jsonb), true);
      res := jsonb_set(res, array[pr.key, v.key], to_jsonb(public.campaign_units_sold(c.id, pr.key, v.key)), true);
    end loop;
  end loop;
  return res;
end $$;
revoke all on function public.campaign_sold(uuid) from public;
grant execute on function public.campaign_sold(uuid) to authenticated;

-- Tienda (sin sesión): igual que en 0008, más los topes y lo que queda de cada opción con tope.
create or replace function public.store_campaigns(tenant_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select id from public.tenants where slug = tenant_slug)
  select jsonb_build_object(
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'prices', c.prices,
                                          'limits', c.limits, 'left', public.campaign_left(c.id)) order by c.starts_at)
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

-- Pedido desde la tienda: 0016 + reparto por tope de campaña.
-- La fila de la opción queda bloqueada (for update) mientras se arma el pedido, así dos compras
-- simultáneas de la misma opción no pueden pasarse del tope.
create or replace function public.place_order(tenant_slug text, p jsonb)
returns table (order_id uuid, order_number integer, order_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  t public.tenants;
  it jsonb;
  v record;
  cr record;
  q integer;
  rest integer;
  take integer;
  used uuid[];
  -- Unidades a precio de campaña ya tomadas en ESTE pedido: {"<campaign_id>/<variant_id>": n}
  taken jsonb := '{}';
  tk text;
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
    select pv.id, pv.key, pv.label, pv.price, pv.stock, pr.name, pr.slug, pr.status,
           case when pr.extra->>'minQty' ~ '^[0-9]+$' then greatest(1, (pr.extra->>'minQty')::int) else 1 end as min_qty
      into v
      from public.product_variants pv join public.products pr on pr.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid and pv.tenant_id = t.id
      for update of pv;
    if not found or v.status <> 'published' then raise exception 'Producto no disponible'; end if;
    if q < v.min_qty then raise exception 'El pedido mínimo de % es de % unidades', v.name, v.min_qty; end if;
    if v.stock is not null then
      if v.stock < q then raise exception 'Sin stock suficiente de %', v.name; end if;
      update public.product_variants set stock = stock - q where id = v.id;
    end if;

    -- Reparto: primero la campaña vigente más barata con cupo; si se acaba, la siguiente; el resto a precio regular.
    rest := q;
    used := '{}';
    while rest > 0 loop
      select c.id, c.name, (c.prices -> v.slug ->> v.key)::numeric as price,
             case when jsonb_typeof(c.limits -> v.slug -> v.key) = 'number'
                  then greatest(0, (c.limits -> v.slug ->> v.key)::numeric::int
                                   - public.campaign_units_sold(c.id, v.slug, v.key)
                                   - coalesce((taken ->> (c.id::text || '/' || v.id::text))::int, 0))
             end as avail
        into cr
        from public.price_campaigns c
       where c.tenant_id = t.id and c.starts_at <= now() and c.ends_at > now()
         and jsonb_typeof(c.prices -> v.slug -> v.key) = 'number'
         -- Una «oferta» más cara que el precio regular no se aplica.
         and (c.prices -> v.slug ->> v.key)::numeric < v.price
         and not (c.id = any(used))
       order by (c.prices -> v.slug ->> v.key)::numeric, c.starts_at desc
       limit 1;
      exit when not found;
      used := used || cr.id;
      continue when cr.avail is not null and cr.avail <= 0;
      take := case when cr.avail is null then rest else least(rest, cr.avail) end;
      tk := cr.id::text || '/' || v.id::text;
      taken := taken || jsonb_build_object(tk, coalesce((taken ->> tk)::int, 0) + take);
      sub := sub + cr.price * take;
      lines := lines || jsonb_build_object('variant_id', v.id, 'product', v.slug, 'name', v.name,
                                           'variant', v.label, 'price', cr.price, 'qty', take,
                                           'list_price', v.price, 'campaign_id', cr.id, 'campaign', cr.name);
      rest := rest - take;
    end loop;
    if rest > 0 then
      sub := sub + v.price * rest;
      lines := lines || jsonb_build_object('variant_id', v.id, 'product', v.slug, 'name', v.name,
                                           'variant', v.label, 'price', v.price, 'qty', rest);
    end if;
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
