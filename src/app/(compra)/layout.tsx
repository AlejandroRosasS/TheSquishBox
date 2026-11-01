import { StoreShell } from "@/components/StoreShell";

export default function PurchaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreShell>
      <main id="contenido">{children}</main>
    </StoreShell>
  );
}
