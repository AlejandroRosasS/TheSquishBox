import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { productMetadata } from "@/lib/seo";
import { visibleProducts } from "@/lib/catalog";
import { ProductPageView } from "@/components/product/ProductPageView";
import { JsonLd } from "@/components/JsonLd";
import { productLd } from "@/lib/structuredData";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = visibleProducts((await getTenantBundle()).catalog).map((p) => ({ slug: p.id }));
  // Una marca nueva puede no tener productos aún: Next exige al menos un parámetro (este responde 404).
  return slugs.length ? slugs : [{ slug: "_" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getTenantBundle();
  const p = bundle.catalog.products.find((x) => x.id === slug);
  return p ? productMetadata(bundle, p) : {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const bundle = await getTenantBundle();
  const product = visibleProducts(bundle.catalog).find((p) => p.id === slug);
  if (!product) notFound();
  return (
    <>
      <JsonLd data={productLd(bundle, product)} />
      <ProductPageView bundle={bundle} product={product} />
    </>
  );
}
