import { COMPLAINT_DEFS, COMPLAINT_NOTES, complaintDate, complaintSections, type Complaint } from "@/lib/legal";

/** Hoja de reclamación (constancia para el consumidor). */
export function ComplaintSheet({ c, title }: { c: Complaint; title: string }) {
  return (
    <div className="hoja" id="hoja">
      <div className="hoja-h">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="h3">Hoja de reclamación N.º {c.code}</p>
        </div>
        <p className="small muted">{complaintDate(c.createdAt)}</p>
      </div>
      {complaintSections(c).map((s) => (
        <section key={s.title} className="hoja-s">
          <h2 className="label">{s.title}</h2>
          <dl>
            {s.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className="hoja-notes small muted stack g2">
        <p><b>Reclamo:</b> {COMPLAINT_DEFS.reclamo}</p>
        <p><b>Queja:</b> {COMPLAINT_DEFS.queja}</p>
        {COMPLAINT_NOTES.map((n) => <p key={n}>{n}</p>)}
      </div>
    </div>
  );
}
