import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { pageMetadata } from "@/lib/seo";
import { PartyForm } from "@/components/party/PartyForm";

export function generateMetadata(): Metadata {
  const bundle = getTenantBundle();
  const { tenant } = bundle;
  return pageMetadata(bundle, "fiesta", { title: tenant.customOrder.label, description: tenant.customOrder.description });
}

export default function PartyPage() {
  const { tenant } = getTenantBundle();
  if (!tenant.customOrder.enabled) notFound();
  return <PartyForm />;
}
