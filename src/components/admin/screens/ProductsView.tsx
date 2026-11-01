"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { isSoldOut } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { AdminProduct } from "@/lib/admin/types";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { AIInstagram, AISearch } from "../AdminIcons";
import { LineHeader } from "../LineHeader";

type Filter = "all" | "pub" | "draft" | "low";

export function stockInfo(p: AdminProduct): { label: string; cls: string } {
  if (p.stockMode === "none") return p.available === false ? { label: "Agotado", cls: "agotado" } : { label: "Sin control de stock", cls: "publicado" };
  if (p.status === "draft" && !p.variants.length) return { label: "Sin definir", cls: "borrador" };
  if (isSoldOut(p)) return { label: "Agotado", cls: "agotado" };
  const low = p.variants.some((v) => v.stock > 0 && v.stock <= 5);
  const stocks = p.variants.map((v) => v.stock).join(" · ");
  return low ? { label: `Stock bajo · ${stocks}`, cls: "bajo" } : { label: `Stock ${stocks}`, cls: "publicado" };
}

export function priceSummary(p: AdminProduct): string {
  if (!p.variants.length || p.variants.every((v) => !v.price)) return "Sin precio";
  if (p.variants.length === 1) return formatPrice(p.variants[0].price);
  return p.variants.map((v) => `${v.label} ${formatPrice(v.price)}`).join(" · ");
}

export function ProductsView() {
  const { bundle, toast } = useAdmin();
  const { catalog, setCatalog } = useAdminCatalog();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [newLine, setNewLine] = useState<string | null>(null);
  const [newLineAt, setNewLineAt] = useState<"top" | "bottom">("top");
  const a = (p: string) => asset(bundle.tenant.slug, p);

  const match = (p: AdminProduct) => {
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "pub") return p.status !== "draft";
    if (filter === "draft") return p.status === "draft";
    if (filter === "low") return ["bajo", "agotado"].includes(stockInfo(p).cls);
    return true;
  };
  const count = (f: Filter) => catalog.products.filter((p) => (f === "draft" ? p.status === "draft" : ["bajo", "agotado"].includes(stockInfo(p).cls))).length;

  const moveLine = (i: number, d: number) => {
    const lines = catalog.lines.slice();
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    [lines[i], lines[j]] = [lines[j], lines[i]];
    setCatalog({ ...catalog, lines: lines.map((l, k) => ({ ...l, order: k + 1 })) });
  };
  const addLine = () => {
    const name = (newLine ?? "").trim();
    if (!name) return;
    const id = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `linea-${Date.now()}`;
    if (catalog.lines.some((l) => l.id === id || l.name.trim().toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) return toast("Ya existe una línea con ese nombre");
    setCatalog({ ...catalog, lines: [...catalog.lines, { id, name, order: catalog.lines.length + 1 }] });
    setNewLine(null);
    toast(`Línea «${name}» creada`);
  };

  const newLineForm = (
    <form className="a-card" onSubmit={(e) => { e.preventDefault(); addLine(); }}>
      <div className="a-field"><label htmlFor="nl">Nombre de la nueva línea</label><input id="nl" className="a-input" autoFocus value={newLine ?? ""} onChange={(e) => setNewLine(e.target.value)} placeholder="Ej.: Navidad" /></div>
      <div className="row g2"><button className="a-btn primary" type="submit">Crear línea</button><button className="a-btn ghost" type="button" onClick={() => setNewLine(null)}>Cancelar</button></div>
    </form>
  );

  const chips: [Filter, string, number?][] = [["all", "Todos"], ["pub", "Publicados"], ["draft", "Borradores", count("draft")], ["low", "Stock bajo / agotado", count("low")]];

  return (
    <AdminPage title="Productos" topRight={<Link className="a-btn primary sm" href="/admin/instagram">+ Desde IG</Link>}>
      <div className="a-head">
        <div className="stack g1"><h1 className="a-h1">Productos</h1><p className="a-sub">Agrupados por línea. El orden de aquí es el orden de la tienda.</p></div>
        <div className="row g2 wrap-row only-d">
          <button className="a-btn" type="button" onClick={() => { setNewLineAt("top"); setNewLine(""); }}>+ Nueva línea</button>
          <Link className="a-btn primary" href="/admin/instagram"><AIInstagram />Convertir post en producto</Link>
        </div>
      </div>

      {newLine !== null && newLineAt === "top" && newLineForm}

      <div className="filters-bar">
        <div className="a-search grow"><AISearch size="sm" /><input placeholder="Buscar producto" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {chips.map(([k, label, n]) => (
          <button key={k} className={`a-chip ${filter === k ? "on" : ""}`} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label} {!!n && <span className="n">{n}</span>}
          </button>
        ))}
      </div>

      {catalog.lines.map((line, i) => {
        const all = catalog.products.filter((p) => p.line === line.id);
        const items = all.filter(match);
        if ((filter !== "all" || q) && !items.length) return null;
        const note = catalog.lineNotes[line.id];
        return (
          <section key={line.id} className="a-card flush" aria-label={`Línea ${line.name}`}>
            <LineHeader
              line={line}
              index={i}
              catalog={catalog}
              caption={[note, `${all.length} ${all.length === 1 ? "producto" : "productos"}`].filter(Boolean).join(" · ")}
              onMove={(d) => moveLine(i, d)}
              onChange={setCatalog}
              toast={toast}
            />
            <div className="a-table">
              {items.map((p) => {
                const inv = stockInfo(p);
                return (
                  <Link key={p.id} className="a-tr" href={`/admin/productos/${encodeURIComponent(p.id)}`} style={{ gridTemplateColumns: "48px minmax(0, 1.3fr) 190px minmax(0, 1fr) 110px" }}>
                    <span className="av">{p.images[0] && <img src={a(p.images[0])} alt="" />}</span>
                    <span className="stack" style={{ gap: 1 }}>
                      <b>{p.name || "Producto sin título"}</b>
                      {p.igSynced && <span className="igsrc"><AIInstagram size="sm" style={{ width: 12, height: 12 }} />Sincronizado con IG</span>}
                      <span className="c-m a-cap">{priceSummary(p)} · {inv.label}</span>
                    </span>
                    <span className="c-d money">{priceSummary(p)}</span>
                    <span className="c-d"><span className={`st ${inv.cls}`}>{inv.label}</span></span>
                    <span><span className={`st ${p.status === "draft" ? "borrador" : "publicado"}`}>{p.status === "draft" ? "Borrador" : "Publicado"}</span></span>
                  </Link>
                );
              })}
              {!items.length && <p className="a-cap" style={{ padding: "14px 20px" }}>Sin productos en esta línea todavía.</p>}
            </div>
          </section>
        );
      })}

      {!catalog.lines.length && <p className="a-cap">Todavía no tienes líneas. Crea una para agrupar tus productos en la tienda.</p>}
      {newLine !== null && newLineAt === "bottom" ? newLineForm : (
        <button className="a-btn block" type="button" onClick={() => { setNewLineAt("bottom"); setNewLine(""); }}>+ Nueva línea</button>
      )}
    </AdminPage>
  );
}
