import { getTenantBundle } from "@/lib/tenant";
import { Header } from "@/components/Header";
import { NotFoundView } from "@/components/NotFoundView";
import { StoreShell } from "@/components/StoreShell";

export default async function NotFound() {
  const bundle = await getTenantBundle();
  return (
    <StoreShell>
      <Header />
      <main id="contenido" className="wrap" style={{ paddingBlock: "72px 112px" }}>
        <NotFoundView bundle={bundle} />
      </main>
    </StoreShell>
  );
}
