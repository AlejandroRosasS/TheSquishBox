import type { Tenant } from "./types";
import type { Tokens } from "./publishedTheme";

/**
 * Identidad de la marca que se edita en Admin › Apariencia: nombre, subtítulo del panel y logo.
 * Vive dentro del documento de Apariencia (site_docs.kind = 'appearance') y, al publicarse,
 * pisa `tenant.name` y `tenant.logo` en toda la tienda y el panel.
 */
export type Brand = {
  name: string;
  /** Línea chica debajo del nombre en el menú del panel. */
  subtitle: string;
  logo: {
    /** "css": logo con letras del tenant (tenant.logo.lines); "image": una foto de la marca. */
    type: "css" | "image";
    image?: string;
    /** Fondo del logo con letras. */
    background?: string;
  };
};

/** Documento publicado de Admin › Apariencia. `brand` falta en lo publicado antes de que existiera. */
export type AppearanceDoc = { key: string | null; tokens: Tokens; brand?: Brand };

export const PANEL_SUBTITLE = "Panel de la tienda";

/** Identidad actual de la marca según sus archivos/base (punto de partida del editor). */
export function brandOf(tenant: Tenant): Brand {
  return {
    name: tenant.name,
    subtitle: tenant.panelSubtitle ?? PANEL_SUBTITLE,
    logo: {
      type: tenant.logo.type === "image" && tenant.logo.image ? "image" : tenant.logo.lines?.length ? "css" : "image",
      ...(tenant.logo.image ? { image: tenant.logo.image } : {}),
      ...(tenant.logo.background ? { background: tenant.logo.background } : {}),
    },
  };
}

/** Marca con la identidad publicada aplicada. Sin `brand` devuelve la misma marca. */
export function withBrand(tenant: Tenant, brand?: Partial<Brand> | null): Tenant {
  if (!brand) return tenant;
  const name = brand.name?.trim() || tenant.name;
  const logo = brand.logo;
  // Si piden imagen pero no hay ninguna, se queda el logo con letras (nunca un logo vacío).
  const type = logo?.type === "image" && (logo.image || tenant.logo.image) ? "image" : logo?.type === "css" && tenant.logo.lines?.length ? "css" : tenant.logo.type;
  return {
    ...tenant,
    name,
    panelSubtitle: brand.subtitle?.trim() || tenant.panelSubtitle,
    logo: {
      ...tenant.logo,
      type,
      ...(logo?.image ? { image: logo.image } : {}),
      ...(logo?.background ? { background: logo.background } : {}),
    },
  };
}
