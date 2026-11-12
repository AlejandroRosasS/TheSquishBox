import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTenantBundle } from "@/lib/tenant";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_FORM_ROUTE, isContactForm } from "@/lib/customOrder";
import { PartyForm } from "@/components/party/PartyForm";

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getTenantBundle();
  const { tenant } = bundle;
  return pageMetadata(bundle, "fiesta", { title: tenant.customOrder.label, description: tenant.customOrder.description });
}

export default async function PartyPage() {
  const { tenant } = await getTenantBundle();
  if (!tenant.customOrder.enabled) notFound();
  // La marca cambió el formulario de fiesta por el formulario de Contacto: los links viejos siguen funcionando.
  if (isContactForm(tenant)) permanentRedirect(CONTACT_FORM_ROUTE);
  return <PartyForm />;
}
