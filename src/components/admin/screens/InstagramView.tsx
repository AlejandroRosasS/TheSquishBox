"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AICheck, AIChevron, AIPlay, AIRefresh } from "../AdminIcons";
import { Logo } from "@/components/Logo";
import { useIg } from "./useIg";

type Tab = "all" | "new" | "done" | "content";

export function InstagramView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const { posts, st, setSt } = useIg();
  const [tab, setTab] = useState<Tab>("all");
  const [syncing, setSyncing] = useState(false);
  const tabs: [Tab, string][] = [["all", "Todos"], ["new", "Nuevos"], ["done", "En tienda"], ["content", "Contenido"]];
  const list = posts.filter((p) => tab === "all" || p.kind === tab);
  const sel = st.sel.filter((id) => posts.some((p) => p.id === id && p.kind !== "done"));
  const toggle = (id: string) => setSt((s) => ({ ...s, sel: s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id] }));
  const sync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setSt((s) => ({ ...s, syncedAt: new Date().toISOString() })); toast("Sincronizado: no hay posts nuevos"); }, 900);
  };
  const synced = st.syncedAt ? "hace un momento" : "hace 12 min";
  const hideContent = () => setSt((s) => ({ ...s, hidden: [...s.hidden, ...posts.filter((p) => p.kind === "content" && !s.sel.includes(p.id)).map((p) => p.id)] }));

  return (
    <AdminPage title="Instagram" topRight={<button className="a-btn sm" type="button" aria-label="Sincronizar ahora" onClick={sync} disabled={syncing}><AIRefresh size="sm" /></button>}>
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Posts de Instagram</h1><p className="a-sub">Llegan solos. Elige cuáles se venden y conviértelos en producto.</p></div></div>
      <section className="a-card">
        <div className="ig-acct">
          <span className="ig-ava"><Logo tenant={tenant} size="sm" /></span>
          <div className="grow"><b>@{tenant.instagram}</b><p className="a-cap"><span className="st pagado" style={{ height: 20 }}>Conectada</span> · Última sincronización {synced} · se revisa cada 15 min</p></div>
          <button className="a-btn" type="button" onClick={sync} disabled={syncing}><AIRefresh size="sm" />{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>
        </div>
      </section>
      <div className="a-scroll-x" role="group" aria-label="Filtrar posts">
        {tabs.map(([k, l]) => (
          <button key={k} className={`a-chip ${tab === k ? "on" : ""}`} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l} <span className="n">{k === "all" ? posts.length : posts.filter((p) => p.kind === k).length}</span>
          </button>
        ))}
      </div>
      <div className="ig-grid">
        {list.map((p) => {
          const idx = sel.indexOf(p.id);
          const done = p.kind === "done";
          return (
            <button key={p.id} className={`ig-cell ${idx >= 0 ? "on" : ""} ${done ? "done" : ""}`} type="button" disabled={done} aria-pressed={done ? undefined : idx >= 0}
              aria-label={`${p.name}${done ? ", ya está en la tienda" : idx >= 0 ? ", seleccionado" : ""}`} onClick={() => toggle(p.id)}>
              <img src={asset(tenant.slug, p.img)} alt="" />
              {p.reel && <span className="kind"><AIPlay size="sm" /></span>}
              {!done && <span className="sel">{idx >= 0 ? idx + 1 : ""}</span>}
              {p.kind === "new" && idx < 0 && <span className="new-tag">Nuevo</span>}
              {done && <span className="done-tag"><AICheck size="sm" style={{ width: 12, height: 12 }} />En tienda</span>}
              {p.kind === "content" && idx < 0 && <span className="cont-tag">Contenido</span>}
            </button>
          );
        })}
      </div>
      <p className="a-cap">Los posts «En tienda» ya son producto: sus fotos y texto se mantienen sincronizados. Los de «Contenido» (modelos, tips, sorteos) puedes <button type="button" className="a-btn sm ghost" style={{ minHeight: 0, padding: 0, textDecoration: "underline", display: "inline" }} onClick={hideContent}>ocultarlos de esta bandeja</button>.</p>
      <DemoNote>Demo: estos posts son de ejemplo. La conexión real con Instagram llega en la Fase 3.</DemoNote>
      <div className="a-sticky">
        <span><b>{sel.length}</b> <span className="a-cap">{sel.length === 1 ? "post seleccionado" : "posts seleccionados"}</span></span>
        <div className="row g2">
          <button className="a-btn ghost sm" type="button" disabled={!sel.length} onClick={() => setSt((s) => ({ ...s, sel: [] }))}>Limpiar</button>
          {sel.length ? <Link className="a-btn primary" href="/admin/instagram/convertir">Convertir en producto<AIChevron size="sm" /></Link> : <button className="a-btn primary" type="button" disabled>Convertir en producto</button>}
        </div>
      </div>
    </AdminPage>
  );
}
