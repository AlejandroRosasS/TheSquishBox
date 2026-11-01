import Link from "next/link";
import { getTenantBundle } from "@/lib/tenant";
import { asset } from "@/lib/assets";
import { Header } from "@/components/Header";
import { Rich } from "@/components/Rich";
import { StoreShell } from "@/components/StoreShell";

export default async function NotFound() {
  const { tenant, storefront: sf } = await getTenantBundle();
  return (
    <StoreShell>
      <Header />
      <main id="contenido" className="wrap" style={{ paddingBlock: "72px 112px" }}>
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
      </main>
    </StoreShell>
  );
}
