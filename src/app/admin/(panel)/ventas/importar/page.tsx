import type { Metadata } from "next";
import { ImportSalesView } from "@/components/admin/screens/ImportSalesView";

export const metadata: Metadata = { title: "Importar ventas" };

export default function Page() {
  return <ImportSalesView />;
}
