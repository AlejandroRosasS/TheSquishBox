import type { Metadata } from "next";
import { OrdersView } from "@/components/admin/screens/OrdersView";

export const metadata: Metadata = { title: "Pedidos" };

export default function OrdersPage() {
  return <OrdersView />;
}
