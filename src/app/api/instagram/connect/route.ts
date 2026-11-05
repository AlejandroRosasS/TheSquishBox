import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, checkSetup, igConfigured, igMock } from "@/lib/instagram/graph";
import { currentMember, redirectUri, STATE_COOKIE } from "@/lib/instagram/auth";
import { serviceConfigured } from "@/lib/db/service";

/** "Conectar Instagram": manda a la marca a autorizar la app en Instagram. */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/admin/instagram?ig=${q}`, req.url));
  if (!igConfigured() || !serviceConfigured()) return back("not-configured");
  const me = await currentMember();
  if (!me) return back("no-access");
  // /api/instagram/connect?check=1 → diagnóstico de la configuración (solo para el equipo, sin secretos).
  if (req.nextUrl.searchParams.get("check")) return NextResponse.json(await checkSetup(redirectUri(req)));

  const state = crypto.randomUUID();
  const url = igMock() ? `${redirectUri(req)}?code=mock&state=${state}` : authorizeUrl(redirectUri(req), state);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/instagram" });
  return res;
}
