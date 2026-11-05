import type { Complaint, ComplaintInput } from "@/lib/legal";
import { publicClient } from "./public";

type Provider = Complaint["provider"];

/** Registra la hoja en la base (RPC sin sesión). La base asigna el número correlativo. */
export async function fileComplaint(slug: string, input: ComplaintInput, provider: Provider) {
  const { data, error } = await publicClient().rpc("file_complaint", { tenant_slug: slug, p: { ...input, provider } });
  if (error) throw new Error(error.message);
  const r = data as { id: string; code: string; created_at: string; provider: Provider };
  return { id: r.id, code: r.code, createdAt: r.created_at, provider: r.provider };
}

export const COMPLAINT_COLUMNS = "id, code, kind, consumer, item, detail, request, provider, status, response, responded_at, created_at";

export type ComplaintRow = {
  id: string;
  code: string;
  kind: Complaint["kind"];
  consumer: Complaint["consumer"];
  item: Complaint["item"];
  detail: string;
  request: string;
  provider: Provider;
  status: Complaint["status"];
  response: string | null;
  responded_at: string | null;
  created_at: string;
};

export const toComplaint = (r: ComplaintRow): Complaint => ({
  id: r.id,
  code: r.code,
  kind: r.kind,
  consumer: r.consumer,
  item: r.item,
  detail: r.detail,
  request: r.request,
  provider: r.provider,
  status: r.status,
  response: r.response ?? "",
  respondedAt: r.responded_at,
  createdAt: r.created_at,
});
