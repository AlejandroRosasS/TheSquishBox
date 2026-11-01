import { getTenantBundle } from "@/lib/tenant";
import { HomeView } from "@/components/home/HomeView";

export default async function HomePage() {
  return <HomeView bundle={await getTenantBundle()} />;
}
