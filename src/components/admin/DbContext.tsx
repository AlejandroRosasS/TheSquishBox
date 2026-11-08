"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { dbConfigured } from "@/lib/db/env";
import { browserClient } from "@/lib/db/browser";
import type { Doc } from "@/lib/admin/storage";
import { refreshStore } from "@/app/admin/actions";
import { isRole, type Role } from "@/lib/team/roles";

/** Documentos editables del admin y su tipo en la base (`site_docs.kind`). */
export const DOC_KINDS = { appearance: "appearance", texts: "storefront", seo: "seo" } as const;
export type DocName = keyof typeof DOC_KINDS;

type Row = { kind: string; stage: "draft" | "published"; body: unknown; updated_at: string };

type State =
  | { phase: "loading" }
  | { phase: "signed-out" }
  | { phase: "no-access"; user: User }
  | { phase: "error"; message: string }
  | { phase: "ready"; user: User; tenantId: string; role: Role; docs: Partial<Record<DocName, Doc<unknown>>> };

type Ctx = {
  client: SupabaseClient;
  state: State;
  setDoc: (name: DocName, next: Doc<unknown>) => Promise<void>;
  signOut: () => Promise<void>;
};

const DbCtx = createContext<Ctx | null>(null);

/** null = modo demo (sin Supabase): el admin guarda en el navegador. */
export function useDb(): Ctx | null {
  return useContext(DbCtx);
}

function toDocs(rows: Row[]): Partial<Record<DocName, Doc<unknown>>> {
  const docs: Partial<Record<DocName, Doc<unknown>>> = {};
  for (const [name, kind] of Object.entries(DOC_KINDS) as [DocName, string][]) {
    const draft = rows.find((r) => r.kind === kind && r.stage === "draft");
    const pub = rows.find((r) => r.kind === kind && r.stage === "published");
    docs[name] = {
      draft: draft?.body ?? null,
      published: pub?.body ?? null,
      savedAt: draft?.updated_at,
      publishedAt: pub?.updated_at,
    };
  }
  return docs;
}

export function DbProvider({ slug, children }: { slug: string; children: ReactNode }) {
  if (!dbConfigured()) return <>{children}</>;
  return <DbProviderInner slug={slug}>{children}</DbProviderInner>;
}

function DbProviderInner({ slug, children }: { slug: string; children: ReactNode }) {
  const client = useMemo(() => browserClient(), []);
  const [state, setState] = useState<State>({ phase: "loading" });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(
    async (user: User | null) => {
      if (!user) return setState({ phase: "signed-out" });
      const { data: t, error } = await client.from("tenants").select("id").eq("slug", slug).maybeSingle();
      if (error) return setState({ phase: "error", message: error.message });
      if (!t) return setState({ phase: "error", message: `La marca «${slug}» no está cargada en la base de datos.` });
      const { data: member } = await client.from("tenant_members").select("role").eq("tenant_id", t.id).eq("user_id", user.id).maybeSingle();
      if (!member) return setState({ phase: "no-access", user });
      const role: Role = isRole(member.role) ? member.role : "staff";
      const { data: rows, error: e2 } = await client
        .from("site_docs")
        .select("kind, stage, body, updated_at")
        .eq("tenant_id", t.id)
        .in("kind", Object.values(DOC_KINDS));
      if (e2) return setState({ phase: "error", message: e2.message });
      setState({ phase: "ready", user, tenantId: t.id, role, docs: toDocs((rows ?? []) as Row[]) });
    },
    [client, slug],
  );

  useEffect(() => {
    let current: string | null | undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (id === current) {
        // Mismo usuario (por ejemplo, cambió su nombre): se actualizan sus datos sin recargar el panel.
        if (session && _event === "USER_UPDATED") setState((s) => (s.phase === "ready" ? { ...s, user: session.user } : s));
        return;
      }
      current = id;
      // Fuera del callback: Supabase recomienda no llamar a la base dentro de él.
      setTimeout(() => void load(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [client, load]);

  const setDoc = useCallback(
    async (name: DocName, next: Doc<unknown>) => {
      const s = stateRef.current;
      if (s.phase !== "ready") throw new Error("Sin sesión");
      const prev = s.docs[name] ?? { draft: null, published: null };
      const kind = DOC_KINDS[name];
      const now = new Date().toISOString();
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

      if (!same(prev.published, next.published) && next.published !== null) {
        const { error } = await client
          .from("site_docs")
          .upsert({ tenant_id: s.tenantId, kind, stage: "published", body: next.published, updated_at: now, updated_by: s.user.id });
        if (error) throw new Error(error.message);
      }
      if (!same(prev.draft, next.draft)) {
        const q = client.from("site_docs");
        const { error } =
          next.draft === null
            ? await q.delete().match({ tenant_id: s.tenantId, kind, stage: "draft" })
            : await q.upsert({ tenant_id: s.tenantId, kind, stage: "draft", body: next.draft, updated_at: now, updated_by: s.user.id });
        if (error) throw new Error(error.message);
      }
      setState({
        ...s,
        docs: {
          ...s.docs,
          [name]: {
            ...next,
            savedAt: next.draft ? now : undefined,
            publishedAt: same(prev.published, next.published) ? prev.publishedAt : now,
          },
        },
      });
      if (!same(prev.published, next.published)) await refreshStore();
    },
    [client],
  );

  const signOut = useCallback(async () => {
    await client.auth.signOut();
  }, [client]);

  const value = useMemo(() => ({ client, state, setDoc, signOut }), [client, state, setDoc, signOut]);
  return <DbCtx.Provider value={value}>{children}</DbCtx.Provider>;
}
