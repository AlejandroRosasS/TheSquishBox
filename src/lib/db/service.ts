import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente con la clave secreta: salta los permisos (RLS). Solo para el servidor
 * (sincronización de Instagram, cron). Nunca importarlo desde un componente "use client".
 */
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function serviceConfigured(): boolean {
  return Boolean(SUPABASE_URL && SECRET);
}

export function serviceClient(): SupabaseClient {
  if (!serviceConfigured()) throw new Error("Falta SUPABASE_SECRET_KEY en las variables del servidor.");
  return createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}
