-- ─────────── Usuarios y accesos del panel ───────────
-- Perfiles por marca:
--   owner = Dueño: todo el panel y la gestión de usuarios.
--   admin = Administrador: todo el panel; ve el equipo pero no lo cambia.
--   staff = Ventas: pedidos, productos, inventario, ventas, Instagram y reclamaciones.
--           No edita la tienda (apariencia, textos, SEO) ni la configuración.
-- Invitar, cambiar perfil y quitar acceso se hace desde el servidor (Admin › Usuarios)
-- con la clave secreta; por eso tenant_members no tiene políticas de escritura.

alter table public.tenant_members drop constraint if exists tenant_members_role_check;
alter table public.tenant_members
  add constraint tenant_members_role_check check (role in ('owner', 'admin', 'staff'));
alter table public.tenant_members
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- Perfil de quien pide en una marca (null = no es del equipo).
create or replace function public.member_role(t uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.tenant_members m where m.tenant_id = t and m.user_id = auth.uid();
$$;

-- Dueño o Administrador: puede cambiar la tienda y la configuración.
create or replace function public.is_manager(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_members m
                 where m.tenant_id = t and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.is_manager(uuid) to authenticated;

-- Documentos de la tienda (apariencia, textos, SEO, ajustes, alertas):
-- todo el equipo los lee; solo Dueño y Administrador los cambian.
drop policy if exists "docs: equipo escribe" on public.site_docs;
create policy "docs: equipo lee" on public.site_docs for select using (public.is_member(tenant_id));
create policy "docs: gestores crean" on public.site_docs for insert with check (public.is_manager(tenant_id));
create policy "docs: gestores cambian" on public.site_docs for update using (public.is_manager(tenant_id)) with check (public.is_manager(tenant_id));
create policy "docs: gestores borran" on public.site_docs for delete using (public.is_manager(tenant_id));

-- Los datos de la marca (nombre, dominios) también son de gestores.
drop policy if exists "tenants: equipo edita" on public.tenants;
create policy "tenants: gestores editan" on public.tenants for update using (public.is_manager(id));
