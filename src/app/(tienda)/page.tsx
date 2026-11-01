import { getTenantBundle } from "@/lib/tenant";
import { HomeView } from "@/components/home/HomeView";

export default function HomePage() {
  return <HomeView bundle={getTenantBundle()} />;
}
