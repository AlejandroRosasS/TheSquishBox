/** Perfiles del equipo de una marca (tenant_members.role). Lo comparten el panel y el servidor. */
export type Role = "owner" | "admin" | "staff";

export const ROLES: { id: Role; label: string; summary: string; can: string[]; cannot: string[] }[] = [
  {
    id: "owner",
    label: "Dueño",
    summary: "Todo el panel, más invitar, cambiar perfiles y quitar accesos.",
    can: ["Todo lo de Administrador", "Invitar personas y quitar accesos", "Cambiar perfiles y mandar enlaces de contraseña"],
    cannot: [],
  },
  {
    id: "admin",
    label: "Administrador",
    summary: "Todo el panel: tienda, textos, apariencia y ajustes. Ve el equipo pero no lo cambia.",
    can: ["Pedidos, productos, inventario y ventas", "Apariencia, textos, fotos y SEO", "Notificaciones y ajustes"],
    cannot: ["Invitar o quitar usuarios"],
  },
  {
    id: "staff",
    label: "Ventas",
    summary: "El día a día: pedidos, productos, inventario, ventas, Instagram y reclamaciones.",
    can: ["Pedidos y pedidos especiales", "Productos, precios e inventario", "Ventas, Instagram y reclamaciones"],
    cannot: ["Cambiar la tienda (apariencia, textos, fotos, SEO)", "Notificaciones, ajustes y usuarios"],
  },
];

export const isRole = (v: unknown): v is Role => v === "owner" || v === "admin" || v === "staff";
export const roleLabel = (r: Role) => ROLES.find((x) => x.id === r)?.label ?? r;

/** Puede cambiar la tienda y la configuración (en la base: is_manager). */
export const isManager = (r: Role) => r === "owner" || r === "admin";

/** Secciones que ve el perfil Ventas. El resto del panel es para Dueño y Administrador. */
const STAFF_SECTIONS = ["/admin/pedidos", "/admin/fiestas", "/admin/productos", "/admin/inventario", "/admin/instagram", "/admin/ventas", "/admin/reclamaciones", "/admin/perfil"];

export function canSee(role: Role, path: string): boolean {
  if (isManager(role)) return true;
  if (path === "/admin" || path === "/admin/") return true;
  return STAFF_SECTIONS.some((s) => path === s || path.startsWith(`${s}/`));
}
