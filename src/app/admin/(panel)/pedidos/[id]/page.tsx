import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderOrParty } from "@/components/admin/screens/OrderOrParty";

export const metadata: Metadata = { title: "Pedido" };

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="a-main" id="contenido"><p className="a-sub">Cargando…</p></main>}>
      <OrderOrParty params={params} />
    </Suspense>
  );
}
