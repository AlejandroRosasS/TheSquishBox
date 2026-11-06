import Link from "next/link";
import type { TenantBundle } from "@/tenants";
import { asset } from "@/lib/assets";
import { Rich } from "@/components/Rich";

/** Contenido de la página 404. Sin datos del servidor: la usan la tienda y la vista previa del admin. */
export function NotFoundView({ bundle }: { bundle: TenantBundle }) {
  const { tenant, storefront: sf } = bundle;
  return (
    <div className="split">
      <div className="stack g5">
        <p className="eyebrow">Error 404</p>
        <p className="display" style={{ fontSize: 120, lineHeight: 0.9, color: "var(--primary)" }} aria-hidden="true"><em>Ups</em></p>
        <h1 className="h2"><Rich text={sf.notFound.title} /></h1>
        <p className="lead">{sf.notFound.lead}</p>
        <div className="row g3 wrap-row">
          <Link className="btn" href="/tienda">Ver la tienda</Link>
          <Link className="btn ghost" href="/">Ir al inicio</Link>
        </div>
      </div>
      <div className="ph r45" style={{ borderRadius: 20, maxWidth: 460, justifySelf: "end", width: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(tenant.slug, sf.notFound.image)} alt={sf.notFound.alt} />
      </div>
    </div>
  );
}
