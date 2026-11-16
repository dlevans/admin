import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, Channel, EmailSendResult, SendResult, SmsSendResult } from "../api";
import AudiencePicker from "../components/AudiencePicker";
import ChannelToggles, { CHANNEL_ORDER, channelConfigured } from "../components/ChannelToggles";
import { useCompose } from "../components/useCompose";
import { canReach, ComposePreset, fmtPhone, plural, smsSegments } from "../util";

/** Longest message each channel's API accepts. */
const LIMIT: Record<Channel, number> = { push: 2000, sms: 1600, email: 20000 };
const LABEL: Record<Channel, string> = { push: "Push notification", sms: "Text message", email: "Email" };
const NOT_SET_UP: Record<Channel, string> = {
  push: "Push notifications aren't set up on the server yet (FCM_SERVICE_ACCOUNT_FILE in the API's .env).",
  sms: "Texting isn't set up on the server yet (TWILIO_* settings in the API's .env).",
  email: "Email isn't set up on the server yet (SMTP_* settings in the API's .env).",
};

type Outcome =
  | { channel: "push"; ok: true; result: SendResult }
  | { channel: "sms"; ok: true; result: SmsSendResult }
  | { channel: "email"; ok: true; result: EmailSendResult }
  | { channel: Channel; ok: false; skipped: boolean; error: string };

const SMS_STATUS: Record<SmsSendResult["results"][number]["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  no_phone: "No valid phone number",
  opted_out: "Opted out (replied STOP)",
};
const EMAIL_STATUS: Record<EmailSendResult["results"][number]["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  no_email: "No valid email address",
};

/**
 * One message, sent as any mix of push notification, text and email. Each channel is sent
 * separately, so one failing (or not being set up yet) doesn't stop the others.
 */
