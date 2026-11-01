import type { Metadata } from "next";
import { InstagramView } from "@/components/admin/screens/InstagramView";

export const metadata: Metadata = { title: "Instagram" };

export default function InstagramPage() {
  return <InstagramView />;
}
