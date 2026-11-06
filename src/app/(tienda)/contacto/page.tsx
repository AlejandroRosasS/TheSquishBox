import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { plainMetadata } from "@/lib/seo";
import { ContactView } from "@/components/legal/ContactView";

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getTenantBundle();
  return plainMetadata(bundle, { title: bundle.storefront.contact.eyebrow, description: bundle.storefront.contact.lead });
}

export default async function ContactPage() {
  return <ContactView bundle={await getTenantBundle()} />;
}
