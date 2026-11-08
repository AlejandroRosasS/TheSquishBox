import type { Metadata } from "next";
import { ProfileView } from "@/components/admin/screens/ProfileView";

export const metadata: Metadata = { title: "Mi perfil" };

export default function ProfilePage() {
  return <ProfileView />;
}
