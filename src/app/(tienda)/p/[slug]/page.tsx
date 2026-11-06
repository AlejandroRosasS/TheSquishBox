import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { productMetadata } from "@/lib/seo";
import { visibleProducts } from "@/lib/catalog";
import { ProductPageView } from "@/components/product/ProductPageView";

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
  const bundle = await getTenantBundle();
  const product = visibleProducts(bundle.catalog).find((p) => p.id === slug);
  if (!product) notFound();
  return <ProductPageView bundle={bundle} product={product} />;
}
