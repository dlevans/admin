import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, VkcEvent } from "../api";
import { ComposePreset, fmtDate, fmtStamp, fmtTime, plural, useLoad } from "../util";

export default function Events() {
  const [includePast, setIncludePast] = useState(false);
  const { data: events, error, loading, reload } = useLoad(() => api.events(includePast), [includePast]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.syncEvents();
      setSyncMsg(`Synced: ${r.created} new, ${r.updated} updated, ${r.removed} removed.`);
      reload();
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page">
      <div className="row between wrap">
        <h1>Events</h1>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} /> Show past events
          </label>
          <button onClick={sync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync from volunteerkc.com"}
          </button>
        </div>
      </div>
      {syncMsg && <div className="alert">{syncMsg}</div>}
      {error && <div className="alert error">{error}</div>}
      {loading && !events && <p className="muted">Loading…</p>}
      {events?.length === 0 && <p className="muted">No events.</p>}

      <ul className="events">
        {events?.map((ev) => (
          <EventRow key={ev.id} ev={ev} open={openId === ev.id} onToggle={() => setOpenId(openId === ev.id ? null : ev.id)} />
        ))}
      </ul>
    </div>
  );
}

function EventRow({ ev, open, onToggle }: { ev: VkcEvent; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const compose = (to: string) => navigate(to, { state: { audience: "event", eventId: ev.id } satisfies ComposePreset });

  return (
    <li className="card">
      <button className="event-head" onClick={onToggle} aria-expanded={open}>
        <div className="date-box">
          <span>{fmtDate(ev.start_at)}</span>
          <span className="muted small">{fmtTime(ev.start_at)}</span>
        </div>
        <div className="grow">
          <strong>{ev.title}</strong>
          <div className="muted small">{[ev.location_name, ev.city].filter(Boolean).join(" · ")}</div>
        </div>
        <span className="badge">{plural(ev.signup_count, "signup")}</span>
      </button>
      {open && (
        <div className="event-body">
          <div className="row wrap">
            <button className="primary" disabled={!ev.signup_count} onClick={() => compose("/texts")}>
              Text everyone signed up
            </button>
            <button disabled={!ev.signup_count} onClick={() => compose("/notifications")}>
              Notify everyone signed up
            </button>
          </div>
          <Signups eventId={ev.id} />
        </div>
      )}
    </li>
  );
}

function Signups({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const { data, error, loading } = useLoad(() => api.signups(eventId), [eventId]);

  if (loading) return <p className="muted">Loading signups…</p>;
  if (error) return <div className="alert error">{error}</div>;
  if (!data?.length) return <p className="muted">Nobody has signed up in the app yet.</p>;

  const textOne = (id: string) =>
    navigate("/texts", { state: { audience: "volunteers", volunteerIds: [id] } satisfies ComposePreset });

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th className="hide-sm">Email</th>
          <th className="hide-sm">Signed up</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {data.map((s) => (
          <tr key={s.volunteer_id}>
            <td>{s.name}</td>
            <td>{s.phone || "—"}</td>
            <td className="hide-sm">{s.email}</td>
            <td className="hide-sm muted small">{fmtStamp(s.signed_up_at)}</td>
            <td>
              <button className="link" onClick={() => textOne(s.volunteer_id)} disabled={!s.phone}>
                Text
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
