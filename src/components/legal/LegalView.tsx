import Link from "next/link";
import type { TenantBundle } from "@/tenants";
import { businessOf, COMPLAINTS_ROUTE, CONTACT_ROUTE, fillLegal, LEGAL_ROUTES } from "@/lib/legal";
import type { LegalPageKey } from "@/lib/types";
import { Rich } from "@/components/Rich";

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Página legal (Términos, Cambios y devoluciones, Entregas, Privacidad). Sin datos del servidor: la usan la tienda y la vista previa del admin. */
export function LegalView({ bundle, page }: { bundle: TenantBundle; page: LegalPageKey }) {
  const { tenant, storefront: sf } = bundle;
  const doc = sf.legalPages[page];
  const b = businessOf(tenant, sf);
  const fill = (t: string) => fillLegal(t, tenant, b);
  const others = (Object.keys(LEGAL_ROUTES) as LegalPageKey[]).filter((k) => k !== page);
  return (
    <div className="wrap legal-page">
      <article className="stack g6">
        <header className="stack g3">
          <p className="eyebrow">{tenant.name}</p>
          <h1 className="h1">{doc.title}</h1>
          {doc.lead && <p className="lead">{fill(doc.lead)}</p>}
        </header>
        {doc.sections.map((s, i) => (
          <section key={i} className="stack g2" id={slugify(s.title) || undefined} aria-labelledby={`lg-${i}`}>
            <h2 className="h4" id={`lg-${i}`}>{s.title}</h2>
            <p className="prose"><Rich text={fill(s.text)} /></p>
          </section>
        ))}
      </article>
      <aside className="legal-aside stack g3" aria-label="Más información">
        <p className="label">Más información</p>
        {others.map((k) => <Link key={k} className="link" href={LEGAL_ROUTES[k]}>{sf.legalPages[k].title}</Link>)}
        <Link className="link" href={CONTACT_ROUTE}>{sf.contact.eyebrow}</Link>
        <Link className="link" href={COMPLAINTS_ROUTE}>{sf.complaints.title}</Link>
      </aside>
    </div>
  );
}
