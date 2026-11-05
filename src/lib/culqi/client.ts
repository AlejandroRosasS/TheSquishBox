"use client";

/**
 * Culqi en el navegador: Culqi Checkout (ventana segura donde el cliente escribe su tarjeta)
 * y Culqi 3DS (cuando el banco pide verificar). Los datos de la tarjeta nunca pasan por nuestro servidor:
 * Culqi devuelve un token (tkn_…) y con eso cobra el servidor.
 */

const CHECKOUT_SRC = "https://js.culqi.com/checkout-js";
const THREEDS_SRC = "https://3ds.culqi.com";

type CulqiCheckoutInstance = {
  open: () => void;
  close: () => void;
  culqi: () => void;
  token?: { id: string; email?: string };
  order?: unknown;
  error?: { user_message?: string; merchant_message?: string };
};

type Culqi3DSApi = {
  publicKey: string;
  settings: unknown;
  options: unknown;
  initAuthentication: (tokenId: string) => Promise<void> | void;
  generateDevice?: () => Promise<string | null>;
  reset?: () => void;
};

declare global {
  interface Window {
    CulqiCheckout?: new (publicKey: string, config: unknown) => CulqiCheckoutInstance;
    Culqi3DS?: Culqi3DSApi;
  }
}

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = loading.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading.delete(src);
      reject(new Error("No se pudo cargar Culqi. Revisa tu conexión."));
    };
    document.body.appendChild(s);
  });
  loading.set(src, p);
  return p;
}

export function preloadCulqi() {
  void loadScript(CHECKOUT_SRC).catch(() => {});
}

export type CheckoutOptions = { publicKey: string; title: string; amountCents: number; email: string; firstName: string; lastName: string; color?: string; textColor?: string; logo?: string };

/**
 * Abre la ventana de Culqi. Resuelve con el token cuando el cliente confirma su tarjeta,
 * o rechaza con el mensaje de Culqi. Si el cliente cierra la ventana, la promesa no se resuelve:
 * la pantalla de checkout no debe quedarse bloqueada esperándola.
 */
export async function openCulqiCheckout(o: CheckoutOptions): Promise<string> {
  await loadScript(CHECKOUT_SRC);
  if (!window.CulqiCheckout) throw new Error("No se pudo cargar Culqi. Revisa tu conexión.");
  const culqi = new window.CulqiCheckout(o.publicKey, {
    settings: { title: o.title, currency: "PEN", amount: o.amountCents },
    client: { email: o.email, firstName: o.firstName, lastName: o.lastName },
    options: {
      lang: "auto",
      installments: false,
      modal: true,
      // Solo tarjeta: Yape y Plin siguen siendo manuales en el MVP.
      paymentMethods: { tarjeta: true, yape: false, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
      paymentMethodsSort: ["tarjeta"],
    },
    appearance: {
      theme: "default",
      hiddenCulqiLogo: false,
      hiddenBannerContent: false,
      hiddenBanner: false,
      hiddenToolBarAmount: false,
      menuType: "sidebar",
      buttonCardPayText: "Pagar",
      ...(o.logo ? { logo: o.logo } : {}),
      ...(o.color ? { defaultStyle: { bannerColor: o.color, buttonBackground: o.color, menuColor: o.color, linksColor: o.color, priceColor: o.color, ...(o.textColor ? { buttonTextColor: o.textColor } : {}) } } : {}),
    },
  });
  return new Promise<string>((resolve, reject) => {
    culqi.culqi = () => {
      if (culqi.token?.id) {
        culqi.close();
        resolve(culqi.token.id);
      } else if (culqi.error) {
        reject(new Error(culqi.error.user_message || "No pudimos validar tu tarjeta."));
      }
    };
    culqi.open();
  });
}

async function load3DS(publicKey: string): Promise<Culqi3DSApi> {
  await loadScript(THREEDS_SRC);
  const api = window.Culqi3DS;
  if (!api) throw new Error("No se pudo cargar la verificación de tu banco.");
  api.publicKey = publicKey;
  return api;
}

/**
 * Huella del dispositivo para el antifraude de Culqi (antifraud_details.device_finger_print_id).
 * Debe ser la misma en el cobro y en el reintento con 3DS. Si no carga, se cobra sin ella.
 */
export async function deviceFingerprint(publicKey: string): Promise<string | null> {
  try {
    const api = await load3DS(publicKey);
    return (await api.generateDevice?.()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Verificación 3DS (cuando Culqi responde que el banco quiere confirmar que eres tú).
 * Devuelve los parámetros que el servidor reenvía con el cobro.
 */
export async function authenticate3DS(o: { publicKey: string; tokenId: string; amountCents: number; email: string }): Promise<Record<string, unknown>> {
  const api = await load3DS(o.publicKey);
  api.reset?.();
  api.settings = { charge: { totalAmount: o.amountCents, returnUrl: window.location.href, currency: "PEN" }, card: { email: o.email } };
  api.options = { showModal: true, showLoading: true, showIcon: true };
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const r = e.data as { parameters3DS?: Record<string, unknown>; error?: string } | null;
      if (!r || typeof r !== "object") return;
      if (r.parameters3DS) {
        window.removeEventListener("message", onMsg);
        resolve(r.parameters3DS);
      } else if (r.error) {
        window.removeEventListener("message", onMsg);
        reject(new Error("Tu banco no pudo verificar la compra."));
      }
    };
    window.addEventListener("message", onMsg);
    void Promise.resolve(api.initAuthentication(o.tokenId)).catch(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Tu banco no pudo verificar la compra."));
    });
  });
}

export type ChargeResponse = { ok: true; number: number } | { ok: false; review?: boolean; message?: string; code?: string };

export async function chargeOrder(orderId: string, token: string, deviceId: string | null, authentication3DS?: Record<string, unknown>): Promise<ChargeResponse> {
  const res = await fetch("/api/culqi/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, token, deviceId, authentication3DS }),
  });
  return (await res.json().catch(() => ({ ok: false, message: "" }))) as ChargeResponse;
}
