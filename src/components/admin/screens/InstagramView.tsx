"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { asset } from "@/lib/assets";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AICheck, AIChevron, AIPlay, AIRefresh } from "../AdminIcons";
import { Logo } from "@/components/Logo";
import { useIg, type IgAccount } from "./useIg";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { withDefaults } from "@/lib/defaults";
import { newsId, todayLima } from "@/lib/news";
import type { IgPost } from "@/lib/admin/types";
import type { NewsItem, Storefront } from "@/lib/types";

type Tab = "all" | "new" | "done" | "content" | "news";

export function InstagramView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const { posts, st, setSt, live, loading, account, hide, sync: runSync } = useIg();
  const [tab, setTab] = useState<Tab>("all");
  const [syncing, setSyncing] = useState(false);
  const news = useNews();
  const [newsOpen, setNewsOpen] = useState(false);
  const [until, setUntil] = useState("");
  const tabs: [Tab, string][] = [["all", "Todos"], ["new", "Nuevos"], ["done", "En tienda"], ["content", "Contenido"], ["news", "En Novedades"]];
  const inTab = (p: IgPost, k: Tab) => k === "all" || (k === "news" ? news.ids.has(p.id) : p.kind === k);
  const list = posts.filter((p) => inTab(p, tab));
  const sel = st.sel.filter((id) => posts.some((p) => p.id === id && p.kind !== "done"));
  const toggle = (id: string) => setSt((s) => ({ ...s, sel: s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id] }));
  const sync = async () => {
    setSyncing(true);
    const msg = await runSync();
    setSyncing(false);
    toast(msg);
  };
  const synced = live ? ago(account?.phase === "connected" ? account.syncedAt : null) : st.syncedAt ? "hace un momento" : "hace 12 min";
  const hideContent = () => void hide(posts.filter((p) => p.kind === "content" && !st.sel.includes(p.id)).map((p) => p.id));
  const connected = !live || (account?.phase === "connected" && account.status !== "disconnected");

  // Resultado de "Conectar Instagram" (vuelve con ?ig=…).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("ig");
    if (!q) return;
    toast(IG_RESULT[q] ?? "No se pudo conectar Instagram");
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);

  return (
    <AdminPage title="Instagram" topRight={<button className="a-btn sm" type="button" aria-label="Sincronizar ahora" onClick={sync} disabled={syncing}><AIRefresh size="sm" /></button>}>
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Posts de Instagram</h1><p className="a-sub">Llegan solos. Elige cuáles se venden y conviértelos en producto.</p></div></div>
      <section className="a-card">
        {connected ? (
          <div className="ig-acct">
            <span className="ig-ava">{account?.phase === "connected" && account.picture ? <img src={account.picture} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%" }} /> : <Logo tenant={tenant} size="sm" />}</span>
            <div className="grow">
              <b>@{account?.phase === "connected" ? account.username : tenant.instagram}</b>
              <AccountStatus account={account} synced={synced} />
            </div>
            <div className="row g2 wrap-row">
              {account?.phase === "connected" && account.status === "error" && <a className="a-btn" href="/api/instagram/connect">Volver a conectar</a>}
              <button className="a-btn" type="button" onClick={sync} disabled={syncing}><AIRefresh size="sm" />{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>
            </div>
          </div>
        ) : account?.phase === "loading" ? (
          <p className="a-cap">Cargando…</p>
        ) : (
          <div className="ig-acct">
            <span className="ig-ava"><Logo tenant={tenant} size="sm" /></span>
            <div className="grow"><b>Conecta tu Instagram</b><p className="a-cap">Tus posts llegarán solos a esta bandeja. Necesitas una cuenta profesional (de empresa o de creador).</p></div>
            <a className="a-btn primary" href="/api/instagram/connect">Conectar Instagram</a>
          </div>
        )}
      </section>
      <div className="a-scroll-x" role="group" aria-label="Filtrar posts">
        {tabs.map(([k, l]) => (
          <button key={k} className={`a-chip ${tab === k ? "on" : ""}`} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l} <span className="n">{posts.filter((p) => inTab(p, k)).length}</span>
          </button>
        ))}
      </div>
      {loading && <p className="a-cap">Cargando posts…</p>}
      {live && !loading && connected && !posts.length && <p className="a-cap">Todavía no hay posts. Usa «Sincronizar ahora» para traerlos.</p>}
      <div className="ig-grid">
        {list.map((p) => {
          const idx = sel.indexOf(p.id);
          const done = p.kind === "done";
          return (
            <button key={p.id} className={`ig-cell ${idx >= 0 ? "on" : ""} ${done ? "done" : ""}`} type="button" disabled={done} aria-pressed={done ? undefined : idx >= 0}
              aria-label={`${p.name}${done ? ", ya está en la tienda" : idx >= 0 ? ", seleccionado" : ""}`} onClick={() => toggle(p.id)}>
              {p.img ? <img src={asset(tenant.slug, p.img)} alt="" /> : <span className="a-cap">Sin foto</span>}
              {p.reel && <span className="kind"><AIPlay size="sm" /></span>}
              {!done && <span className="sel">{idx >= 0 ? idx + 1 : ""}</span>}
              {p.kind === "new" && idx < 0 && <span className="new-tag">Nuevo</span>}
              {done && <span className="done-tag"><AICheck size="sm" style={{ width: 12, height: 12 }} />En tienda</span>}
              {p.kind === "content" && idx < 0 && <span className="cont-tag">{p.deleted ? "Borrado en IG" : "Contenido"}</span>}
              {news.ids.has(p.id) && <span className="news-tag">Novedad</span>}
            </button>
          );
        })}
      </div>
      <p className="a-cap">Los posts «En tienda» ya son producto: sus fotos y texto se mantienen sincronizados. Los de «Contenido» (modelos, tips, sorteos) puedes <button type="button" className="a-btn sm ghost" style={{ minHeight: 0, padding: 0, textDecoration: "underline", display: "inline" }} onClick={hideContent}>ocultarlos de esta bandeja</button>.</p>
      {newsOpen && sel.length > 0 && (
        <section className="a-card stack g3" aria-labelledby="ig-news-h">
          <div className="stack g1">
            <h2 className="a-h3" id="ig-news-h">Poner en Novedades de Inicio</h2>
            <p className="a-cap">{sel.length === 1 ? "La foto entra" : `Las ${sel.length} fotos entran`} adelante en la tira de Novedades y se publican al toque. Al tocarlas, el cliente va al post en Instagram. Textos, orden y fechas se cambian en <Link href="/admin/textos?seccion=news">Textos › Novedades</Link>.</p>
          </div>
          <div className="a-field">
            <label htmlFor="ig-news-until">Se muestra hasta (opcional)</label>
            <input id="ig-news-until" className="a-input" type="date" style={{ maxWidth: 200 }} min={todayLima()} value={until} onChange={(e) => setUntil(e.target.value)} />
            <span className="a-cap">Ponle fecha a las promos (ej. Black Friday): al terminar ese día dejan de verse solas. Sin fecha, quedan hasta que las quites.</span>
          </div>
          <div className="row g2 wrap-row">
            <button className="a-btn primary" type="button" disabled={news.busy} onClick={async () => {
              const msg = await news.add(posts.filter((p) => sel.includes(p.id)).sort((a, b) => sel.indexOf(a.id) - sel.indexOf(b.id)), until);
              toast(msg);
              if (msg.startsWith("Listo")) { setNewsOpen(false); setUntil(""); setSt((s) => ({ ...s, sel: [] })); }
            }}>{news.busy ? "Publicando…" : "Publicar en Novedades"}</button>
            <button className="a-btn ghost" type="button" onClick={() => setNewsOpen(false)}>Cancelar</button>
          </div>
        </section>
      )}
      {!live && <DemoNote>Demo: estos posts son de ejemplo. Conecta la base de datos para traer los posts reales de Instagram.</DemoNote>}
      <div className="a-sticky">
        <span><b>{sel.length}</b> <span className="a-cap">{sel.length === 1 ? "post seleccionado" : "posts seleccionados"}</span></span>
        <div className="row g2">
          <button className="a-btn ghost sm" type="button" disabled={!sel.length} onClick={() => setSt((s) => ({ ...s, sel: [] }))}>Limpiar</button>
          <button className="a-btn" type="button" disabled={!sel.length || !news.ready} aria-expanded={newsOpen} onClick={() => setNewsOpen(true)}>Poner en Novedades</button>
          {sel.length ? <Link className="a-btn primary" href="/admin/instagram/convertir">Convertir en producto<AIChevron size="sm" /></Link> : <button className="a-btn primary" type="button" disabled>Convertir en producto</button>}
        </div>
      </div>
    </AdminPage>
  );
}

