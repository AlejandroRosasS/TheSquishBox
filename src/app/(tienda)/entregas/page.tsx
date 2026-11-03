import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const generateMetadata = () => legalMetadata("shipping");

export default function Page() {
  return <LegalPage page="shipping" />;
}
