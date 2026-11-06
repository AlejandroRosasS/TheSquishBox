"use client";

import { useId, useState } from "react";
import { MediaProvider, Photo } from "@/components/Photo";
import { FORMATS, hasTwoFormats, sizeWarning, slotFor, frameOf, type FormatId } from "@/lib/media";
import { useAdminMedia, useMeasure } from "./AdminMedia";
import { FrameEditor } from "./FrameEditor";
import { OriginTag, PhotoPicker } from "./PhotoPicker";
import { AICrop, AIRefresh, AIUndo } from "./AdminIcons";

type Value = { image: string; imageMobile?: string };

function Preview({ src, format, label, max = 260 }: { src: string; format: FormatId; label: string; max?: number }) {
  const { media } = useAdminMedia();
  useMeasure(src);
  const f = FORMATS[format];
  const warn = sizeWarning(media[src]?.width, format, frameOf(media, src, format).zoom);
  return (
    <div className="stack g2">
      <div className="row between"><b style={{ fontSize: 13 }}>{label}</b><span className="a-cap">{f.label}</span></div>
      <div className="slot-img" style={{ aspectRatio: `${f.w} / ${f.h}`, maxHeight: max }}>
        <MediaProvider mode="d"><Photo src={src} alt="" slot={format} /></MediaProvider>
        <OriginTag item={media[src]} />
      </div>
      {warn && <p className="a-cap warn-txt" role="note">{warn}</p>}
    </div>
  );
}

/**
 * Foto de una sección de la tienda (portada, accesos…). Si la sección usa formatos distintos en
 * escritorio y en celular, deja elegir una foto por formato; si no, la de celular es la misma con su encuadre.
 */
/** `compact`: miniaturas más chicas (fotos dentro de una lista). */
export function SlotImage({ slotKey, value, onChange, compact }: { slotKey: string; value: Value; onChange: (v: Value) => void; compact?: boolean }) {
  const max = compact ? 150 : 260;
  const slot = slotFor(slotKey);
  const two = hasTwoFormats(slot);
  const id = useId();
  const [pick, setPick] = useState<null | "d" | "m">(null);
  const [framing, setFraming] = useState(false);
  const mSrc = value.imageMobile || value.image;

  const choose = (src: string) => {
    if (pick === "m") onChange({ ...value, imageMobile: src === value.image ? undefined : src });
    else onChange({ ...value, image: src, ...(value.imageMobile === src ? { imageMobile: undefined } : {}) });
    setPick(null);
  };

  return (
    <div className="a-field" role="group" aria-labelledby={id}>
      <span id={id} style={{ fontSize: 13, fontWeight: 600 }}>{two ? "Fotos (escritorio y celular)" : "Foto"}</span>
      <div className={two ? "slot-pair" : "stack"} style={two ? (compact ? { maxWidth: 320 } : undefined) : { maxWidth: compact ? 150 : 260 }}>
        <div className="stack g2">
          <Preview src={value.image} format={slot.d} label={two ? "Escritorio" : "En la tienda"} max={max} />
          <button className="a-btn sm" type="button" onClick={() => setPick("d")}><AIRefresh size="sm" /> Cambiar foto</button>
        </div>
        {two && (
          <div className="stack g2">
            <Preview src={mSrc} format={slot.m} label={value.imageMobile ? "Celular · foto propia" : "Celular · misma foto"} max={max} />
            <div className="row g2 wrap-row">
              <button className="a-btn sm" type="button" onClick={() => setPick("m")}><AIRefresh size="sm" /> {value.imageMobile ? "Cambiar foto" : "Usar otra foto"}</button>
              {value.imageMobile && <button className="a-btn sm ghost" type="button" onClick={() => onChange({ ...value, imageMobile: undefined })}><AIUndo size="sm" /> Usar la de escritorio</button>}
            </div>
          </div>
        )}
      </div>
      <div className="row g2 wrap-row">
        <button className="a-btn sm" type="button" aria-expanded={framing} onClick={() => setFraming(!framing)}><AICrop size="sm" /> Encuadrar</button>
        {two && !compact && <span className="a-cap">Los formatos cambian mucho entre celular y escritorio: si puedes, usa una foto horizontal y otra vertical.</span>}
      </div>
      {framing && (
        <div className="a-card" style={{ background: "var(--a-bg)" }}>
          <FrameEditor
            targets={[
              { src: value.image, format: slot.d, label: two ? "Escritorio" : slot.label },
              ...(two ? [{ src: mSrc, format: slot.m, label: "Celular" }] : []),
            ]}
            onClose={() => setFraming(false)}
          />
          <p className="a-cap">El encuadre se guarda con la foto: se aplica apenas lo guardas, sin publicar los textos.</p>
        </div>
      )}
      <PhotoPicker
        open={!!pick}
        title={pick === "m" ? "Foto para celular" : two ? "Foto para escritorio" : "Elegir foto"}
        hint={`${slot.label} · ${FORMATS[pick === "m" ? slot.m : slot.d].label}. Recomendado: ${FORMATS[pick === "m" ? slot.m : slot.d].minW} px de ancho o más.`}
        onPick={choose}
        onClose={() => setPick(null)}
      />
    </div>
  );
}
