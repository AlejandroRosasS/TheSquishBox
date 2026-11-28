"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Google Customer Reviews. Dos piezas, ambas con el ID de Merchant Center de la marca (Admin › SEO):
 * - `CustomerReviewsOptIn`: en la confirmación del pedido, la ventana de Google que pregunta si el cliente
 *   acepta una encuesta por correo después de la entrega.
 * - `CustomerReviewsBadge`: insignia opcional con la calificación del vendedor (toda la tienda).
 */

type Gapi = { load: (m: string, cb: () => void) => void; surveyoptin: { render: (o: Record<string, unknown>) => void } };
type W = Window & { gapi?: Gapi; renderOptIn?: () => void; ___gcfg?: { lang: string }; merchantwidget?: { start: (o: Record<string, unknown>) => void } };

export type OptInData = { merchantId: number; orderId: string; email: string; country: string; deliveryDate: string; lang: string };

export function CustomerReviewsOptIn({ data, onceKey }: { data: OptInData; onceKey: string }) {
  useEffect(() => {
    const w = window as W;
    // Una sola vez por pedido: si el cliente recarga la confirmación no vuelve a salir la ventana.
    try {
      if (localStorage.getItem(onceKey)) return;
    } catch {}
    w.___gcfg = { lang: data.lang };
    const render = () => {
      w.gapi?.load("surveyoptin", () => {
        try {
          w.gapi?.surveyoptin.render({
            merchant_id: data.merchantId,
            order_id: data.orderId,
            email: data.email,
            delivery_country: data.country,
            estimated_delivery_date: data.deliveryDate,
          });
          localStorage.setItem(onceKey, "1");
        } catch {}
      });
    };
    if (w.gapi?.load) render();
    else w.renderOptIn = render;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se muestra una vez al abrir la confirmación
  }, []);
  return <Script src="https://apis.google.com/js/platform.js?onload=renderOptIn" strategy="afterInteractive" />;
}

export function CustomerReviewsBadge({ merchantId, position, region }: { merchantId: number; position: string; region: string }) {
  return (
    <Script
      id="merchantWidgetScript"
      src="https://www.gstatic.com/shopping/merchant/merchantwidget.js"
      strategy="afterInteractive"
      onReady={() => {
        // Al pasar de la tienda al checkout el script se vuelve a montar: la insignia se arranca una sola vez.
        const w = window as W & { __gcrBadge?: boolean };
        if (w.__gcrBadge) return;
        try {
          w.merchantwidget?.start({ merchant_id: merchantId, position, region });
          w.__gcrBadge = true;
        } catch {}
      }}
    />
  );
}
