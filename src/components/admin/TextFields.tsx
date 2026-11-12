"use client";

import { useId, type ReactNode } from "react";
import { HIDDEN_KEYS, PRODUCT_LIST_KEYS, isImageKey, isLong, isRichCandidate, itemLabelFor, labelFor } from "@/lib/admin/textSchema";
import { AIDown, AIPlus, AITrash, AIUp } from "./AdminIcons";
import { Switch } from "./AdminPage";
import { BUSINESS_TOGGLES } from "@/lib/legal";
import { SlotImage } from "./SlotImage";
import { useAdminMedia } from "./AdminMedia";
import { OriginTag, Thumb, UploadButton } from "./PhotoPicker";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type FieldCtx = {
  slug: string;
  images: string[];
  products: { id: string; name: string }[];
  routesId: string;
};

/** `path`: ruta del campo dentro de storefront (ej. "tiles.1.title"); la vista previa la usa para resaltarlo. */
type Props = { k: string; value: Json; onChange: (v: Json) => void; ctx: FieldCtx; depth?: number; path?: string; inList?: boolean };

/** Copia "vacía" de un elemento, para agregar uno nuevo a una lista. */
function blank(v: Json): Json {
  if (typeof v === "string") return "";
  if (typeof v === "number") return 0;
  // Una lista anidada nueva arranca con un elemento vacío, para que se pueda completar y agregar más.
  if (Array.isArray(v)) return v.length ? [blank(v[0])] : [];
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "image" ? x : blank(x)]));
  return v;
}

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

