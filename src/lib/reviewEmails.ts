import type { SupabaseClient } from "@supabase/supabase-js";
import { getTenantBundle, tenantSlug } from "@/lib/tenant";
import { absoluteUrl } from "@/lib/seo";
import { sendTeamEmail, teamEmailReady } from "@/lib/team/email";
import { ensureOrderRequest } from "@/lib/db/reviews";
import { fillTemplate, reviewPath } from "@/lib/reviews";

/** Días después de entregado para mandar el correo, y hasta cuándo se sigue intentando. */
const AFTER_DAYS = 3;
const UNTIL_DAYS = 30;
const PER_RUN = 10;

const DAY = 86_400_000;

/**
 * Correo automático pidiendo reseña, a los 3 días de entregado. Solo para la marca de este despliegue,
 * pedidos web con correo, sin «No pedir reseña», y una sola vez por pedido (review_requests.email_at).
 * Si el cliente ya dejó su reseña (por WhatsApp), no se manda. Lo llama el cron de alertas.
 */
export async function sendReviewEmails(db: SupabaseClient, origin: string): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  if (!teamEmailReady()) return out;
  const { data: t } = await db.from("tenants").select("id").eq("slug", tenantSlug()).maybeSingle();
  if (!t) return out;
  const now = Date.now();
  const { data: orders, error } = await db
    .from("orders")
    .select("id, customer, items, review_requests(id, email_at, submitted_at)")
    .eq("tenant_id", t.id)
    .eq("kind", "store")
    .eq("status", "delivered")
    .eq("review_blocked", false)
    .lte("delivered_at", new Date(now - AFTER_DAYS * DAY).toISOString())
    .gte("delivered_at", new Date(now - UNTIL_DAYS * DAY).toISOString())
    .order("delivered_at")
    .limit(100);
  // Sin la migración 0017 la consulta falla: no hay nada que mandar.
  if (error || !orders?.length) return out;

  type Row = { id: string; customer: { name?: string; phone?: string; email?: string }; items: { product?: string }[]; review_requests: { id: string; email_at: string | null; submitted_at: string | null }[] | null };
  const due = (orders as unknown as Row[])
    .filter((o) => /^\S+@\S+\.\S+$/.test(o.customer?.email ?? ""))
    .filter((o) => !(o.review_requests ?? []).some((r) => r.email_at || r.submitted_at))
    .slice(0, PER_RUN);
  if (!due.length) return out;

  const bundle = await getTenantBundle();
  const sf = bundle.storefront.reviews;
  const brand = bundle.tenant.name;
  for (const o of due) {
    try {
      const req = await ensureOrderRequest(db, t.id as string, {
        id: o.id,
        customer: o.customer,
        productSlugs: (o.items ?? []).map((i) => i.product ?? "").filter(Boolean),
      });
      if (req.email_at || req.submitted_at || !req.items.length) continue;
      const url = absoluteUrl(bundle.tenant.domain, reviewPath(req.token)) ?? `${origin}${reviewPath(req.token)}`;
      const nombre = (o.customer.name ?? "").trim().split(/\s+/)[0];
      const r = await sendTeamEmail(
        {
          to: o.customer.email as string,
          brand,
          subject: fillTemplate(sf.emailSubject, { nombre, marca: brand }),
          lines: [fillTemplate(sf.emailText, { nombre, marca: brand }), ...req.items.map((i) => `• ${i.name}`)],
          button: sf.emailButton,
          url,
          foot: `Te escribimos porque compraste en ${brand}. Es el único correo que te mandaremos sobre este pedido.`,
        },
        `review-${req.id}`,
      );
      if (r.ok) {
        out.sent++;
        await db.from("review_requests").update({ email_at: new Date().toISOString() }).eq("id", req.id);
      } else out.failed++;
    } catch {
      out.failed++;
    }
  }
  return out;
}
