import type { Metadata } from "next";
import { SetPasswordView } from "@/components/admin/screens/SetPasswordView";

export const metadata: Metadata = { title: "Crear contraseña" };

export default function SetPasswordPage() {
  return <SetPasswordView />;
}
