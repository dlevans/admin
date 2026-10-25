import { OutboundMessage } from "../api";
import { fmtStamp, plural } from "../util";

function audienceLabel(m: OutboundMessage) {
  if (m.audience === "all") return "Everyone";
  if (m.audience === "event") return m.event_title ? `Signed up: ${m.event_title}` : "Event signups";
  return plural(m.recipients, "volunteer");
}

export default function MessageList({ messages }: { messages: OutboundMessage[] }) {
  if (messages.length === 0) return <p className="muted">Nothing sent yet.</p>;
  return (
    <ul className="messages">
      {messages.map((m) => (
        <li key={m.id} className="card">
          <div className="row between">
            <span className={`badge ${m.channel}`}>{m.channel === "push" ? "Push" : "Text"}</span>
            <span className="muted small">
              {fmtStamp(m.created_at)}
              {m.sent_by_name && ` · ${m.sent_by_name}`}
            </span>
          </div>
          {m.title && <strong>{m.title}</strong>}
          <p className="msg-body">{m.body}</p>
          <div className="muted small">
            {audienceLabel(m)} · reached {m.sent} of {m.recipients}
            {m.failed > 0 && ` · ${m.failed} failed`}
          </div>
        </li>
      ))}
    </ul>
  );
}
