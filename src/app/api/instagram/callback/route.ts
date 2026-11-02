import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchMe, igMock } from "@/lib/instagram/graph";
import { currentMember, redirectUri, STATE_COOKIE } from "@/lib/instagram/auth";
import { serviceClient } from "@/lib/db/service";
import { syncTenant } from "@/lib/instagram/sync";

/** Instagram vuelve aquí con un código: se guarda el token y se traen todos los posts. */
export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/admin/instagram?ig=${q}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/instagram" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("denied"); // la marca canceló
  const code = q.get("code");
  if (!code || !q.get("state") || q.get("state") !== req.cookies.get(STATE_COOKIE)?.value) return back("bad-state");
  const me = await currentMember();
  if (!me) return back("no-access");

  try {
    const auth = igMock()
      ? { token: "mock", expiresAt: new Date(Date.now() + 60 * 864e5), userId: "mock" }
      : await exchangeCode(code, redirectUri(req));
    const profile = await fetchMe(auth.token);
    const db = serviceClient();
    const { error } = await db.from("ig_accounts").upsert({
      tenant_id: me.tenantId,
      ig_user_id: profile.userId || auth.userId,
      username: profile.username,
      picture: profile.picture ?? null,
      access_token: auth.token,
      token_expires_at: auth.expiresAt.toISOString(),
      status: "ok",
      last_error: null,
      connected_at: new Date().toISOString(),
      connected_by: me.userId,
    });
    if (error) throw new Error(error.message);
    const r = await syncTenant(db, me.slug, { full: true });
    return back(r.ok ? "connected" : "sync-error");
  } catch (e) {
    console.error("[instagram] conexión fallida", e);
    return back("error");
  }
}
