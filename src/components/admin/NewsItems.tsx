"use client";

import Link from "next/link";
import { useId } from "react";
import type { NewsItem } from "@/lib/types";
import { newsId, shortDate, todayLima } from "@/lib/news";
import { useToday } from "@/lib/useToday";
import { AIDown, AIInstagram, AITrash, AIUp } from "./AdminIcons";
import { SlotImage } from "./SlotImage";
import { UploadButton } from "./PhotoPicker";

/** Estado de una novedad para el admin: vigente, con vencimiento o vencida. */
export function NewsStatus({ item }: { item: Pick<NewsItem, "until"> }) {
  const today = useToday();
  if (!item.until) return <span className="st cancelado">Sin vencimiento</span>;
  if (today && item.until < today) return <span className="st pend">Vencida · ya no se ve</span>;
  return <span className="st pagado">Hasta el {shortDate(item.until)}</span>;
}

function withUntil(item: NewsItem, until: string): NewsItem {
  const next = { ...item };
  if (until) next.until = until;
  else delete next.until;
  return next;
}

function Row({ item, i, n, onChange, onMove, onRemove }: { item: NewsItem; i: number; n: number; onChange: (v: NewsItem) => void; onMove: (d: number) => void; onRemove: () => void }) {
  const id = useId();
  return (
    <div className="stack g3" data-path={`news.items.${i}`} style={{ borderTop: i ? "1px solid var(--a-border)" : 0, paddingTop: i ? 12 : 0 }}>
      <div className="row between g2 wrap-row">
        <p className="a-label" style={{ margin: 0 }}>
          Novedad {i + 1} {item.igPostId && <span className="a-cap"> · <AIInstagram size="sm" style={{ width: 12, height: 12, verticalAlign: -2 }} /> de Instagram</span>}
        </p>
        <NewsStatus item={item} />
      </div>
      <div className="row g3" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 160 }}>
          <SlotImage slotKey="news" compact value={{ image: item.image }} onChange={(v) => onChange({ ...item, image: v.image })} />
        </div>
        <div className="grow stack g3" style={{ minWidth: 220 }}>
          <div className="a-field">
            <label htmlFor={`${id}-c`}>Texto debajo de la foto (opcional)</label>
            <input id={`${id}-c`} className="a-input" value={item.caption} maxLength={140} placeholder="Ej.: ¡Black Friday hasta el domingo!" onChange={(e) => onChange({ ...item, caption: e.target.value })} />
          </div>
          <div className="a-field">
            <label htmlFor={`${id}-a`}>Descripción de la foto (para Google y lectores de pantalla)</label>
            <input id={`${id}-a`} className="a-input" value={item.alt} onChange={(e) => onChange({ ...item, alt: e.target.value })} />
          </div>
          <div className="a-field">
            <label htmlFor={`${id}-h`}>Al tocarla lleva a (opcional)</label>
            <input id={`${id}-h`} className="a-input" value={item.href} placeholder="/p/mi-producto o https://www.instagram.com/p/…" onChange={(e) => onChange({ ...item, href: e.target.value.trim() })} />
          </div>
          <div className="a-field">
            <label htmlFor={`${id}-u`}>Se muestra hasta (opcional)</label>
            <div className="row g2 wrap-row">
              <input id={`${id}-u`} className="a-input" type="date" style={{ maxWidth: 200 }} min={todayLima()} value={item.until ?? ""}
                onChange={(e) => onChange(withUntil(item, e.target.value))} />
              {item.until && <button className="a-btn sm ghost" type="button" onClick={() => onChange(withUntil(item, ""))}>Quitar fecha</button>}
            </div>
            <span className="a-cap">Con fecha, desaparece sola al terminar ese día. Sin fecha, queda hasta que la quites.</span>
          </div>
        </div>
      </div>
      <div className="mv" style={{ alignSelf: "flex-end" }}>
        <button type="button" disabled={i === 0} aria-label={`Subir novedad ${i + 1}`} onClick={() => onMove(-1)}><AIUp size="sm" /></button>
        <button type="button" disabled={i === n - 1} aria-label={`Bajar novedad ${i + 1}`} onClick={() => onMove(1)}><AIDown size="sm" /></button>
        <button type="button" aria-label={`Quitar novedad ${i + 1}`} onClick={onRemove}><AITrash size="sm" /></button>
      </div>
    </div>
  );
}

/** Lista de novedades en Admin › Textos › Novedades: subir fotos, ordenar, vencimiento. */
export function NewsItemsEditor({ items, onChange }: { items: NewsItem[]; onChange: (v: NewsItem[]) => void }) {
  const id = useId();
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const out = items.slice();
    [out[i], out[j]] = [out[j], out[i]];
    onChange(out);
  };
  const add = (srcs: string[]) => onChange([...srcs.map((image) => ({ id: newsId(), image, alt: "", caption: "", href: "" })), ...items]);

  return (
    <fieldset className="tx-group" aria-labelledby={id} data-path="news.items">
      <div className="tx-group-h">
        <span id={id} className="a-h3">Fotos de novedades</span>
        <span className="a-cap">{items.length}</span>
      </div>
      <p className="a-cap" style={{ margin: 0 }}>La primera es la que se ve primero. Las nuevas entran adelante.</p>
      <div className="row g2 wrap-row">
        <UploadButton className="a-btn sm" label="Subir fotos" onUploaded={add} />
        <Link className="a-btn sm" href="/admin/instagram"><AIInstagram size="sm" /> Elegir de Instagram</Link>
      </div>
      {!items.length && <p className="a-cap">Todavía no hay novedades: mientras no haya ninguna, la sección no se muestra en la tienda.</p>}
      {items.map((item, i) => (
        <Row key={item.id} item={item} i={i} n={items.length}
          onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
          onMove={(d) => move(i, d)}
          onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
    </fieldset>
  );
}
