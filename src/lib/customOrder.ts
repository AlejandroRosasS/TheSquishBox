import type { Tenant } from "@/lib/types";
import { CONTACT_ROUTE } from "@/lib/legal";

/** Rutas de la página de pedido especial según el tipo de formulario de la marca. */
export const PARTY_ROUTE = "/fiesta";
/** El formulario de contacto vive dentro de la página Contacto. */
export const CONTACT_FORM_ROUTE = CONTACT_ROUTE;

/** La marca usa el formulario de la página Contacto (motivo + mensaje) en vez del formulario de cotización. */
export const isContactForm = (tenant: Pick<Tenant, "customOrder">) => tenant.customOrder.form === "contact";

/** A dónde llevan los botones del pedido especial (banda de Inicio, catálogo, producto agotado…). */
export const customOrderHref = (tenant: Pick<Tenant, "customOrder">) => (isContactForm(tenant) ? CONTACT_FORM_ROUTE : PARTY_ROUTE);
