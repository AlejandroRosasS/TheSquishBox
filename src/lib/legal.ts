import type { Business, LegalPageKey, Storefront, Tenant } from "./types";
import { policiesOf, policyVars } from "./policies";

/** Rutas fijas de las páginas legales (iguales en todas las marcas). */
export const LEGAL_ROUTES: Record<LegalPageKey, string> = {
  terms: "/terminos",
  returns: "/cambios-y-devoluciones",
  shipping: "/entregas",
  privacy: "/privacidad",
};
export const COMPLAINTS_ROUTE = "/libro-de-reclamaciones";
export const CONTACT_ROUTE = "/contacto";

/** Un dato sin completar: vacío, entre corchetes o con XX (p. ej. "[N.º de RUC]", "+51 9XX…"). */
export const isPlaceholder = (v: string | undefined | null) => !v || !v.trim() || /^\[.*\]$/.test(v.trim()) || /X{2,}/.test(v);

/**
 * Datos que se pueden ocultar en Contacto y en el pie (Admin › Textos › Contacto y empresa).
 * Razón social y RUC no: los exigen Culqi e INDECOPI. Las páginas legales y el Libro de reclamaciones muestran todo igual.
 */
export const BUSINESS_TOGGLES = ["phone", "email", "address", "hours", "instagram"] as const;
export type BusinessToggle = (typeof BUSINESS_TOGGLES)[number];
export const isShown = (b: Pick<Business, "hidden">, key: BusinessToggle) => !(b.hidden ?? []).includes(key);

/** Datos de la empresa con el WhatsApp del tenant como teléfono si no se puso otro. */
export function businessOf(tenant: Tenant, sf: Storefront): Business {
  const b = sf.business;
  return { ...b, phone: isPlaceholder(b.phone) ? tenant.whatsapp : b.phone };
}

/**
 * Reemplaza {name}, {legalName}, {ruc}, {address}, {email}, {phone} en los textos legales y, si se pasa
 * `sf`, también {deliveryDaysMin}, {deliveryDaysMax} y {returnDays} (Textos › Envíos y cambios).
 */
export function fillLegal(text: string, tenant: Tenant, b: Business, sf?: Pick<Storefront, "policies">): string {
  const { hidden: _hidden, ...data } = b;
  void _hidden;
  const vars: Record<string, string> = { name: tenant.name, ...data, ...(sf ? policyVars(policiesOf(sf)) : {}) };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

// ─────────── Libro de reclamaciones (D. S. 011-2011-PCM y modificatorias) ───────────
// Textos que exige el reglamento: son iguales para todas las marcas, por eso viven en el código.

export const COMPLAINT_DEFS = {
  reclamo: "Disconformidad relacionada a los productos o servicios.",
  queja: "Disconformidad no relacionada a los productos o servicios; o malestar o descontento respecto a la atención al público.",
};
export const COMPLAINT_NOTES = [
  "La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.",
  "El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables.",
];
export const RESPONSE_BUSINESS_DAYS = 15;

export type ComplaintInput = {
  consumer: {
    name: string;
    docType: "DNI" | "CE" | "Pasaporte";
    docNumber: string;
    address: string;
    phone: string;
    email: string;
    /** Solo si quien reclama es menor de edad. */
    guardian: string;
  };
  item: { type: "producto" | "servicio"; description: string; amount: string; orderNumber: string };
  kind: "reclamo" | "queja";
  detail: string;
  request: string;
};

export type Complaint = ComplaintInput & {
  id: string;
  code: string;
  createdAt: string;
  provider: { legalName: string; ruc: string; address: string };
  status: "open" | "answered";
  response: string;
  respondedAt: string | null;
};

/** Código visible de la hoja: 7 en 2026 → "000007-2026". */
export const complaintCode = (n: number, year: number) => `${String(n).padStart(6, "0")}-${year}`;

/** Suma días hábiles (lunes a viernes; no descuenta feriados: tómalo como plazo máximo aproximado). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

// Modo demo (sin base de datos): las hojas se guardan en este navegador para verlas en el admin.
const demoKey = (slug: string) => `complaints:${slug}`;

export function loadDemoComplaints(slug: string): Complaint[] {
  try {
    return JSON.parse(localStorage.getItem(demoKey(slug)) || "[]");
  } catch {
    return [];
  }
}

export function saveDemoComplaints(slug: string, list: Complaint[]) {
  localStorage.setItem(demoKey(slug), JSON.stringify(list));
}

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(iso));
export const fmtDate = (iso: string) => new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" }).format(new Date(iso));

/** Contenido de la hoja de reclamación, en el orden del formato oficial. Lo usan la constancia de la tienda y el admin. */
export function complaintSections(c: Complaint): { title: string; rows: [string, string][] }[] {
  const amount = c.item.amount.trim() ? `S/ ${Number(c.item.amount.replace(",", ".")).toFixed(2)}` : "—";
  return [
    { title: "Proveedor", rows: [["Razón social", c.provider.legalName], ["RUC", c.provider.ruc], ["Dirección", c.provider.address]] },
    {
      title: "1. Identificación del consumidor reclamante",
      rows: [
        ["Nombre", c.consumer.name],
        [c.consumer.docType, c.consumer.docNumber],
        ["Domicilio", c.consumer.address],
        ["Teléfono", c.consumer.phone || "—"],
        ["Correo", c.consumer.email],
        ...(c.consumer.guardian ? ([["Padre, madre o apoderado (menor de edad)", c.consumer.guardian]] as [string, string][]) : []),
      ],
    },
    {
      title: "2. Identificación del bien contratado",
      rows: [
        ["Tipo", c.item.type === "producto" ? "Producto" : "Servicio"],
        ["N.º de pedido", c.item.orderNumber || "—"],
        ["Monto reclamado", amount],
        ["Descripción", c.item.description],
      ],
    },
    {
      title: "3. Detalle de la reclamación y pedido del consumidor",
      rows: [
        ["Tipo", c.kind === "reclamo" ? "Reclamo" : "Queja"],
        ["Detalle", c.detail],
        ["Pedido", c.request],
      ],
    },
    {
      title: "4. Observaciones y acciones adoptadas por el proveedor",
      rows: c.status === "answered" ? [["Respuesta", c.response], ["Fecha de respuesta", c.respondedAt ? fmtDate(c.respondedAt) : "—"]] : [["Estado", "Pendiente de respuesta"]],
    },
  ];
}

export const complaintDate = fmtDateTime;
