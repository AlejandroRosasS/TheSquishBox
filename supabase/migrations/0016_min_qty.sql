-- ─────────── Pedido mínimo por producto ───────────
-- Se edita en Admin › Productos › (producto) › Inventario y se guarda en products.extra->>'minQty'
-- (sin columna nueva). Por defecto 1. Aquí solo se agrega la validación al crear el pedido:
-- cada línea del carrito (una opción) debe pedir al menos ese mínimo.
-- Es la misma place_order de 0008_campaigns.sql con una validación más.

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
