import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminVolunteer, api, Channel, Opportunity, VolunteerEvent, VolunteerEventUpdate } from "../api";
import ChannelToggles from "../components/ChannelToggles";
import Modal from "../components/Modal";
import OpportunityForm from "../components/OpportunityForm";
import { ComposePreset, composePath, fmtDate, fmtHours, fmtPhone, fmtStamp, fmtTime, fromLocalInput, plural, personMatches, toLocalInput, useLoad } from "../util";

/** Made on this admin site rather than imported from the volunteerkc.com calendar. */
const isSpecial = (o: Opportunity) => o.source === "manual";

type SourceFilter = "all" | "calendar" | "special";

/** Opportunities, and for each one its volunteers' events: signup, arrival, departure, hours. */
export default function Opportunities() {
  const [includePast, setIncludePast] = useState(false);
  const { data: opportunities, error, loading, reload } = useLoad(() => api.opportunities(includePast), [includePast]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const shown = (opportunities ?? []).filter((o) =>
    filter === "all" ? true : filter === "special" ? isSpecial(o) : !isSpecial(o),
  );
  const specialCount = (opportunities ?? []).filter(isSpecial).length;

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.syncOpportunities();
      setSyncMsg(
        `Synced: ${r.created} new, ${r.updated} updated, ${r.removed} removed.` +
          (r.kept_with_events
            ? ` ${plural(r.kept_with_events, "opportunity", "opportunities")} disappeared from the website but people had signed up, so it was kept. Check the website.`
            : ""),
      );
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
        <h1>Opportunities</h1>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} /> Show past
            opportunities
          </label>
          <button onClick={sync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync from volunteerkc.com"}
          </button>
          <button onClick={() => setCreating(true)}>
            + New opportunity
          </button>
        </div>
      </div>
      <div className="seg compact source-filter" role="radiogroup" aria-label="Show">
        {(
          [
            ["all", "All"],
            ["calendar", "volunteerkc.com calendar"],
            ["special", `Special (${specialCount})`],
          ] as [SourceFilter, string][]
        ).map(([value, label]) => (
          <label key={value} className={filter === value ? "on" : ""}>
            <input type="radio" name="source" checked={filter === value} onChange={() => setFilter(value)} />
            {label}
          </label>
        ))}
      </div>
      {syncMsg && <div className="alert">{syncMsg}</div>}
      {error && <div className="alert error">{error}</div>}
      {loading && !opportunities && <p className="muted">Loading…</p>}
      {opportunities && shown.length === 0 && (
        <p className="muted">
          {filter === "special" ? "No Special opportunities yet. Use + New opportunity to make one." : "No opportunities."}
        </p>
      )}

      <ul className="events">
        {shown.map((o) => (
          <OpportunityRow
            key={o.id}
            opp={o}
            open={openId === o.id}
            onToggle={() => setOpenId(openId === o.id ? null : o.id)}
            onChanged={reload}
          />
        ))}
      </ul>

      {creating && (
        <OpportunityForm
          onClose={() => setCreating(false)}
          onSaved={(o) => {
            setCreating(false);
            setOpenId(o.id);
            // A past date would be hidden unless past opportunities are shown.
            if (new Date(o.end_at) < new Date()) setIncludePast(true);
            reload();
          }}
        />
      )}
    </div>
  );
}

