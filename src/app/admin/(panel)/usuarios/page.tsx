import type { Metadata } from "next";
import { UsersView } from "@/components/admin/screens/UsersView";

export const metadata: Metadata = { title: "Usuarios" };

export default function UsersPage() {
  return <UsersView />;
}
