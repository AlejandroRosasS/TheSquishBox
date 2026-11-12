import type { Metadata } from "next";
import { getTenantBundle } from "@/lib/tenant";
import { homeMetadata } from "@/lib/seo";
import { storeLd } from "@/lib/structuredData";
import { HomeView } from "@/components/home/HomeView";
import { JsonLd } from "@/components/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getTenantBundle());
}

export default async function HomePage() {
  const bundle = await getTenantBundle();
  return (
    <>
      <JsonLd data={storeLd(bundle)} />
      <HomeView bundle={bundle} />
    </>
  );
}
