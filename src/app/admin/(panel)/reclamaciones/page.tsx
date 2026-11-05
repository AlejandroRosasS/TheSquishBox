import type { Metadata } from "next";
import { ComplaintsView } from "@/components/admin/screens/ComplaintsView";

export const metadata: Metadata = { title: "Libro de reclamaciones" };

export default function Page() {
  return <ComplaintsView />;
}
