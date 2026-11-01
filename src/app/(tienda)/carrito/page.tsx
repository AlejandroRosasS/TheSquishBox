import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { pageMetadata } from "@/lib/seo";
import { CartPageView } from "@/components/cart/CartPageView";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(await getTenantBundle(), "carrito", { title: "Tu carrito", description: "" });
}

export default function CartPage() {
  return <CartPageView />;
}
