import type { Metadata } from "next";
import { NotificationsView } from "@/components/admin/screens/NotificationsView";

export const metadata: Metadata = { title: "Notificaciones" };

export default function Page() {
  return <NotificationsView />;
}