function TextInput({ k, value, onChange }: { k: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const long = isLong(k, value);
  const vars = value.match(/\{\w+\}/g);
  const marks = /\*|\[[^\]]*\]\(/.test(value);
  const rich = isRichCandidate(k) || marks;
  return (
    <div className="a-field">
      <label htmlFor={id}>{labelFor(k)}</label>
      {long ? (
        <textarea id={id} className="a-textarea" value={value} rows={value.length > 240 ? 7 : 3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="a-input" value={value} onChange={(e) => onChange(e.target.value)} list={k === "href" ? "tx-routes" : undefined} />
      )}
      {(vars || (rich && marks)) && (
        <span className="a-cap">
          {rich && marks && <>Usa *así* para resaltar, **así** para negrita y [texto](/ruta) para un enlace. </>}
          {vars && <>Deja tal cual {vars.join(", ")}: se reemplaza por el dato que corresponde.</>}
        </span>
      )}
    </div>
  );
}

export function ImagePicker({ value, onChange, ctx }: { value: string; onChange: (v: string) => void; ctx: FieldCtx }) {
  const id = useId();
  const { list, media } = useAdminMedia();
  const images = [...new Set([...ctx.images, ...list.map((m) => m.src)])];
  return (
    <div className="a-field" role="group" aria-labelledby={id}>
      <span id={id} style={{ fontSize: 13, fontWeight: 600 }}>{labelFor("image")}</span>
      <div className="img-pick">
        {images.map((src) => (
          <button key={src} type="button" className={src === value ? "on" : ""} aria-pressed={src === value} aria-label={`Usar ${media[src]?.name ?? src.split("/").pop()}`} onClick={() => onChange(src)} style={{ position: "relative" }}>
            <Thumb src={src} />
            <OriginTag item={media[src]} />
          </button>
        ))}
      </div>
      <div className="row g2 wrap-row">
        <UploadButton className="a-btn sm" label="Subir foto" multiple={false} onUploaded={(s) => onChange(s[0])} />
        <span className="a-cap">Fotos de la marca: las de Instagram y las que subes.</span>
      </div>
    </div>
  );
}

function ProductChecks({ k, value, onChange, ctx }: { k: string; value: string[]; onChange: (v: string[]) => void; ctx: FieldCtx }) {
  const id = useId();
  return (
    <fieldset className="tx-group" aria-labelledby={id}>
      <span id={id} className="a-h3">{labelFor(k)}</span>
      {ctx.products.map((p) => {
        const on = value.includes(p.id);
        return (
          <label key={p.id} className="row g3" style={{ minHeight: 44, cursor: "pointer" }}>
            <input type="checkbox" checked={on} style={{ width: 20, height: 20 }} onChange={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])} />
            <span className="grow">{p.name}</span>
            {on && <span className="a-cap">#{value.indexOf(p.id) + 1}</span>}
          </label>
        );
      })}
      <span className="a-cap">Se muestran en el orden en que los marcas.</span>
    </fieldset>
  );
}

/** Editor genérico de un valor de storefront.json (texto, número, color, foto, lista u objeto). */
export function FieldEditor({ k, value, onChange, ctx, depth = 0, path = k, inList }: Props) {
  const id = useId();
  if (HIDDEN_KEYS.has(k)) return null;
  const at = (sub: string | number) => `${path}.${sub}`;

  if (PRODUCT_LIST_KEYS.has(k) && Array.isArray(value)) {
    return <div data-path={path}><ProductChecks k={k} value={value as string[]} onChange={onChange} ctx={ctx} /></div>;
  }
  if (typeof value === "string") {
    if (isImageKey(k)) return <div data-path={path}><ImagePicker value={value} onChange={onChange} ctx={ctx} /></div>;
    if (k === "hex")
      return (
        <div className="a-field" data-path={path}>
          <label htmlFor={id}>{labelFor(k)}</label>
          <div className="color-in"><input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} /><span className="a-cap">{value}</span></div>
        </div>
      );
    return <div data-path={path}><TextInput k={k} value={value} onChange={onChange} /></div>;
  }
  if (typeof value === "number") {
    return (
      <div className="a-field" data-path={path}>
        <label htmlFor={id}>{labelFor(k)}</label>
        <input id={id} className="a-input" type="number" inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      </div>
    );
  }
  if (value === null || typeof value === "boolean") return null;

  if (Array.isArray(value)) {
    const items = value;
    const simple = items.every((x) => typeof x === "string");
    return (
      <fieldset className="tx-group" aria-labelledby={id} data-path={path}>
        <div className="tx-group-h">
          <span id={id} className="a-h3">{labelFor(k)}</span>
          <span className="a-cap">{items.length}</span>
        </div>
        {items.map((item, i) => (
          <div key={i} data-path={at(i)} className={simple ? "row g2" : "stack g3"} style={simple ? { alignItems: "flex-end" } : { borderTop: i ? "1px solid var(--a-border)" : 0, paddingTop: i ? 12 : 0 }}>
            {!simple && <p className="a-label">{itemLabelFor(k)} {i + 1}</p>}
            <div className="grow stack g3">
              {simple ? (
                <TextInput k={k} value={item as string} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
              ) : (
                <ObjectFields k={k} path={at(i)} inList obj={item as Record<string, Json>} ctx={ctx} depth={depth + 1} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
              )}
            </div>
            <div className="mv" style={simple ? undefined : { alignSelf: "flex-end" }}>
              <button type="button" disabled={i === 0} aria-label={`Subir ${labelFor(k)} ${i + 1}`} onClick={() => onChange(move(items, i, -1))}><AIUp size="sm" /></button>
              <button type="button" disabled={i === items.length - 1} aria-label={`Bajar ${labelFor(k)} ${i + 1}`} onClick={() => onChange(move(items, i, 1))}><AIDown size="sm" /></button>
              <button type="button" aria-label={`Quitar ${labelFor(k)} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><AITrash size="sm" /></button>
            </div>
          </div>
        ))}
        {items.length > 0 && (
          <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...items, blank(items[items.length - 1])])}>
            <AIPlus size="sm" /> Agregar
          </button>
        )}
      </fieldset>
    );
  }

  const inner = <ObjectFields k={k} path={path} inList={inList} obj={value} ctx={ctx} depth={depth + 1} onChange={onChange} />;
  if (depth === 0) return <div className="stack g4" data-path={path}>{inner}</div>;
  return (
    <fieldset className="tx-group" aria-labelledby={id} data-path={path}>
      <span id={id} className="a-h3">{labelFor(k)}</span>
      {inner}
    </fieldset>
  );
}

export type { Json };

/** Interruptor «Mostrar» al lado de un dato de la empresa: lo apagado no se ve en Contacto ni en el pie. */
function ShownToggle({ name, k, obj, onChange, children }: { name: string; k: string; obj: Record<string, Json>; onChange: (v: Json) => void; children: ReactNode }) {
  const hidden = Array.isArray(obj.hidden) ? (obj.hidden as string[]) : [];
  const on = !hidden.includes(k);
  const set = (v: boolean) => {
    const next = v ? hidden.filter((x) => x !== k) : [...hidden, k];
    const o: Record<string, Json> = { ...obj, hidden: next };
    if (!next.length) delete o.hidden;
    onChange(o);
  };
  return (
    <div className="row g3" style={{ alignItems: "flex-end" }}>
      <div className="grow" style={{ opacity: on ? 1 : 0.55 }}>{children}</div>
      <div className="stack g1" style={{ alignItems: "center", minWidth: 64, paddingBottom: 8 }}>
        <span className="a-cap">{on ? "Visible" : "Oculto"}</span>
        <Switch on={on} onChange={set} label={`Mostrar ${name.toLowerCase()} en la tienda`} />
      </div>
    </div>
  );
}

/**
 * Campos de un objeto. Si tiene foto (`image`), se edita con su formato de la tienda:
 * en secciones con formatos distintos (portada, accesos) se puede elegir otra foto para celular.
 */
function ObjectFields({ k, path, inList, obj, onChange, ctx, depth }: { k: string; path: string; inList?: boolean; obj: Record<string, Json>; onChange: (v: Json) => void; ctx: FieldCtx; depth: number }) {
  const hasSlot = typeof obj.image === "string";
  const entries = Object.entries(obj).filter(([ck]) => !HIDDEN_KEYS.has(ck) && !(hasSlot && (ck === "image" || ck === "imageMobile")));
  return (
    <>
      {hasSlot && (
        <div className="tx-photo" data-path={`${path}.image`}>
          <SlotImage
            slotKey={k}
            compact={inList}
            value={{ image: obj.image as string, imageMobile: (obj.imageMobile as string) || undefined }}
            onChange={(v) => {
              const next: Record<string, Json> = { ...obj, image: v.image };
              if (v.imageMobile) next.imageMobile = v.imageMobile;
              else delete next.imageMobile;
              onChange(next);
            }}
          />
        </div>
        )}
      {entries.map(([ck, cv]) => {
        const field = <FieldEditor key={ck} k={ck} path={`${path}.${ck}`} value={cv} ctx={ctx} depth={depth} onChange={(v) => onChange({ ...obj, [ck]: v })} />;
        if (path !== "business" || !(BUSINESS_TOGGLES as readonly string[]).includes(ck)) return field;
        return <ShownToggle key={ck} name={labelFor(ck)} k={ck} obj={obj} onChange={onChange}>{field}</ShownToggle>;
      })}
      {path === "business" && (
        <ShownToggle name="Instagram" k="instagram" obj={obj} onChange={onChange}>
          <p className="a-cap grow">Instagram de la marca (la cuenta conectada en Ajustes › Conexiones)</p>
        </ShownToggle>
      )}
    </>
  );
}
