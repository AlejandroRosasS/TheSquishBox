/**
 * Hosts de vista previa: demo.<dominio>, los *.vercel.app y localhost.
 * Muestran la tienda completa pero nunca se indexan (Google solo debe ver el dominio de la marca).
 */
export const PREVIEW_HOSTS = /^(demo\.|localhost$|127\.0\.0\.1$)|\.vercel\.app$/i;

/** Host sin puerto, en minúsculas. */
export const cleanHost = (host: string | null | undefined) => (host ?? "").split(":")[0].toLowerCase();

export const isPreviewHost = (host: string) => !host || PREVIEW_HOSTS.test(host);

/** La tienda está lanzada en el dominio principal (variable STORE_LIVE=1 del proyecto). */
export const storeLive = () => process.env.STORE_LIVE === "1";

/** Dominio público de la marca, si ya está definido (no un placeholder como "[dominio por definir]"). */
export function validDomain(domain: string | undefined): string | undefined {
  const d = (domain ?? "").trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : undefined;
}
