"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import type { IgPost } from "@/lib/admin/types";
import type { CaptionSuggestion } from "@/lib/instagram/caption";
import { useAdmin } from "../AdminContext";
import { useDb } from "../DbContext";

type IgState = { sel: string[]; converted: string[]; hidden: string[]; syncedAt?: string };

/** Estado de la cuenta conectada. null = modo demo (sin base de datos). */
export type IgAccount =
  | { phase: "loading" }
  | { phase: "none" }
  | { phase: "connected"; username: string; picture: string | null; status: "ok" | "error" | "disconnected"; error: string | null; syncedAt: string | null };

type PostRow = {
  id: string;
  ig_media_id: string;
  media_type: string;
  product_type: string | null;
  permalink: string | null;
  caption: string;
  images: string[];
  state: "new" | "content" | "done" | "hidden";
  suggestion: Partial<CaptionSuggestion>;
  deleted_at: string | null;
};

function toPost(r: PostRow): IgPost {
  const s = r.suggestion ?? {};
  const vars = s.variants?.length ? s.variants : null;
  return {
    id: r.id,
    mediaId: r.ig_media_id,
    img: r.images[0] ?? "",
    images: r.images,
    kind: r.state === "hidden" ? "content" : r.state,
    name: s.name || r.caption.split("\n")[0].slice(0, 60) || "Post sin texto",
    reel: r.media_type === "VIDEO" || r.product_type === "REELS",
    caption: r.caption,
    variants: vars ? vars.map((v) => v.label) : ["Única"],
    prices: vars ? vars.map((v) => v.price) : [s.price ?? null],
    line: s.line ?? undefined,
    permalink: r.permalink ?? undefined,
    deleted: Boolean(r.deleted_at),
  };
}

/**
 * Bandeja de posts de Instagram.
 * Con la base conectada lee ig_posts (lo que trae la sincronización); sin base usa los posts de ejemplo.
 */
export function useIg() {
  const { bundle, demo } = useAdmin();
  const db = useDb();
  const live = db?.state.phase === "ready" ? { client: db.client, tenantId: db.state.tenantId } : null;
  const [st, setSt] = usePersisted<IgState>(dataKey(bundle.tenant.slug, "ig"), { sel: [], converted: [], hidden: [] });
  const [rows, setRows] = useState<PostRow[] | null>(null);
  const [account, setAccount] = useState<IgAccount>({ phase: "loading" });
  const client = live?.client;
  const tenantId = live?.tenantId;

  const load = useCallback(async () => {
    if (!client || !tenantId) return;
    const [{ data: acct }, { data: posts }] = await Promise.all([
      client.from("ig_accounts").select("username, picture, status, last_error, last_sync_at").eq("tenant_id", tenantId).maybeSingle(),
      client
        .from("ig_posts")
        .select("id, ig_media_id, media_type, product_type, permalink, caption, images, state, suggestion, deleted_at")
        .eq("tenant_id", tenantId)
        .neq("state", "hidden")
        .order("taken_at", { ascending: false })
        .limit(200),
    ]);
    setAccount(acct ? { phase: "connected", username: acct.username, picture: acct.picture, status: acct.status, error: acct.last_error, syncedAt: acct.last_sync_at } : { phase: "none" });
    setRows((posts ?? []) as PostRow[]);
  }, [client, tenantId]);

  useEffect(() => {
    // Primera carga desde la base; los setState ocurren al resolver la consulta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const posts: IgPost[] = useMemo(() => {
    if (client) return (rows ?? []).map(toPost);
    return demo.igPosts.filter((p) => !st.hidden.includes(p.id)).map((p) => (st.converted.includes(p.id) ? { ...p, kind: "done" as const } : p));
  }, [client, rows, demo.igPosts, st.converted, st.hidden]);

  /** Oculta posts de la bandeja (contenido que no se vende). */
  const hide = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      if (client) {
        await client.from("ig_posts").update({ state: "hidden" }).in("id", ids);
        setRows((r) => (r ?? []).filter((x) => !ids.includes(x.id)));
      } else setSt((s) => ({ ...s, hidden: [...s.hidden, ...ids] }));
      setSt((s) => ({ ...s, sel: s.sel.filter((x) => !ids.includes(x)) }));
    },
    [client, setSt],
  );

  /** Marca posts como "En tienda" después de convertirlos en producto. */
  const markConverted = useCallback(
    async (ids: string[]) => {
      if (client) {
        await client.from("ig_posts").update({ state: "done" }).in("id", ids);
        setRows((r) => (r ?? []).map((x) => (ids.includes(x.id) ? { ...x, state: "done" } : x)));
      }
      setSt((s) => ({ ...s, converted: client ? s.converted : [...s.converted, ...ids], sel: s.sel.filter((x) => !ids.includes(x)) }));
    },
    [client, setSt],
  );

  /** "Sincronizar ahora". Devuelve el texto para el aviso. */
  const sync = useCallback(async (): Promise<string> => {
    if (!client) {
      setSt((s) => ({ ...s, syncedAt: new Date().toISOString() }));
      return "Sincronizado: no hay posts nuevos";
    }
    const res = await fetch("/api/instagram/sync", { method: "POST" });
    const r = await res.json().catch(() => ({ ok: false, message: "No se pudo sincronizar" }));
    await load();
    if (!r.ok) return r.message || "No se pudo sincronizar";
    if (r.recent) return "Se acaba de sincronizar";
    return r.added ? `${r.added} ${r.added === 1 ? "post nuevo" : "posts nuevos"}` : "Sincronizado: no hay posts nuevos";
  }, [client, load, setSt]);

  return { posts, st, setSt, live: Boolean(live), loading: Boolean(live) && rows === null, account: live ? account : null, hide, markConverted, sync };
}
