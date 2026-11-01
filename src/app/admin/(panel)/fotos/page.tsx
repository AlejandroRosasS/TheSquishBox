import type { Metadata } from "next";
import { PhotosView } from "@/components/admin/screens/PhotosView";

export const metadata: Metadata = { title: "Fotos" };

export default function PhotosPage() {
  return <PhotosView />;
}
