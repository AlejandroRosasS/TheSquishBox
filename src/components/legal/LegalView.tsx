import Link from "next/link";
import type { TenantBundle } from "@/tenants";
import { businessOf, COMPLAINTS_ROUTE, CONTACT_ROUTE, fillLegal, LEGAL_ROUTES } from "@/lib/legal";
import type { LegalPageKey } from "@/lib/types";
import { Rich } from "@/components/Rich";
import { plainText } from "@/lib/format";
import { analyticsIdOf } from "@/lib/analytics";

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ANALYTICS_SECTION = {
  title: "Estadísticas de visitas",
  text: "Usamos Google Analytics para saber cuántas personas visitan la tienda, desde dónde llegan y qué productos miran. Para eso Google guarda cookies en tu navegador y recibe datos de navegación sin tu nombre, celular ni correo. Puedes bloquear las cookies desde la configuración de tu navegador o instalar el complemento de inhabilitación de Google Analytics.",
};

/** Página legal (Términos, Cambios y devoluciones, Entregas, Privacidad). Sin datos del servidor: la usan la tienda y la vista previa del admin. */
export function LegalView({ bundle, page }: { bundle: TenantBundle; page: LegalPageKey }) {
  const { tenant, storefront: sf } = bundle;
  const doc = sf.legalPages[page];
  const b = businessOf(tenant, sf);
  const fill = (t: string) => fillLegal(t, tenant, b, sf);
  // Con Google Analytics activo, Privacidad lo informa (Ley 29733): la sección se agrega sola.
  const sections = page === "privacy" && analyticsIdOf(bundle.seo.analyticsId)
    ? [...doc.sections.slice(0, -1), ANALYTICS_SECTION, ...doc.sections.slice(-1)]
    : doc.sections;
  const others = (Object.keys(LEGAL_ROUTES) as LegalPageKey[]).filter((k) => k !== page);
  return (
    <div className="wrap legal-page">
      <article className="stack g6">
        <header className="stack g3">
          <p className="eyebrow">{tenant.name}</p>
          <h1 className="h1"><Rich text={doc.title} /></h1>
          {doc.lead && <p className="lead">{fill(doc.lead)}</p>}
        </header>
        {sections.map((s, i) => (
          <section key={i} className="stack g2" id={slugify(s.title) || undefined} aria-labelledby={`lg-${i}`}>
            <h2 className="h4" id={`lg-${i}`}>{s.title}</h2>
            <p className="prose"><Rich text={fill(s.text)} /></p>
          </section>
        ))}
      </article>
      <aside className="legal-aside stack g3" aria-label="Más información">
        <p className="label">Más información</p>
        {others.map((k) => <Link key={k} className="link" href={LEGAL_ROUTES[k]}>{plainText(sf.legalPages[k].title)}</Link>)}
        <Link className="link" href={CONTACT_ROUTE}>{plainText(sf.contact.eyebrow)}</Link>
        <Link className="link" href={COMPLAINTS_ROUTE}>{plainText(sf.complaints.title)}</Link>
      </aside>
    </div>
  );
}
