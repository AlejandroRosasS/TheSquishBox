"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/components/StoreContext";
import { useCart } from "@/components/cart/CartProvider";
import { Rich } from "@/components/Rich";
import { asset } from "@/lib/assets";
import { hasOptions, variantImage } from "@/lib/catalog";
import { formatPrice, plural } from "@/lib/format";
import { saveOrder } from "@/lib/orders";
import { orderCode, placeOrder } from "@/lib/db/orders";
import { useToday } from "@/lib/useToday";
import { IconAlert, IconBag, IconChevronLeft, IconLock, IconPin, IconTruck } from "@/components/Icons";

/* eslint-disable @next/next/no-img-element */

type Ship = "delivery" | "pickup";
type Doc = "boleta" | "factura";
type Pay = "yape" | "tarjeta";

const digits = (s: string) => s.replace(/\D/g, "");

/** Código de Yape que simula un pago rechazado (solo demo de Fase 1). */
const DEMO_FAIL_CODE = "000000";

export function CheckoutView() {
  const { tenant, storefront: sf, source } = useStore();
  const cart = useCart();
  const router = useRouter();
  const cur = tenant.currency;
  const rates = sf.checkout.deliveryRates;
  const methods = (["yape", "tarjeta"] as Pay[]).filter((m) => tenant.payments.methods.includes(m));

  const [f, setF] = useState({
    name: "", phone: "", email: "",
    address: "", district: sf.checkout.defaultDistrict, reference: "", date: "", recipient: "", gift: "",
    pickupDate: "",
    dni: "", ruc: "", razon: "",
    yapePhone: "", yapeCode: "",
    cardNumber: "", cardExp: "", cardCvv: "",
  });
  const [ship, setShip] = useState<Ship>("delivery");
  const [doc, setDoc] = useState<Doc>("boleta");
  const [pay, setPay] = useState<Pay>(methods[0] ?? "yape");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payError, setPayError] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const today = useToday();

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  if (!cart.ready) return <div style={{ minHeight: "60vh" }} />;

  if (cart.lines.length === 0) {
    return (
      <>
        <CheckoutHeader />
        <div className="wrap" style={{ paddingBlock: "72px 96px" }}>
          <div className="stack g4" style={{ alignItems: "center", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
            <h1 className="h2"><Rich text={sf.cart.emptyTitle} /></h1>
            <p className="lead">Agrega algo a tu carrito para finalizar la compra.</p>
            <Link className="btn" href={sf.cart.emptyPrimary.href}>{sf.cart.emptyPrimary.label}</Link>
          </div>
        </div>
      </>
    );
  }

  const isDelivery = ship === "delivery";
  const rate = isDelivery ? rates[f.district] ?? null : 0;
  const coordinate = isDelivery && rate == null;
  const total = cart.subtotal + (rate || 0);
  const estLabel = !isDelivery ? "Gratis" : coordinate ? "A coordinar" : formatPrice(rate as number, cur);
  const totalLabel = formatPrice(total, cur) + (coordinate ? " + delivery" : "");
  const payLabel = pay === "yape" ? "Pagar con Yape" : "Pagar con tarjeta";

  const validate = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Escribe tu nombre y apellido.";
    if (digits(f.phone).length !== 9) e.phone = "Escribe un celular de 9 dígitos.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Escribe un correo válido.";
    if (isDelivery) {
      if (f.address.trim().length < 5) e.address = "Escribe tu dirección.";
      if (!f.date) e.date = "Elige una fecha.";
      if (f.gift.length > 120) e.gift = "Máximo 120 caracteres.";
    } else if (!f.pickupDate) e.pickupDate = "Elige una fecha.";
    if (doc === "boleta" && digits(f.dni).length !== 8) e.dni = "El DNI tiene 8 dígitos.";
    if (doc === "factura") {
      if (digits(f.ruc).length !== 11) e.ruc = "El RUC tiene 11 dígitos.";
      if (!f.razon.trim()) e.razon = "Escribe la razón social.";
    }
    if (pay === "yape") {
      if (digits(f.yapePhone).length !== 9) e.yapePhone = "Escribe el celular de tu Yape.";
      if (digits(f.yapeCode).length !== 6) e.yapeCode = "El código tiene 6 dígitos.";
    } else {
      if (digits(f.cardNumber).length < 15) e.cardNumber = "Revisa el número de tarjeta.";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.cardExp.trim())) e.cardExp = "Usa el formato MM/AA.";
      if (!/^\d{3,4}$/.test(f.cardCvv.trim())) e.cardCvv = "3 o 4 dígitos.";
    }
    return e;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.getElementById(`c-${Object.keys(e)[0]}`);
      first?.focus();
      return;
    }
    setSending(true);
    setOrderError(null);
    // Pago simulado (Fase 1). En Fase 3 aquí se llama a Culqi.
    setTimeout(async () => {
      if (pay === "yape" && digits(f.yapeCode) === DEMO_FAIL_CODE) {
        setPayError(true);
        setErrors({ yapeCode: "Código vencido o incorrecto." });
        setSending(false);
        document.getElementById("co-4")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const customer = { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() };
      const shipping = isDelivery
        ? { type: "delivery" as const, address: f.address.trim(), district: f.district, reference: f.reference.trim(), date: f.date, recipient: f.recipient.trim(), gift: f.gift.trim() }
        : { type: "pickup" as const, date: f.pickupDate };
      const docInfo = doc === "boleta" ? { type: "boleta" as const, dni: digits(f.dni) } : { type: "factura" as const, ruc: digits(f.ruc), razon: f.razon.trim() };
      let id: string | undefined;
      let finalTotal = total;
      // Con la base: el pedido se guarda allá (precio, stock y delivery los calcula la base).
      if (source === "db") {
        const items = cart.lines.map((l) => ({ variant_id: l.variant.dbId ?? "", qty: l.qty }));
        try {
          if (items.some((i) => !i.variant_id)) throw new Error("Producto no disponible");
          const res = await placeOrder(tenant.slug, {
            items,
            customer: { ...customer, doc: docInfo },
            delivery: shipping.type === "delivery"
              ? { mode: "delivery", address: shipping.address, district: shipping.district, reference: shipping.reference, date: shipping.date, recipient: shipping.recipient }
              : { mode: "pickup", date: shipping.date },
            payment_method: pay,
            gift_message: shipping.type === "delivery" ? shipping.gift : "",
          });
          id = orderCode(res.number);
          finalTotal = res.total;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          setOrderError(
            /stock|disponible/i.test(msg)
              ? `${msg}. Revisa tu carrito: puede que alguien se haya llevado las últimas unidades.`
              : "No pudimos registrar tu pedido. Revisa tu conexión e inténtalo otra vez. No se realizó ningún cobro.",
          );
          setSending(false);
          return;
        }
      }
      const order = saveOrder(tenant.slug, {
        customer,
        shipping,
        doc: docInfo,
        payment: { method: pay },
        lines: cart.lines.map((l) => ({
          productId: l.productId,
          name: l.product.name,
          variantLabel: hasOptions(l.product) ? l.variant.label : "",
          qty: l.qty,
          price: l.variant.price,
          image: variantImage(l.product, l.variant),
        })),
        subtotal: cart.subtotal,
        deliveryFee: isDelivery ? rate : 0,
        total: finalTotal,
      }, id);
      router.push(`/pedido/${order.id}`);
      cart.clear();
    }, 700);
  };

  const err = (k: string) => (errors[k] ? <p className="err-msg" id={`c-${k}-err`}>{errors[k]}</p> : null);
  const fieldCls = (k: string) => `field ${errors[k] ? "error" : ""}`;
  const aria = (k: string) => ({ id: `c-${k}`, "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `c-${k}-err` : undefined });

  return (
    <>
      <CheckoutHeader />
      <div className="sum-bar only-m flex">
        <span className="row g2"><IconBag size="sm" />Resumen · {plural(cart.count, "producto", "productos")}</span>
        <b>{totalLabel}</b>
      </div>

      <form className="wrap" style={{ paddingBlock: "40px 96px" }} onSubmit={submit} noValidate>
        <h1 className="h2" style={{ marginBottom: 28 }}>Finalizar <em>compra</em></h1>
        <div className="co-layout">
          <div className="stack g6">
            <section className="co-block" aria-labelledby="co-1">
              <div className="co-step"><span className="n">1</span><h2 id="co-1" className="h4">Contacto</h2></div>
              <div className={fieldCls("name")}><label htmlFor="c-name">Nombre y apellido</label><input className="input" autoComplete="name" value={f.name} onChange={set("name")} {...aria("name")} />{err("name")}</div>
              <div className="grid2">
                <div className={fieldCls("phone")}><label htmlFor="c-phone">Celular</label><input className="input" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="9XX XXX XXX" value={f.phone} onChange={set("phone")} {...aria("phone")} /><span className="hint">Te escribiremos por WhatsApp a este número.</span>{err("phone")}</div>
                <div className={fieldCls("email")}><label htmlFor="c-email">Correo</label><input className="input" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={f.email} onChange={set("email")} {...aria("email")} />{err("email")}</div>
              </div>
            </section>

            <section className="co-block" aria-labelledby="co-2">
              <div className="co-step"><span className="n">2</span><h2 id="co-2" className="h4">Entrega</h2></div>
              <div className="grid2" role="radiogroup" aria-label="Tipo de entrega">
                <button className={`opt ${isDelivery ? "on" : ""}`} type="button" role="radio" aria-checked={isDelivery} onClick={() => setShip("delivery")}>
                  <span className="radio" /><IconTruck /><span className="grow"><b>Delivery</b><br /><span className="small muted">{sf.checkout.deliveryLabel}</span></span>
                </button>
                <button className={`opt ${!isDelivery ? "on" : ""}`} type="button" role="radio" aria-checked={!isDelivery} onClick={() => setShip("pickup")}>
                  <span className="radio" /><IconPin /><span className="grow"><b>Recojo</b><br /><span className="small muted">{sf.checkout.pickupLabel}</span></span>
                </button>
              </div>

              {isDelivery ? (
                <div className="stack g4">
                  <div className={fieldCls("address")}><label htmlFor="c-address">Dirección</label><input className="input" autoComplete="street-address" placeholder="Calle, número, dpto." value={f.address} onChange={set("address")} {...aria("address")} />{err("address")}</div>
                  <div className="grid2">
                    <div className="field"><label htmlFor="c-district">Distrito de Lima</label>
                      <select id="c-district" className="select" value={f.district} onChange={set("district")}>
                        {Object.keys(rates).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="field"><label htmlFor="c-reference">Referencia</label><input id="c-reference" className="input" placeholder="Ej.: frente al parque" value={f.reference} onChange={set("reference")} /></div>
                  </div>
                  <div className="est" aria-live="polite">
                    <span className="row g3"><IconPin size="sm" style={{ color: "var(--primary)" }} /><span><b>Delivery estimado a {f.district}</b><br /><span className="small muted">El costo final se confirma al coordinar tu entrega.</span></span></span>
                    <b style={{ whiteSpace: "nowrap" }}>{estLabel}</b>
                  </div>
                  <div className="grid2">
                    <div className={fieldCls("date")}><label htmlFor="c-date">Fecha preferida</label><input className="input" type="date" min={today} value={f.date} onChange={set("date")} {...aria("date")} /><span className="hint">Coordinamos la hora por WhatsApp.</span>{err("date")}</div>
                    <div className="field"><label htmlFor="c-recipient">¿Quién recibe? <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><input id="c-recipient" className="input" placeholder="Si no eres tú" value={f.recipient} onChange={set("recipient")} /></div>
                  </div>
                  <div className={fieldCls("gift")}><label htmlFor="c-gift">¿Es un regalo? Déjale un mensaje <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><textarea className="textarea" style={{ minHeight: 88 }} maxLength={120} value={f.gift} onChange={set("gift")} {...aria("gift")} /><span className="hint">{sf.checkout.giftHint} ({f.gift.length}/120)</span>{err("gift")}</div>
                </div>
              ) : (
                <div className="stack g4">
                  <div className="note"><IconPin size="sm" /><span><Rich text={sf.checkout.pickupNote} /></span></div>
                  <div className={fieldCls("pickupDate")}><label htmlFor="c-pickupDate">Fecha preferida de recojo</label><input className="input" type="date" min={today} value={f.pickupDate} onChange={set("pickupDate")} {...aria("pickupDate")} />{err("pickupDate")}</div>
                </div>
              )}
            </section>

            <section className="co-block" aria-labelledby="co-3">
              <div className="co-step"><span className="n">3</span><h2 id="co-3" className="h4">Comprobante</h2></div>
              <div className="grid2" role="radiogroup" aria-label="Tipo de comprobante">
                <button className={`opt ${doc === "boleta" ? "on" : ""}`} type="button" role="radio" aria-checked={doc === "boleta"} onClick={() => setDoc("boleta")}><span className="radio" /><span className="grow"><b>Boleta</b><br /><span className="small muted">Con DNI</span></span></button>
                <button className={`opt ${doc === "factura" ? "on" : ""}`} type="button" role="radio" aria-checked={doc === "factura"} onClick={() => setDoc("factura")}><span className="radio" /><span className="grow"><b>Factura</b><br /><span className="small muted">Con RUC</span></span></button>
              </div>
              {doc === "boleta" ? (
                <div className={fieldCls("dni")}><label htmlFor="c-dni">DNI</label><input className="input" inputMode="numeric" placeholder="8 dígitos" value={f.dni} onChange={set("dni")} {...aria("dni")} />{err("dni")}</div>
              ) : (
                <div className="grid2">
                  <div className={fieldCls("ruc")}><label htmlFor="c-ruc">RUC</label><input className="input" inputMode="numeric" placeholder="11 dígitos" value={f.ruc} onChange={set("ruc")} {...aria("ruc")} />{err("ruc")}</div>
                  <div className={fieldCls("razon")}><label htmlFor="c-razon">Razón social</label><input className="input" value={f.razon} onChange={set("razon")} {...aria("razon")} />{err("razon")}</div>
                </div>
              )}
            </section>

            <section className="co-block" aria-labelledby="co-4" style={{ borderBottom: 0 }}>
              <div className="co-step"><span className="n">4</span><h2 id="co-4" className="h4">Pago</h2></div>
              {payError && (
                <div className="alert" role="alert">
                  <IconAlert />
                  <div className="stack g1">
                    <b>No pudimos procesar tu pago con Yape</b>
                    <span className="small">El código de aprobación venció o es incorrecto. <b>No se realizó ningún cobro.</b> Genera un código nuevo en tu app Yape e inténtalo otra vez{methods.includes("tarjeta") ? ", o paga con tarjeta" : ""}.</span>
                  </div>
                </div>
              )}
              <div className="stack g3" role="radiogroup" aria-label="Medio de pago">
                {methods.includes("yape") && (
                  <>
                    <button className={`opt ${pay === "yape" ? "on" : ""}`} type="button" role="radio" aria-checked={pay === "yape"} onClick={() => setPay("yape")}>
                      <span className="radio" /><span className="grow"><b>Yape</b><br /><span className="small muted">Con tu celular y código de aprobación</span></span><span className="pay-logo">YAPE</span>
                    </button>
                    {pay === "yape" && (
                      <div className="grid2" style={{ padding: "4px 0 8px" }}>
                        <div className={fieldCls("yapePhone")}><label htmlFor="c-yapePhone">Celular de Yape</label><input className="input" type="tel" inputMode="numeric" value={f.yapePhone} onChange={set("yapePhone")} {...aria("yapePhone")} />{err("yapePhone")}</div>
                        <div className={fieldCls("yapeCode")}><label htmlFor="c-yapeCode">Código de aprobación</label><input className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="6 dígitos" value={f.yapeCode} onChange={set("yapeCode")} {...aria("yapeCode")} /><span className="hint">Yape › Menú › Código de aprobación</span>{err("yapeCode")}</div>
                      </div>
                    )}
                  </>
                )}
                {methods.includes("tarjeta") && (
                  <>
                    <button className={`opt ${pay === "tarjeta" ? "on" : ""}`} type="button" role="radio" aria-checked={pay === "tarjeta"} onClick={() => setPay("tarjeta")}>
                      <span className="radio" /><span className="grow"><b>Tarjeta de crédito o débito</b><br /><span className="small muted">Visa, Mastercard, Amex, Diners</span></span><span className="pay-logos"><span className="pay-logo">VISA</span><span className="pay-logo">MC</span></span>
                    </button>
                    {pay === "tarjeta" && (
                      <div className="stack g3" style={{ padding: "4px 0 8px" }}>
                        <div className={fieldCls("cardNumber")}><label htmlFor="c-cardNumber">Número de tarjeta</label><input className="input" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={f.cardNumber} onChange={set("cardNumber")} {...aria("cardNumber")} />{err("cardNumber")}</div>
                        <div className="grid2" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          <div className={fieldCls("cardExp")}><label htmlFor="c-cardExp">Vence</label><input className="input" autoComplete="cc-exp" placeholder="MM/AA" value={f.cardExp} onChange={set("cardExp")} {...aria("cardExp")} />{err("cardExp")}</div>
                          <div className={fieldCls("cardCvv")}><label htmlFor="c-cardCvv">CVV</label><input className="input" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={f.cardCvv} onChange={set("cardCvv")} {...aria("cardCvv")} />{err("cardCvv")}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <p className="small muted">Procesado por Culqi. No guardamos los datos de tu tarjeta.</p>
              <p className="demo-note">Demo: el pago es simulado y no se cobra nada. Con el código de Yape {DEMO_FAIL_CODE} puedes ver el error de pago.</p>
            </section>
          </div>

          <aside className="summary" aria-label="Resumen del pedido" style={{ position: "sticky", top: 24 }}>
            <p className="h4">Tu pedido</p>
            {cart.lines.map((l) => (
              <div className="row g3" key={`${l.productId}/${l.variantId}`}>
                <div className="ph r45" style={{ width: 56, flex: "none", borderRadius: 10 }}><img src={asset(tenant.slug, variantImage(l.product, l.variant))} alt={l.product.name} /></div>
                <div className="grow"><b style={{ fontSize: 14 }}>{l.product.name}</b><p className="small muted">{hasOptions(l.product) ? `${l.variant.label} · ` : ""}x{l.qty}</p></div>
                <span className="small strong">{formatPrice(l.lineTotal, cur)}</span>
              </div>
            ))}
            <hr className="hr" />
            <div className="sum-row"><span className="muted">Subtotal</span><span>{formatPrice(cart.subtotal, cur)}</span></div>
            <div className="sum-row"><span className="muted">{isDelivery ? "Delivery estimado" : "Recojo acordado"}</span><span>{estLabel}</span></div>
            <div className="sum-row total"><span>Total</span><span>{totalLabel}</span></div>
            <p className="small muted">
              {coordinate
                ? `No tenemos tarifa para ${f.district}: te escribiremos para coordinar el costo antes de enviar.`
                : isDelivery
                  ? "El costo final del delivery se confirma al coordinar tu entrega."
                  : "Te escribimos por WhatsApp para coordinar dónde y cuándo recoges."}
            </p>
            {orderError && <div className="alert" role="alert"><IconAlert /><span className="small">{orderError}</span></div>}
            <button className="btn block" type="submit" disabled={sending}>
              {sending ? "Procesando…" : `${payError ? "Reintentar" : payLabel} · ${formatPrice(total, cur)}`}
            </button>
            <p className="secure"><IconLock size="xs" />Pago encriptado · Libro de reclamaciones</p>
          </aside>
        </div>
      </form>
    </>
  );
}

function CheckoutHeader() {
  return (
    <header className="header">
      <div className="wrap row between" style={{ minHeight: 76 }}>
        <Link className="textlink" href="/carrito" aria-label="Volver al carrito"><IconChevronLeft size="sm" /><span className="only-d">Volver al carrito</span></Link>
        <span className="secure"><IconLock size="sm" /><span className="only-d">Pago seguro</span></span>
      </div>
    </header>
  );
}
