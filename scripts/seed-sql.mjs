// Genera el SQL para cargar una marca en Supabase desde src/tenants/<slug>/*.json.
// Uso: node scripts/seed-sql.mjs squish > supabase/seed/squish.sql
// Es idempotente: vuelve a correrlo para reemplazar lo publicado con lo que hay en los archivos.
import { readFileSync } from "node:fs";

const slug = process.argv[2];
if (!slug) throw new Error("Falta el slug: node scripts/seed-sql.mjs <slug>");
const read = (f) => JSON.parse(readFileSync(new URL(`../src/tenants/${slug}/${f}.json`, import.meta.url), "utf8"));
const tenant = read("tenant");
const catalog = read("catalog");
const storefront = read("storefront");
const seo = read("seo");

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const arr = (a) => `array[${a.map(q).join(",")}]::text[]`;

const { lines, products, ...catalogExtras } = catalog;
const settings = { deliveryRates: storefront.checkout.deliveryRates, deliveryRatesAreExample: storefront.checkout.deliveryRatesAreExample };
const domains = tenant.domain && !tenant.domain.startsWith("[") ? [tenant.domain] : [];

const T = `public.tenants where slug = ${q(slug)}`;
const out = [];
out.push("begin;");
out.push(`insert into public.tenants (slug, name, domains) values (${q(slug)}, ${q(tenant.name)}, ${arr(domains)})
  on conflict (slug) do update set name = excluded.name;`);

const docs = { tenant: { ...tenant, catalogExtras }, storefront, seo, settings };
for (const [kind, body] of Object.entries(docs)) {
  out.push(`insert into public.site_docs (tenant_id, kind, stage, body) select id, ${q(kind)}, 'published', ${j(body)} from ${T}
  on conflict (tenant_id, kind, stage) do update set body = excluded.body, updated_at = now();`);
}

out.push(`delete from public.product_lines where tenant_id = (select id from ${T});`);
for (const l of lines) {
  out.push(`insert into public.product_lines (tenant_id, id, name, position) select id, ${q(l.id)}, ${q(l.name)}, ${l.order} from ${T};`);
}

products.forEach((p, i) => {
  const kind = p.kind ?? (p.variants.length > 1 ? "options" : "simple");
  out.push(`insert into public.products (tenant_id, slug, name, line, badge, status, kind, options_label, description, images, position)
  select id, ${q(p.id)}, ${q(p.name)}, ${q(p.line)}, ${q(p.badge)}, ${q(p.status)}, ${q(kind)}, ${q(p.optionsLabel)}, ${q(p.description)}, ${arr(p.images)}, ${i} from ${T}
  on conflict (tenant_id, slug) do update set name = excluded.name, line = excluded.line, badge = excluded.badge, status = excluded.status,
    kind = excluded.kind, options_label = excluded.options_label,
    description = excluded.description, images = excluded.images, position = excluded.position, updated_at = now();`);
  p.variants.forEach((v, k) => {
    out.push(`insert into public.product_variants (tenant_id, product_id, key, label, price, price_is_reference, stock, image, position)
  select pr.tenant_id, pr.id, ${q(v.id)}, ${q(v.label)}, ${v.price}, ${v.priceIsReference}, ${v.stock ?? "null"}, ${q(v.image)}, ${k}
  from public.products pr where pr.tenant_id = (select id from ${T}) and pr.slug = ${q(p.id)}
  on conflict (product_id, key) do update set label = excluded.label, price = excluded.price,
    price_is_reference = excluded.price_is_reference, stock = excluded.stock, image = excluded.image, position = excluded.position;`);
  });
});
out.push("commit;");
console.log(out.join("\n"));
