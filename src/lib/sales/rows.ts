import type { CatalogLite, SaleDraft } from "./csv";

export type SaleSource = "admin" | "csv" | "telegram";

/** Venta → fila de `manual_sales` (ítems con el mismo formato que los pedidos). */
export function saleRow(s: Omit<SaleDraft, "rows">, opts: { tenantId: string; catalog: CatalogLite; source: SaleSource; userId: string | null }) {
  const name = (pid: string, vid: string) => {
    const p = opts.catalog.products.find((x) => x.id === pid);
    return { name: p?.name ?? pid, variant_label: p?.variants.find((v) => v.id === vid)?.label ?? vid };
  };
  return {
    tenant_id: opts.tenantId, ref: s.ref, channel: s.channel, client: s.client || null, pay: s.pay || null, note: s.note || null,
    delivery_in: s.dIn, delivery_out: s.dOut, total: s.lines.reduce((a, l) => a + l.price * l.qty, 0) + s.dIn,
    sold_at: `${s.day}T12:00:00-05:00`, created_by: opts.userId, source: opts.source,
    items: s.lines.map((l) => ({
      product: l.productId, variant: l.variantId, ...name(l.productId, l.variantId), qty: l.qty, price: l.price,
      ...(l.campaignId ? { list_price: l.listPrice ?? l.price, campaign_id: l.campaignId, campaign: l.campaign } : {}),
    })),
  };
}
