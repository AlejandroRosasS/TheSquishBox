import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Suspense } from "react";
import { getTenantBundle } from "@/lib/tenant";
import { Rich } from "@/components/Rich";
import { CatalogView } from "@/components/catalog/CatalogView";

export function generateMetadata(): Metadata {
  return pageMetadata(getTenantBundle(), "tienda", { title: "Tienda", description: "" });
}

type SP = Promise<{ linea?: string }>;

function Crumbs({ label }: { label: string }) {
  return (
    <nav className="crumbs" aria-label="Ruta">
      <Link href="/">Inicio</Link>
      <span aria-hidden="true">/</span>
      <span>{label}</span>
    </nav>
  );
}

async function Filtered({ searchParams, children }: { searchParams: SP; children: React.ReactNode }) {
  const { linea } = await searchParams;
  const { catalog } = getTenantBundle();
  const line = catalog.lines.find((l) => l.id === linea);
  return (
    <>
      <Crumbs label={line?.name ?? "Toda la tienda"} />
      {children}
      <CatalogView key={line?.id ?? "all"} initialLine={line?.id ?? "all"} />
    </>
  );
}

export default function CatalogPage({ searchParams }: { searchParams: SP }) {
  const { storefront: sf } = getTenantBundle();
  const intro = (
    <div className="stack g3" style={{ paddingBottom: 32 }}>
      <h1 className="h1"><Rich text={sf.catalog.title} /></h1>
      <p className="lead" style={{ maxWidth: 640 }}>{sf.catalog.lead}</p>
    </div>
  );
  return (
    <div className="wrap">
      <Suspense
        fallback={
          <>
            <Crumbs label="Toda la tienda" />
            {intro}
            <CatalogView initialLine="all" />
          </>
        }
      >
        <Filtered searchParams={searchParams}>{intro}</Filtered>
      </Suspense>
    </div>
  );
}
