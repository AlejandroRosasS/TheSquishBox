import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StoreShell } from "@/components/StoreShell";
import { getTenantBundle } from "@/lib/tenant";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreShell>
      <Header />
      <main id="contenido">{children}</main>
      <Footer bundle={getTenantBundle()} />
    </StoreShell>
  );
}
