import { getTenantBundle } from "@/lib/tenant";
import { storeStyle } from "@/lib/theme";
import { StoreProvider } from "@/components/StoreContext";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PaletteDemo } from "@/components/PaletteDemo";
import { PublishedTheme } from "@/components/PublishedTheme";
import { themeBootScript } from "@/lib/publishedTheme";

/** Envoltura de la tienda pública: fuentes y tokens de la marca, carrito y tema publicado desde el admin. */
export async function StoreShell({ children }: { children: React.ReactNode }) {
  const bundle = await getTenantBundle();
  const demoTheme = bundle.source === "files";
  const { tenant, storefront } = bundle;
  return (
    <>
      {tenant.fonts.googleFontsUrl && <link rel="stylesheet" href={tenant.fonts.googleFontsUrl} precedence="default" />}
      {/* Modo demo (sin base de datos): la paleta publicada vive en este navegador y se aplica antes de pintar. */}
      {demoTheme && <script dangerouslySetInnerHTML={{ __html: themeBootScript(tenant.slug) }} />}
      <div className="store" style={storeStyle(tenant, storefront, undefined, bundle.appearance?.tokens)}>
        <StoreProvider value={bundle}>
          <CartProvider>
            {children}
            <CartDrawer />
            {demoTheme && <PublishedTheme />}
            {process.env.NEXT_PUBLIC_DEMO === "1" && <PaletteDemo />}
          </CartProvider>
        </StoreProvider>
      </div>
    </>
  );
}
