import { ReactNode } from "react";
import { AdminVolunteer, AdminVolunteerDetail, api } from "../api";
import { fmtHours, fmtPhone, fmtStamp, plural, useLoad } from "../util";
import Modal from "./Modal";

interface Props {
  volunteer: AdminVolunteer;
  onClose: () => void;
  onEdit: () => void;
}

const dash = (v: ReactNode) => (v === null || v === undefined || v === "" ? <span className="muted">—</span> : v);
const stamp = (iso: string | null) => (iso ? fmtStamp(iso) : null);
// DATE columns come as "YYYY-MM-DD"; parse as local so they don't shift a day.
const day = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });

function age(birthdate: string) {
  const b = new Date(`${birthdate}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) years--;
  return years;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{dash(children)}</dd>
    </>
  );
}

export default function ViewVolunteer({ volunteer, onClose, onEdit }: Props) {
  const { data, error, loading } = useLoad(() => api.volunteer(volunteer.id), [volunteer.id]);
  // Until the details load (or if this API version doesn't have them), show what the list already has.
  const v: AdminVolunteer & Partial<AdminVolunteerDetail> = data ?? volunteer;
  const now = new Date();
  const monthName = now.toLocaleDateString(undefined, { month: "long" });

  return (
    <Modal title={v.name} onClose={onClose} wide>
      <div className="tiles compact">
        <div className="tile">
          <div className="muted small">Lifetime hours</div>
          <div className="tile-value">{v.hours ? fmtHours(v.hours.lifetime) : "…"}</div>
        </div>
        <div className="tile">
          <div className="muted small">{now.getFullYear()} hours</div>
          <div className="tile-value">{v.hours ? fmtHours(v.hours.year) : "…"}</div>
        </div>
        <div className="tile">
          <div className="muted small">{monthName} hours</div>
          <div className="tile-value">{v.hours ? fmtHours(v.hours.month) : "…"}</div>
        </div>
      </div>

      {loading && <p className="muted small">Loading details…</p>}
      {error && (
        <div className="alert error">
          Couldn't load the full details: {error}
          {error.startsWith("404") || error.startsWith("405") ? " (the API may need updating)" : ""}
        </div>
      )}

      <section className="detail-section">
        <h3>Contact</h3>
        <dl className="kv">
          <Field label="Email">{v.email && <a href={`mailto:${v.email}`}>{v.email}</a>}</Field>
          <Field label="Phone">{fmtPhone(v.phone)}</Field>
          <Field label="Address">{v.address}</Field>
          <Field label="City">{v.city}</Field>
          <Field label="State">{v.state}</Field>
          <Field label="ZIP">{v.zip}</Field>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Profile</h3>
        <dl className="kv">
          <Field label="Pronouns">{v.pronouns}</Field>
          <Field label="Sex">{data ? v.sex : undefined}</Field>
          <Field label="Birthdate">{v.birthdate && `${day(v.birthdate)} (age ${age(v.birthdate)})`}</Field>
          <Field label="Background check">{v.background_check_complete ? "Complete" : "Not complete"}</Field>
          <Field label="Role">{v.role === "admin" ? <span className="badge">admin</span> : "Volunteer"}</Field>
          <Field label="Abilities">
            {v.abilities?.length ? (
              <span className="chips">{v.abilities.map((a) => <span key={a} className="badge">{a}</span>)}</span>
            ) : null}
          </Field>
          <Field label="Interests">
            {v.interests?.length ? (
              <span className="chips">{v.interests.map((c) => <span key={c.id} className="badge">{c.name}</span>)}</span>
            ) : null}
          </Field>
          <Field label="Availability">
            {v.availability?.length ? (
              <span>
                {v.availability.map((a) => (
                  <div key={a.id}>
                    {a.day}, {a.start_time} – {a.end_time}
                  </div>
                ))}
              </span>
            ) : null}
          </Field>
        </dl>
      </section>

      <section className="detail-section">
        <h3>Account</h3>
        <dl className="kv">
          <Field label="ID"><code className="small">{v.id}</code></Field>
          <Field label="Joined">{stamp(v.created_at)}</Field>
          <Field label="Last updated">{stamp(v.updated_at ?? null)}</Field>
          <Field label="App devices">
            {v.devices?.length
              ? v.devices.map((d, i) => (
                  <div key={i}>
                    {d.platform === "ios" ? "iPhone" : d.platform === "android" ? "Android" : d.platform}
                    {d.last_seen_at && <span className="muted small"> · last seen {fmtStamp(d.last_seen_at)}</span>}
                  </div>
                ))
              : v.device_count
                ? plural(v.device_count, "device")
                : "None"}
          </Field>
        </dl>
      </section>

      {data && (
        <section className="detail-section">
          <h3>Hours log ({plural(data.hours.entries, "entry", "entries")})</h3>
          {data.participations.length === 0 ? (
            <p className="muted">No hours logged yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th className="hide-sm">Location</th>
                    <th>Hours</th>
                    <th className="hide-sm">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.participations.map((p) => (
                    <tr key={p.id}>
                      <td>{day(p.date)}</td>
                      <td>{dash(p.event)}</td>
                      <td className="hide-sm">{dash(p.location)}</td>
                      <td>{fmtHours(p.hours)}</td>
                      <td className="hide-sm muted small">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="row">
        <button className="primary" onClick={onEdit}>Edit</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
