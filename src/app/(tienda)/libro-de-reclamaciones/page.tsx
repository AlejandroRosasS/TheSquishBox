import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { plainMetadata } from "@/lib/seo";
import { COMPLAINTS_ROUTE } from "@/lib/legal";
import { ComplaintForm } from "@/components/legal/ComplaintForm";

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getTenantBundle();
  return plainMetadata(bundle, { title: bundle.storefront.complaints.title, description: bundle.storefront.complaints.lead }, COMPLAINTS_ROUTE);
}

export default function ComplaintsPage() {
  return <ComplaintForm />;
}
