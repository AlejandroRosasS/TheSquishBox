import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { PartyForm } from "@/components/party/PartyForm";

export function generateMetadata(): Metadata {
  const { tenant } = getTenantBundle();
  return { title: tenant.customOrder.label, description: tenant.customOrder.description };
}

export default function PartyPage() {
  const { tenant } = getTenantBundle();
  if (!tenant.customOrder.enabled) notFound();
  return <PartyForm />;
}
