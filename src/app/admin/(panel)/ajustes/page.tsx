import type { Metadata } from "next";
import { SettingsView } from "@/components/admin/screens/SettingsView";

export const metadata: Metadata = { title: "Ajustes" };

export default function Page() {
  return <SettingsView />;
}
