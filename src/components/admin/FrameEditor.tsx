"use client";

/* eslint-disable @next/next/no-img-element */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CENTER, FORMATS, frameOf, frameStyle, normFrame, sizeWarning, type FormatId, type Frame } from "@/lib/media";
import { useAdminMedia } from "./AdminMedia";

export type FrameTarget = { format: FormatId; label: string; src: string };

/** Un formato: la foto recortada al tamaño real del formato. Se arrastra para mover y se hace zoom. */
function FrameBox({ target, frame, onChange, width }: { target: FrameTarget; frame: Frame; onChange: (f: Frame) => void; width: number }) {
  const { resolve, media, setSize } = useAdminMedia();
  const zoomId = useId();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; f: Frame } | null>(null);
  const fmt = FORMATS[target.format];
  const url = resolve(target.src);
  const item = media[target.src];
  const warn = sizeWarning(item?.width, target.format, frame.zoom);

  // Sensibilidad del arrastre: cuántos px "sobran" de foto a cada lado del formato.
  const range = () => {
    const el = box.current;
    const W = el?.clientWidth ?? 1;
    const H = el?.clientHeight ?? 1;
    const w = item?.width ?? W;
    const h = item?.height ?? H;
    const s = Math.max(W / w, H / h);
    return { x: Math.max(w * s - W + (frame.zoom - 1) * W, 1), y: Math.max(h * s - H + (frame.zoom - 1) * H, 1) };
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, f: frame };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = range();
    onChange(normFrame({ ...d.f, x: d.f.x - ((e.clientX - d.x) / r.x) * 100, y: d.f.y - ((e.clientY - d.y) / r.y) * 100 }));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const m: Record<string, Partial<Frame>> = {
      ArrowLeft: { x: frame.x - step }, ArrowRight: { x: frame.x + step },
      ArrowUp: { y: frame.y - step }, ArrowDown: { y: frame.y + step },
      "+": { zoom: frame.zoom + 0.1 }, "=": { zoom: frame.zoom + 0.1 }, "-": { zoom: frame.zoom - 0.1 },
    };
    const p = m[e.key];
    if (!p) return;
    e.preventDefault();
    onChange(normFrame({ ...frame, ...p }));
  };

  return (
    <div className="stack g2" style={{ width, maxWidth: "100%" }}>
      <div className="row between"><b style={{ fontSize: 13 }}>{target.label}</b><span className="a-cap">{fmt.label}</span></div>
      <div
        ref={box}
        className="frame-box"
        style={{ aspectRatio: `${fmt.w} / ${fmt.h}` }}
        tabIndex={0}
        role="group"
        aria-label={`Encuadre ${target.label}: arrastra la foto o usa las flechas para moverla y + o − para el zoom`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            style={frameStyle(frame)}
            onLoad={(e) => setSize(target.src, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          />
        )}
        <span className="frame-grid" aria-hidden="true" />
      </div>
      <div className="row g2">
        <label htmlFor={zoomId} className="a-cap" style={{ minWidth: 36 }}>Zoom</label>
        <input id={zoomId} type="range" min={1} max={3} step={0.05} value={frame.zoom} className="grow" style={{ minHeight: 44 }} onChange={(e) => onChange(normFrame({ ...frame, zoom: Number(e.target.value) }))} />
      </div>
      {warn && <p className="a-cap warn-txt" role="note">{warn}</p>}
    </div>
  );
}

/**
 * Encuadre de una o varias fotos en sus formatos (p. ej. portada: escritorio 16:9 y celular 3:4).
 * Los cambios se guardan al tocar «Guardar encuadre».
 */
export function FrameEditor({ targets, onClose }: { targets: FrameTarget[]; onClose?: () => void }) {
  const { media, setFrame } = useAdminMedia();
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  const [busy, setBusy] = useState(false);
  const key = (t: FrameTarget) => `${t.src}|${t.format}`;
  const get = (t: FrameTarget) => frames[key(t)] ?? frameOf(media, t.src, t.format);
  const dirty = Object.keys(frames).length > 0;

  const save = async () => {
    setBusy(true);
    try {
      for (const t of targets) if (frames[key(t)]) await setFrame(t.src, t.format, frames[key(t)]);
      setFrames({});
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack g4">
      <p className="a-cap">Arrastra la foto para elegir qué parte se ve. En la tienda se recorta igual que aquí.</p>
      <div className="frame-row">
        {targets.map((t) => {
          const f = FORMATS[t.format];
          // Mismo alto visual para formatos verticales y horizontales.
          const width = Math.round(Math.min(360, (240 * f.w) / f.h));
          return <FrameBox key={key(t)} target={t} width={width} frame={get(t)} onChange={(fr) => setFrames((p) => ({ ...p, [key(t)]: fr }))} />;
        })}
      </div>
      <div className="row g2 wrap-row">
        <button className="a-btn primary" type="button" disabled={!dirty || busy} onClick={save}>{busy ? "Guardando…" : "Guardar encuadre"}</button>
        <button className="a-btn" type="button" onClick={() => setFrames(Object.fromEntries(targets.map((t) => [key(t), CENTER])))}>Centrar</button>
        {onClose && <button className="a-btn ghost" type="button" onClick={() => { setFrames({}); onClose(); }}>Cerrar</button>}
      </div>
    </div>
  );
}
