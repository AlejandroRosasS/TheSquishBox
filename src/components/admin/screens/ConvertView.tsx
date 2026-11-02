"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { asset } from "@/lib/assets";
import type { AdminProduct } from "@/lib/admin/types";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, BackLink, Switch } from "../AdminPage";
import { useIg } from "./useIg";

type Item = { name: string; line: string; mode: "stock" | "none"; vars: { label: string; price: string; cost: string; qty: number }[] };

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ConvertView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const router = useRouter();
  const { posts, st, setSt, markConverted } = useIg();
  const { catalog, setCatalog } = useAdminCatalog();
  const selected = st.sel.map((id) => posts.find((p) => p.id === id)).filter((p) => p && p.kind !== "done") as typeof posts;
  const [items, setItems] = useState<Record<string, Item>>({});
  const get = (id: string): Item => {
    const p = posts.find((x) => x.id === id)!;
    // Línea sugerida solo si existe en el catálogo; precio solo si el caption lo dice (nunca se inventa).
    const line = p.line && catalog.lines.some((l) => l.id === p.line) ? p.line : catalog.lines[0]?.id ?? "";
    const vars = (p.variants?.length ? p.variants : ["Única"]).map((label, i) => ({ label, price: p.prices?.[i] != null ? String(p.prices[i]) : "", cost: "", qty: 0 }));
    return items[id] ?? { name: p.name, line, mode: "stock", vars };
  };
  const set = (id: string, patch: Partial<Item>) => setItems((s) => ({ ...s, [id]: { ...get(id), ...patch } }));
  const setVar = (id: string, i: number, patch: Partial<Item["vars"][number]>) => set(id, { vars: get(id).vars.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const pct = (p: string, c: string) => { const a = parseFloat(p), b = parseFloat(c); return a > 0 && b >= 0 ? `${Math.round(((a - b) / a) * 100)}%` : null; };
  const missingPrice = selected.some((p) => get(p.id).vars.some((v) => !(parseFloat(v.price) > 0)));

  const commit = (status: AdminProduct["status"]) => {
    if (status !== "draft" && missingPrice) return toast("Falta el precio de alguna variante");
    const ids = new Set(catalog.products.map((p) => p.id));
    const newProducts: AdminProduct[] = [];
    const costs = { ...catalog.costs };
    selected.forEach((p) => {
      const it = get(p.id);
      let id = slugify(it.name) || p.id;
      while (ids.has(id)) id = `${id}-2`;
      ids.add(id);
      const variants = it.vars.map((v, i) => ({ id: it.vars.length === 1 ? "unica" : String(i + 1), label: v.label, price: parseFloat(v.price) || 0, priceIsReference: false, stock: it.mode === "stock" ? v.qty : 99 }));
      costs[id] = Object.fromEntries(variants.map((v, i) => [v.id, parseFloat(it.vars[i].cost) || 0]));
      const images = p.images?.length ? p.images : [p.img];
      newProducts.push({ id, name: it.name, line: it.line, status, kind: variants.length > 1 ? "options" : "simple", description: p.caption ?? "", variants, images, igImages: images, photosSynced: true, stockMode: it.mode, available: true, lowAlert: true, igSynced: true, igPostId: p.mediaId });
    });
    setCatalog({ ...catalog, products: [...catalog.products, ...newProducts], costs });
    void markConverted(selected.map((p) => p.id));
    toast(status === "draft" ? "Guardados como borradores" : `${newProducts.length} ${newProducts.length === 1 ? "producto publicado" : "productos publicados"}`);
    router.push("/admin/productos");
  };

  return (
    <AdminPage title="Convertir en producto" back={{ href: "/admin/instagram", label: "Instagram" }} topRight={<span className="a-cap">{selected.length} posts</span>}>
      <div className="a-head">
        <div className="stack g1"><BackLink href="/admin/instagram" label="Instagram" /><h1 className="a-h1">Convertir en producto</h1><p className="a-sub">Fotos y texto ya vienen de Instagram. Solo define precio, costo, línea e inventario de cada variante.</p></div>
      </div>
      {!selected.length && (
        <section className="a-card"><p>No hay posts seleccionados.</p><Link className="a-btn" href="/admin/instagram" style={{ alignSelf: "flex-start" }}>Elegir posts</Link></section>
      )}
      {selected.map((p) => {
        const it = get(p.id);
        return (
          <section key={p.id} className="a-card" aria-label={it.name}>
            <div className="dr">
              <div className="stack g2"><div className="pic"><img src={asset(tenant.slug, p.img)} alt="" /></div><span className="a-cap">{p.reel ? "Reel" : "Post"}</span></div>
              <div className="stack g4">
                <div className="a-field"><label htmlFor={`n-${p.id}`}>Nombre</label><input id={`n-${p.id}`} className="a-input" value={it.name} onChange={(e) => set(p.id, { name: e.target.value })} /><span className="a-cap">Sugerido desde el caption. Puedes cambiarlo.</span></div>
                {p.caption && <div className="cap">{p.caption}</div>}
                <div className="g4c">
                  {it.vars.map((v, i) => (
                    <div key={`p${i}`} className="a-field"><label htmlFor={`p-${p.id}-${i}`}>Precio {v.label}</label><div className="a-prefix"><span>S/</span><input id={`p-${p.id}-${i}`} inputMode="decimal" value={v.price} placeholder="0" onChange={(e) => setVar(p.id, i, { price: e.target.value })} /></div></div>
                  ))}
                  {it.vars.map((v, i) => (
                    <div key={`c${i}`} className="a-field"><label htmlFor={`c-${p.id}-${i}`}>Costo {v.label}</label><div className="a-prefix"><span>S/</span><input id={`c-${p.id}-${i}`} inputMode="decimal" value={v.cost} placeholder="0" onChange={(e) => setVar(p.id, i, { cost: e.target.value })} /></div>{pct(v.price, v.cost) && <span className="marg">Margen {pct(v.price, v.cost)}</span>}</div>
                  ))}
                </div>
                <div className="a-grid2">
                  <div className="a-field"><label htmlFor={`l-${p.id}`}>Línea</label><select id={`l-${p.id}`} className="a-select" value={it.line} onChange={(e) => set(p.id, { line: e.target.value })}>{catalog.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                  <div className="a-field"><span style={{ fontSize: 13, fontWeight: 600 }}>Inventario</span>
                    <div className="a-seg" role="radiogroup" aria-label="Inventario" style={{ width: "100%" }}>
                      <button className={it.mode === "none" ? "on" : ""} type="button" role="radio" aria-checked={it.mode === "none"} onClick={() => set(p.id, { mode: "none" })}>Sin stock</button>
                      <button className={it.mode === "stock" ? "on" : ""} type="button" role="radio" aria-checked={it.mode === "stock"} onClick={() => set(p.id, { mode: "stock" })}>Con stock</button>
                    </div>
                  </div>
                </div>
                {it.mode === "stock" ? (
                  <div className="row g5 wrap-row">
                    {it.vars.map((v, i) => (
                      <div className="row g3" key={i}><span style={{ fontWeight: 600 }}>{v.label}</span>
                        <div className="qty2"><button type="button" aria-label={`Restar ${v.label}`} onClick={() => setVar(p.id, i, { qty: Math.max(0, v.qty - 1) })}>−</button><span>{v.qty}</span><button type="button" aria-label={`Sumar ${v.label}`} onClick={() => setVar(p.id, i, { qty: v.qty + 1 })}>+</button></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="row g3"><Switch on label="Disponible" /><span>Disponible <span className="a-cap">(se arma bajo pedido)</span></span></div>
                )}
                <div className="row between wrap-row g2"><span /><button className="a-btn sm ghost danger" type="button" onClick={() => setSt((s) => ({ ...s, sel: s.sel.filter((x) => x !== p.id) }))}>Quitar de la lista</button></div>
              </div>
            </div>
          </section>
        );
      })}
      {selected.length > 0 && (
        <div className="a-sticky">
          <span className="a-cap">Se publican en la tienda en el orden de su línea.</span>
          <div className="row g2">
            <button className="a-btn" type="button" onClick={() => commit("draft")}>Guardar borradores</button>
            <button className="a-btn primary" type="button" onClick={() => commit("published")}>Publicar {selected.length} {selected.length === 1 ? "producto" : "productos"}</button>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
