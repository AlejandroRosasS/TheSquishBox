import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { pageMetadata } from "@/lib/seo";
import { CartPageView } from "@/components/cart/CartPageView";

export function generateMetadata(): Metadata {
  return pageMetadata(getTenantBundle(), "carrito", { title: "Tu carrito", description: "" });
}

export default function CartPage() {
  return <CartPageView />;
}
