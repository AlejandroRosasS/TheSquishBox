"use client";

import { useEffect, useState } from "react";
import { deductions, payMethodKey } from "@/lib/sales/fees";
import { useAdmin, useAdminCatalog, useOrders } from "./AdminContext";
import { useOrdersFromDb } from "./AdminOrders";
import { usePaymentFees } from "./AdminFees";
import { useManualSales, type ManualSaleLine } from "./AdminSales";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export type WeekSales = {
  total: number;
  count: number;
  contribution: number;
  /** Últimos 7 días (el último es hoy): monto vendido, % para la barra y etiqueta del día. */
  days: { label: string; amount: number; pct: number }[];
  /** true: datos de ejemplo (sin base). */
  demo: boolean;
};

const limaDay = (ms: number) => new Date(ms - 5 * 3600_000).toISOString().slice(0, 10);

/**
 * Ventas de los últimos 7 días (hora de Perú), todos los canales: pedidos web + ventas registradas.
 * Mismas reglas que Ventas y márgenes: no cuentan pedidos cancelados, con pago fallido o devueltos;
 * la contribución descuenta costo de productos, IGV y comisiones del medio de pago.
 * Sin base (demo) devuelve los números de ejemplo.
 */
export function useWeekSales(): WeekSales | null {
  const { demo } = useAdmin();
  const { catalog } = useAdminCatalog();
  const fromDb = useOrdersFromDb();
  const { orders } = useOrders();
  const { sales } = useManualSales();
  const { fees } = usePaymentFees();
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la fecha es solo del navegador
  useEffect(() => setNow(Date.now()), []);

  if (!fromDb) {
    const max = Math.max(1, ...demo.weekSales.bars);
    return {
      total: demo.weekSales.total,
      count: demo.weekSales.count,
      contribution: demo.weekSales.contribution,
      days: demo.weekSales.bars.map((b, i) => ({ label: WEEKDAYS[i % 7], amount: b, pct: (b / max) * 100 })),
      demo: true,
    };
  }
  if (now === null) return null;

  const keys = Array.from({ length: 7 }, (_, i) => limaDay(now - (6 - i) * 86_400_000));
  const byDay = new Map(keys.map((k) => [k, 0]));
  const cost = (l: ManualSaleLine) => (l.cost ?? catalog.costs[l.productId]?.[l.variantId] ?? 0) * l.qty;
  let total = 0, count = 0, contribution = 0;
  const add = (day: string | undefined, lines: ManualSaleLine[], pay: string | undefined, channel: string) => {
    if (!day || !byDay.has(day)) return;
    const key = payMethodKey(pay, channel);
    const rule = key ? fees.rules[key] : null;
    let rev = 0;
    lines.forEach((l, i) => {
      const r = l.price * l.qty;
      const d = deductions(r, rule, fees.igvRate, i === 0);
      rev += r;
      contribution += r - cost(l) - d.igv - d.fee;
    });
    total += rev;
    count += 1;
    byDay.set(day, (byDay.get(day) ?? 0) + rev);
  };
  for (const s of sales) add(s.day, s.lines, s.pay, s.channel);
  for (const o of orders) {
    if (o.status === "cancelado" || ["failed", "refunded"].includes(o.paymentStatus ?? "") || !o.createdIso) continue;
    add(limaDay(Date.parse(o.createdIso)), o.lines, o.payMethod, "web");
  }
  const max = Math.max(0, ...byDay.values());
  return {
    total,
    count,
    contribution,
    days: keys.map((k) => {
      const amount = byDay.get(k) ?? 0;
      return { label: WEEKDAYS[new Date(`${k}T12:00:00Z`).getUTCDay()], amount, pct: max ? (amount / max) * 100 : 0 };
    }),
    demo: false,
  };
}
