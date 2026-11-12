"use client";

/* eslint-disable @next/next/no-img-element */
import { isContactForm, PARTY_ROUTE } from "@/lib/customOrder";
import { useId, useMemo } from "react";
import type { Seo, SeoPage } from "@/lib/types";
import { asset } from "@/lib/assets";
import { applyTemplate, SEO_LIMITS } from "@/lib/seo";
import { STATUS_LABEL, useDoc } from "@/lib/admin/useDoc";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote, Switch } from "../AdminPage";
import { ImagePicker, type FieldCtx } from "../TextFields";
import { AIAlert } from "../AdminIcons";

function Counted({ label, value, onChange, max, placeholder, long, hint }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; long?: boolean; hint?: string }) {
  const id = useId();
  const n = (value || placeholder || "").length;
  return (
    <div className="a-field">
      <div className="row between g2">
        <label htmlFor={id}>{label}</label>
        <span className={`a-count ${n > max ? "over" : ""}`} aria-live="polite">{n}/{max}</span>
      </div>
      {long ? (
        <textarea id={id} className="a-textarea" rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="a-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {n > max && <span className="a-err">Google suele cortar después de {max} caracteres.</span>}
      {hint && <span className="a-cap">{hint}</span>}
    </div>
  );
}

function Serp({ url, title, description, favicon }: { url: string; title: string; description: string; favicon?: string }) {
  return (
    <div className="serp" aria-label="Vista previa en Google">
      <span className="u"><i>{favicon && <img src={favicon} alt="" />}</i>{url}</span>
      <span className="t">{title}</span>
      <span className="d">{description}</span>
    </div>
  );
}

export function SeoView() {
  const { bundle, toast } = useAdmin();
  const { tenant, catalog } = bundle;
  const doc = useDoc<Seo>("seo", bundle.seo);
  const seo = doc.value;
  const [stLabel, stCls] = STATUS_LABEL[doc.status];
  const set = (patch: Partial<Seo>) => doc.edit((p) => ({ ...p, ...patch }));
  const host = tenant.domain;
  const favicon = tenant.logo.image ? asset(tenant.slug, tenant.logo.image) : undefined;
  const ctx: FieldCtx = useMemo(() => {
    const imgs = new Set<string>([seo.shareImage, bundle.storefront.hero.image, ...catalog.products.flatMap((p) => p.images)].filter(Boolean));
    return { slug: tenant.slug, images: [...imgs], products: [], routesId: "" };
  }, [seo.shareImage, bundle.storefront.hero.image, catalog.products, tenant.slug]);

  const pages: { key: string; name: string; path: string; fallback: SeoPage }[] = [
    { key: "tienda", name: "Tienda (catálogo)", path: "/tienda", fallback: { title: "Tienda", description: "" } },
    // Con el formulario en Contacto no hay página aparte (Contacto toma sus textos de Admin › Textos).
    ...(tenant.customOrder.enabled && !isContactForm(tenant)
      ? [{ key: "fiesta", name: tenant.customOrder.label, path: PARTY_ROUTE, fallback: { title: tenant.customOrder.label, description: tenant.customOrder.description } }]
      : []),
    { key: "carrito", name: "Carrito", path: "/carrito", fallback: { title: "Tu carrito", description: "" } },
  ];
  const setPage = (key: string, patch: Partial<SeoPage>) => set({ pages: { ...seo.pages, [key]: { ...(seo.pages[key] ?? { title: "", description: "" }), ...patch } } });
  const setProduct = (id: string, patch: Partial<SeoPage>) => set({ products: { ...seo.products, [id]: { ...(seo.products[id] ?? {}), ...patch } } });
  const templateOk = seo.titleTemplate.includes("%s");

  return (
    <AdminPage title="SEO" back={{ href: "/admin/ajustes", label: "Ajustes" }} topRight={<span className={`st ${stCls}`}>{stLabel}</span>}>
      <div className="a-head">
        <div className="stack g1">
          <div className="row g3">
            <h1 className="a-h1">SEO y redes</h1>
            <span className={`st ${stCls} only-d`}>{stLabel}</span>
          </div>
          <p className="a-sub">Cómo aparece tu tienda en Google y cuando alguien comparte un link por WhatsApp, Instagram o Facebook.</p>
        </div>
      </div>

      <div className="a-cols">
        <div className="stack g5">
          <section className="a-card" aria-labelledby="seo-gen">
            <h2 className="a-h2" id="seo-gen">Página de inicio</h2>
            <Counted label="Título" value={seo.siteTitle} onChange={(v) => set({ siteTitle: v })} max={SEO_LIMITS.title} hint="Lo que sale en azul en Google y en la pestaña del navegador." />
            <Counted label="Descripción" long value={seo.description} onChange={(v) => set({ description: v })} max={SEO_LIMITS.description} hint="También se usa en las páginas que no tienen descripción propia." />
            <div className="a-field">
              <label htmlFor="seo-tpl">Formato del título en las demás páginas</label>
              <input id="seo-tpl" className="a-input" value={seo.titleTemplate} onChange={(e) => set({ titleTemplate: e.target.value })} aria-invalid={!templateOk || undefined} />
              <span className={templateOk ? "a-cap" : "a-err"}>
                {templateOk ? <>%s es el nombre de cada página. Ej.: «{applyTemplate(seo, "Mystery Squish")}»</> : "Incluye %s donde va el nombre de la página."}
              </span>
            </div>
          </section>

          <section className="a-card" aria-labelledby="seo-share">
            <h2 className="a-h2" id="seo-share">Imagen al compartir</h2>
            <p className="a-cap">Sale cuando compartes el link de la tienda. Los productos usan su primera foto.</p>
            <ImagePicker value={seo.shareImage} onChange={(v) => set({ shareImage: v })} ctx={ctx} />
          </section>

          <section className="a-card flush" aria-labelledby="seo-pages">
            <div className="a-card-h"><h2 className="a-h2" id="seo-pages">Otras páginas</h2></div>
            {pages.map((pg) => {
              const cur = { ...pg.fallback, ...(seo.pages[pg.key] ?? {}) };
              return (
                <details key={pg.key} className="a-details" style={{ padding: "4px 20px", borderBottom: "1px solid var(--a-border)" }}>
                  <summary><span>{pg.name} <span className="a-cap">{pg.path}</span></span></summary>
                  <div className="stack g4" style={{ paddingBottom: 16 }}>
                    <Counted label="Título" value={cur.title} onChange={(v) => setPage(pg.key, { title: v })} max={SEO_LIMITS.title} />
                    <Counted label="Descripción" long value={cur.description} placeholder={seo.description} onChange={(v) => setPage(pg.key, { description: v })} max={SEO_LIMITS.description} hint="Vacía = usa la descripción de inicio." />
                    <Serp url={`${host} › ${pg.path.slice(1)}`} title={applyTemplate(seo, cur.title)} description={cur.description || seo.description} favicon={favicon} />
                  </div>
                </details>
              );
            })}
          </section>

          <section className="a-card flush" aria-labelledby="seo-prod">
            <div className="a-card-h">
              <div className="stack g1"><h2 className="a-h2" id="seo-prod">Productos</h2><p className="a-cap">Por defecto usan el nombre y la descripción del producto. Cámbialos solo si quieres algo distinto para Google.</p></div>
            </div>
            {catalog.products.filter((p) => p.status !== "draft").map((p) => {
              const o = seo.products[p.id] ?? {};
              const title = o.title || p.name;
              const desc = o.description || p.description;
              return (
                <details key={p.id} className="a-details" style={{ padding: "4px 20px", borderBottom: "1px solid var(--a-border)" }}>
                  <summary>
                    <span className="row g3"><span className="av" style={{ width: 40, height: 40 }}><img src={asset(tenant.slug, p.images[0])} alt="" /></span>{p.name}</span>
                    {(o.title || o.description) && <span className="mod">Personalizado</span>}
                  </summary>
                  <div className="stack g4" style={{ paddingBottom: 16 }}>
                    <Counted label="Título" value={o.title ?? ""} placeholder={p.name} onChange={(v) => setProduct(p.id, { title: v })} max={SEO_LIMITS.title} />
                    <Counted label="Descripción" long value={o.description ?? ""} placeholder={p.description} onChange={(v) => setProduct(p.id, { description: v })} max={SEO_LIMITS.description} />
                    <Serp url={`${host} › p › ${p.id}`} title={applyTemplate(seo, title)} description={desc} favicon={favicon} />
                  </div>
                </details>
              );
            })}
          </section>

          <section className="a-card" aria-labelledby="seo-adv">
            <h2 className="a-h2" id="seo-adv">Avanzado</h2>
            <div className="row between g3">
              <div><b>Aparecer en Google</b><p className="a-cap">Si lo apagas, Google no mostrará la tienda.</p></div>
              <Switch on={seo.indexing} onChange={(v) => set({ indexing: v })} label="Aparecer en Google" />
            </div>
            {!seo.indexing && <div className="a-banner warn"><AIAlert size="sm" /><span>Con esto apagado nadie te encontrará en Google.</span></div>}
            <div className="a-field">
              <label htmlFor="seo-gv">Código de verificación de Google Search Console</label>
              <input id="seo-gv" className="a-input" value={seo.googleVerification} placeholder="Ej.: AbC123…" onChange={(e) => set({ googleVerification: e.target.value.trim() })} />
              <span className="a-cap">Pega solo el código del meta tag «google-site-verification». Sirve para ver cómo te encuentran en Google.</span>
            </div>
            <p className="a-cap">Mientras la tienda esté en construcción, el sitio de demo no se indexa aunque esto esté encendido.</p>
          </section>
        </div>

        <div className="stack g5" style={{ position: "sticky", top: 16 }}>
          <section className="a-card" aria-labelledby="seo-g">
            <h2 className="a-h2" id="seo-g">En Google</h2>
            <Serp url={host} title={seo.siteTitle} description={seo.description} favicon={favicon} />
          </section>
          <section className="a-card" aria-labelledby="seo-w">
            <h2 className="a-h2" id="seo-w">Al compartir el link</h2>
            <div className="share">
              <div className="im">{seo.shareImage && <img src={asset(tenant.slug, seo.shareImage)} alt="" />}</div>
              <div className="tx"><span className="h">{host}</span><b>{seo.siteTitle}</b><span>{seo.description}</span></div>
            </div>
          </section>
        </div>
      </div>

      <DemoNote untilDb>Demo (Fase 2): se guarda en este navegador. Google y las redes leen estos datos desde el servidor, así que se activan en vivo cuando conectemos la base de datos (Fase 3).</DemoNote>

      <div className="a-sticky">
        <span className="a-cap">{doc.status === "live" ? "Publicado." : "Los cambios se aplican al publicar."}</span>
        <div className="row g2">
          <button className="a-btn" type="button" disabled={!doc.dirty} onClick={async () => { if (await doc.saveDraft()) toast("Borrador guardado"); }}>Guardar borrador</button>
          <button className="a-btn primary" type="button" disabled={doc.status === "live" || !templateOk} onClick={async () => { if (await doc.publish()) toast("SEO publicado"); }}>Publicar</button>
        </div>
      </div>
    </AdminPage>
  );
}