export default function Send() {
  const preset = (useLocation().state ?? null) as ComposePreset | null;
  const c = useCompose("event");
  const [channels, setChannels] = useState<Channel[]>(preset?.channels ?? []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [separateSms, setSeparateSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);

  const has = (ch: Channel) => channels.includes(ch);
  const configured = (ch: Channel) => channelConfigured(ch, c.stats);
  const needsTitle = has("push") || has("email");
  const smsWithOthers = has("sms") && (has("push") || has("email"));
  const smsOwn = smsWithOthers && separateSms;
  const smsText = smsOwn ? smsBody : body;
  const seg = smsSegments(smsText);

  // The shared message has to fit every channel that uses it.
  const sharedChannels = channels.filter((ch) => !(ch === "sms" && smsOwn));
  const sharedMax = Math.min(LIMIT.email, ...sharedChannels.map((ch) => LIMIT[ch]));
  const tooLong = body.length > sharedMax;
  const everyoneBlocked = has("sms") && c.audience === "all";
  const notSetUp = channels.filter((ch) => !configured(ch));
  const live = channels.filter(configured);

  const titleLabel = has("push") && has("email") ? "Title / subject" : has("email") ? "Subject" : "Title";

  const ready =
    channels.length > 0 &&
    live.length > 0 &&
    c.ready &&
    !everyoneBlocked &&
    (!needsTitle || !!title.trim()) &&
    !!body.trim() &&
    !tooLong &&
    (!smsOwn || !!smsBody.trim());

  // For hand-picked volunteers we know exactly who each channel can reach.
  const reach = useMemo(() => {
    if (c.audience !== "volunteers") return null;
    const chosen = c.volunteers.filter((v) => c.selected.includes(v.id));
    return Object.fromEntries(CHANNEL_ORDER.map((ch) => [ch, chosen.filter((v) => canReach(v, ch)).length])) as Record<
      Channel,
      number
    >;
  }, [c.audience, c.volunteers, c.selected]);

  const audienceText =
    c.audience === "all"
      ? "every volunteer"
      : c.audience === "event"
        ? `everyone signed up for “${c.opportunityTitle ?? "the opportunity"}”`
        : plural(c.selected.length, "selected volunteer");

  const review = (e: FormEvent) => {
    e.preventDefault();
    setOutcomes(null);
    setConfirming(true);
  };

  const sendOne = async (ch: Channel): Promise<Outcome> => {
    if (!configured(ch)) return { channel: ch, ok: false, skipped: true, error: `Not sent. ${NOT_SET_UP[ch]}` };
    const target = c.target;
    try {
      if (ch === "push") {
        return { channel: "push", ok: true, result: await api.sendPush({ title: title.trim(), body: body.trim(), ...target }) };
      }
      if (ch === "sms") {
        const audience = target.audience;
        if (audience === "all") {
          return { channel: "sms", ok: false, skipped: true, error: "Not sent. Texts can't go to everyone at once." };
        }
        return { channel: "sms", ok: true, result: await api.sendSms({ body: smsText.trim(), ...target, audience }) };
      }
      return { channel: "email", ok: true, result: await api.sendEmail({ subject: title.trim(), body: body.trim(), ...target }) };
    } catch (err) {
      return { channel: ch, ok: false, skipped: false, error: (err as Error).message };
    }
  };

  const send = async () => {
    setSending(true);
    const results = await Promise.all(channels.map(sendOne));
    setOutcomes(results);
    // Untick what went out, so trying again only resends the channels that didn't.
    const done = results.filter((o) => o.ok).map((o) => o.channel);
    const remaining = channels.filter((ch) => !done.includes(ch));
    setChannels(remaining);
    if (remaining.length === 0) {
      setTitle("");
      setBody("");
      setSmsBody("");
      setSeparateSms(false);
    }
    setSending(false);
    setConfirming(false);
  };

  return (
    <div className="page">
      <h1>Send a message</h1>
      <p className="muted">
        Write it once and send it as a push notification, a text and/or an email. Each one goes out separately, so if one
        fails the others still send.
      </p>
      {c.listsError && <div className="alert error">{c.listsError}</div>}

      <form className="card stack narrow" onSubmit={review}>
        <fieldset className="audience">
          <legend>Send as</legend>
          <ChannelToggles
            value={channels}
            onChange={(chs) => {
              setChannels(chs);
              setConfirming(false);
            }}
            stats={c.stats}
          />
          {channels.length === 0 && <span className="muted small">Choose one or more.</span>}
        </fieldset>
        {notSetUp.map((ch) => (
          <div key={ch} className="alert warn">
            {NOT_SET_UP[ch]} {live.length > 0 ? "The other channels will still send." : ""}
          </div>
        ))}

        <AudiencePicker
          channels={channels}
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

        {needsTitle && (
          <label>
            {titleLabel}
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Volunteers needed Saturday" />
            {has("push") && has("email") && (
              <span className="muted small">The notification's title and the email's subject line.</span>
            )}
          </label>
        )}

        <label>
          Message
          <textarea value={body} rows={has("email") ? 8 : 5} onChange={(e) => setBody(e.target.value)} required />
          <span className={`small right ${tooLong ? "error-text" : "muted"}`}>
            {body.length.toLocaleString()}/{sharedMax.toLocaleString()}
            {has("push") && " · phones show roughly the first 150 characters"}
            {has("sms") && !smsOwn && ` · ${plural(seg.segments, "text")} per person`}
          </span>
          {tooLong && (
            <span className="error-text small">
              Too long for {sharedMax === LIMIT.sms ? "a text" : "a push notification"}.
              {has("sms") && smsWithOthers && !smsOwn ? " Shorten it, or write a separate text message below." : " Shorten it."}
            </span>
          )}
        </label>

        {smsWithOthers && (
          <label className="check">
            <input type="checkbox" checked={separateSms} onChange={(e) => setSeparateSms(e.target.checked)} />
            Write a separate, shorter text message
          </label>
        )}
        {smsOwn && (
          <label>
            Text message
            <textarea value={smsBody} maxLength={LIMIT.sms} rows={4} onChange={(e) => setSmsBody(e.target.value)} required />
            <span className="muted small right">
              {seg.length} characters · {plural(seg.segments, "text")} per person
              {seg.unicode && " (emoji or special characters shorten each text to 70)"}
            </span>
          </label>
        )}
        {has("sms") && (
          <p className="muted small">Tip: start texts with “VolunteerKC:” so people know who it's from. Volunteers can reply STOP to opt out.</p>
        )}

        {confirming ? (
          <div className="confirm">
            <p>Send to {audienceText}:</p>
            <ul className="send-summary">
              {channels.map((ch) => (
                <li key={ch}>
                  <strong>{LABEL[ch]}</strong>
                  {!configured(ch) ? (
                    <span className="muted"> · will be skipped (not set up yet)</span>
                  ) : reach ? (
                    <span className="muted">
                      {" "}· reaches {reach[ch]} of {c.selected.length}
                      {ch === "push" && " (only people with the app)"}
                      {ch === "sms" && ` · about ${plural(reach.sms * seg.segments, "text")}`}
                    </span>
                  ) : (
                    <span className="muted"> · up to {plural(c.recipientCount, "volunteer")}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="row">
              <button type="button" className="primary" onClick={send} disabled={sending}>
                {sending ? "Sending…" : `Send ${live.length > 1 ? `all ${live.length}` : "now"}`}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={sending}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <button className="primary" disabled={!ready}>
            Review &amp; send
          </button>
        )}
      </form>

      {outcomes && (
        <div className="card narrow">
          {outcomes.some((o) => !o.ok) && outcomes.some((o) => o.ok) && (
            <div className="alert">
              The channels that went out have been unticked above, so sending again only retries the rest.
            </div>
          )}
          {outcomes.map((o) => (
            <ChannelResult key={o.channel} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelResult({ o }: { o: Outcome }) {
  if (!o.ok) {
    return (
      <section className="channel-result">
        <h2>{LABEL[o.channel]}</h2>
        <div className={`alert ${o.skipped ? "warn" : "error"}`}>{o.error}</div>
      </section>
    );
  }
  if (o.channel === "push") {
    const r = o.result;
    return (
      <section className="channel-result">
        <h2>{LABEL.push}</h2>
        <div className="alert ok">
          Sent to {plural(r.sent, "volunteer")}.{r.skipped > 0 && ` ${r.skipped} don't have the app installed.`}
          {r.failed > 0 && ` ${r.failed} couldn't be reached.`}
        </div>
      </section>
    );
  }
  const rows =
    o.channel === "sms"
      ? o.result.results.map((r) => ({ id: r.volunteer_id, name: r.name, contact: fmtPhone(r.phone), status: r.status, label: SMS_STATUS[r.status], error: r.error }))
      : o.result.results.map((r) => ({ id: r.volunteer_id, name: r.name, contact: r.email, status: r.status, label: EMAIL_STATUS[r.status], error: r.error }));
  return (
    <section className="channel-result">
      <h2>
        {LABEL[o.channel]}: sent {o.result.sent} of {plural(o.result.recipients, "volunteer")}
      </h2>
      <table className="table">
        <thead>
          <tr>
            <th>Volunteer</th>
            <th>{o.channel === "sms" ? "Phone" : "Email"}</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.contact || "—"}</td>
              <td>
                <span className={`badge ${r.status}`}>{r.label}</span>
                {r.status === "failed" && r.error && <div className="muted small">{r.error}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
