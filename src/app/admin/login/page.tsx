import type { Metadata } from "next";
import { LoginView } from "@/components/admin/screens/LoginView";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return <LoginView />;
}