/** Novedades de Inicio (storefront.news): qué posts ya están y cómo agregar más publicando al toque. */
function useNews() {
  const { bundle } = useAdmin();
  const [doc, save, ready] = useStoredDoc<Storefront>("texts");
  const [busy, setBusy] = useState(false);
  const base = bundle.storefront;
  const published = doc.published ? withDefaults(base, doc.published) : base;
  const ids = new Set((published.news?.items ?? []).map((n) => n.igPostId).filter(Boolean) as string[]);

  const add = async (picked: IgPost[], until: string): Promise<string> => {
    const fresh = picked.filter((p) => p.img);
    if (!fresh.length) return "Esos posts no tienen foto";
    const pickedIds = new Set(fresh.map((p) => p.id));
    const items: NewsItem[] = fresh.map((p) => ({
      id: newsId(),
      image: p.img,
      alt: p.name,
      caption: "",
      href: p.permalink ?? "",
      igPostId: p.id,
      ...(p.reel ? { reel: true } : {}),
      ...(until ? { until } : {}),
    }));
    // Si ya estaba, se reemplaza (vuelve adelante con la fecha nueva).
    const put = (sf: Storefront): Storefront => ({ ...sf, news: { ...sf.news, items: [...items, ...(sf.news?.items ?? []).filter((n) => !n.igPostId || !pickedIds.has(n.igPostId))] } });
    setBusy(true);
    try {
      // Se publica directo y, si hay un borrador de Textos, también se suma ahí para no perderla al publicarlo.
      await save({ ...doc, published: put(published), draft: doc.draft ? put(withDefaults(base, doc.draft)) : null });
      return `Listo: ${items.length === 1 ? "1 foto publicada" : `${items.length} fotos publicadas`} en Novedades`;
    } catch (e) {
      return `No se pudo publicar: ${e instanceof Error ? e.message : "error de conexión"}`;
    } finally {
      setBusy(false);
    }
  };

  return { ids, add, busy, ready };
}

const IG_RESULT: Record<string, string> = {
  connected: "Instagram conectado. Ya trajimos tus posts.",
  "sync-error": "Instagram conectado, pero no se pudieron traer los posts. Prueba «Sincronizar ahora».",
  denied: "Cancelaste la conexión con Instagram",
  "not-configured": "Falta configurar la app de Instagram en el servidor",
  "no-access": "Tu usuario no tiene acceso a esta tienda",
  "bad-state": "La conexión expiró. Vuelve a intentarlo.",
};

function ago(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function AccountStatus({ account, synced }: { account: IgAccount | null; synced: string }) {
  if (account?.phase === "connected" && account.status === "error") {
    return <p className="a-cap"><span className="st" style={{ height: 20 }}>Con problemas</span> · {account.error ?? "No se pudo sincronizar"}</p>;
  }
  return <p className="a-cap"><span className="st pagado" style={{ height: 20 }}>Conectada</span> · Última sincronización {synced} · se revisa sola</p>;
}
