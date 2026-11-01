import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { productMetadata } from "@/lib/seo";
import { lineName, visibleProducts } from "@/lib/catalog";
import { Rich } from "@/components/Rich";
import { ProductCard } from "@/components/ProductCard";
import { ProductView } from "@/components/product/ProductView";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return visibleProducts((await getTenantBundle()).catalog).map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getTenantBundle();
  const p = bundle.catalog.products.find((x) => x.id === slug);
  return p ? productMetadata(bundle, p) : {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const { tenant, catalog, storefront: sf } = await getTenantBundle();
  const product = visibleProducts(catalog).find((p) => p.id === slug);
  if (!product) notFound();
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
