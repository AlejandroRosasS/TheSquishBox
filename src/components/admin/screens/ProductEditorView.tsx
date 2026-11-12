"use client";

import Link from "next/link";
import { use, useId, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { MAX_LINE_QTY, minQty, productKind } from "@/lib/catalog";
import type { AdminProduct } from "@/lib/admin/types";
import type { Variant } from "@/lib/types";
import { ProductView } from "@/components/product/ProductView";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { StorePreview } from "../StorePreview";
import { AdminPage, BackLink, DemoNote, Switch } from "../AdminPage";
import { ProductPhotos } from "../ProductPhotos";
import { Thumb } from "../PhotoPicker";
import { AIDown, AIInstagram, AIPlus, AITrash, AIUp } from "../AdminIcons";

const LOW = 5;

function Locked({ label, value, onChange, synced, long }: { label: string; value: string; onChange: (v: string) => void; synced: boolean; long?: boolean }) {
  const id = useId();
  const [editing, setEditing] = useState(!synced);
  return (
    <div className="a-field">
      <div className="row between">
        <label htmlFor={id}>{label}</label>
        {!editing && <button className="a-btn sm ghost" type="button" onClick={() => setEditing(true)}>Editar a mano</button>}
      </div>
      {editing ? (
        long ? <textarea id={id} className="a-textarea" value={value} onChange={(e) => onChange(e.target.value)} /> : <input id={id} className="a-input" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="locked" id={id}>{value || <span className="a-cap">Vacío</span>}</div>
      )}
    </div>
  );
}

function Money({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="a-field">
      <label htmlFor={id}>{label}</label>
      <div className="a-prefix">
        <span>S/</span>
        <input id={id} inputMode="decimal" value={text ?? (value ? String(value) : "")} placeholder="0.00"
          onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value.replace(",", ".")); onChange(Number.isFinite(n) ? n : 0); }}
          onBlur={() => setText(null)} />
      </div>
    </div>
  );
}

