import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderView } from "@/components/checkout/OrderView";

export const metadata: Metadata = { title: "Pedido confirmado", robots: { index: false } };

async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderView id={id} />;
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <Order params={params} />
    </Suspense>
  );
}
