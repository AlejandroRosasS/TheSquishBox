import type { Metadata, Viewport } from "next";
import "./store.css";
import { getTenantBundle } from "@/lib/tenant";
import { storeStyle } from "@/lib/theme";
import { StoreProvider } from "@/components/StoreContext";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PaletteDemo } from "@/components/PaletteDemo";

export function generateMetadata(): Metadata {
  const { tenant } = getTenantBundle();
  return {
    title: { default: `${tenant.name} · ${tenant.tagline}`, template: `%s · ${tenant.name}` },
    description: `${tenant.tagline}. ${tenant.motto}. ${tenant.city}.`,
  };
}

export function generateViewport(): Viewport {
  const { tenant } = getTenantBundle();
  return { themeColor: tenant.palettes[tenant.defaultPalette]?.primary };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const bundle = getTenantBundle();
  const { tenant, storefront } = bundle;
  return (
    <html lang={tenant.locale}>
      <head>
        {tenant.fonts.googleFontsUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={tenant.fonts.googleFontsUrl} />
          </>
        )}
      </head>
      <body>
        <div className="store" style={storeStyle(tenant, storefront)}>
          <StoreProvider value={bundle}>
            <CartProvider>
              {children}
              <CartDrawer />
              {process.env.NEXT_PUBLIC_DEMO === "1" && <PaletteDemo />}
            </CartProvider>
          </StoreProvider>
        </div>
      </body>
    </html>
  );
}
