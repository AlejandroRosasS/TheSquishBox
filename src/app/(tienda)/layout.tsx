import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StoreShell } from "@/components/StoreShell";
import { Year } from "@/components/Year";
import { getTenantBundle } from "@/lib/tenant";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreShell>
      <Header />
      <main id="contenido">{children}</main>
      <Footer bundle={await getTenantBundle()} year={<Year />} />
    </StoreShell>
  );
}
