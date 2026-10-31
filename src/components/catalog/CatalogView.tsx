"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/components/StoreContext";
import { ProductCard } from "@/components/ProductCard";
import { isSoldOut, minPrice, visibleProducts } from "@/lib/catalog";
import { plural } from "@/lib/format";

type Sort = "featured" | "price-asc" | "price-desc";

export function CatalogView({ initialLine }: { initialLine: string }) {
  const { tenant, catalog, storefront: sf } = useStore();
  const [line, setLine] = useState(initialLine);
  const [ranges, setRanges] = useState<number[]>([]);
  const [sort, setSort] = useState<Sort>("featured");

  const all = useMemo(() => visibleProducts(catalog), [catalog]);
  const lines = [...catalog.lines].sort((a, b) => a.order - b.order);
  const options = [{ id: "all", name: sf.catalog.allLabel }, ...lines];
  const soldOutSuffix = tenant.customOrder.enabled ? `pídela ${tenant.customOrder.label.toLowerCase()}` : undefined;

  const pickLine = (id: string) => {
    setLine(id);
    const url = id === "all" ? "/tienda" : `/tienda?linea=${id}`;
    window.history.replaceState(null, "", url);
  };

  const inRange = (price: number) =>
    ranges.length === 0 ||
    ranges.some((i) => {
      const r = sf.catalog.priceRanges[i];
      return (r.min === undefined || price >= r.min) && (r.max === undefined || price <= r.max);
    });

  const products = all
    .filter((p) => line === "all" || p.line === line)
    .filter((p) => inRange(minPrice(p)))
    .sort((a, b) => {
      if (sort === "featured") return 0;
      const d = minPrice(a) - minPrice(b);
      return sort === "price-asc" ? d : -d;
    })
    .sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));

  const filtersOn = (line !== "all" ? 1 : 0) + ranges.length;

  const sortSelect = (style?: React.CSSProperties) => (
    <select className="select mini-select" aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={style}>
      <option value="featured">Destacados</option>
      <option value="price-asc">Precio: menor a mayor</option>
      <option value="price-desc">Precio: mayor a menor</option>
    </select>
  );

  return (
    <>
      <div className="only-m" style={{ paddingBottom: 16 }}>
        <div className="chips" role="group" aria-label="Línea">
          {options.map((c) => (
            <button key={c.id} className={`chip ${line === c.id ? "on" : ""}`} type="button" aria-pressed={line === c.id} onClick={() => pickLine(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="row g3" style={{ marginTop: 12 }}>
          {sortSelect({ width: "100%", height: 44, minHeight: 44 })}
        </div>
      </div>

      <div className="cat-layout" style={{ paddingBottom: 96 }}>
        <aside className="filters only-d" aria-label="Filtros">
          <div className="fgroup">
            <h3>Línea</h3>
            {options.map((c) => (
              <button key={c.id} className="fopt" type="button" aria-pressed={line === c.id} onClick={() => pickLine(c.id)}>
                <span className={`check ${line === c.id ? "on" : ""}`} />
                {c.name}
                <span className="muted small" style={{ marginLeft: "auto" }}>
                  {c.id === "all" ? all.length : all.filter((p) => p.line === c.id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="fgroup">
            <h3>Precio</h3>
            {sf.catalog.priceRanges.map((r, i) => {
              const on = ranges.includes(i);
              return (
                <button key={r.label} className="fopt" type="button" aria-pressed={on} onClick={() => setRanges(on ? ranges.filter((x) => x !== i) : [...ranges, i])}>
                  <span className={`check ${on ? "on" : ""}`} />
                  {r.label}
                </button>
              );
            })}
          </div>
          {filtersOn > 0 && (
            <button className="link" type="button" style={{ alignSelf: "flex-start" }} onClick={() => { pickLine("all"); setRanges([]); }}>
              Limpiar filtros
            </button>
          )}
        </aside>

        <div className="stack">
          <div className="toolbar only-d">
            <span className="small muted" aria-live="polite">{plural(products.length, "producto", "productos")}</span>
            <label className="row g3">
              <span className="small muted">Ordenar por</span>
              {sortSelect()}
            </label>
          </div>
          {products.length === 0 ? (
            <div className="stack g3" style={{ paddingBlock: 48 }}>
              <p className="h4">No hay productos con estos filtros</p>
              <button className="link" type="button" style={{ alignSelf: "flex-start" }} onClick={() => { pickLine("all"); setRanges([]); }}>
                Ver toda la tienda
              </button>
            </div>
          ) : (
            <div className="pgrid c3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} catalog={catalog} slug={tenant.slug} currency={tenant.currency} soldOutSuffix={soldOutSuffix} />
              ))}
            </div>
          )}
          {tenant.customOrder.enabled && (
            <div className="primary-band row between wrap-row g4" style={{ marginTop: 56, padding: "28px 32px", borderRadius: 24 }}>
              <div className="stack g1">
                <p className="h3">{sf.catalog.partyCta.title}</p>
                <p className="small">{sf.catalog.partyCta.text}</p>
              </div>
              <Link className="btn light" href="/fiesta">{sf.catalog.partyCta.cta}</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
