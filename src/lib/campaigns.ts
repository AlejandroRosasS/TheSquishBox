import type { Campaign, Catalog, Variant } from "./types";

/** Hora de Perú (sin horario de verano). Las fechas de campaña se escriben y muestran en esta zona. */
export const LIMA_OFFSET = "-05:00";
const TZ = "America/Lima";

/** "2026-11-20T00:00" (hora de Lima, como en <input type="datetime-local">) → ISO UTC. */
export function limaToIso(local: string): string {
  return new Date(`${local.length === 16 ? `${local}:00` : local}${LIMA_OFFSET}`).toISOString();
}

/** ISO → "2026-11-20T00:00" en hora de Lima (para <input type="datetime-local">). */
export function isoToLima(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** "20 nov, 00:00" */
export function campaignDate(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, day: "numeric", month: "short" }).format(d).replace(".", "");
  const time = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day}, ${time}`;
}

export function campaignRange(c: Pick<Campaign, "startsAt" | "endsAt">): string {
  return `${campaignDate(c.startsAt)} → ${campaignDate(c.endsAt)}`;
}

export type CampaignState = "active" | "scheduled" | "ended";

export function campaignState(c: Pick<Campaign, "startsAt" | "endsAt">, now: number): CampaignState {
  if (Date.parse(c.endsAt) <= now) return "ended";
  if (Date.parse(c.startsAt) > now) return "scheduled";
  return "active";
}

export const CAMPAIGN_STATE: Record<CampaignState, [string, string]> = {
  active: ["Activa", "publicado"],
  scheduled: ["Programada", "nuevo"],
  ended: ["Terminada", "borrador"],
};

export const isActive = (c: Pick<Campaign, "startsAt" | "endsAt">, now: number) => campaignState(c, now) === "active";

/** Precio de oferta de una opción en una campaña (undefined = no participa). */
export function campaignPriceOf(c: Campaign, productId: string, variantId: string): number | undefined {
  const v = c.prices[productId]?.[variantId];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Campaña que aplica a una opción en un momento: la vigente con el precio más bajo (igual que la base). */
export function bestCampaign(campaigns: Campaign[], productId: string, variantId: string, now: number): { campaign: Campaign; price: number } | null {
  let best: { campaign: Campaign; price: number } | null = null;
  for (const c of campaigns) {
    if (!isActive(c, now)) continue;
    const price = campaignPriceOf(c, productId, variantId);
    if (price === undefined) continue;
    if (!best || price < best.price || (price === best.price && c.startsAt > best.campaign.startsAt)) best = { campaign: c, price };
  }
  return best;
}

/**
 * Catálogo con los precios de las campañas vigentes: `price` pasa a ser el de oferta y
 * `listPrice` guarda el regular (para mostrarlo tachado). Sin campañas devuelve el mismo catálogo.
 */
export function applyCampaigns(catalog: Catalog, campaigns: Campaign[], now: number): Catalog {
  if (!campaigns.some((c) => isActive(c, now))) return catalog;
  return {
    ...catalog,
    products: catalog.products.map((p) => ({
      ...p,
      variants: p.variants.map((v): Variant => {
        const b = bestCampaign(campaigns, p.id, v.id, now);
        if (!b || b.price >= v.price) return v;
        return { ...v, price: b.price, listPrice: v.price, campaign: { id: b.campaign.id, name: b.campaign.name, endsAt: b.campaign.endsAt } };
      }),
    })),
  };
}

/** Descuento en % (redondeado) de `price` frente a `list`. */
export const discountPct = (list: number, price: number) => (list > 0 ? Math.round(((list - price) / list) * 100) : 0);
