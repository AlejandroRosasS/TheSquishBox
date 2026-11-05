-- Ventas manuales en la base (antes vivían en el navegador de quien las registraba).
-- Se cargan desde Admin › Ventas (una por una o importando un CSV) y, más adelante, desde el bot de Telegram.
-- items: [{"product": "<slug>", "variant": "<key de la opción>", "name", "variant_label", "qty", "price",
--          "list_price"?, "campaign_id"?, "campaign"?}]  (como los ítems de los pedidos)

alter table public.manual_sales
  add column if not exists client text,
  add column if not exists pay text,
  add column if not exists delivery_in numeric(10,2) not null default 0,
  add column if not exists delivery_out numeric(10,2) not null default 0,
  -- Referencia para no cargar dos veces la misma venta (mismo CSV subido dos veces, o por la web y por el bot).
  add column if not exists ref text,
  add column if not exists source text not null default 'admin',
  add column if not exists created_at timestamptz not null default now();

alter table public.manual_sales drop constraint if exists manual_sales_source;
alter table public.manual_sales add constraint manual_sales_source check (source in ('admin', 'csv', 'telegram'));

create unique index if not exists manual_sales_ref on public.manual_sales (tenant_id, ref);
create index if not exists manual_sales_tenant_sold on public.manual_sales (tenant_id, sold_at desc);
