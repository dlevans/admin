import { useMemo, useState } from "react";
import { AdminVolunteer, Audience, Channel, Opportunity } from "../api";
import { canReach, fmtDate, fmtPhone, fmtTime, personMatches, plural } from "../util";

interface Props {
  /** The channels this message goes out on; decides which audiences are offered and what each row shows. */
  channels: Channel[];
  audience: Audience;
  onAudience: (a: Audience) => void;
  opportunities: Opportunity[];
  opportunityId: string;
  onOpportunityId: (id: string) => void;
  showPast: boolean;
  onShowPast: (on: boolean) => void;
  volunteers: AdminVolunteer[];
  selected: string[];
  onSelected: (ids: string[]) => void;
  totalUsers: number;
}

export default function AudiencePicker(p: Props) {
  const noEveryone = p.channels.includes("sms"); // the API doesn't text everyone at once
  const onlyPush = p.channels.length === 1 && p.channels[0] === "push";
  const options: { value: Audience; label: string; hint: string; disabled?: boolean }[] = [
    {
      value: "all",
      label: "Everyone",
      hint: noEveryone
        ? "Not available for texts"
        : `All ${plural(p.totalUsers, onlyPush ? "app user" : "volunteer")}`,
      disabled: noEveryone,
    },
    { value: "event", label: "Signed up for an opportunity", hint: "Everyone who signed up in the app" },
    { value: "volunteers", label: "Specific volunteers", hint: "Pick one or more people" },
  ];
  // Single-channel SMS pages never offered "Everyone"; keep it that way.
  const shown = p.channels.length === 1 && noEveryone ? options.filter((o) => o.value !== "all") : options;

  return (
    <fieldset className="audience">
      <legend>Send to</legend>
      <div className="seg">
        {shown.map((o) => (
          <label key={o.value} className={`${p.audience === o.value ? "on" : ""}${o.disabled ? " disabled" : ""}`}>
            <input
              type="radio"
              name="audience"
              value={o.value}
              checked={p.audience === o.value}
              disabled={o.disabled}
              onChange={() => p.onAudience(o.value)}
            />
            <strong>{o.label}</strong>
            <span className="muted small">{o.hint}</span>
          </label>
        ))}
      </div>
      {noEveryone && p.audience === "all" && (
        <div className="alert warn">Texts can't go to everyone at once. Choose an opportunity or specific volunteers.</div>
      )}

      {p.audience === "event" && (
        <OpportunitySelect
          opportunities={p.opportunities}
          value={p.opportunityId}
          onChange={p.onOpportunityId}
          showPast={p.showPast}
          onShowPast={p.onShowPast}
        />
      )}

      {p.audience === "volunteers" && (
        <VolunteerPicker channels={p.channels} volunteers={p.volunteers} selected={p.selected} onSelected={p.onSelected} />
      )}
    </fieldset>
  );
}

function OpportunitySelect({
  opportunities,
  value,
  onChange,
  showPast,
  onShowPast,
}: {
  opportunities: Opportunity[];
  value: string;
  onChange: (id: string) => void;
  showPast: boolean;
  onShowPast: (on: boolean) => void;
}) {
  const now = Date.now();
  const upcoming = opportunities.filter((o) => new Date(o.end_at).getTime() >= now);
  const past = opportunities.filter((o) => new Date(o.end_at).getTime() < now);
  const option = (o: Opportunity) => (
    <option key={o.id} value={o.id}>
      {fmtDate(o.start_at)} {fmtTime(o.start_at)} · {o.title} ({plural(o.signup_count, "signup")})
    </option>
  );

  return (
    <div className="stack tight">
      <label>
        Opportunity
        <select value={value} onChange={(e) => onChange(e.target.value)} required>
          <option value="">Choose an opportunity…</option>
          {past.length > 0 ? <optgroup label="Upcoming">{upcoming.map(option)}</optgroup> : upcoming.map(option)}
          {past.length > 0 && <optgroup label="Past (most recent first)">{past.map(option)}</optgroup>}
        </select>
      </label>
      <label className="check small">
        <input type="checkbox" checked={showPast} onChange={(e) => onShowPast(e.target.checked)} /> Show past
      </label>
    </div>
  );
}

function VolunteerPicker({
  channels,
  volunteers,
  selected,
  onSelected,
}: {
  channels: Channel[];
  volunteers: AdminVolunteer[];
  selected: string[];
  onSelected: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(volunteers.map((v) => [v.id, v])), [volunteers]);
  const matches = useMemo(
    () => volunteers.filter((v) => personMatches(q, v.phone, v.name, v.email)).slice(0, 50),
    [q, volunteers],
  );

  const toggle = (id: string) =>
    onSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // Dimmed when none of the chosen channels can reach them.
  const reachable = (v: AdminVolunteer) => channels.length === 0 || channels.some((ch) => canReach(v, ch));

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
                <span className="muted small">
                  {channels.includes("sms") && ` · ${fmtPhone(v.phone) || "no phone"}`}
                  {(channels.includes("email") || !channels.includes("sms")) && ` · ${v.email}`}
                </span>
              </span>
              {channels.includes("push") && (
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
