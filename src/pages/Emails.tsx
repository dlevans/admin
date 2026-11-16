import { FormEvent, useState } from "react";
import { api, EmailRecipientResult, EmailSendResult } from "../api";
import AudiencePicker from "../components/AudiencePicker";
import { useCompose } from "../components/useCompose";
import { plural } from "../util";

const STATUS_LABEL: Record<EmailRecipientResult["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  no_email: "No valid email address",
};

export default function Emails() {
  const c = useCompose("event");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailSendResult | null>(null);

  const notSetUp = c.stats != null && !c.stats.email_configured;

  const review = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setConfirming(true);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setResult(await api.sendEmail({ subject: subject.trim(), body: body.trim(), ...c.target }));
      setSubject("");
      setBody("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const audienceText =
    c.audience === "all"
      ? "every volunteer"
      : c.audience === "event"
        ? `everyone signed up for “${c.opportunityTitle ?? "the opportunity"}”`
        : plural(c.selected.length, "selected volunteer");

  return (
    <div className="page">
      <h1>Emails</h1>
      <p className="muted">
        Sends a plain-text email to the address each volunteer registered with. Everyone gets their own copy, so no one
        sees anyone else's address.
      </p>

      {notSetUp && (
        <div className="alert warn">
          Email isn't set up on the server yet. Add the <code>SMTP_*</code> settings to the API's <code>.env</code>.
        </div>
      )}
      {c.listsError && <div className="alert error">{c.listsError}</div>}

      <form className="card stack narrow" onSubmit={review}>
        <AudiencePicker
          channel="email"
          audience={c.audience}
          onAudience={c.setAudience}
          opportunities={c.opportunities}
          opportunityId={c.opportunityId}
          onOpportunityId={c.setOpportunityId}
          volunteers={c.volunteers}
          selected={c.selected}
          onSelected={c.setSelected}
          totalUsers={c.stats?.volunteers ?? 0}
        />
        <label>
          Subject
          <input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Message
          <textarea value={body} maxLength={20000} rows={10} onChange={(e) => setBody(e.target.value)} required />
        </label>

        {error && <div className="alert error">{error}</div>}

        {confirming ? (
          <div className="confirm">
            <p>
              Email {audienceText} ({plural(c.recipientCount, "volunteer")})?
            </p>
            <div className="row">
              <button type="button" className="primary" onClick={send} disabled={sending}>
                {sending ? "Sending…" : "Send now"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={sending}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <button className="primary" disabled={!c.ready || !subject.trim() || !body.trim() || notSetUp}>
            Review &amp; send
          </button>
        )}
      </form>

      {result && (
        <div className="card narrow">
          <h2>
            Sent {result.sent} of {plural(result.recipients, "volunteer")}
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Email</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.volunteer_id}>
                  <td>{r.name}</td>
                  <td>{r.email || "—"}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === "failed" && r.error && <div className="muted small">{r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
