import type { Metadata } from "next";
import { TextsView } from "@/components/admin/screens/TextsView";

export const metadata: Metadata = { title: "Textos" };

export default function TextsPage() {
  return <TextsView />;
}
