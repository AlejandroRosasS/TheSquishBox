-- Ventas por Telegram: el equipo le manda al bot un CSV (archivo o texto pegado), el bot responde
-- con un resumen y botones Confirmar/Cancelar. Mientras tanto la importación queda aquí.
-- Solo el servidor (webhook del bot) usa esta tabla.

create table public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chat_id text not null,
  sales jsonb not null,            -- ventas listas para manual_sales (formato de src/lib/sales/csv.ts)
  status text not null default 'pending' check (status in ('pending', 'saved', 'cancelled')),
  created_at timestamptz not null default now()
);
create index sales_imports_created on public.sales_imports (created_at);
alter table public.sales_imports enable row level security;
revoke all on public.sales_imports from anon, authenticated;

-- Con webhook, el bot vincula el chat al recibir /start <código> y deja aquí el nombre del chat
-- para que la pantalla de Notificaciones lo muestre.
alter table public.telegram_link_codes add column if not exists linked_label text;
