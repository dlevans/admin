import { useMemo, useState } from "react";
import { AdminVolunteer, Audience, VkcEvent } from "../api";
import { fmtDate, fmtTime, plural } from "../util";

interface Props {
  channel: "push" | "sms";
  audience: Audience;
  onAudience: (a: Audience) => void;
  events: VkcEvent[];
  eventId: string;
  onEventId: (id: string) => void;
  volunteers: AdminVolunteer[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  totalUsers: number;
}

export default function AudiencePicker(p: Props) {
  const options: { value: Audience; label: string; hint: string }[] = [
    ...(p.channel === "push"
      ? [{ value: "all" as Audience, label: "Everyone", hint: `All ${plural(p.totalUsers, "app user")}` }]
      : []),
    { value: "event", label: "Signed up for an event", hint: "Everyone who signed up in the app" },
    { value: "volunteers", label: "Specific volunteers", hint: "Pick one or more people" },
  ];

  return (
    <fieldset className="audience">
      <legend>Send to</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={o.value} className={p.audience === o.value ? "on" : ""}>
            <input
              type="radio"
              name="audience"
              value={o.value}
              checked={p.audience === o.value}
              onChange={() => p.onAudience(o.value)}
            />
            <strong>{o.label}</strong>
            <span className="muted small">{o.hint}</span>
          </label>
        ))}
      </div>

      {p.audience === "event" && (
        <label>
          Event
          <select value={p.eventId} onChange={(e) => p.onEventId(e.target.value)} required>
            <option value="">Choose an event…</option>
            {p.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {fmtDate(ev.start_at)} {fmtTime(ev.start_at)} · {ev.title} ({plural(ev.signup_count, "signup")})
              </option>
            ))}
          </select>
        </label>
      )}

      {p.audience === "volunteers" && (
        <VolunteerPicker channel={p.channel} volunteers={p.volunteers} selected={p.selected} onSelected={p.onSelected} />
      )}
    </fieldset>
  );
}

function VolunteerPicker({
  channel,
  volunteers,
  selected,
  onSelected,
}: {
  channel: "push" | "sms";
  volunteers: AdminVolunteer[];
  selected: string[];
  onSelected: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(volunteers.map((v) => [v.id, v])), [volunteers]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? volunteers.filter((v) => `${v.name} ${v.email} ${v.phone}`.toLowerCase().includes(s))
      : volunteers;
    return list.slice(0, 50);
  }, [q, volunteers]);

  const toggle = (id: string) =>
    onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const reachable = (v: AdminVolunteer) => (channel === "push" ? v.device_count > 0 : !!v.phone.trim());

  return (
    <div className="picker">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((id) => (
            <button type="button" key={id} className="chip" onClick={() => toggle(id)} title="Remove">
              {byId.get(id)?.name ?? "Unknown"} ×
            </button>
          ))}
          <button type="button" className="link small" onClick={() => onSelected([])}>
            Clear all
          </button>
        </div>
      )}
      <input type="search" placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="pick-list">
        {matches.map((v) => (
          <li key={v.id}>
            <label className={reachable(v) ? "" : "dim"}>
              <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} />
              <span className="grow">
                {v.name}
                <span className="muted small"> · {channel === "sms" ? v.phone || "no phone" : v.email}</span>
              </span>
              {channel === "push" && (
                <span className="muted small">{v.device_count ? plural(v.device_count, "device") : "app not installed"}</span>
              )}
            </label>
          </li>
        ))}
        {matches.length === 0 && <li className="muted small pad">No volunteers match.</li>}
      </ul>
    </div>
  );
}
