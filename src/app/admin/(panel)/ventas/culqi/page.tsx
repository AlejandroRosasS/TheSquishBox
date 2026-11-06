import type { Metadata } from "next";
import { CulqiStatementView } from "@/components/admin/screens/CulqiStatementView";

export const metadata: Metadata = { title: "Cobros con tarjeta (Culqi)" };

export default function Page() {
  return <CulqiStatementView />;
}
