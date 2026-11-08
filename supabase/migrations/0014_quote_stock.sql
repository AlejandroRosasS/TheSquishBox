-- Inventario parte 2b: descontar del stock los insumos de una cotización.
-- Cada salida queda como movimiento kind 'sale' con el quote_id de la cotización, para saber
-- que ya se descontó y poder devolverlo (se borran los movimientos de esa cotización).
-- Correr en Supabase › SQL Editor. Se puede correr más de una vez.

alter table public.inv_movements drop constraint if exists inv_movements_kind_check;
alter table public.inv_movements add constraint inv_movements_kind_check
  check (kind in ('purchase', 'waste', 'adjust', 'use', 'sale'));

alter table public.inv_movements add column if not exists quote_id uuid references public.inv_quotes(id) on delete set null;
create index if not exists inv_movements_quote on public.inv_movements (quote_id) where quote_id is not null;
