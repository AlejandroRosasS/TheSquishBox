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
import { analyticsIdOf } from "@/lib/analytics";
import { BADGE_POSITIONS, merchantIdOf } from "@/lib/customerReviews";
import { HelpLink } from "../HelpLink";

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
  const gaBad = !!seo.analyticsId && !analyticsIdOf(seo.analyticsId);
  const mcBad = !!seo.merchantId && !merchantIdOf(seo.merchantId);
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
              <div className="a-label-row">
                <label htmlFor="seo-gv">Código de verificación de Google Search Console</label>
                <HelpLink title="Google Search Console" href="https://search.google.com/search-console" hrefLabel="Abrir Search Console">
                  <p>Es una herramienta gratis de Google que te muestra cómo te encuentra la gente: qué búsquedas te traen visitas, qué páginas de tu tienda salen en Google y si hay algún error. Antes de mostrarte esos datos, Google te pide probar que la tienda es tuya, y para eso sirve este código.</p>
                  <ol>
                    <li>Entra a Search Console y agrega tu tienda como «Prefijo de la URL» con tu dirección completa: <code>https://{host}</code>.</li>
                    <li>En los métodos de verificación, elige «Etiqueta HTML».</li>
                    <li>Google te muestra algo como <code>{'<meta name="google-site-verification" content="AbC123…" />'}</code>. Copia solo lo que va entre comillas después de <code>content=</code>.</li>
                    <li>Pégalo aquí, publica y vuelve a Search Console para darle «Verificar».</li>
                  </ol>
                </HelpLink>
              </div>
              <input id="seo-gv" className="a-input" value={seo.googleVerification} placeholder="Ej.: AbC123…" onChange={(e) => set({ googleVerification: e.target.value.trim() })} />
              <span className="a-cap">Pega solo el código del meta tag «google-site-verification». Sirve para ver cómo te encuentran en Google.</span>
            </div>
            <div className="a-field">
              <div className="a-label-row">
                <label htmlFor="seo-ga">ID de medición de Google Analytics</label>
                <HelpLink title="Google Analytics" href="https://analytics.google.com/" hrefLabel="Abrir Google Analytics">
                  <p>Es la herramienta gratis de Google para contar las visitas de tu tienda: cuánta gente entra, desde dónde llega (Instagram, Google, WhatsApp), qué productos mira y cuántos terminan comprando.</p>
                  <ol>
                    <li>Entra a Google Analytics y crea una cuenta y una propiedad para tu tienda, con zona horaria de Perú y moneda en soles.</li>
                    <li>Cuando te pregunte la plataforma, elige «Web» y escribe la dirección de tu tienda.</li>
                    <li>Te va a mostrar el «ID de medición», que empieza con <code>G-</code>. Si ya la tenías creada, está en Administrar › Flujos de datos › tu web.</li>
                    <li>Pégalo aquí y publica. Las primeras visitas aparecen en unas horas.</li>
                  </ol>
                  <p>Al activarlo, la página de Privacidad agrega sola el aviso que pide la ley.</p>
                </HelpLink>
              </div>
              <input id="seo-ga" className="a-input" value={seo.analyticsId ?? ""} placeholder="Ej.: G-AB12CD34EF" autoCapitalize="characters" spellCheck={false} aria-describedby="seo-ga-h" aria-invalid={gaBad || undefined} onChange={(e) => set({ analyticsId: e.target.value.trim().toUpperCase() })} />
              {gaBad && <span className="a-err">El ID empieza con «G-» seguido de letras y números (ej.: G-AB12CD34EF).</span>}
              <span className="a-cap" id="seo-ga-h">Lo encuentras en analytics.google.com › Administrar › Flujos de datos › tu web. Mide visitas, de dónde llegan (Instagram, Google, WhatsApp), productos vistos, carritos, checkouts y pedidos en soles. Vacío = no se carga Analytics. El panel de admin nunca se mide.</span>
            </div>
            <div className="a-field">
              <div className="a-label-row">
                <label htmlFor="seo-mc">ID de Google Merchant Center (Google Customer Reviews)</label>
                <HelpLink title="Google Merchant Center y Customer Reviews" href="https://merchants.google.com/" hrefLabel="Abrir Merchant Center">
                  <p>Merchant Center es donde Google lee los productos de tu tienda para mostrarlos gratis en Google Shopping. Con este número se activa Google Customer Reviews: al terminar una compra, Google le pregunta al cliente si quiere recibir una encuesta por correo. Unos días después de la entrega le pregunta cómo le fue con tu tienda, y con esas respuestas arma tus estrellas de vendedor en Google.</p>
                  <p>Es distinto de las reseñas de productos de Admin › Reseñas: esas son tuyas, las moderas tú y se ven en tu tienda.</p>
                  <ol>
                    <li>Entra a Merchant Center con la cuenta de Google de tu negocio.</li>
                    <li>Busca «Google Customer Reviews» y acepta las condiciones del programa.</li>
                    <li>Copia tu ID: es el número que sale arriba a la derecha, junto al nombre de tu negocio.</li>
                    <li>Pégalo aquí y publica. La página de Privacidad agrega sola el aviso de la encuesta.</li>
                  </ol>
                </HelpLink>
              </div>
              <input id="seo-mc" className="a-input" value={seo.merchantId ?? ""} placeholder="Ej.: 1234567890" inputMode="numeric" spellCheck={false} aria-describedby="seo-mc-h" aria-invalid={mcBad || undefined} onChange={(e) => set({ merchantId: e.target.value.replace(/\D/g, "") })} />
              {mcBad && <span className="a-err">El ID son solo números (lo ves arriba a la derecha en Merchant Center).</span>}
              <span className="a-cap" id="seo-mc-h">Al confirmar un pedido, Google le ofrece al cliente una encuesta por correo después de la entrega. Con esas respuestas arma la calificación de tu tienda en Google Shopping. Es aparte de las reseñas de productos de tu tienda. Vacío = no se muestra. Privacidad agrega sola el aviso.</span>
            </div>
            <div className="a-field">
              <div className="a-label-row">
                <label htmlFor="seo-badge">Insignia de Google Customer Reviews</label>
                <HelpLink title="Insignia de Google Customer Reviews" href="https://support.google.com/merchants/answer/14632921?hl=es-419" hrefLabel="Ver ayuda de Google">
                  <p>Es un sello chiquito de Google que flota en una esquina de tu tienda y muestra tus estrellas de vendedor. Le da confianza a quien todavía no te conoce.</p>
                  <p>Necesita el ID de Merchant Center de arriba. Mientras Google no junte suficientes encuestas, el sello dice «no rating available». Por eso conviene dejarlo en «No mostrar» hasta que veas tus calificaciones en Merchant Center.</p>
                  <p>En celular el sello puede tapar un poco los botones de abajo. Si te pasa, cámbialo al otro lado.</p>
                </HelpLink>
              </div>
              <select id="seo-badge" className="a-select" value={seo.merchantBadge ?? ""} disabled={!merchantIdOf(seo.merchantId)} aria-describedby="seo-badge-h" onChange={(e) => set({ merchantBadge: e.target.value as Seo["merchantBadge"] })}>
                <option value="">No mostrar</option>
                {BADGE_POSITIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="a-cap" id="seo-badge-h">Muestra tu calificación de vendedor en todas las páginas de la tienda. Mientras Google no tenga calificaciones dirá «no rating available»: conviene prenderla cuando ya tengas.</span>
            </div>
            <div className="row between g3">
              <div>
                <div className="a-label-row">
                  <b>Mapa del sitio (sitemap.xml)</b>
                  <HelpLink title="Mapa del sitio (sitemap.xml)" href="https://search.google.com/search-console/sitemaps" hrefLabel="Abrir Sitemaps en Search Console">
                    <p>Es una lista de todas las páginas de tu tienda: portada, catálogo, cada producto publicado, Contacto y páginas legales. A Google le sirve para encontrarlas más rápido, sobre todo los productos nuevos.</p>
                    <p>Se arma sola y se mantiene al día sin que hagas nada. Solo tienes que avisarle a Google una vez:</p>
                    <ol>
                      <li>Primero verifica tu tienda en Search Console (el código de arriba).</li>
                      <li>En Search Console, entra a «Sitemaps».</li>
                      <li>Escribe <code>sitemap.xml</code> y dale «Enviar».</li>
                    </ol>
                  </HelpLink>
                </div>
                <p className="a-cap">Se arma solo con la portada, el catálogo, cada producto publicado, Contacto y las páginas legales. En Search Console, envía <code>sitemap.xml</code> en la sección Sitemaps.</p>
              </div>
              <a className="a-btn sm" href="/sitemap.xml" target="_blank" rel="noreferrer">Ver sitemap</a>
            </div>
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
          <button className="a-btn primary" type="button" disabled={doc.status === "live" || !templateOk || gaBad || mcBad} onClick={async () => { if (await doc.publish()) toast("SEO publicado"); }}>Publicar</button>
        </div>
      </div>
    </AdminPage>
  );
}
