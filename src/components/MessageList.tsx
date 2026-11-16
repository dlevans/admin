import { useState } from "react";
import { api, Channel, OutboundMessage } from "../api";
import { fmtStamp, plural } from "../util";

const CHANNEL_LABEL: Record<Channel, string> = { push: "Push", sms: "Text", email: "Email" };

function audienceLabel(m: OutboundMessage) {
  if (m.audience === "all") return "Everyone";
  if (m.audience === "event") return m.opportunity_title ? `Signed up: ${m.opportunity_title}` : "Opportunity signups";
  return plural(m.recipients, "volunteer");
}

/**
 * Sent messages. With onDeleted, each card gets a Delete button (asks first) that removes
 * the message from the server's history.
 */
export default function MessageList({
  messages,
  onDeleted,
}: {
  messages: OutboundMessage[];
  onDeleted?: (id: string) => void;
}) {
  if (messages.length === 0) return <p className="muted">Nothing sent yet.</p>;
  return (
    <ul className="messages">
      {messages.map((m) => (
        <MessageCard key={m.id} m={m} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}

function MessageCard({ m, onDeleted }: { m: OutboundMessage; onDeleted?: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteMessage(m.id);
      onDeleted?.(m.id);
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <li className="card">
      <div className="row between">
        <span className={`badge ${m.channel}`}>{CHANNEL_LABEL[m.channel] ?? m.channel}</span>
        <span className="muted small">
          {fmtStamp(m.created_at)}
          {m.sent_by_name && ` · ${m.sent_by_name}`}
        </span>
      </div>
      {m.title && <strong>{m.title}</strong>}
      <p className="msg-body">{m.body}</p>
      <div className="row between wrap">
        <div className="muted small">
          {audienceLabel(m)} · reached {m.sent} of {m.recipients}
          {m.failed > 0 && ` · ${m.failed} failed`}
        </div>
        {onDeleted && (
          <div className="msg-actions">
            {confirming ? (
              <span className="confirm-inline small">
                <span className="muted">Delete from history? It won't unsend it.</span>
                <button className="danger small-btn" onClick={remove} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button className="small-btn" onClick={() => setConfirming(false)} disabled={deleting}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="danger-outline small-btn" onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      {error && <div className="alert error small">{error}</div>}
    </li>
  );
}
