"use client";

import { useMemo, useState } from "react";
import type { Storefront } from "@/lib/types";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { STATUS_LABEL, useDoc } from "@/lib/admin/useDoc";
import { TEXT_SECTIONS, itemLabelFor, labelFor } from "@/lib/admin/textSchema";
import { TOKEN_KEYS, type Tokens } from "@/lib/publishedTheme";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { FieldEditor, type FieldCtx, type Json } from "../TextFields";
import { StorePreview } from "../StorePreview";
import { previewPage } from "../PreviewPage";
import type { PreviewFocus } from "../previewFocus";
import { AIUndo } from "../AdminIcons";
import { COMPLAINTS_ROUTE, CONTACT_ROUTE, LEGAL_ROUTES } from "@/lib/legal";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const getIn = (obj: unknown, path: string[]): unknown =>
  path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), obj);

/** Para un elemento de lista (un círculo, un acceso…), el texto que mejor lo ubica en la tienda. */
function representative(v: unknown): { key: string; value: string } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  for (const k of ["title", "label", "name", "text", "eyebrow", "image"]) if (typeof o[k] === "string" && o[k]) return { key: k, value: o[k] as string };
  return null;
}

/** «Círculo 3 › Texto» a partir de "highlights.2.label". */
function pathLabel(parts: string[]): string {
  if (parts.length === 1) return labelFor(parts[0]);
  const out: string[] = [];
  parts.forEach((p, i) => {
    if (i === 0) return;
    if (/^\d+$/.test(p)) out.push(`${itemLabelFor(parts[i - 1])} ${Number(p) + 1}`);
    else if (!/^\d+$/.test(parts[i + 1] ?? "")) out.push(labelFor(p));
  });
  return out.join(" › ");
}

/** Recolecta las fotos que ya usa la marca (tienda + catálogo + Instagram) para elegir. */
function collectImages(...sources: unknown[]): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^img\/.+\.(jpe?g|png|webp)$/i.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...out].filter((x) => !/logo\./.test(x));
}