function OpportunityRow({
  opp,
  open,
  onToggle,
  onChanged,
}: {
  opp: Opportunity;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const special = isSpecial(opp);
  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteOpportunity(opp.id);
      onChanged();
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };
  const send = () =>
    navigate(composePath(channels), { state: { audience: "event", opportunityId: opp.id, channels } satisfies ComposePreset });

  return (
    <li className="card">
      <button className="event-head" onClick={onToggle} aria-expanded={open}>
        <div className="date-box">
          <span>{fmtDate(opp.start_at)}</span>
          <span className="muted small">{fmtTime(opp.start_at)}</span>
        </div>
        <div className="grow">
          <strong>{opp.title}</strong>{" "}
          {special && (
            <span className="badge special" title="Made on this admin site, not imported from the volunteerkc.com calendar">
              Special
            </span>
          )}
          <div className="muted small">{[opp.location_name, opp.city].filter(Boolean).join(" · ")}</div>
        </div>
        <span className="badge">{plural(opp.signup_count, "signup")}</span>
        {opp.checkin_count > 0 && <span className="badge sent">{opp.checkin_count} checked in</span>}
        {!!opp.user_modified_count && (
          <span className="badge user-mod" title="Volunteers who changed their own times or hours in the app">
            {opp.user_modified_count} user updated
          </span>
        )}
      </button>
      {open && (
        <div className="event-body">
          <div className="row between wrap source-line">
            <span className="muted small">
              {special ? (
                <>Special opportunity · added from this admin site. The website sync leaves it alone.</>
              ) : (
                <>
                  From the{" "}
                  {opp.source_url ? (
                    <a href={opp.source_url} target="_blank" rel="noreferrer">volunteerkc.com calendar</a>
                  ) : (
                    "volunteerkc.com calendar"
                  )}
                  {opp.locally_modified ? " · edited here, so the sync no longer updates it" : ""}
                </>
              )}
            </span>
            {special && (
              <span className="row">
                {confirmDelete ? (
                  <>
                    <span className="small">
                      Delete it{opp.signup_count ? ` and its ${plural(opp.signup_count, "signup")}` : ""}? Logged hours are kept.
                    </span>
                    <button className="small-btn danger" onClick={remove} disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                    <button className="small-btn" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="small-btn" onClick={() => setEditing(true)}>Edit</button>
                    <button className="small-btn danger-outline" onClick={() => setConfirmDelete(true)}>Delete</button>
                  </>
                )}
              </span>
            )}
          </div>
          {deleteError && <div className="alert error">{deleteError}</div>}
          {opp.signup_count > 0 && (
            <div className="row wrap">
              <span className="muted small">Message everyone signed up:</span>
              <ChannelToggles value={channels} onChange={setChannels} compact />
              <button className="primary" disabled={!channels.length} onClick={send}>
                Send…
              </button>
            </div>
          )}
          <Roster opp={opp} onChanged={onChanged} />
        </div>
      )}
      {editing && (
        <OpportunityForm
          opp={opp}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </li>
  );
}

function Roster({ opp, onChanged }: { opp: Opportunity; onChanged: () => void }) {
  const navigate = useNavigate();
  const { data, setData, error, loading } = useLoad(() => api.opportunityEvents(opp.id), [opp.id]);
  const [editing, setEditing] = useState<VolunteerEvent | null>(null);
  const [history, setHistory] = useState<VolunteerEvent | null>(null);
  const [adding, setAdding] = useState(false);

  const saved = (ev: VolunteerEvent) => {
    const rest = (data ?? []).filter((x) => x.volunteer_id !== ev.volunteer_id);
    setData([...rest, ev].sort((a, b) => a.signed_up_at.localeCompare(b.signed_up_at)));
    setEditing(null);
    setAdding(false);
    onChanged(); // refresh the counts on the opportunity
  };

  const textOne = (id: string) =>
    navigate("/texts", { state: { audience: "volunteers", volunteerIds: [id] } satisfies ComposePreset });

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <>
      {!data?.length ? (
        <p className="muted">Nobody has signed up in the app yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="hide-sm">Phone</th>
              <th className="hide-sm">Signed up</th>
              <th>Arrived</th>
              <th>Left</th>
              <th>Hours</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((ev) => (
              <tr key={ev.volunteer_id}>
                <td>
                  {ev.name}
                  {ev.walk_in && <span className="muted small"> · walk-in</span>}
                  {ev.user_modified && (
                    <>
                      {" "}
                      <span
                        className="badge user-mod"
                        title={`Changed their own times/hours in the app${ev.user_modified_at ? ` (last ${fmtStamp(ev.user_modified_at)})` : ""}`}
                      >
                        user updated
                      </span>
                    </>
                  )}
                </td>
                <td className="hide-sm">{fmtPhone(ev.phone) || "—"}</td>
                <td className="hide-sm muted small">{ev.walk_in ? "—" : fmtStamp(ev.signed_up_at)}</td>
                <td className="small">{ev.checked_in_at ? fmtStamp(ev.checked_in_at) : "—"}</td>
                <td className="small">{ev.checked_out_at ? fmtStamp(ev.checked_out_at) : "—"}</td>
                <td>{fmtHours(ev.hours)}</td>
                <td>
                  <div className="row">
                    <button className="link" onClick={() => setEditing(ev)}>
                      Edit
                    </button>
                    <button className="link" onClick={() => setHistory(ev)}>
                      History
                    </button>
                    <button className="link" onClick={() => textOne(ev.volunteer_id)} disabled={!ev.phone}>
                      Text
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="actions">
        <button onClick={() => setAdding(true)}>Record someone who didn't use the app</button>
      </div>

      {history && <ChangeHistory opp={opp} ev={history} onClose={() => setHistory(null)} />}
      {editing && <EditTimes opp={opp} ev={editing} onClose={() => setEditing(null)} onSaved={saved} />}
      {adding && (
        <AddVolunteer
          opp={opp}
          exclude={new Set((data ?? []).map((x) => x.volunteer_id))}
          onClose={() => setAdding(false)}
          onSaved={saved}
        />
      )}
    </>
  );
}

/** Correct someone's arrival, departure and hours. Their hours log is updated to match. */
function EditTimes({
  opp,
  ev,
  onClose,
  onSaved,
}: {
  opp: Opportunity;
  ev: VolunteerEvent;
  onClose: () => void;
  onSaved: (ev: VolunteerEvent) => void;
}) {
  return (
    <Modal title={`${ev.name} · ${opp.title}`} onClose={onClose}>
      {ev.user_modified && (
        <div className="alert warn small" style={{ marginTop: 0 }}>
          {ev.name} changed these times or hours in the app
          {ev.user_modified_at ? ` (last on ${fmtStamp(ev.user_modified_at)})` : ""}. Your changes are logged too; see
          History on the roster.
        </div>
      )}
      <TimesForm
        opp={opp}
        initial={ev}
        submitLabel="Save"
        onSubmit={(body) => api.updateVolunteerEvent(opp.id, ev.volunteer_id, body)}
        onSaved={onSaved}
      />
    </Modal>
  );
}

/** Every logged change to someone's arrival, departure and hours, newest first. */
function ChangeHistory({ opp, ev, onClose }: { opp: Opportunity; ev: VolunteerEvent; onClose: () => void }) {
  const { data, error, loading } = useLoad(() => api.eventChanges(opp.id, ev.volunteer_id), [opp.id, ev.volunteer_id]);
  const stamp = (iso: string | null) => (iso ? fmtStamp(iso) : "—");
  const diff = (label: string, before: string, after: string) =>
    before === after ? null : (
      <div className="small">
        <span className="muted">{label}:</span> {before} → <strong>{after}</strong>
      </div>
    );

  return (
    <Modal title={`History · ${ev.name}`} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        {opp.title} · {fmtStamp(opp.start_at)}
      </p>
      {loading && !data && <p className="muted">Loading…</p>}
      {error && <div className="alert error">{error}</div>}
      {data?.length === 0 && (
        <p className="muted">No changes recorded. Changes made before this log existed aren't shown.</p>
      )}
      {!!data?.length && (
        <ul className="change-list">
          {[...data].reverse().map((c, i) => (
            <li key={i}>
              <div className="row between wrap">
                <span>
                  <strong>{c.changed_by_name ?? "Deleted account"}</strong>{" "}
                  <span className={`badge ${c.changed_by_role === "volunteer" ? "user-mod" : ""}`}>
                    {c.changed_by_role === "volunteer" ? "volunteer" : "admin"}
                  </span>
                </span>
                <span className="muted small">{fmtStamp(c.changed_at)}</span>
              </div>
              {diff("Arrived", stamp(c.old_checked_in_at), stamp(c.new_checked_in_at))}
              {diff("Left", stamp(c.old_checked_out_at), stamp(c.new_checked_out_at))}
              {diff("Hours", fmtHours(c.old_hours), fmtHours(c.new_hours))}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Record a volunteer who came but never signed up or checked in with the app. */
function AddVolunteer({
  opp,
  exclude,
  onClose,
  onSaved,
}: {
  opp: Opportunity;
  exclude: Set<string>;
  onClose: () => void;
  onSaved: (ev: VolunteerEvent) => void;
}) {
  const { data: volunteers, error } = useLoad(() => api.volunteers());
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<AdminVolunteer | null>(null);
  const matches = useMemo(() => {
    return (volunteers ?? [])
      .filter((v) => !exclude.has(v.id))
      .filter((v) => personMatches(q, v.phone, v.name, v.email))
      .slice(0, 50);
  }, [q, volunteers, exclude]);

  return (
    <Modal title={`Record a volunteer · ${opp.title}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      {!picked ? (
        <div className="picker">
          <input type="search" placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="pick-list">
            {matches.map((v) => (
              <li key={v.id}>
                <label>
                  <input type="radio" name="volunteer" onChange={() => setPicked(v)} />
                  <span className="grow">
                    {v.name}
                    <span className="muted small"> · {v.email}</span>
                  </span>
                </label>
              </li>
            ))}
            {volunteers && matches.length === 0 && <li className="muted small pad">No volunteers match.</li>}
          </ul>
          <p className="muted small">They need an account. If they don't have one, add their hours another way.</p>
        </div>
      ) : (
        <>
          <p>
            <strong>{picked.name}</strong>{" "}
            <button type="button" className="link small" onClick={() => setPicked(null)}>
              Change
            </button>
          </p>
          <TimesForm
            opp={opp}
            initial={{ checked_in_at: opp.start_at, checked_out_at: opp.end_at, hours: null }}
            isNew
            submitLabel="Record"
            onSubmit={(body) => api.updateVolunteerEvent(opp.id, picked.id, body)}
            onSaved={onSaved}
          />
        </>
      )}
    </Modal>
  );
}

function TimesForm({
  opp,
  initial,
  isNew = false,
  submitLabel,
  onSubmit,
  onSaved,
}: {
  opp: Opportunity;
  initial: Pick<VolunteerEvent, "checked_in_at" | "checked_out_at" | "hours">;
  isNew?: boolean; // recording someone new: send the times even if left as suggested
  submitLabel: string;
  onSubmit: (body: VolunteerEventUpdate) => Promise<VolunteerEvent>;
  onSaved: (ev: VolunteerEvent) => void;
}) {
  const [inAt, setInAtRaw] = useState(toLocalInput(initial.checked_in_at));
  const [outAt, setOutAtRaw] = useState(toLocalInput(initial.checked_out_at));
  // Once a time changes, the old hours no longer apply: show "from the times" unless typed.
  const setInAt = (v: string) => {
    setInAtRaw(v);
    if (!hoursTouched) setHours("");
  };
  const setOutAt = (v: string) => {
    setOutAtRaw(v);
    if (!hoursTouched) setHours("");
  };
  // Blank hours = work them out from the times.
  const [hours, setHours] = useState(initial.hours == null ? "" : String(initial.hours));
  const [hoursTouched, setHoursTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromTimes = useMemo(() => {
    if (!inAt || !outAt) return null;
    const h = (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3_600_000;
    return h >= 0 ? Math.round(h * 100) / 100 : null;
  }, [inAt, outAt]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Send only what changed. Changed times without typed hours → the API recalculates the hours.
    const body: { checked_in_at?: string | null; checked_out_at?: string | null; hours?: number | null } = {};
    if (isNew || inAt !== toLocalInput(initial.checked_in_at)) body.checked_in_at = fromLocalInput(inAt);
    if (isNew || outAt !== toLocalInput(initial.checked_out_at)) body.checked_out_at = fromLocalInput(outAt);
    if (hoursTouched && hours.trim() !== "") body.hours = Number(hours);
    try {
      onSaved(await onSubmit(body));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form className="stack" onSubmit={save}>
      <p className="muted small" style={{ margin: 0 }}>
        Scheduled {fmtStamp(opp.start_at)} – {fmtTime(opp.end_at)}
      </p>
      <label>
        Arrived
        <input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} />
      </label>
      <label>
        Left
        <input type="datetime-local" value={outAt} onChange={(e) => setOutAt(e.target.value)} />
      </label>
      <label>
        Hours
        <input
          type="number"
          min="0"
          max="24"
          step="0.25"
          placeholder={fromTimes != null ? `${fromTimes} (from the times)` : "From the times"}
          value={hours}
          onChange={(e) => {
            setHours(e.target.value);
            setHoursTouched(true);
          }}
        />
        <span className="muted small" style={{ fontWeight: 400 }}>
          Leave blank to work it out from the times. These hours go in their volunteer log.
        </span>
      </label>
      {error && <div className="alert error">{error}</div>}
      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
