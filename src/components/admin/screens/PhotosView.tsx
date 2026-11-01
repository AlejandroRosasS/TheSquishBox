"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Storefront } from "@/lib/types";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { FORMATS, SLOTS, hasTwoFormats, type FormatId, type MediaItem } from "@/lib/media";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { useAdminMedia } from "../AdminMedia";
import { AdminPage } from "../AdminPage";
import { FrameEditor, type FrameTarget } from "../FrameEditor";
import { OriginTag, Thumb, UploadButton } from "../PhotoPicker";
import { AICrop, AITrash } from "../AdminIcons";

type Use = { label: string; href: string; format: FormatId; formatM?: FormatId; mobile?: boolean };
type Filter = "all" | "ig" | "upload" | "unused";

const SECTION_LABEL: Record<string, string> = { hero: "Portada", partyBand: "Banda de pedido especial", inside: "¿Qué hay dentro?" };

/** Biblioteca de fotos de la marca: las de Instagram y las subidas, dónde se usa cada una y su encuadre. */
export function PhotosView() {
  const { bundle, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { list, remove } = useAdminMedia();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [texts] = useStoredDoc<Storefront>("texts");
  // Cuenta tanto lo publicado como el borrador de Textos, para no borrar una foto que está por publicarse.
  const docs = useMemo(() => [texts.draft, texts.published ?? bundle.storefront].filter(Boolean) as Storefront[], [texts, bundle.storefront]);

  const uses = useMemo(() => {
    const out: Record<string, Use[]> = {};
    const add = (src: string | undefined, u: Use) => {
      if (src) (out[src] ??= []).push(u);
    };
    for (const p of catalog.products) p.images.forEach((src) => add(src, { label: p.name, href: `/admin/productos/${encodeURIComponent(p.id)}`, format: SLOTS.product.d }));
    for (const sf of docs) {
    for (const key of ["hero", "partyBand", "inside"] as const) {
      const s = sf[key];
      const slot = SLOTS[key];
      add(s.image, { label: SECTION_LABEL[key], href: "/admin/textos", format: slot.d, ...(hasTwoFormats(slot) && !s.imageMobile ? { formatM: slot.m } : {}) });
      if (s.imageMobile) add(s.imageMobile, { label: `${SECTION_LABEL[key]} (celular)`, href: "/admin/textos", format: slot.m, mobile: true });
    }
    sf.tiles.forEach((t) => {
      add(t.image, { label: `Acceso «${t.title}»`, href: "/admin/textos", format: SLOTS.tiles.d, ...(!t.imageMobile ? { formatM: SLOTS.tiles.m } : {}) });
      if (t.imageMobile) add(t.imageMobile, { label: `Acceso «${t.title}» (celular)`, href: "/admin/textos", format: SLOTS.tiles.m, mobile: true });
    });
    }
    // Sin repetir el mismo uso (borrador y publicado suelen coincidir).
    for (const k of Object.keys(out)) out[k] = out[k].filter((u, i, a) => a.findIndex((x) => x.label === u.label && x.format === u.format) === i);
    return out;
  }, [catalog.products, docs]);

  const items = list.filter((m) => (filter === "all" ? true : filter === "unused" ? !uses[m.src] : m.origin === filter));
  const counts = { all: list.length, ig: list.filter((m) => m.origin === "ig").length, upload: list.filter((m) => m.origin === "upload").length, unused: list.filter((m) => !uses[m.src]).length };

  /** Formatos donde se ve la foto (sin repetir). Si no se usa todavía, el de producto. */
  const targets = (m: MediaItem): FrameTarget[] => {
    const seen = new Map<FormatId, string>();
    for (const u of uses[m.src] ?? []) {
      if (!seen.has(u.format)) seen.set(u.format, u.mobile ? "Celular" : u.formatM ? "Escritorio" : FORMATS[u.format].label);
      if (u.formatM && !seen.has(u.formatM)) seen.set(u.formatM, "Celular");
    }
    if (!seen.size) seen.set(SLOTS.product.d, "Producto");
    return [...seen].map(([format, label]) => ({ src: m.src, format, label: `${label} · ${FORMATS[format].label}` }));
  };

  const del = (m: MediaItem) => {
    if (uses[m.src]) return toast("Esta foto está en uso. Quítala primero de donde aparece.");
    remove(m.src);
    if (open === m.src) setOpen(null);
    toast("Foto borrada");
  };

  return (
    <AdminPage title="Fotos" topRight={<UploadButton className="a-btn sm primary" label="Subir" />}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Fotos</h1>
          <p className="a-sub">Las fotos de Instagram y las que subes. Elige dónde va cada una en Productos o en Textos, y aquí ajusta su encuadre en cada formato.</p>
        </div>
        <span className="only-d"><UploadButton className="a-btn primary" label="Subir fotos" /></span>
      </div>

      <section className="a-card" aria-labelledby="ft-fmt">
        <h2 className="a-h2" id="ft-fmt">Formatos de la tienda</h2>
        <ul className="stack g1" style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Productos:</b> vertical 4:5 en celular y escritorio (ideal 1080 × 1350 px).</li>
          <li><b>Portada:</b> horizontal 16:9 en escritorio (1920 × 1080) y vertical 3:4 en celular (1080 × 1440). Conviene una foto para cada uno.</li>
          <li><b>Accesos por línea:</b> vertical 4:5 en escritorio y horizontal 16:10 en celular.</li>
          <li><b>Banda de pedido especial y «¿Qué hay dentro?»:</b> vertical 4:5.</li>
        </ul>
        <p className="a-cap">Las fotos de Instagram suelen ser cuadradas o 4:5 y de baja resolución: para la portada en escritorio sube una foto propia horizontal.</p>
      </section>

      <div className="a-seg" role="radiogroup" aria-label="Mostrar" style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}>
        {([["all", "Todas"], ["ig", "De Instagram"], ["upload", "Tuyas"], ["unused", "Sin usar"]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>
        ))}
      </div>

      {open && list.some((m) => m.src === open) && (
        <section className="a-card" aria-label="Encuadre">
          <div className="row between"><h2 className="a-h2">Encuadre</h2></div>
          <FrameEditor key={open} targets={targets(list.find((m) => m.src === open)!)} onClose={() => setOpen(null)} />
        </section>
      )}

      {items.length ? (
        <div className="lib-grid">
          {items.map((m) => {
            const u = uses[m.src] ?? [];
            return (
              <div className="lib-it" key={m.src}>
                <div className="lib-ph">
                  <Thumb src={m.src} alt={m.alt ?? ""} />
                  <OriginTag item={m} />
                </div>
                <span className="a-cap" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.width ? `${m.width} × ${m.height} px` : m.name ?? m.src.split("/").pop()}
                </span>
                <span className="a-cap">
                  {u.length ? <>En <Link href={u[0].href} style={{ color: "inherit" }}>{u[0].label}</Link>{u.length > 1 ? ` y ${u.length - 1} más` : ""}</> : "Sin usar"}
                </span>
                <div className="row g2">
                  <button className="a-btn sm grow" type="button" aria-pressed={open === m.src} onClick={() => setOpen(open === m.src ? null : m.src)}><AICrop size="sm" /> Encuadrar</button>
                  {m.origin === "upload" && (
                    <button className="a-btn sm ghost danger" type="button" style={{ width: 44, padding: 0 }} aria-label="Borrar foto" onClick={() => del(m)}><AITrash size="sm" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="a-sub">{filter === "upload" ? "Aún no subes fotos." : "No hay fotos para mostrar."}</p>
      )}
    </AdminPage>
  );
}
