"use client";

import { useEffect, useState } from "react";

/** Fecha de hoy (AAAA-MM-DD), calculada en el navegador para no fijarla en el prerender. */
export function useToday(): string | undefined {
  const [today, setToday] = useState<string>();
  useEffect(() => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor solo del cliente
    setToday(local.toISOString().slice(0, 10));
  }, []);
  return today;
}
