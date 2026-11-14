import Script from "next/script";

/**
 * Etiqueta de Google Analytics 4 de la marca. Solo la monta la tienda pública (StoreShell):
 * el admin y la página «en construcción» no la cargan. Las visitas entre páginas las cuenta GA4
 * solo (medición mejorada: «cambios de página según el historial del navegador»).
 */
export function Analytics({ id }: { id: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(id)});`}
      </Script>
    </>
  );
}
