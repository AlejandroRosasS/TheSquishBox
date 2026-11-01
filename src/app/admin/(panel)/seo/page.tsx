import type { Metadata } from "next";
import { SeoView } from "@/components/admin/screens/SeoView";

export const metadata: Metadata = { title: "SEO" };

export default function SeoPage() {
  return <SeoView />;
}
