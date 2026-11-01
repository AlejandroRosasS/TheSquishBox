import type { Metadata } from "next";
import { PartyRequestsView } from "@/components/admin/screens/PartyRequestsView";

export const metadata: Metadata = { title: "Pedidos especiales" };

export default function PartyRequestsPage() {
  return <PartyRequestsView />;
}
