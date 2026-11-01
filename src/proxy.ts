import { NextResponse, type NextRequest } from "next/server";

/**
 * Mientras la tienda está en construcción:
 * - thesquishbox.com y www.thesquishbox.com muestran la página "en construcción".
 * - demo.thesquishbox.com (y los *.vercel.app) muestran la tienda completa, sin indexar.
 * Para lanzar la tienda en el dominio principal, borra este archivo.
 */
const COMING_SOON_HOSTS = /^(www\.)?thesquishbox\.com$/i;

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const { pathname } = request.nextUrl;

  if (COMING_SOON_HOSTS.test(host)) {
    if (pathname === "/pronto") return NextResponse.next();
    return NextResponse.rewrite(new URL("/pronto", request.url));
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Todo menos los archivos estáticos (JS/CSS de Next, fotos y favicon).
  matcher: ["/((?!_next/|tenants/|favicon\\.ico|.*\\.(?:jpg|jpeg|png|svg|webp|ico|txt|xml)$).*)"],
};
