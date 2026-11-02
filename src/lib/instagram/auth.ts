import type { NextRequest } from "next/server";
import { serverClient } from "@/lib/db/server";
import { dbConfigured } from "@/lib/db/env";
import { tenantSlug } from "@/lib/tenant";

/** Quién pide: alguien del equipo de la marca de este despliegue, o null. */
export async function currentMember(): Promise<{ userId: string; tenantId: string; slug: string } | null> {
  if (!dbConfigured()) return null;
  const slug = tenantSlug();
  const db = await serverClient();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return null;
  const { data: t } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!t) return null;
  const { data: member } = await db.rpc("is_member", { t: t.id });
  return member ? { userId: u.user.id, tenantId: t.id, slug } : null;
}

/** La URL de regreso debe ser idéntica a la registrada en la app de Meta. */
export function redirectUri(req: NextRequest): string {
  return process.env.INSTAGRAM_REDIRECT_URI || `${req.nextUrl.origin}/api/instagram/callback`;
}

export const STATE_COOKIE = "ig_oauth_state";
