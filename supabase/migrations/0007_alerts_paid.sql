-- Ajustes a las alertas (0004) por los cambios de Culqi y de Notificaciones:
-- 1) Pedidos con tarjeta: el pedido se crea ANTES de cobrar. El aviso sale recién cuando el pago queda
--    aprobado (payment_status pasa a 'paid'), así el equipo no recibe avisos de cobros rechazados o abandonados.
-- 2) Ya no hay un interruptor aparte para pedidos especiales: todos siguen el de «Nuevo pedido» (events.order_new).

create or replace function public.enqueue_alerts_for(o public.orders)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ev text := case when o.kind = 'party' then 'party_new' else 'order_new' end;
  ch text;
  r jsonb;
  n integer := 0;
begin
  begin
    select body into cfg from public.site_docs
      where tenant_id = o.tenant_id and kind = 'notifications' and stage = 'published';
    if cfg is not null and coalesce((cfg->'events'->>'order_new')::boolean, true) then
      foreach ch in array array['telegram','email','whatsapp'] loop
        if coalesce((cfg->'channels'->ch->>'on')::boolean, false)
           and jsonb_typeof(cfg->'channels'->ch->'recipients') = 'array' then
          for r in select * from jsonb_array_elements(cfg->'channels'->ch->'recipients') loop
            if coalesce(r->>'to', '') <> '' then
              insert into public.alert_outbox (tenant_id, order_id, event, channel, recipient, label)
              values (o.tenant_id, o.id, ev, ch, r->>'to', coalesce(r->>'label', r->>'to'));
              n := n + 1;
            end if;
          end loop;
        end if;
      end loop;
    end if;
    if n = 0 then
      insert into public.order_events (tenant_id, order_id, kind, text)
      values (o.tenant_id, o.id, 'alert',
              case when cfg is not null and not coalesce((cfg->'events'->>'order_new')::boolean, true)
                   then 'Sin aviso al equipo: los avisos de pedidos nuevos están apagados'
                   else 'Sin aviso al equipo: no hay canales de notificación activos' end);
    end if;
  exception when others then
    -- Un problema con los avisos nunca debe impedir que el pedido se guarde.
    insert into public.order_events (tenant_id, order_id, kind, text)
    values (o.tenant_id, o.id, 'alert', 'No se pudo programar el aviso al equipo: ' || sqlerrm);
  end;
end $$;

-- Al crear el pedido. Tarjeta sin cobrar todavía: se espera al pago.
create or replace function public.enqueue_order_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(new.payment_method, '') = 'tarjeta' and new.payment_status <> 'paid') then
    perform public.enqueue_alerts_for(new);
  end if;
  return new;
end $$;

-- Pago con tarjeta aprobado: una sola vez (solo al pasar a 'paid' y si el pedido aún no tiene avisos).
create or replace function public.enqueue_paid_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.payment_method = 'tarjeta' and new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
     and not exists (select 1 from public.alert_outbox where order_id = new.id) then
    perform public.enqueue_alerts_for(new);
  end if;
  return new;
end $$;

drop trigger if exists orders_enqueue_paid_alerts on public.orders;
create trigger orders_enqueue_paid_alerts after update of payment_status on public.orders
  for each row execute function public.enqueue_paid_alerts();

revoke all on function public.enqueue_alerts_for(public.orders) from public, anon, authenticated;
revoke all on function public.enqueue_paid_alerts() from public, anon, authenticated;