export function ProductEditorView({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const { bundle, toast } = useAdmin();
  const { catalog, setCatalog, hydrated } = useAdminCatalog();
  const saved = catalog.products.find((p) => p.id === id);
  const savedCosts = useMemo(() => catalog.costs[id] ?? {}, [catalog.costs, id]);
  const [draft, setDraft] = useState<AdminProduct | null>(null);
  const [costs, setCosts] = useState<Record<string, number> | null>(null);
  // Opciones apartadas al pasar a «Precio único» (vuelven si regresas a «Con opciones» sin guardar).
  const [stash, setStash] = useState<Variant[]>([]);
  const base = draft ?? saved;
  // Un producto nuevo sin precio todavía: se edita como «Precio único» con una variante vacía.
  const p = base && !base.variants.length ? { ...base, variants: [{ id: "unica", label: "Precio único", price: 0, priceIsReference: false, stock: 0 }] } : base;
  const c = costs ?? savedCosts;

  if (!p) {
    return (
      <AdminPage title="Producto" back={{ href: "/admin/productos", label: "Productos" }}>
        <h1 className="a-h1">{hydrated ? "No encontramos este producto" : "Cargando…"}</h1>
        {hydrated && <Link className="a-btn" href="/admin/productos" style={{ alignSelf: "flex-start" }}>Volver a Productos</Link>}
      </AdminPage>
    );
  }

  const edit = (patch: Partial<AdminProduct>) => setDraft({ ...p, ...patch });
  const min = minQty(p);
  const options = productKind(p) === "options";
  const editVar = (i: number, patch: Partial<Variant>) => edit({ variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const dirty = draft !== null || costs !== null;
  const published = p.status !== "draft";
  const lineName = catalog.lines.find((l) => l.id === p.line)?.name ?? "";
  const previewBundle = { ...bundle, catalog: { ...bundle.catalog, products: [p, ...bundle.catalog.products.filter((x) => x.id !== p.id)] } };

  const save = (status?: AdminProduct["status"], msg = "Producto guardado") => {
    const next: AdminProduct = {
      ...p,
      ...(status ? { status } : {}),
      kind: options ? "options" : "simple",
      // Una foto de opción que ya no está entre las fotos del producto se descarta.
      variants: p.variants.map((v) => (v.image && !p.images.includes(v.image) ? { ...v, image: undefined } : v)),
    };
    if (!next.name.trim()) return toast("Ponle un nombre al producto");
    if (options) {
      const unnamed = next.variants.findIndex((v) => !v.label.trim());
      if (unnamed >= 0) return toast(`Ponle nombre a la opción ${unnamed + 1}`);
      const labels = next.variants.map((v) => v.label.trim().toLowerCase());
      if (new Set(labels).size !== labels.length) return toast("Hay dos opciones con el mismo nombre");
    }
    if (next.status !== "draft") {
      const free = next.variants.find((v) => !(v.price > 0));
      if (free) return toast(options ? `Ponle precio a «${free.label}» para publicar` : "Ponle precio al producto para publicar");
    }
    setCatalog({ ...catalog, products: catalog.products.map((x) => (x.id === id ? next : x)), costs: { ...catalog.costs, [id]: c } });
    setDraft(null);
    setCosts(null);
    setStash([]);
    toast(msg);
  };

  const newVariant = (label = ""): Variant => ({ id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, label, price: 0, priceIsReference: false, stock: 0 });
  const addVariant = () => edit({ kind: "options", variants: [...p.variants, newVariant()] });
  const removeVariant = (i: number) => edit({ variants: p.variants.filter((_, j) => j !== i) });
  const moveVariant = (i: number, d: -1 | 1) => {
    const v = [...p.variants];
    [v[i], v[i + d]] = [v[i + d], v[i]];
    edit({ variants: v });
  };
  // Al pasar a «Precio único» se queda la primera opción; las demás se guardan aparte por si vuelves a «Con opciones».
  const toSimple = () => {
    if (!options) return;
    setStash(p.variants.slice(1));
    edit({ kind: "simple", variants: p.variants.slice(0, 1) });
  };
  const toOptions = () => {
    if (options) return;
    const list = [...p.variants, ...stash];
    while (list.length < 2) list.push(newVariant());
    setStash([]);
    edit({ kind: "options", variants: list });
  };
  const cap = (n: number) => (n <= 0 ? "Agotado en la tienda" : n <= LOW ? "Stock bajo · se avisará" : "Disponible");
  const pubStatus = (on: boolean): AdminProduct["status"] => (on ? (p.variants.length && p.variants.every((v) => v.stock <= 0) && p.stockMode !== "none" ? "sold_out" : "published") : "draft");

  return (
    <AdminPage title={p.name || "Producto sin título"} back={{ href: "/admin/productos", label: "Productos" }} topRight={<span className={`st ${published ? "publicado" : "borrador"}`}>{published ? "Publicado" : "Borrador"}</span>}>
      <div className="a-head">
        <div className="stack g1">
          <BackLink href="/admin/productos" label="Productos" />
          <div className="row g3 wrap-row"><h1 className="a-h1">{p.name || "Producto sin título"}</h1><span className={`st ${published ? "publicado" : "borrador"}`}>{published ? "Publicado" : "Borrador"}</span></div>
        </div>
        <div className="row g2 only-d">
          {published && <a className="a-btn" href={`/p/${p.id}`} target="_blank" rel="noreferrer">Ver en tienda</a>}
          <button className="a-btn" type="button" disabled={!dirty} onClick={() => save()}>Guardar</button>
        </div>
      </div>

      <div className="a-cols">
        <div className="stack g5">
          <section className="a-card" aria-labelledby="ed-ig">
            <div className="a-card-h">
              <h2 className="a-h2" id="ed-ig">{p.igSynced ? "Contenido desde Instagram" : "Contenido"}</h2>
              {p.igSynced && <span className="sync"><AIInstagram size="sm" style={{ width: 14, height: 14 }} />Sincronizado</span>}
            </div>
            {p.igSynced && <p className="a-cap">Fotos y texto se actualizan solos cuando editan el post en Instagram. Si cambias algo a mano (incluidas las fotos), eso deja de sincronizarse.</p>}
            <ProductPhotos product={p} onChange={edit} />
            <Locked label="Nombre" value={p.name} synced={!!p.igSynced} onChange={(v) => edit({ name: v })} />
            <Locked label="Descripción" long value={p.description} synced={!!p.igSynced} onChange={(v) => edit({ description: v })} />
            <div className="a-field">
              <label htmlFor="ed-badge">Etiqueta <span className="a-cap">(opcional, ej.: Favorito, Nuevo)</span></label>
              <input id="ed-badge" className="a-input" value={p.badge ?? ""} onChange={(e) => edit({ badge: e.target.value || undefined })} />
              <span className="a-cap">«Agotado» y «Últimas N» se ponen solos según el stock.</span>
            </div>
            <a className="a-cap" href={`https://www.instagram.com/${bundle.tenant.instagram}/`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Ver cuenta en Instagram</a>
          </section>

          <section className="a-card" aria-labelledby="ed-price">
            <h2 className="a-h2" id="ed-price">Tipo de producto y precio</h2>
            <div className="a-seg" role="radiogroup" aria-label="Tipo de producto" style={{ width: "100%" }}>
              <button className={!options ? "on" : ""} type="button" role="radio" aria-checked={!options} onClick={toSimple}>Precio único</button>
              <button className={options ? "on" : ""} type="button" role="radio" aria-checked={options} onClick={toOptions}>Con opciones</button>
            </div>
            <p className="a-cap">
              {options
                ? "El cliente elige una opción antes de agregar al carrito. Cada opción tiene su precio, su costo y su stock. Agrega todas las que necesites."
                : "Un solo producto con un solo precio. Puedes subirle varias fotos."}
            </p>

            {options && (
              <div className="a-field">
                <label htmlFor="ed-optq">Pregunta para elegir <span className="a-cap">(se ve arriba de las opciones)</span></label>
                <input id="ed-optq" className="a-input" value={p.optionsLabel ?? ""} placeholder={bundle.storefront.product.variantQuestion} onChange={(e) => edit({ optionsLabel: e.target.value || undefined })} />
                <span className="a-cap">Si la dejas vacía se usa «{bundle.storefront.product.variantQuestion}».</span>
              </div>
            )}

            {p.variants.map((v, i) => {
              const cost = c[v.id] ?? 0;
              const contrib = v.price - cost;
              const margin = v.price ? Math.round((contrib / v.price) * 100) : 0;
              const name = v.label || `Opción ${i + 1}`;
              return (
                <div key={v.id} className={options ? "opt-edit" : "stack g2"}>
                  {options && (
                    <div className="row between">
                      <b className="a-cap" style={{ fontWeight: 700 }}>Opción {i + 1}</b>
                      <div className="row g1">
                        <button className="a-btn sm ghost" type="button" style={{ width: 44, padding: 0 }} disabled={i === 0} aria-label={`Subir ${name}`} onClick={() => moveVariant(i, -1)}><AIUp size="sm" /></button>
                        <button className="a-btn sm ghost" type="button" style={{ width: 44, padding: 0 }} disabled={i === p.variants.length - 1} aria-label={`Bajar ${name}`} onClick={() => moveVariant(i, 1)}><AIDown size="sm" /></button>
                        <button className="a-btn sm ghost danger" type="button" style={{ width: 44, padding: 0 }} disabled={p.variants.length <= 2} aria-label={`Quitar ${name}`} title={p.variants.length <= 2 ? "Mínimo 2 opciones. Para un solo precio elige «Precio único»." : undefined} onClick={() => removeVariant(i)}><AITrash size="sm" /></button>
                      </div>
                    </div>
                  )}
                  <div className={options ? "var-edit opt" : "var-edit simple"}>
                    {options && <div className="a-field"><label htmlFor={`vl-${i}`}>Nombre de la opción</label><input id={`vl-${i}`} className="a-input" value={v.label} placeholder="Ej.: 3 squishies" onChange={(e) => editVar(i, { label: e.target.value })} /></div>}
                    <Money id={`vp-${i}`} label="Precio" value={v.price} onChange={(n) => editVar(i, { price: n })} />
                    <Money id={`vc-${i}`} label="Costo" value={cost} onChange={(n) => setCosts({ ...c, [v.id]: n })} />
                  </div>
                  {options && p.images.length > 0 && (
                    <div className="a-field">
                      <span className="opt-pics-l" id={`vi-${i}`}>Foto de esta opción <span className="a-cap">(opcional)</span></span>
                      <div className="opt-pics" role="radiogroup" aria-labelledby={`vi-${i}`}>
                        <button type="button" role="radio" aria-checked={!v.image || !p.images.includes(v.image)} className={!v.image || !p.images.includes(v.image) ? "on" : ""} onClick={() => editVar(i, { image: undefined })}>Ninguna</button>
                        {p.images.map((img, k) => (
                          <button key={img + k} type="button" role="radio" aria-checked={v.image === img} aria-label={`Foto ${k + 1}`} className={v.image === img ? "on" : ""} onClick={() => editVar(i, { image: img })}><Thumb src={img} /></button>
                        ))}
                      </div>
                      <span className="a-cap">Al elegir esta opción en la tienda, la galería muestra esta foto y el carrito la usa de miniatura.</span>
                    </div>
                  )}
                  {v.price > 0 && (
                    <div className="row g2" style={{ justifyContent: "flex-end" }}>
                      <span className={`marg ${contrib < 0 ? "bad" : ""}`}>Contribución {formatPrice(contrib)} · margen {margin}%</span>
                    </div>
                  )}
                </div>
              );
            })}
            {options && <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} onClick={addVariant}><AIPlus size="sm" /> Agregar opción</button>}
            <p className="a-cap">El costo es interno (producto, caja, sobres y empaque). No se muestra en la tienda; se usa para calcular márgenes en Ventas.</p>
            <div className="a-field">
              <label htmlFor="ed-line">Línea</label>
              <select id="ed-line" className="a-select" value={p.line} onChange={(e) => edit({ line: e.target.value })}>
                {catalog.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </section>
        </div>

        <div className="stack g5">
          <section className="a-card" aria-labelledby="ed-inv">
            <h2 className="a-h2" id="ed-inv">Inventario</h2>
            <div className="a-seg" role="radiogroup" aria-label="Tipo de inventario" style={{ width: "100%" }}>
              <button className={p.stockMode === "none" ? "on" : ""} type="button" role="radio" aria-checked={p.stockMode === "none"} onClick={() => edit({ stockMode: "none" })}>Sin control de stock</button>
              <button className={p.stockMode !== "none" ? "on" : ""} type="button" role="radio" aria-checked={p.stockMode !== "none"} onClick={() => edit({ stockMode: "stock" })}>Con control de stock</button>
            </div>
            {p.stockMode === "none" ? (
              <div className="stack g3">
                <div className="row between">
                  <div><b>{p.available !== false ? "Disponible" : "Agotado"}</b><p className="a-cap">Se muestra como «{p.available !== false ? "Disponible" : "Agotado"}» en la tienda.</p></div>
                  <Switch on={p.available !== false} onChange={(v) => edit({ available: v })} label="Disponible" />
                </div>
                <p className="a-cap">Se vende siempre, sin contar unidades. Útil para lo que siempre tienes o armas bajo pedido. Cuando quieras controlar unidades, elige «Con control de stock».</p>
              </div>
            ) : (
              <div className="stack">
                {p.variants.map((v, i) => (
                  <div className="var-row" key={v.id}>
                    <div><b>{options ? v.label || "Opción sin nombre" : "Stock"}</b><p className="a-cap">{cap(v.stock)}</p></div>
                    <div className="stepq">
                      <button type="button" onClick={() => editVar(i, { stock: Math.max(0, v.stock - 1) })} aria-label={`Restar stock de ${v.label}`}>−</button>
                      <span aria-live="polite">{v.stock}</span>
                      <button type="button" onClick={() => editVar(i, { stock: v.stock + 1 })} aria-label={`Sumar stock de ${v.label}`}>+</button>
                    </div>
                  </div>
                ))}
                <div className="row between" style={{ paddingTop: 12 }}>
                  <div><b>Avisar stock bajo</b><p className="a-cap">Cuando queden {LOW} o menos</p></div>
                  <Switch on={p.lowAlert !== false} onChange={(v) => edit({ lowAlert: v })} label="Avisar stock bajo" />
                </div>
                <p className="a-cap" style={{ marginTop: 10 }}>Se descuenta solo con cada venta. Al llegar a 0, {options ? "esa opción pasa" : "el producto pasa"} a «Agotado».</p>
              </div>
            )}
            <div className="var-row" style={{ borderTop: "1px solid var(--a-border)", paddingTop: 12 }}>
              <div>
                <b id="ed-min">Pedido mínimo</b>
                <p className="a-cap">
                  {min > 1
                    ? `En la tienda la cantidad empieza en ${min} y no se puede bajar de ahí${options ? " (por opción)" : ""}.`
                    : "Se puede pedir desde 1 unidad. Súbelo para lo hecho a medida."}
                </p>
              </div>
              <div className="stepq" role="group" aria-labelledby="ed-min">
                <button type="button" onClick={() => edit({ minQty: min - 1 > 1 ? min - 1 : undefined })} disabled={min <= 1} aria-label="Bajar pedido mínimo">−</button>
                <span aria-live="polite">{min}</span>
                <button type="button" onClick={() => edit({ minQty: min + 1 })} disabled={min >= MAX_LINE_QTY} aria-label="Subir pedido mínimo">+</button>
              </div>
            </div>
          </section>

          <section className="a-card" aria-labelledby="ed-pub">
            <h2 className="a-h2" id="ed-pub">Publicación</h2>
            <div className="row between">
              <div><b>Visible en la tienda</b><p className="a-cap">{published ? `Publicado · se ve en ${lineName}` : "Borrador · no se ve en la tienda"}</p></div>
              <Switch on={published} onChange={(v) => edit({ status: pubStatus(v) })} label="Visible en la tienda" />
            </div>
            <button className="a-btn primary block" type="button" onClick={() => save(pubStatus(true), "Producto publicado")}>Publicar</button>
            <button className="a-btn block" type="button" onClick={() => save("draft", "Guardado como borrador")}>Guardar como borrador</button>
            {dirty && <button className="a-btn ghost block" type="button" onClick={() => { setDraft(null); setCosts(null); setStash([]); }}>Descartar cambios</button>}
          </section>
          <section className="a-card" aria-labelledby="ed-prev">
            <h2 className="a-h2" id="ed-prev">Así se ve en la tienda</h2>
            <StorePreview bundle={previewBundle} mode="m" maxHeight={820} label={`Vista previa de ${p.name || "este producto"} en la tienda`}>
              <ProductView key={`${p.variants.map((v) => v.id).join("|")}·${min}`} product={p} lineLabel={lineName} />
            </StorePreview>
          </section>
          <DemoNote>Demo: los cambios de productos se guardan en este navegador y se ven en el panel. La tienda en vivo los toma cuando conectemos la base de datos (Fase 3).</DemoNote>
        </div>
      </div>

      {dirty && (
        <div className="a-sticky only-m">
          <span className="a-cap">Tienes cambios sin guardar.</span>
          <button className="a-btn primary" type="button" onClick={() => save()}>Guardar</button>
        </div>
      )}
    </AdminPage>
  );
}
