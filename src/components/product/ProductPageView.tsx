import Link from "next/link";
import type { TenantBundle } from "@/tenants";
import type { Product } from "@/lib/types";
import { lineName, visibleProducts } from "@/lib/catalog";
import { Rich } from "@/components/Rich";
import { ProductCard } from "@/components/ProductCard";
import { ProductView } from "./ProductView";

/** Página de un producto (ruta, ficha y «más productos»). La usan la tienda y la vista previa del admin. */
export function ProductPageView({ bundle, product }: { bundle: TenantBundle; product: Product }) {
  const { tenant, catalog, storefront: sf } = bundle;
  const more = visibleProducts(catalog).filter((p) => p.id !== product.id && p.status === "published").slice(0, 4);
  const line = lineName(catalog, product.line);

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Ruta">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/tienda?linea=${product.line}`}>{line}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <ProductView product={product} lineLabel={line} />
      {more.length > 0 && (
        <section className="stack g5" style={{ paddingBottom: 96 }}>
          <h2 className="h2"><Rich text={sf.product.moreTitle} /></h2>
          <div className="pgrid">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} catalog={catalog} slug={tenant.slug} currency={tenant.currency} showBadge={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
