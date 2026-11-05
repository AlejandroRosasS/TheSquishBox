import type { NextRequest } from "next/server";

/** Dominio para los links "Ver en el panel": SITE_URL si está, si no el de la petición. */
export function siteOrigin(req: NextRequest): string {
  return (process.env.SITE_URL?.trim() || req.nextUrl.origin).replace(/\/+$/, "");
}
