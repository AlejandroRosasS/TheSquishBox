import type { Metadata } from "next";
import { AppearanceView } from "@/components/admin/screens/AppearanceView";

export const metadata: Metadata = { title: "Apariencia" };

export default function AppearancePage() {
  return <AppearanceView />;
}
