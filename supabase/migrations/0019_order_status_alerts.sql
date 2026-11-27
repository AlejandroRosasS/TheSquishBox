-- Avisos al equipo cuando un pedido cambia: pago confirmado y cada cambio de estado.
-- Dos estados nuevos entre «Listo» y «Entregado»: «Esperando delivery» (awaiting_courier) y «En tránsito» (in_transit).
-- Más granularidad en Admin › Notificaciones:
--   - events.<evento>            interruptor general («¿Qué nos avisa?»), prendido si no existe.
--   - channels.<canal>.events.<evento>  la tuerca «Configurar» de cada canal, prendido si no existe.
-- Un aviso sale por un canal solo si el canal está activo, el evento está prendido en general y en ese canal.
-- No toca pedidos existentes: sus estados siguen valiendo.

-- ───────── Estados nuevos ─────────
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new','quoted','accepted','preparing','ready','awaiting_courier','in_transit','delivered','cancelled'));

-- ───────── Eventos nuevos en la cola ─────────
alter table public.alert_outbox drop constraint if exists alert_outbox_event_check;
alter table public.alert_outbox add constraint alert_outbox_event_check
  check (event in ('order_new','party_new','review_new','order_paid',
                   'order_preparing','order_ready','order_awaiting_courier','order_in_transit','order_delivered','order_cancelled'));

-- ───────── Programar un aviso (todos los eventos pasan por aquí) ─────────
-- Devuelve cuántos avisos quedaron en cola. Nunca falla: un problema con los avisos no debe frenar el pedido.
create or replace function public.enqueue_alert(p_tenant uuid, p_order uuid, p_request uuid, ev text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ch text;
  r jsonb;
  n integer := 0;
begin
  select body into cfg from public.site_docs
    where tenant_id = p_tenant and kind = 'notifications' and stage = 'published';
  if cfg is null or not coalesce((cfg->'events'->>ev)::boolean, true) then return 0; end if;
  foreach ch in array array['telegram','email','whatsapp'] loop
    if coalesce((cfg->'channels'->ch->>'on')::boolean, false)
       and coalesce((cfg->'channels'->ch->'events'->>ev)::boolean, true)
       and jsonb_typeof(cfg->'channels'->ch->'recipients') = 'array' then
      for r in select * from jsonb_array_elements(cfg->'channels'->ch->'recipients') loop
        if coalesce(r->>'to', '') <> '' then
          insert into public.alert_outbox (tenant_id, order_id, request_id, event, channel, recipient, label)
          values (p_tenant, p_order, p_request, ev, ch, r->>'to', coalesce(r->>'label', r->>'to'));
          n := n + 1;
        end if;
      end loop;
    end if;
  end loop;
  return n;
exception when others then
  return 0;
end $$;

-- Pedido nuevo / mensaje de contacto (redefine 0018 usando enqueue_alert; mismo comportamiento + filtro por canal).
create or replace function public.enqueue_alerts_for(o public.orders)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ev text := case when o.kind = 'party' then 'party_new' else 'order_new' end;
  enabled boolean;
  n integer;
begin
  begin
    select body into cfg from public.site_docs
      where tenant_id = o.tenant_id and kind = 'notifications' and stage = 'published';
    enabled := cfg is null or coalesce((cfg->'events'->>ev)::boolean, true);
    n := public.enqueue_alert(o.tenant_id, o.id, null, ev);
    if n = 0 then
      insert into public.order_events (tenant_id, order_id, kind, text)
      values (o.tenant_id, o.id, 'alert',
              case when not enabled and ev = 'party_new' then 'Sin aviso al equipo: los avisos de mensajes de contacto están apagados'
                   when not enabled then 'Sin aviso al equipo: los avisos de pedidos nuevos están apagados'
                   else 'Sin aviso al equipo: no hay canales de notificación activos para este aviso' end);
    end if;
  exception when others then
    insert into public.order_events (tenant_id, order_id, kind, text)
    values (o.tenant_id, o.id, 'alert', 'No se pudo programar el aviso al equipo: ' || sqlerrm);
  end;
end $$;

-- Reseña nueva (redefine 0017 usando enqueue_alert).
create or replace function public.enqueue_review_alerts(rq public.review_requests)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_alert(rq.tenant_id, rq.order_id, rq.id, 'review_new');
exception when others then
  null;
end $$;

-- ───────── Cambios de un pedido de la tienda ─────────
-- Pago confirmado: Yape/Plin marcado por el equipo. Con tarjeta no: ese pago ya dispara «Nuevo pedido» (0007).
-- Estado: un aviso por cada paso (volver a «Nuevo» al reactivar no avisa).
create or replace function public.enqueue_order_change_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ev text;
begin
  if new.kind <> 'store' then return new; end if;
  begin
    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid'
       and coalesce(new.payment_method, '') <> 'tarjeta' then
      perform public.enqueue_alert(new.tenant_id, new.id, null, 'order_paid');
    end if;
    if new.status is distinct from old.status then
      ev := case new.status
        when 'preparing' then 'order_preparing'
        when 'ready' then 'order_ready'
        when 'awaiting_courier' then 'order_awaiting_courier'
        when 'in_transit' then 'order_in_transit'
        when 'delivered' then 'order_delivered'
        when 'cancelled' then 'order_cancelled'
      end;
      if ev is not null then perform public.enqueue_alert(new.tenant_id, new.id, null, ev); end if;
    end if;
  exception when others then
    null; -- Nunca frenar el cambio del pedido por un aviso.
  end;
  return new;
end $$;

drop trigger if exists orders_enqueue_change_alerts on public.orders;
create trigger orders_enqueue_change_alerts after update of status, payment_status on public.orders
  for each row execute function public.enqueue_order_change_alerts();

revoke all on function public.enqueue_alert(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.enqueue_alerts_for(public.orders) from public, anon, authenticated;
revoke all on function public.enqueue_review_alerts(public.review_requests) from public, anon, authenticated;
revoke all on function public.enqueue_order_change_alerts() from public, anon, authenticated;
