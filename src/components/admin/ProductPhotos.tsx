"use client";

import { useState } from "react";
import { Photo, MediaProvider } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import type { AdminProduct } from "@/lib/admin/types";
import { useAdmin } from "./AdminContext";
import { useAdminMedia } from "./AdminMedia";
import { FrameEditor } from "./FrameEditor";
import { OriginTag, PhotoPicker, UploadButton } from "./PhotoPicker";
import { AICrop, AIImage, AIInstagram, AIPlus, AIRefresh, AITrash, AIUp, AIUndo } from "./AdminIcons";

/**
 * Fotos de un producto: las de Instagram por defecto, y las del equipo cuando quiera.
 * Cualquier cambio a mano hace que la sincronización con Instagram deje de tocar las fotos;
 * las de Instagram quedan guardadas para volver a ellas.
 */
export function ProductPhotos({ product: p, onChange }: { product: AdminProduct; onChange: (patch: Partial<AdminProduct>) => void }) {
  const { bundle } = useAdmin();
  const { media } = useAdminMedia();
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "replace"; index: number }>(null);
  const [framing, setFraming] = useState<string | null>(null);

  const igImages = p.igImages ?? (p.igSynced ? bundle.catalog.products.find((x) => x.id === p.id)?.images ?? [] : []);
  const synced = p.photosSynced ?? !!p.igSynced;
  const isOwn = (src: string) => media[src]?.origin === "upload";
  const ownCount = p.images.filter(isOwn).length;
  const igCount = p.images.length - ownCount;
  const sameAsIg = igImages.length > 0 && JSON.stringify(igImages) === JSON.stringify(p.images);

  /** Todo cambio de fotos hecho a mano. */
  const set = (images: string[]) => onChange({ images, igImages, photosSynced: false });

  const pick = (src: string) => {
    if (!picker) return;
    if (picker.mode === "add") set([...p.images, src]);
    else set(p.images.map((x, j) => (j === picker.index ? src : x)));
    setPicker(null);
  };

  return (
    <div className="stack g3">
      {igImages.length > 0 && (
        <div className="photo-src" role="status">
          <span className="row g2">
            {synced ? <AIInstagram size="sm" /> : <AIImage size="sm" />}
            <span>
              <b>{synced ? "Fotos de Instagram" : ownCount ? (igCount ? "Fotos mixtas" : "Tus fotos") : "Fotos elegidas a mano"}</b>
              <span className="a-cap" style={{ display: "block" }}>
                {synced ? "Se actualizan solas cuando editan el post." : "Instagram ya no cambia estas fotos. Las del post siguen guardadas."}
              </span>
            </span>
          </span>
          <span className="row g2 wrap-row">
            {ownCount > 0 && igCount > 0 && (
              <button className="a-btn sm" type="button" onClick={() => set(p.images.filter(isOwn))}>Usar solo mis fotos</button>
            )}
            {(!synced || !sameAsIg) && (
              <button className="a-btn sm" type="button" onClick={() => onChange({ images: igImages, igImages, photosSynced: true })}>
                <AIUndo size="sm" /> Volver a las de Instagram
              </button>
            )}
          </span>
        </div>
      )}

      {/* Las miniaturas muestran el recorte real de la tienda (4:5). */}
      <MediaProvider mode="d">
        <div className="media">
          {p.images.map((img, i) => (
            <div key={img + i}>
              <Photo src={img} alt={`Foto ${i + 1}`} slot={SLOTS.product} />
              {i === 0 && <span className="cover">Portada</span>}
              <OriginTag item={media[img]} />
              <span className="m-act">
                {i > 0 && <button type="button" aria-label={`Usar foto ${i + 1} como portada`} onClick={() => set([img, ...p.images.filter((_, j) => j !== i)])}><AIUp size="sm" /></button>}
                <button type="button" aria-label={`Encuadrar foto ${i + 1}`} aria-pressed={framing === img} onClick={() => setFraming(framing === img ? null : img)}><AICrop size="sm" /></button>
                <button type="button" aria-label={`Reemplazar foto ${i + 1}`} onClick={() => setPicker({ mode: "replace", index: i })}><AIRefresh size="sm" /></button>
                <button type="button" aria-label={`Quitar foto ${i + 1}`} onClick={() => set(p.images.filter((_, j) => j !== i))}><AITrash size="sm" /></button>
              </span>
            </div>
          ))}
        </div>
      </MediaProvider>
      {!p.images.length && <p className="a-cap">Este producto no tiene fotos. Sube una o elige una de la marca.</p>}

      {framing && p.images.includes(framing) && (
        <div className="a-card" style={{ background: "var(--a-bg)" }}>
          <FrameEditor targets={[{ src: framing, format: SLOTS.product.d, label: "Tarjeta, galería y carrito" }]} onClose={() => setFraming(null)} />
        </div>
      )}

      <div className="row g2 wrap-row">
        <button className="a-btn sm" type="button" onClick={() => setPicker({ mode: "add" })}><AIPlus size="sm" /> Agregar foto</button>
        <UploadButton className="a-btn sm" label="Subir fotos" onUploaded={(srcs) => set([...p.images, ...srcs])} />
      </div>
      <p className="a-cap">En la tienda las fotos de producto se ven en vertical 4:5, en celular y en escritorio. Lo ideal: 1080 × 1350 px o más.</p>

      <PhotoPicker
        open={!!picker}
        title={picker?.mode === "replace" ? `Reemplazar foto ${picker.index + 1}` : "Agregar foto"}
        hint="Se verá en vertical 4:5. Después puedes encuadrarla."
        exclude={picker?.mode === "add" ? p.images : []}
        onPick={pick}
        onClose={() => setPicker(null)}
      />
    </div>
  );
}
