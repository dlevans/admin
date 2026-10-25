import { FormEvent, useState } from "react";
import { api, SmsRecipientResult, SmsSendResult } from "../api";
import AudiencePicker from "../components/AudiencePicker";
import { useCompose } from "../components/useCompose";
import { plural, smsSegments } from "../util";

const STATUS_LABEL: Record<SmsRecipientResult["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  no_phone: "No valid phone number",
  opted_out: "Opted out (replied STOP)",
};

export default function Texts() {
  const c = useCompose("event");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmsSendResult | null>(null);

  const seg = smsSegments(body);

  const review = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setConfirming(true);
  };

  const send = async () => {
    if (c.audience === "all") return;
    setSending(true);
    setError(null);
    try {
      setResult(await api.sendSms({ body: body.trim(), ...c.target, audience: c.audience }));
      setBody("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  const audienceText =
    c.audience === "event"
      ? `everyone signed up for “${c.eventTitle ?? "the event"}”`
      : plural(c.selected.length, "selected volunteer");

  return (
    <div className="page">
      <h1>Text messages</h1>
      <p className="muted">Sends an SMS to the phone number each volunteer entered when they registered.</p>

      {c.stats && !c.stats.sms_configured && (
        <div className="alert warn">
          Texting isn't set up on the server yet. Add the <code>TWILIO_*</code> settings to the API's <code>.env</code>.
        </div>
      )}
      {c.listsError && <div className="alert error">{c.listsError}</div>}

      <form className="card stack narrow" onSubmit={review}>
        <AudiencePicker
          channel="sms"
          audience={c.audience}
          onAudience={c.setAudience}
          events={c.events}
          eventId={c.eventId}
          onEventId={c.setEventId}
          volunteers={c.volunteers}
          selected={c.selected}
          onSelected={c.setSelected}
          totalUsers={c.stats?.volunteers ?? 0}
        />
        <label>
          Message
          <textarea value={body} maxLength={1600} rows={5} onChange={(e) => setBody(e.target.value)} required />
          <span className="muted small right">
            {seg.length} characters · {plural(seg.segments, "text")} per person
            {seg.unicode && " (emoji or special characters shorten each text to 70)"}
          </span>
        </label>
        <p className="muted small">Tip: start with “VolunteerKC:” so people know who it's from. Volunteers can reply STOP to opt out.</p>

        {error && <div className="alert error">{error}</div>}

        {confirming ? (
          <div className="confirm">
            <p>
              Text {audienceText} ({plural(c.recipientCount, "volunteer")})? That's about{" "}
              {plural(c.recipientCount * seg.segments, "message")}.
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
          <button className="primary" disabled={!c.ready || !body.trim() || c.stats?.sms_configured === false}>
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
                <th>Phone</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.volunteer_id}>
                  <td>{r.name}</td>
                  <td>{r.phone || "—"}</td>
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
