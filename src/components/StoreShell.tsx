import { getTenantBundle } from "@/lib/tenant";
import { storeStyle } from "@/lib/theme";
import { StoreProvider } from "@/components/StoreContext";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PaletteDemo } from "@/components/PaletteDemo";
import { PublishedTheme } from "@/components/PublishedTheme";
import { themeBootScript } from "@/lib/publishedTheme";

/** Envoltura de la tienda pública: fuentes y tokens de la marca, carrito y tema publicado desde el admin. */
export function StoreShell({ children }: { children: React.ReactNode }) {
  const bundle = getTenantBundle();
  const { tenant, storefront } = bundle;
  return (
    <>
      {tenant.fonts.googleFontsUrl && <link rel="stylesheet" href={tenant.fonts.googleFontsUrl} precedence="default" />}
      {/* Paleta publicada desde el admin (demo): se aplica antes de pintar para evitar un parpadeo. */}
      <script dangerouslySetInnerHTML={{ __html: themeBootScript(tenant.slug) }} />
      <div className="store" style={storeStyle(tenant, storefront)}>
        <StoreProvider value={bundle}>
          <CartProvider>
            {children}
            <CartDrawer />
            <PublishedTheme />
            {process.env.NEXT_PUBLIC_DEMO === "1" && <PaletteDemo />}
          </CartProvider>
        </StoreProvider>
      </div>
    </>
  );
}
