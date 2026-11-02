-- Alertas de pedidos nuevos al equipo (Telegram, correo, WhatsApp).
-- Los pedidos no se pueden perder: el aviso se programa en la MISMA transacción que crea el pedido
-- (trigger sobre orders), queda en alert_outbox y el servidor lo envía con reintentos hasta lograrlo.
--
-- Configuración por marca: site_docs kind 'notifications', stage 'published' (solo la ve el equipo):
-- { "channels": { "telegram": {"on": true, "recipients": [{"to": "-100123", "label": "Grupo Pedidos"}]},
--                 "email":    {"on": true, "recipients": [{"to": "ana@correo.com", "label": "ana@correo.com"}]},
--                 "whatsapp": {"on": false, "recipients": [{"to": "51999999999", "label": "+51 999 999 999"}]} },
--   "events": { "order_new": true, "party_new": true } }

create table public.alert_outbox (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  event text not null check (event in ('order_new','party_new')),
  channel text not null check (channel in ('telegram','email','whatsapp')),
  recipient text not null,
  label text not null default '',
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index alert_outbox_due on public.alert_outbox (next_attempt_at) where status in ('pending','sending');
create index alert_outbox_tenant on public.alert_outbox (tenant_id, created_at desc);

alter table public.alert_outbox enable row level security;
-- El equipo ve el estado de sus avisos; solo el servidor (clave secreta) los crea y los marca.
create policy "alertas: equipo ve" on public.alert_outbox for select using (public.is_member(tenant_id));
revoke insert, update, delete on public.alert_outbox from anon, authenticated;

-- Códigos para vincular un chat o grupo de Telegram (/start <código>). Solo los usa el servidor.
create table public.telegram_link_codes (
  code text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.telegram_link_codes enable row level security;
revoke all on public.telegram_link_codes from anon, authenticated;

-- ─────────── Programar los avisos al crear un pedido ───────────
create or replace function public.enqueue_order_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ev text := case when new.kind = 'party' then 'party_new' else 'order_new' end;
  ch text;
  r jsonb;
  n integer := 0;
begin
  begin
    select body into cfg from public.site_docs
      where tenant_id = new.tenant_id and kind = 'notifications' and stage = 'published';
    if cfg is not null and coalesce((cfg->'events'->>ev)::boolean, true) then
      foreach ch in array array['telegram','email','whatsapp'] loop
        if coalesce((cfg->'channels'->ch->>'on')::boolean, false)
           and jsonb_typeof(cfg->'channels'->ch->'recipients') = 'array' then
          for r in select * from jsonb_array_elements(cfg->'channels'->ch->'recipients') loop
            if coalesce(r->>'to', '') <> '' then
              insert into public.alert_outbox (tenant_id, order_id, event, channel, recipient, label)
              values (new.tenant_id, new.id, ev, ch, r->>'to', coalesce(r->>'label', r->>'to'));
              n := n + 1;
            end if;
          end loop;
        end if;
      end loop;
    end if;
    if n = 0 then
      insert into public.order_events (tenant_id, order_id, kind, text)
      values (new.tenant_id, new.id, 'alert',
              case when cfg is not null and not coalesce((cfg->'events'->>ev)::boolean, true)
                   then 'Sin aviso al equipo: este tipo de pedido tiene los avisos apagados'
                   else 'Sin aviso al equipo: no hay canales de notificación activos' end);
    end if;
  exception when others then
    -- Un problema con los avisos nunca debe impedir que el pedido se guarde.
    insert into public.order_events (tenant_id, order_id, kind, text)
    values (new.tenant_id, new.id, 'alert', 'No se pudo programar el aviso al equipo: ' || sqlerrm);
  end;
  return new;
end $$;

create trigger orders_enqueue_alerts after insert on public.orders
  for each row execute function public.enqueue_order_alerts();

-- ─────────── El servidor toma los avisos pendientes ───────────
-- Marca hasta `max_rows` avisos como 'sending' y los devuelve. Si el envío se corta a la mitad,
-- vuelven a estar disponibles a los 2 minutos (next_attempt_at), así que ningún aviso queda colgado.
create or replace function public.claim_alerts(max_rows integer default 20)
returns setof public.alert_outbox
language sql security definer set search_path = public as $$
  update public.alert_outbox o
     set status = 'sending', attempts = o.attempts + 1, next_attempt_at = now() + interval '2 minutes'
   where o.id in (
     select id from public.alert_outbox
      where status in ('pending','sending') and next_attempt_at <= now()
      order by next_attempt_at
      limit max_rows
      for update skip locked)
  returning o.*;
$$;

revoke all on function public.claim_alerts(integer) from public, anon, authenticated;
revoke all on function public.enqueue_order_alerts() from public, anon, authenticated;
grant execute on function public.claim_alerts(integer) to service_role;
