"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { use, useId, useMemo, useState } from "react";
import { asset } from "@/lib/assets";
import { formatPrice } from "@/lib/format";
import type { AdminProduct } from "@/lib/admin/types";
import type { Variant } from "@/lib/types";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, BackLink, DemoNote, Switch } from "../AdminPage";
import { AIInstagram, AIPlus, AITrash, AIUp } from "../AdminIcons";

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
  const [showPicker, setShowPicker] = useState(false);
  const p = draft ?? saved;
  const c = costs ?? savedCosts;
  const a = (x: string) => asset(bundle.tenant.slug, x);

  const brandImages = useMemo(() => {
    const s = new Set<string>();
    catalog.products.forEach((x) => x.images.forEach((i) => s.add(i)));
    bundle.storefront.tiles.forEach((t) => s.add(t.image));
    s.add(bundle.storefront.hero.image);
    return [...s];
  }, [catalog.products, bundle.storefront]);

  if (!p) {
    return (
      <AdminPage title="Producto" back={{ href: "/admin/productos", label: "Productos" }}>
        <h1 className="a-h1">{hydrated ? "No encontramos este producto" : "Cargando…"}</h1>
        {hydrated && <Link className="a-btn" href="/admin/productos" style={{ alignSelf: "flex-start" }}>Volver a Productos</Link>}
      </AdminPage>
    );
  }

  const edit = (patch: Partial<AdminProduct>) => setDraft({ ...p, ...patch });
  const editVar = (i: number, patch: Partial<Variant>) => edit({ variants: p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const dirty = draft !== null || costs !== null;
  const published = p.status !== "draft";
  const lineName = catalog.lines.find((l) => l.id === p.line)?.name ?? "";

  const save = (status?: AdminProduct["status"], msg = "Producto guardado") => {
    const next: AdminProduct = { ...p, ...(status ? { status } : {}) };
    if (!next.name.trim()) return toast("Ponle un nombre al producto");
    setCatalog({ ...catalog, products: catalog.products.map((x) => (x.id === id ? next : x)), costs: { ...catalog.costs, [id]: c } });
    setDraft(null);
    setCosts(null);
    toast(msg);
  };

  const addVariant = () => edit({ variants: [...p.variants, { id: `v${Date.now().toString(36)}`, label: "Nueva variante", price: 0, priceIsReference: true, stock: 0 }] });
  const removeVariant = (i: number) => edit({ variants: p.variants.filter((_, j) => j !== i) });
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
            {p.igSynced && <p className="a-cap">Fotos y texto se actualizan solos cuando editan el post en Instagram. Si editas algo a mano, ese campo deja de sincronizarse.</p>}
            <div className="media">
              {p.images.map((img, i) => (
                <div key={img + i}>
                  <img src={a(img)} alt={`Foto ${i + 1}`} />
                  {i === 0 && <span className="cover">Portada</span>}
                  <span className="m-act">
                    {i > 0 && <button type="button" aria-label={`Usar foto ${i + 1} como portada`} onClick={() => edit({ images: [img, ...p.images.filter((_, j) => j !== i)] })}><AIUp size="sm" /></button>}
                    <button type="button" aria-label={`Quitar foto ${i + 1}`} onClick={() => edit({ images: p.images.filter((_, j) => j !== i) })}><AITrash size="sm" /></button>
                  </span>
                </div>
              ))}
            </div>
            <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} aria-expanded={showPicker} onClick={() => setShowPicker(!showPicker)}><AIPlus size="sm" /> Agregar foto</button>
            {showPicker && (
              <div className="img-pick">
                {brandImages.filter((x) => !p.images.includes(x)).map((src) => (
                  <button key={src} type="button" aria-label={`Agregar ${src.split("/").pop()}`} onClick={() => edit({ images: [...p.images, src] })}><img src={a(src)} alt="" /></button>
                ))}
              </div>
            )}
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
            <div className="a-card-h"><h2 className="a-h2" id="ed-price">Variantes, precio y costo</h2><button className="a-btn sm" type="button" onClick={addVariant}><AIPlus size="sm" /> Variante</button></div>
            {p.variants.map((v, i) => {
              const cost = c[v.id] ?? 0;
              const contrib = v.price - cost;
              const margin = v.price ? Math.round((contrib / v.price) * 100) : 0;
              return (
                <div key={v.id} className="stack g2" style={{ borderBottom: "1px solid var(--a-border)", paddingBottom: 12 }}>
                  <div className="var-edit">
                    <div className="a-field"><label htmlFor={`vl-${i}`}>Nombre de la variante</label><input id={`vl-${i}`} className="a-input" value={v.label} onChange={(e) => editVar(i, { label: e.target.value })} /></div>
                    <Money id={`vp-${i}`} label="Precio" value={v.price} onChange={(n) => editVar(i, { price: n })} />
                    <Money id={`vc-${i}`} label="Costo" value={cost} onChange={(n) => setCosts({ ...c, [v.id]: n })} />
                    <button className="a-btn ghost danger" type="button" style={{ padding: 0, width: 44 }} disabled={p.variants.length === 1} aria-label={`Quitar variante ${v.label}`} onClick={() => removeVariant(i)}><AITrash size="sm" /></button>
                  </div>
                  <div className="row between wrap-row g2">
                    <label className="row g2" style={{ minHeight: 44, cursor: "pointer" }}>
                      <input type="checkbox" checked={v.priceIsReference} style={{ width: 20, height: 20 }} onChange={(e) => editVar(i, { priceIsReference: e.target.checked })} />
                      <span className="a-cap">Precio referencial (falta confirmar)</span>
                    </label>
                    {v.price > 0 && <span className={`marg ${contrib < 0 ? "bad" : ""}`}>Contribución {formatPrice(contrib)} · margen {margin}%</span>}
                  </div>
                </div>
              );
            })}
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
                <p className="a-cap">Útil para productos que se arman bajo pedido.</p>
              </div>
            ) : (
              <div className="stack">
                {p.variants.map((v, i) => (
                  <div className="var-row" key={v.id}>
                    <div><b>{v.label}</b><p className="a-cap">{cap(v.stock)}</p></div>
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
                <p className="a-cap" style={{ marginTop: 10 }}>Se descuenta solo con cada venta. Al llegar a 0, la variante pasa a «Agotado».</p>
              </div>
            )}
          </section>

          <section className="a-card" aria-labelledby="ed-pub">
            <h2 className="a-h2" id="ed-pub">Publicación</h2>
            <div className="row between">
              <div><b>Visible en la tienda</b><p className="a-cap">{published ? `Publicado · se ve en ${lineName}` : "Borrador · no se ve en la tienda"}</p></div>
              <Switch on={published} onChange={(v) => edit({ status: pubStatus(v) })} label="Visible en la tienda" />
            </div>
            <button className="a-btn primary block" type="button" onClick={() => save(pubStatus(true), "Producto publicado")}>Publicar</button>
            <button className="a-btn block" type="button" onClick={() => save("draft", "Guardado como borrador")}>Guardar como borrador</button>
            {dirty && <button className="a-btn ghost block" type="button" onClick={() => { setDraft(null); setCosts(null); }}>Descartar cambios</button>}
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
