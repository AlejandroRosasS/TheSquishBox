import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/screens/ReviewsView";

export const metadata: Metadata = { title: "Reseñas" };

export default function Page() {
  return <ReviewsView />;
}
