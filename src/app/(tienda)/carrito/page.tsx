import type { Metadata } from "next";
import { CartPageView } from "@/components/cart/CartPageView";

export const metadata: Metadata = { title: "Tu carrito" };

export default function CartPage() {
  return <CartPageView />;
}
