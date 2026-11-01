import type { Metadata, Viewport } from "next";
import "./store.css";
import { getFileBundle, getTenantBundle } from "@/lib/tenant";
import { siteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(await getTenantBundle());
}

export async function generateViewport(): Promise<Viewport> {
  const { tenant, appearance } = await getTenantBundle();
  return { themeColor: appearance?.tokens.primary ?? tenant.palettes[tenant.defaultPalette]?.primary };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // El idioma no cambia con lo que se publica: se lee de los archivos para no esperar a la base.
  const { tenant } = getFileBundle();
  return (
    <html lang={tenant.locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
