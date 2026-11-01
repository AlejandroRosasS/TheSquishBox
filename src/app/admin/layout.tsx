import type { Metadata } from "next";
import "./admin.css";
import { getAdminDemo, getTenantBundle } from "@/lib/tenant";
import { AdminProvider } from "@/components/admin/AdminContext";

const ADMIN_FONTS = "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito:wght@400;500;600;700;800&display=swap";

export function generateMetadata(): Metadata {
  const { tenant } = getTenantBundle();
  return {
    title: { default: `Panel · ${tenant.name}`, template: `%s · Panel · ${tenant.name}` },
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const bundle = getTenantBundle();
  const demo = getAdminDemo(bundle.tenant.slug);
  const logoBg = bundle.tenant.logo.background;
  return (
    <>
      <link rel="stylesheet" href={ADMIN_FONTS} precedence="default" />
      <div className="adm" style={logoBg ? ({ "--logo-bg": logoBg } as React.CSSProperties) : undefined}>
        <AdminProvider bundle={bundle} demo={demo}>
          {children}
        </AdminProvider>
      </div>
    </>
  );
}
