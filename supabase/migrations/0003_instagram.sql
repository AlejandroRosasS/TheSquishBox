-- Importación desde Instagram.
-- ig_accounts: la cuenta conectada de cada marca. El token solo lo lee el servidor (service role).
-- ig_posts: la bandeja de posts (Nuevos / En tienda / Contenido / ocultos) con lo sugerido desde el caption.
-- Los borradores de producto son filas de products con status 'draft' e ig_post_id = id del post en Meta.

create table public.ig_accounts (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  picture text,
  access_token text not null,          -- token de 60 días; nunca se manda al navegador
  token_expires_at timestamptz not null,
  status text not null default 'ok' check (status in ('ok','error','disconnected')),
  last_error text,
  last_sync_at timestamptz,
  last_full_sync_at timestamptz,
  connected_at timestamptz not null default now(),
  connected_by uuid references auth.users(id) on delete set null
);

create table public.ig_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ig_media_id text not null,
  media_type text not null,            -- IMAGE, VIDEO, CAROUSEL_ALBUM
  product_type text,                   -- FEED, REELS
  permalink text,
  caption text not null default '',
  taken_at timestamptz,
  ig_children text[] not null default '{}', -- ids de las fotos en Meta (para saber si cambiaron)
  images text[] not null default '{}',      -- copias en nuestro storage (las URLs de Meta vencen)
  -- new = parece producto; content = tips, sorteos, modelos; done = ya es producto; hidden = ocultado de la bandeja
  state text not null default 'new' check (state in ('new','content','done','hidden')),
  suggestion jsonb not null default '{}',   -- nombre, precio, opciones, línea (ver src/lib/instagram/caption.ts)
  product_id uuid references public.products(id) on delete set null,
  deleted_at timestamptz,              -- ya no está en Instagram
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, ig_media_id)
);
create index ig_posts_tenant_taken on public.ig_posts (tenant_id, taken_at desc);
create index products_ig_post on public.products (tenant_id, ig_post_id) where ig_post_id is not null;

alter table public.ig_accounts enable row level security;
alter table public.ig_posts enable row level security;

-- El equipo ve el estado de la conexión, pero no el token.
revoke all on public.ig_accounts from anon, authenticated;
grant select (tenant_id, ig_user_id, username, picture, token_expires_at, status, last_error, last_sync_at, last_full_sync_at, connected_at)
  on public.ig_accounts to authenticated;
create policy "ig: equipo ve su cuenta" on public.ig_accounts for select using (public.is_member(tenant_id));
create policy "ig: equipo desconecta" on public.ig_accounts for delete using (public.is_member(tenant_id));
grant delete on public.ig_accounts to authenticated;

-- La bandeja es privada del equipo. Altas y fotos las hace la sincronización (service role);
-- el equipo solo cambia el estado (ocultar, marcar como contenido) y el vínculo con el producto.
revoke all on public.ig_posts from anon, authenticated;
grant select on public.ig_posts to authenticated;
grant update (state, product_id) on public.ig_posts to authenticated;
create policy "ig: equipo ve sus posts" on public.ig_posts for select using (public.is_member(tenant_id));
create policy "ig: equipo ordena su bandeja" on public.ig_posts for update
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
