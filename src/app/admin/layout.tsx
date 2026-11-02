import type { Metadata } from "next";
import "./admin.css";
import { getAdminDemo, getTenantBundle } from "@/lib/tenant";
import { AdminProvider } from "@/components/admin/AdminContext";
import { DbProvider } from "@/components/admin/DbContext";
import { AdminMediaProvider } from "@/components/admin/AdminMedia";
import { AdminCatalogProvider } from "@/components/admin/AdminCatalog";

const ADMIN_FONTS = "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;500;600;700;800&display=swap";

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await getTenantBundle();
  return {
    title: { default: `Panel · ${tenant.name}`, template: `%s · Panel · ${tenant.name}` },
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const bundle = await getTenantBundle();
  const demo = getAdminDemo(bundle.tenant.slug);
  const logoBg = bundle.tenant.logo.background;
  return (
    <>
      <link rel="stylesheet" href={ADMIN_FONTS} precedence="default" />
      <div className="adm" style={logoBg ? ({ "--logo-bg": logoBg } as React.CSSProperties) : undefined}>
        <AdminProvider bundle={bundle} demo={demo}>
          <DbProvider slug={bundle.tenant.slug}>
            <AdminMediaProvider>
              <AdminCatalogProvider>{children}</AdminCatalogProvider>
            </AdminMediaProvider>
          </DbProvider>
        </AdminProvider>
      </div>
    </>
  );
}
