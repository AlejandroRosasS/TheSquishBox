import { redirect } from "next/navigation";

/** Los pedidos para fiestas viven en Pedidos. */
export default function PartyRequestsPage() {
  redirect("/admin/pedidos");
}
