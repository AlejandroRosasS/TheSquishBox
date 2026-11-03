import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const generateMetadata = () => legalMetadata("returns");

export default function Page() {
  return <LegalPage page="returns" />;
}
