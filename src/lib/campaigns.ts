import type { Campaign, Catalog, Variant } from "./types";

type StoreCampaignRow = {
  id: string; name: string; starts_at: string; ends_at: string;
  prices: Campaign["prices"] | null; limits?: Campaign["limits"] | null; left?: Campaign["left"] | null;
};

/** Respuesta de la función `store_campaigns` de la base → campañas vigentes. */
export function storeCampaignsFrom(data: unknown): Campaign[] {
  const rows = data && typeof data === "object" ? (data as { campaigns?: unknown }).campaigns : null;
  if (!Array.isArray(rows)) return [];
  return (rows as StoreCampaignRow[]).map((c) => ({
    id: c.id, name: c.name, startsAt: c.starts_at, endsAt: c.ends_at, prices: c.prices ?? {},
    ...(c.limits ? { limits: c.limits } : {}),
    ...(c.left ? { left: c.left } : {}),
  }));
}

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

/** Tope de unidades a precio de oferta de una opción (undefined = sin tope). */
export function campaignLimitOf(c: Pick<Campaign, "limits">, productId: string, variantId: string): number | undefined {
  const v = c.limits?.[productId]?.[variantId];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Unidades que quedan a precio de oferta (undefined = sin tope o sin el dato de la tienda). */
export function campaignLeftOf(c: Campaign, productId: string, variantId: string): number | undefined {
  if (campaignLimitOf(c, productId, variantId) === undefined) return undefined;
  const v = c.left?.[productId]?.[variantId];
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : undefined;
}

/**
 * Campaña que aplica a una opción en un momento: la vigente con el precio más bajo (igual que la base).
 * Una campaña que ya vendió su tope de esa opción no cuenta.
 */
export function bestCampaign(campaigns: Campaign[], productId: string, variantId: string, now: number): { campaign: Campaign; price: number } | null {
  let best: { campaign: Campaign; price: number } | null = null;
  for (const c of campaigns) {
    if (!isActive(c, now)) continue;
    const price = campaignPriceOf(c, productId, variantId);
    if (price === undefined) continue;
    if (campaignLeftOf(c, productId, variantId) === 0) continue;
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
        const left = campaignLeftOf(b.campaign, p.id, v.id);
        return { ...v, price: b.price, listPrice: v.price, campaign: { id: b.campaign.id, name: b.campaign.name, endsAt: b.campaign.endsAt, ...(left !== undefined ? { left } : {}) } };
      }),
    })),
  };
}

/** ¿Alguna campaña vigente tiene tope de unidades? (entonces la tienda se refresca más seguido). */
export const hasActiveLimits = (campaigns: Campaign[], now: number) =>
  campaigns.some((c) => isActive(c, now) && Object.values(c.limits ?? {}).some((o) => Object.values(o ?? {}).some((n) => typeof n === "number")));

/**
 * Precio de `qty` unidades de una opción. Con tope de campaña, solo las que quedan van a precio de oferta
 * y el resto a precio regular (igual que la base al crear el pedido).
 */
export function unitsTotal(v: Pick<Variant, "price" | "listPrice" | "campaign">, qty: number): number {
  const left = v.campaign?.left;
  if (left === undefined || v.listPrice === undefined || qty <= left) return v.price * qty;
  return v.price * left + v.listPrice * (qty - left);
}

/** Cuántas de `qty` unidades salen a precio de oferta (null = todas, no hay tope que aplique). */
export function offerUnits(v: Pick<Variant, "listPrice" | "campaign">, qty: number): number | null {
  const left = v.campaign?.left;
  if (left === undefined || v.listPrice === undefined || qty <= left) return null;
  return left;
}

/**
 * Pone al día lo que queda de cada oferta con tope (lo que la tienda tenía en caché puede ir atrasado).
 * Si una oferta ya se agotó, la opción vuelve a su precio regular.
 */
export function withLiveLeft(catalog: Catalog, campaigns: Campaign[]): Catalog {
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  let changed = false;
  const products = catalog.products.map((p) => {
    let touched = false;
    const variants = p.variants.map((v): Variant => {
      if (!v.campaign || v.campaign.left === undefined || v.listPrice === undefined) return v;
      const c = byId.get(v.campaign.id);
      const left = c ? campaignLeftOf(c, p.id, v.id) : 0;
      if (left === v.campaign.left) return v;
      touched = true;
      if (left === undefined) {
        // Le quitaron el tope: la oferta sigue sin límite.
        const { left: _l, ...campaign } = v.campaign;
        void _l;
        return { ...v, campaign };
      }
      if (left === 0) {
        const { listPrice, campaign: _c, ...rest } = v;
        void _c;
        return { ...rest, price: listPrice };
      }
      return { ...v, campaign: { ...v.campaign, left } };
    });
    if (!touched) return p;
    changed = true;
    return { ...p, variants };
  });
  return changed ? { ...catalog, products } : catalog;
}

/** Descuento en % (redondeado) de `price` frente a `list`. */
export const discountPct = (list: number, price: number) => (list > 0 ? Math.round(((list - price) / list) * 100) : 0);
