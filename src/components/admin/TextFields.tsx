"use client";

/* eslint-disable @next/next/no-img-element */
import { useId } from "react";
import { asset } from "@/lib/assets";
import { HIDDEN_KEYS, PRODUCT_LIST_KEYS, isImageKey, isLong, isRichCandidate, itemLabelFor, labelFor } from "@/lib/admin/textSchema";
import { AIDown, AIPlus, AITrash, AIUp } from "./AdminIcons";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type FieldCtx = {
  slug: string;
  images: string[];
  products: { id: string; name: string }[];
  routesId: string;
};

type Props = { k: string; value: Json; onChange: (v: Json) => void; ctx: FieldCtx; depth?: number };

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
  const rich = isRichCandidate(k) || /\*|\[/.test(value);
  return (
    <div className="a-field">
      <label htmlFor={id}>{labelFor(k)}</label>
      {long ? (
        <textarea id={id} className="a-textarea" value={value} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="a-input" value={value} onChange={(e) => onChange(e.target.value)} list={k === "href" ? "tx-routes" : undefined} />
      )}
      {(vars || (rich && /\*|\[/.test(value))) && (
        <span className="a-cap">
          {rich && /\*|\[/.test(value) && <>Usa *así* para resaltar, **así** para negrita y [texto](/ruta) para un enlace. </>}
          {vars && <>Deja tal cual {vars.join(", ")}: se reemplaza por el dato del cliente.</>}
        </span>
      )}
    </div>
  );
}

export function ImagePicker({ value, onChange, ctx }: { value: string; onChange: (v: string) => void; ctx: FieldCtx }) {
  const id = useId();
  return (
    <div className="a-field" role="group" aria-labelledby={id}>
      <span id={id} style={{ fontSize: 13, fontWeight: 600 }}>{labelFor("image")}</span>
      <div className="img-pick">
        {ctx.images.map((src) => (
          <button key={src} type="button" className={src === value ? "on" : ""} aria-pressed={src === value} aria-label={`Usar ${src.split("/").pop()}`} onClick={() => onChange(src)}>
            <img src={asset(ctx.slug, src)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <span className="a-cap">Fotos de la marca. Subir fotos nuevas llega con la Fase 3.</span>
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
export function FieldEditor({ k, value, onChange, ctx, depth = 0 }: Props) {
  const id = useId();
  if (HIDDEN_KEYS.has(k)) return null;

  if (PRODUCT_LIST_KEYS.has(k) && Array.isArray(value)) {
    return <ProductChecks k={k} value={value as string[]} onChange={onChange} ctx={ctx} />;
  }
  if (typeof value === "string") {
    if (isImageKey(k)) return <ImagePicker value={value} onChange={onChange} ctx={ctx} />;
    if (k === "hex")
      return (
        <div className="a-field">
          <label htmlFor={id}>{labelFor(k)}</label>
          <div className="color-in"><input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} /><span className="a-cap">{value}</span></div>
        </div>
      );
    return <TextInput k={k} value={value} onChange={onChange} />;
  }
  if (typeof value === "number") {
    return (
      <div className="a-field">
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
      <fieldset className="tx-group" aria-labelledby={id}>
        <div className="tx-group-h">
          <span id={id} className="a-h3">{labelFor(k)}</span>
          <span className="a-cap">{items.length}</span>
        </div>
        {items.map((item, i) => (
          <div key={i} className={simple ? "row g2" : "stack g3"} style={simple ? { alignItems: "flex-end" } : { borderTop: i ? "1px solid var(--a-border)" : 0, paddingTop: i ? 12 : 0 }}>
            {!simple && <p className="a-label">{itemLabelFor(k)} {i + 1}</p>}
            <div className="grow stack g3">
              {simple ? (
                <TextInput k={`${k}`} value={item as string} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
              ) : (
                Object.entries(item as Record<string, Json>).map(([ck, cv]) => (
                  <FieldEditor key={ck} k={ck} value={cv} ctx={ctx} depth={depth + 1} onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...(x as object), [ck]: v } : x)))} />
                ))
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

  const entries = Object.entries(value).filter(([ck]) => !HIDDEN_KEYS.has(ck));
  const inner = entries.map(([ck, cv]) => <FieldEditor key={ck} k={ck} value={cv} ctx={ctx} depth={depth + 1} onChange={(v) => onChange({ ...value, [ck]: v })} />);
  if (depth === 0) return <div className="stack g4">{inner}</div>;
  return (
    <fieldset className="tx-group" aria-labelledby={id}>
      <span id={id} className="a-h3">{labelFor(k)}</span>
      {inner}
    </fieldset>
  );
}

export type { Json };
