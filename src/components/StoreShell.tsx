import { getTenantBundle } from "@/lib/tenant";
import { storeStyle } from "@/lib/theme";
import { StoreProvider } from "@/components/StoreContext";
import { MediaProvider } from "@/components/Photo";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PaletteDemo } from "@/components/PaletteDemo";
import { PublishedTheme } from "@/components/PublishedTheme";
import { themeBootScript } from "@/lib/publishedTheme";
import { Analytics } from "@/components/Analytics";
import { analyticsIdOf } from "@/lib/analytics";

/** Envoltura de la tienda pública: fuentes y tokens de la marca, carrito y tema publicado desde el admin. */
export async function StoreShell({ children }: { children: React.ReactNode }) {
  const bundle = await getTenantBundle();
  const demoTheme = bundle.source === "files";
  const { tenant, storefront } = bundle;
  // Los despliegues de prueba de Vercel (preview) no mandan visitas: ensuciarían las estadísticas.
  const gaId = process.env.VERCEL_ENV === "preview" ? null : analyticsIdOf(bundle.seo.analyticsId);
  return (
    <>
      {gaId && <Analytics id={gaId} />}
      {tenant.fonts.googleFontsUrl && <link rel="stylesheet" href={tenant.fonts.googleFontsUrl} precedence="default" />}
      {/* Modo demo (sin base de datos): la paleta publicada vive en este navegador y se aplica antes de pintar. */}
      {demoTheme && <script dangerouslySetInnerHTML={{ __html: themeBootScript(tenant.slug) }} />}
      <div className="store" style={storeStyle(tenant, storefront, undefined, bundle.appearance?.tokens)}>
        <StoreProvider value={bundle}>
        <MediaProvider slug={tenant.slug} media={bundle.media ?? {}}>
          <CartProvider>
            {children}
            <CartDrawer />
            {demoTheme && <PublishedTheme />}
            {process.env.NEXT_PUBLIC_DEMO === "1" && <PaletteDemo />}
          </CartProvider>
        </MediaProvider>
        </StoreProvider>
      </div>
    </>
  );
}
