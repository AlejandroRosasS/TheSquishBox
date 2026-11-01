import type { Metadata } from "next";
import { ProductsView } from "@/components/admin/screens/ProductsView";

export const metadata: Metadata = { title: "Productos" };

export default function ProductsPage() {
  return <ProductsView />;
}
