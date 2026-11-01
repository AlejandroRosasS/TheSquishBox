import type { Metadata } from "next";
import { NewSaleView } from "@/components/admin/screens/NewSaleView";

export const metadata: Metadata = { title: "Registrar venta" };

export default function Page() {
  return <NewSaleView />;
}
