import type { Metadata } from "next";
import { ConvertView } from "@/components/admin/screens/ConvertView";

export const metadata: Metadata = { title: "Convertir en producto" };

export default function ConvertPage() {
  return <ConvertView />;
}
