import type { Metadata } from "next";
import { SalesView } from "@/components/admin/screens/SalesView";

export const metadata: Metadata = { title: "Ventas y márgenes" };

export default function Page() {
  return <SalesView />;
}