export function TextsView() {
  const { bundle, demo, toast } = useAdmin();
  const { tenant, catalog } = bundle;
  const doc = useDoc<Storefront>("texts", bundle.storefront);
  const [appearance] = useStoredDoc<{ tokens: Tokens }>("appearance");
  const sections = TEXT_SECTIONS.filter((s) => !s.needsCustomOrder || tenant.customOrder.enabled);
  const [secId, setSecIdRaw] = useState(sections[1]?.id ?? sections[0].id);
  /** Campo con foco en el editor (ej. "tiles.1.title"): la vista previa lo resalta. */
  const [fieldPath, setFieldPath] = useState<string | null>(null);
  const setSecId = (id: string) => { setSecIdRaw(id); setFieldPath(null); };
  const [mode, setMode] = useState<"m" | "d">("m");
  const sec = sections.find((s) => s.id === secId) ?? sections[0];
  const sf = doc.value;
  const [stLabel, stCls] = STATUS_LABEL[doc.status];

  const ctx: FieldCtx = useMemo(
    () => ({
      slug: tenant.slug,
      images: collectImages(bundle.storefront, catalog, demo.igPosts),
      products: catalog.products.map((p) => ({ id: p.id, name: p.name })),
      routesId: "tx-routes",
    }),
    [tenant.slug, bundle.storefront, catalog, demo.igPosts],
  );
  const routes = useMemo(
    () => [
      "/",
      "/tienda",
      ...catalog.lines.map((l) => `/tienda?linea=${l.id}`),
      ...catalog.products.map((p) => `/p/${p.id}`),
      ...(tenant.customOrder.enabled ? ["/fiesta"] : []),
      "/carrito",
      ...Object.values(LEGAL_ROUTES),
      CONTACT_ROUTE,
      COMPLAINTS_ROUTE,
      "#modelos",
      "#tips",
    ],
    [catalog, tenant.customOrder.enabled],
  );

  const changedFromPublished = (keys: (keyof Storefront)[]) => keys.some((k) => !same(sf[k], doc.published[k]));
  const changedFromOriginal = (keys: (keyof Storefront)[]) => keys.some((k) => !same(sf[k], bundle.storefront[k]));
  const setKey = (k: keyof Storefront, v: Json) => doc.edit((prev) => ({ ...prev, [k]: v }));
  const restoreSection = () => doc.edit((prev) => ({ ...prev, ...Object.fromEntries(sec.keys.map((k) => [k, bundle.storefront[k]])) }));

  const ap = appearance.draft ?? appearance.published;
  const tokens = ap?.tokens && TOKEN_KEYS.every((k) => ap.tokens[k]) ? ap.tokens : undefined;
  const previewBundle = useMemo(() => ({ ...bundle, storefront: sf }), [bundle, sf]);
  const page = previewPage(sec.id, fieldPath, previewBundle);
  const focus: PreviewFocus = (() => {
    const parts = fieldPath?.split(".") ?? [];
    const raw = parts.length ? getIn(sf, parts) : undefined;
    const rep = typeof raw === "string" ? { key: parts[parts.length - 1], value: raw } : representative(raw);
    return {
      id: `${sec.id}|${fieldPath ?? ""}`,
      scope: page.scope,
      key: rep?.key,
      value: rep?.value,
      label: parts.length ? `Editando: ${pathLabel(parts)}` : sec.title,
    };
  })();

  return (
    <AdminPage title="Textos" back={{ href: "/admin/ajustes", label: "Ajustes" }} topRight={<span className={`st ${stCls}`}>{stLabel}</span>}>
      <div className="a-head">
        <div className="stack g1">
          <div className="row g3">
            <h1 className="a-h1">Textos de la tienda</h1>
            <span className={`st ${stCls} only-d`}>{stLabel}</span>
          </div>
          <p className="a-sub">Cambia cualquier texto, botón, enlace o foto de la tienda. Los nombres, precios y descripciones de productos se editan en Productos.</p>
        </div>
        <button className="a-btn" type="button" disabled={!changedFromOriginal(sec.keys)} onClick={restoreSection}>
          <AIUndo size="sm" /> Restaurar «{sec.title}»
        </button>
      </div>

      <datalist id="tx-routes">
        {routes.map((r) => <option key={r} value={r} />)}
      </datalist>

      <div className="tx-layout">
        <nav className="tx-nav" aria-label="Secciones de la tienda">
          {sections.map((s) => (
            <button key={s.id} type="button" className={s.id === sec.id ? "on" : ""} aria-current={s.id === sec.id ? "true" : undefined} onClick={() => setSecId(s.id)}>
              <span>{s.title}</span>
              {changedFromPublished(s.keys) && <span className="dot" aria-label="con cambios sin publicar" role="img" />}
            </button>
          ))}
        </nav>

        <section
          className="a-card"
          aria-labelledby="tx-sec"
          onFocusCapture={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>("[data-path]");
            if (el?.dataset.path) setFieldPath(el.dataset.path);
          }}
        >
          <div className="stack g1">
            <h2 className="a-h2" id="tx-sec">{sec.title}</h2>
            <p className="a-cap">Se ve en: {sec.where}</p>
            {sec.note && <p className="tx-hint">{sec.note}</p>}
          </div>
          {sec.keys.map((k) => (
            <FieldEditor key={k} k={k} value={sf[k] as unknown as Json} ctx={ctx} depth={sec.keys.length > 1 ? 1 : 0} onChange={(v) => setKey(k, v)} />
          ))}
        </section>

        <section className="a-card tx-prev" aria-labelledby="tx-prev">
          <div className="a-card-h">
            <h2 className="a-h2" id="tx-prev">Vista previa</h2>
            <div className="a-seg" role="group" aria-label="Tamaño de la vista previa">
              <button className={mode === "m" ? "on" : ""} type="button" aria-pressed={mode === "m"} onClick={() => setMode("m")}>Móvil</button>
              <button className={mode === "d" ? "on" : ""} type="button" aria-pressed={mode === "d"} onClick={() => setMode("d")}>Desktop</button>
            </div>
          </div>
          <p className="a-cap" aria-live="polite">
            Mostrando: <b>{page.where}</b>. {fieldPath ? "El recuadro azul marca lo que estás editando." : "Toca un campo y te mostramos dónde aparece."}
          </p>
          <div className="prev-frame" style={{ padding: 12 }}>
            <StorePreview bundle={previewBundle} tokens={tokens} mode={mode} maxHeight={620} chrome={page.chrome} cart={page.cart} focus={focus} label={`Vista previa: ${page.where}`}>
              {page.node ?? undefined}
            </StorePreview>
          </div>
        </section>
      </div>

      <DemoNote untilDb>
        Demo (Fase 2): lo que publiques aquí se guarda en este navegador y ya se ve en las vistas previas del panel. En la tienda en vivo los textos se activan cuando conectemos la base de datos (Fase 3).
      </DemoNote>

      <div className="a-sticky">
        <span className="a-cap">{doc.status === "live" ? "La tienda muestra estos textos." : "Los clientes verán los cambios solo al publicar."}</span>
        <div className="row g2">
          <button className="a-btn" type="button" disabled={!doc.dirty} onClick={async () => { if (await doc.saveDraft()) toast("Borrador guardado"); }}>Guardar borrador</button>
          <button className="a-btn primary" type="button" disabled={doc.status === "live"} onClick={async () => { if (await doc.publish()) toast("Textos publicados"); }}>Publicar</button>
        </div>
      </div>
    </AdminPage>
  );
}
