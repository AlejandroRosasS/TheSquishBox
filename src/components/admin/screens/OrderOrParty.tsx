"use client";

import { use } from "react";
import { useParty } from "../AdminContext";
import { OrderView } from "./OrderView";
import { PartyOrderView } from "./PartyOrderView";

/** Pedidos y pedidos para fiestas comparten la misma sección y URL: /admin/pedidos/<id>. */
export function OrderOrParty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { requests } = useParty();
  if (requests.some((r) => r.id === id)) return <PartyOrderView id={id} />;
  return <OrderView id={id} />;
}
