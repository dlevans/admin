import { FormEvent, useState } from "react";
import { api, SendResult } from "../api";
import AudiencePicker from "../components/AudiencePicker";
import { useCompose } from "../components/useCompose";
import { plural } from "../util";

export default function Notifications() {
  const c = useCompose("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

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
      setResult(await api.sendPush({ title: title.trim(), body: body.trim(), ...c.target }));
      setTitle("");
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
      ? "everyone with the app"
      : c.audience === "event"
        ? `everyone signed up for “${c.eventTitle ?? "the event"}”`
        : plural(c.selected.length, "selected volunteer");

  return (
    <div className="page">
      <h1>Push notifications</h1>
      <p className="muted">Sends to the iPhone and Android apps. Volunteers only get them if they've signed in to the app and allowed notifications.</p>

      {c.stats && !c.stats.push_configured && (
        <div className="alert warn">
          Push isn't set up on the server yet. Add a Firebase service-account key (<code>FCM_SERVICE_ACCOUNT_FILE</code>) to the API's <code>.env</code>.
        </div>
      )}
      {c.listsError && <div className="alert error">{c.listsError}</div>}

      <div className="two-col">
        <form className="card stack" onSubmit={review}>
          <AudiencePicker
            channel="push"
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
            Title
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Volunteers needed Saturday" />
          </label>
          <label>
            Message
            <textarea value={body} maxLength={2000} rows={4} onChange={(e) => setBody(e.target.value)} required />
            <span className="muted small right">{body.length}/2000 · phones show roughly the first 150 characters</span>
          </label>

          {error && <div className="alert error">{error}</div>}
          {result && (
            <div className="alert ok">
              Sent to {plural(result.sent, "volunteer")}.
              {result.skipped > 0 && ` ${result.skipped} don't have the app installed.`}
              {result.failed > 0 && ` ${result.failed} couldn't be reached.`}
            </div>
          )}

          {confirming ? (
            <div className="confirm">
              <p>
                Send <strong>“{title.trim()}”</strong> to {audienceText} ({plural(c.recipientCount, "volunteer")})?
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
            <button className="primary" disabled={!c.ready || !title.trim() || !body.trim() || c.stats?.push_configured === false}>
              Review &amp; send
            </button>
          )}
        </form>

        <aside className="preview">
          <div className="muted small">Preview</div>
          <div className="phone">
            <div className="notif">
              <span className="notif-icon"><img src="./vkc_logo.png" alt="" /></span>
              <div>
                <div className="notif-app">VolunteerKC · now</div>
                <div className="notif-title">{title || "Notification title"}</div>
                <div className="notif-body">{body || "Your message appears here."}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
