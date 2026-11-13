import type { SupabaseClient } from "@supabase/supabase-js";
import { publicClient } from "./public";
import { kickAlerts } from "./orders";

// ─────────── Tienda: la página del link (sin sesión, vía RPC) ───────────

export type ReviewRequestInfo = {
  tenant: string;
  customer: string;
  expired: boolean;
  items: { productId: string; name: string; done: boolean }[];
};

export async function loadReviewRequest(token: string): Promise<ReviewRequestInfo | null> {
  const { data, error } = await publicClient().rpc("get_review_request", { req_token: token });
  if (error) throw new Error(error.message);
  return (data as ReviewRequestInfo | null) ?? null;
}

export type ReviewInput = { name: string; reviews: { productId: string; rating: number; body: string }[] };

/** Guarda las reseñas (quedan pendientes de aprobación). Devuelve cuántas se guardaron. */
export async function submitReview(token: string, input: ReviewInput): Promise<number> {
  const { data, error } = await publicClient().rpc("submit_review", { req_token: token, p: input });
  if (error) throw new Error(error.message);
  kickAlerts();
  return Number(data ?? 0);
}

// ─────────── Admin y servidor: pedidos de reseña ───────────

export type RequestRow = {
  id: string;
  token: string;
  order_id: string | null;
  customer: { name?: string; phone?: string; email?: string };
  items: { productId: string; name: string }[];
  whatsapp_at: string | null;
  email_at: string | null;
  submitted_at: string | null;
  expires_at: string;
  created_at: string;
};

export const REQUEST_COLUMNS = "id, token, order_id, customer, items, whatsapp_at, email_at, submitted_at, expires_at, created_at";

/** Productos (uuid) a partir de los ids públicos (slug) del catálogo. */
async function productsBySlug(db: SupabaseClient, tenantId: string, slugs: string[]) {
  if (!slugs.length) return [];
  const { data, error } = await db.from("products").select("id, slug, name").eq("tenant_id", tenantId).in("slug", slugs);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; slug: string; name: string }[];
}

/** El pedido de reseña de un pedido web. Si no existe, lo crea con sus productos (uno por producto). */
export async function ensureOrderRequest(
  db: SupabaseClient,
  tenantId: string,
  order: { id: string; customer: { name?: string; phone?: string; email?: string }; productSlugs: string[] },
): Promise<RequestRow> {
  const { data: found, error } = await db.from("review_requests").select(REQUEST_COLUMNS).eq("order_id", order.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (found) return found as RequestRow;
  const prods = await productsBySlug(db, tenantId, [...new Set(order.productSlugs)]);
  const { data, error: e2 } = await db
    .from("review_requests")
    .insert({ tenant_id: tenantId, order_id: order.id, customer: order.customer, items: prods.map((p) => ({ productId: p.id, name: p.name })) })
    .select(REQUEST_COLUMNS)
    .single();
  if (e2) {
    // Otra pestaña (o el correo automático) lo creó al mismo tiempo.
    const { data: again } = await db.from("review_requests").select(REQUEST_COLUMNS).eq("order_id", order.id).maybeSingle();
    if (again) return again as RequestRow;
    throw new Error(e2.message);
  }
  return data as RequestRow;
}

/** Link generado a mano (feria, Instagram): el equipo elige el cliente y los productos. */
export async function createManualRequest(
  db: SupabaseClient,
  tenantId: string,
  input: { customer: { name: string; phone?: string; email?: string }; productSlugs: string[] },
): Promise<RequestRow> {
  const prods = await productsBySlug(db, tenantId, input.productSlugs);
  if (!prods.length) throw new Error("Elige al menos un producto.");
  const { data, error } = await db
    .from("review_requests")
    .insert({ tenant_id: tenantId, customer: input.customer, items: prods.map((p) => ({ productId: p.id, name: p.name })) })
    .select(REQUEST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RequestRow;
}

// ─────────── Admin: moderación ───────────

export type AdminReviewRow = {
  id: string;
  request_id: string | null;
  product_id: string;
  rating: number;
  body: string | null;
  author_name: string;
  verified: boolean;
  status: "pending" | "approved" | "hidden";
  reply: string | null;
  created_at: string;
  moderated_at: string | null;
  products: { slug: string; name: string } | null;
  review_requests: { order_id: string | null; customer: { name?: string; phone?: string; email?: string } } | null;
};

export const ADMIN_REVIEW_COLUMNS =
  "id, request_id, product_id, rating, body, author_name, verified, status, reply, created_at, moderated_at, products(slug, name), review_requests(order_id, customer)";
