import { bestCampaign, limaToIso } from "../campaigns";
import type { Campaign } from "../types";
import { norm, type CatalogLite, type Pricer } from "./csv";

/**
 * Precio de una opción en un día: el de la campaña vigente ese día (a mediodía, hora de Perú) o el regular.
 * Si piden una campaña por nombre y tiene precio para esa opción, se usa esa.
 */
export function makePricer(catalog: CatalogLite, campaigns: Campaign[]): Pricer {
  return (productId, variantId, day, campaignName) => {
    const regular = catalog.products.find((p) => p.id === productId)?.variants.find((v) => v.id === variantId)?.price ?? 0;
    const named = campaignName ? campaigns.find((c) => norm(c.name) === norm(campaignName)) : undefined;
    const namedPrice = named?.prices[productId]?.[variantId];
    const b =
      named && typeof namedPrice === "number"
        ? { campaign: named, price: namedPrice }
        : /^\d{4}-\d{2}-\d{2}$/.test(day)
          ? bestCampaign(campaigns, productId, variantId, Date.parse(limaToIso(`${day}T12:00`)))
          : null;
    return b && b.price < regular ? { price: b.price, campaignId: b.campaign.id, campaign: b.campaign.name, listPrice: regular } : { price: regular };
  };
}

/** Hoy en Perú (AAAA-MM-DD). */
export const limaToday = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
