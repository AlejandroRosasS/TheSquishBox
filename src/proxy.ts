import { NextResponse, type NextRequest } from "next/server";
import { cleanHost, isPreviewHost, storeLive } from "@/lib/hosts";

/**
 * Mientras la tienda de una marca está en construcción:
 * - su dominio principal (marca.com y www.marca.com) muestra la página "en construcción" (/pronto).
 * - demo.<dominio>, los *.vercel.app y localhost muestran la tienda completa, sin indexar.
 * Sirve para cualquier marca: cada una se despliega en su propio proyecto de Vercel.
 * Para lanzar la tienda en el dominio principal, pon STORE_LIVE=1 en las variables del proyecto.
 * Con la tienda lanzada, demo.<dominio> y *.vercel.app siguen sin indexar para que Google
 * solo vea el dominio principal (sin contenido duplicado).
 * /robots.txt y /sitemap.xml no pasan por aquí (ver matcher): se arman en src/lib/sitemap.ts.
 */
export function proxy(request: NextRequest) {
  const host = cleanHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  const preview = isPreviewHost(host);

  if (storeLive() && !preview) return NextResponse.next();

  if (!preview) {
    // /pronto y las rutas del servidor (cron de Instagram, webhooks) siguen funcionando.
    if (pathname === "/pronto" || pathname.startsWith("/api/")) return NextResponse.next();
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
