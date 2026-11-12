import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { plainMetadata } from "@/lib/seo";
import { businessOf, fillLegal, LEGAL_ROUTES } from "@/lib/legal";
import type { LegalPageKey } from "@/lib/types";
import { LegalView } from "./LegalView";

export async function legalMetadata(key: LegalPageKey): Promise<Metadata> {
  const bundle = await getTenantBundle();
  const doc = bundle.storefront.legalPages[key];
  const b = businessOf(bundle.tenant, bundle.storefront);
  return plainMetadata(bundle, { title: doc.title, description: fillLegal(doc.lead, bundle.tenant, b) }, LEGAL_ROUTES[key]);
}

/** Página legal (Términos, Cambios y devoluciones, Entregas, Privacidad): textos editables en Admin › Textos. */
export async function LegalPage({ page }: { page: LegalPageKey }) {
  return <LegalView bundle={await getTenantBundle()} page={page} />;
}
