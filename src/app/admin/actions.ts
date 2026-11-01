"use server";

import { updateTag } from "next/cache";
import { serverClient } from "@/lib/db/server";
import { tenantSlug, tenantTag } from "@/lib/tenant";

/**
 * Refresca la tienda después de publicar desde el admin.
 * Solo lo puede pedir alguien del equipo de la marca.
 */
export async function refreshStore(): Promise<{ ok: boolean }> {
  const slug = tenantSlug();
  const db = await serverClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return { ok: false };
  const { data: t } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!t) return { ok: false };
  const { data: member } = await db.rpc("is_member", { t: t.id });
  if (!member) return { ok: false };
  updateTag(tenantTag(slug));
  return { ok: true };
}
