-- Interruptor propio para los mensajes del formulario de Contacto (pedidos kind 'party'):
-- Admin › Notificaciones › «Nuevo mensaje de contacto» (events.party_new). Antes seguían a «Nuevo pedido».
-- Solo redefine enqueue_alerts_for (0007); los triggers no cambian.

create or replace function public.enqueue_alerts_for(o public.orders)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  ev text := case when o.kind = 'party' then 'party_new' else 'order_new' end;
  ch text;
  r jsonb;
  n integer := 0;
  enabled boolean;
begin
  begin
    select body into cfg from public.site_docs
      where tenant_id = o.tenant_id and kind = 'notifications' and stage = 'published';
    enabled := cfg is null or coalesce((cfg->'events'->>ev)::boolean, true);
    if cfg is not null and enabled then
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
              case when not enabled and ev = 'party_new' then 'Sin aviso al equipo: los avisos de mensajes de contacto están apagados'
                   when not enabled then 'Sin aviso al equipo: los avisos de pedidos nuevos están apagados'
                   else 'Sin aviso al equipo: no hay canales de notificación activos' end);
    end if;
  exception when others then
    -- Un problema con los avisos nunca debe impedir que el pedido se guarde.
    insert into public.order_events (tenant_id, order_id, kind, text)
    values (o.tenant_id, o.id, 'alert', 'No se pudo programar el aviso al equipo: ' || sqlerrm);
  end;
end $$;

revoke all on function public.enqueue_alerts_for(public.orders) from public, anon, authenticated;
