-- Pagos con tarjeta (Culqi). Cada marca cobra con SU cuenta de Culqi: la plataforma nunca toca el dinero.
-- La llave pública la ve la tienda; la llave secreta solo la lee el servidor (service role).

create table public.payment_accounts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('culqi')),
  public_key text not null,
  secret_key text not null,              -- nunca se manda al navegador
  live boolean not null default false,   -- false = llaves de prueba (pk_test / sk_test)
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (tenant_id, provider)
);

alter table public.payment_accounts enable row level security;

-- El equipo ve el estado de la conexión, pero no la llave secreta.
revoke all on public.payment_accounts from anon, authenticated;
grant select (tenant_id, provider, public_key, live, enabled, updated_at) on public.payment_accounts to authenticated;
create policy "pagos: equipo ve su cuenta" on public.payment_accounts for select using (public.is_member(tenant_id));

-- Guardar las llaves desde Admin › Ajustes. Sin llave secreta nueva se conserva la anterior.
create or replace function public.save_culqi_account(tenant_slug text, p_public_key text, p_secret_key text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid; v_live boolean;
begin
  select id into t from public.tenants where slug = tenant_slug;
  if t is null or not public.is_member(t) then raise exception 'Sin acceso'; end if;
  if p_public_key !~ '^pk_(test|live)_[A-Za-z0-9]+$' then raise exception 'La llave pública debe empezar con pk_test_ o pk_live_'; end if;
  v_live := p_public_key like 'pk_live_%';
  if coalesce(p_secret_key, '') <> '' then
    if p_secret_key !~ '^sk_(test|live)_[A-Za-z0-9]+$' then raise exception 'La llave secreta debe empezar con sk_test_ o sk_live_'; end if;
    if (p_secret_key like 'sk_live_%') <> v_live then raise exception 'Las dos llaves deben ser del mismo modo (prueba o producción)'; end if;
    insert into public.payment_accounts (tenant_id, provider, public_key, secret_key, live, enabled, updated_by)
      values (t, 'culqi', p_public_key, p_secret_key, v_live, p_enabled, auth.uid())
      on conflict (tenant_id, provider) do update
        set public_key = excluded.public_key, secret_key = excluded.secret_key, live = excluded.live,
            enabled = excluded.enabled, updated_at = now(), updated_by = excluded.updated_by;
  else
    update public.payment_accounts a
      set public_key = p_public_key, enabled = p_enabled, updated_at = now(), updated_by = auth.uid()
      where a.tenant_id = t and a.provider = 'culqi'
        and (a.secret_key like 'sk_live_%') = v_live;
    if not found then raise exception 'Falta la llave secreta (del mismo modo que la pública)'; end if;
  end if;
end $$;

-- Lo que necesita la tienda: la llave pública, solo si el cobro con tarjeta está activo.
create or replace function public.culqi_public_key(tenant_slug text)
returns text language sql stable security definer set search_path = public as $$
  select a.public_key from public.payment_accounts a join public.tenants t on t.id = a.tenant_id
   where t.slug = tenant_slug and a.provider = 'culqi' and a.enabled;
$$;

revoke all on function public.save_culqi_account(text, text, text, boolean) from public;
revoke all on function public.culqi_public_key(text) from public;
grant execute on function public.save_culqi_account(text, text, text, boolean) to authenticated;
grant execute on function public.culqi_public_key(text) to anon, authenticated;

-- Referencia del cobro en Culqi (chr_…) para conciliar y para el webhook.
alter table public.orders add column payment_ref text;
create unique index orders_payment_ref on public.orders (tenant_id, payment_ref) where payment_ref is not null;
