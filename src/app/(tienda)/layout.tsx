import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getTenantBundle } from "@/lib/tenant";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="contenido">{children}</main>
      <Footer bundle={getTenantBundle()} />
    </>
  );
}
