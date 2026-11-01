import type { Metadata, Viewport } from "next";
import "./store.css";
import { getTenantBundle } from "@/lib/tenant";
import { siteMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return siteMetadata(getTenantBundle());
}

export function generateViewport(): Viewport {
  const { tenant } = getTenantBundle();
  return { themeColor: tenant.palettes[tenant.defaultPalette]?.primary };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { tenant } = getTenantBundle();
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
