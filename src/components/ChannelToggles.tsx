import { Channel, Stats } from "../api";

export const CHANNEL_ORDER: Channel[] = ["push", "sms", "email"];
export const CHANNEL_NAME: Record<Channel, string> = { push: "Push", sms: "Text", email: "Email" };

export function channelConfigured(ch: Channel, stats: Stats | null | undefined): boolean {
  if (!stats) return true; // unknown yet: don't warn
  return ch === "push" ? stats.push_configured : ch === "sms" ? stats.sms_configured : !!stats.email_configured;
}

/** Multi-select Push / Text / Email toggles. None are on unless the caller says so. */
export default function ChannelToggles({
  value,
  onChange,
  stats,
  compact,
}: {
  value: Channel[];
  onChange: (channels: Channel[]) => void;
  stats?: Stats | null;
  compact?: boolean;
}) {
  const toggle = (ch: Channel) =>
    onChange(value.includes(ch) ? value.filter((x) => x !== ch) : CHANNEL_ORDER.filter((x) => x === ch || value.includes(x)));

  return (
    <div className={`seg toggles${compact ? " compact" : ""}`} role="group" aria-label="Send as">
      {CHANNEL_ORDER.map((ch) => {
        const on = value.includes(ch);
        const ready = channelConfigured(ch, stats);
        return (
          <label key={ch} className={on ? "on" : ""}>
            <input type="checkbox" checked={on} onChange={() => toggle(ch)} />
            <strong>{CHANNEL_NAME[ch]}</strong>
            {!compact && !ready && <span className="muted small">Not set up on the server yet</span>}
          </label>
        );
      })}
    </div>
  );
}
