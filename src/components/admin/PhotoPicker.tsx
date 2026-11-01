"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ACCEPT } from "@/lib/admin/mediaStore";
import type { MediaItem } from "@/lib/media";
import { useAdmin } from "./AdminContext";
import { useAdminMedia } from "./AdminMedia";
import { AIClose, AIInstagram, AIUpload } from "./AdminIcons";

/** Botón + zona para soltar fotos. Sube y devuelve las fotos nuevas. */
export function UploadButton({ onUploaded, multiple = true, label = "Subir fotos", className = "a-btn" }: { onUploaded?: (srcs: string[]) => void; multiple?: boolean; label?: string; className?: string }) {
  const { upload } = useAdminMedia();
  const { toast } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const { added, errors } = await upload(files);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (errors.length) toast(errors[0]);
    else toast(added.length === 1 ? "Foto subida" : `${added.length} fotos subidas`);
    if (added.length) onUploaded?.(added);
  };

  return (
    <>
      <button className={className} type="button" disabled={busy} onClick={() => input.current?.click()}>
        <AIUpload size="sm" /> {busy ? "Subiendo…" : label}
      </button>
      <input ref={input} type="file" accept={ACCEPT} multiple={multiple} hidden onChange={(e) => run(e.target.files)} />
    </>
  );
}

export function OriginTag({ item }: { item?: MediaItem }) {
  if (!item) return null;
  return item.origin === "ig" ? (
    <span className="m-tag" title="Viene de Instagram"><AIInstagram size="sm" style={{ width: 12, height: 12 }} />IG</span>
  ) : (
    <span className="m-tag own" title="Subida por el equipo">Tuya</span>
  );
}

/** Miniatura de cualquier foto de la marca (resuelve fotos locales de la demo). */
export function Thumb({ src, alt = "" }: { src: string; alt?: string }) {
  const { resolve } = useAdminMedia();
  const url = resolve(src);
  return url ? <img src={url} alt={alt} loading="lazy" /> : <span className="thumb-wait" aria-label="Cargando foto" />;
}

type Filter = "all" | "ig" | "upload";

/**
 * Ventana para elegir una foto de la marca o subir una nueva.
 * `hint` explica el formato donde se va a usar (p. ej. «Portada en escritorio · horizontal 16:9»).
 */
export function PhotoPicker({ open, title, hint, exclude = [], onPick, onClose, footer }: { open: boolean; title: string; hint?: ReactNode; exclude?: string[]; onPick: (src: string) => void; onClose: () => void; footer?: ReactNode }) {
  const { list } = useAdminMedia();
  const { upload } = useAdminMedia();
  const { toast } = useAdmin();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [over, setOver] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const items = list.filter((m) => !exclude.includes(m.src) && (filter === "all" || m.origin === filter));

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!e.dataTransfer.files.length) return;
    const { added, errors } = await upload(e.dataTransfer.files);
    if (errors.length) toast(errors[0]);
    if (added[0]) onPick(added[0]);
  };

  return (
    <dialog ref={ref} className="a-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      <div className={`stack g4 ${over ? "drop-over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <div className="row between">
          <h2 className="a-h2" id={titleId}>{title}</h2>
          <button className="a-btn ghost" type="button" aria-label="Cerrar" style={{ width: 44, padding: 0 }} onClick={onClose}><AIClose size="sm" /></button>
        </div>
        {hint && <p className="a-cap">{hint}</p>}
        <div className="row between wrap-row g2">
          <div className="a-seg" role="radiogroup" aria-label="Mostrar">
            {([["all", "Todas"], ["ig", "De Instagram"], ["upload", "Tuyas"]] as [Filter, string][]).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <UploadButton className="a-btn primary" label="Subir desde tu equipo" multiple={false} onUploaded={(s) => onPick(s[0])} />
        </div>
        {items.length ? (
          <div className="pick-grid">
            {items.map((m) => (
              <button key={m.src} type="button" aria-label={`Usar ${m.name ?? m.src.split("/").pop()}${m.origin === "ig" ? " (de Instagram)" : ""}`} onClick={() => onPick(m.src)}>
                <Thumb src={m.src} />
                <OriginTag item={m} />
              </button>
            ))}
          </div>
        ) : (
          <p className="a-sub">{filter === "upload" ? "Aún no subes fotos. Usa «Subir desde tu equipo» o suelta una foto aquí." : "No hay fotos para mostrar."}</p>
        )}
        <p className="a-cap">También puedes soltar una foto aquí. JPG, PNG o WebP; la achicamos a 2400 px para que cargue rápido.</p>
        {footer}
      </div>
    </dialog>
  );
}
