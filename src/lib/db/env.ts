/** Supabase está configurado si hay URL y clave pública. Sin eso, la tienda usa los JSON de src/tenants (modo demo). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function dbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
