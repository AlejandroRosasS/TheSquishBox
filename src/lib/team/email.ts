/**
 * Correos del equipo (invitación, cambio de contraseña). Van por Resend, la misma cuenta
 * de las alertas de pedidos (RESEND_API_KEY + ALERTS_FROM_EMAIL). Solo en el servidor.
 */
const env = (k: string) => process.env[k]?.trim() ?? "";

export function teamEmailReady(): boolean {
  return Boolean(env("RESEND_API_KEY") && env("ALERTS_FROM_EMAIL"));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type TeamMail = { to: string; brand: string; subject: string; lines: string[]; button: string; url: string; foot: string };

export async function sendTeamEmail(m: TeamMail, idempotencyKey?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!teamEmailReady()) return { ok: false, error: "El correo no está configurado en el servidor." };
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f;max-width:520px">
<p style="font-size:18px;font-weight:700;margin:0 0 12px">${esc(m.subject)}</p>
${m.lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("\n")}
<p style="margin:20px 0"><a href="${esc(m.url)}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${esc(m.button)}</a></p>
<p style="margin:0;color:#6e6e73;font-size:13px">${esc(m.foot)}</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: `${m.brand} <${env("ALERTS_FROM_EMAIL")}>`,
        to: [m.to],
        subject: m.subject,
        text: [m.subject, "", ...m.lines, "", `${m.button}: ${m.url}`, "", m.foot].join("\n"),
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: json.message ?? `error ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "sin respuesta" };
  }
}
