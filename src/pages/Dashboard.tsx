import { Link } from "react-router-dom";
import { api } from "../api";
import MessageList from "../components/MessageList";
import { useLoad } from "../util";

export default function Dashboard() {
  const { data, error } = useLoad(() => Promise.all([api.stats(), api.messages()]));
  const [stats, messages] = data ?? [null, []];

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {error && <div className="alert error">{error}</div>}

      {stats && (
        <>
          <div className="tiles">
            <Tile label="Volunteers" value={stats.volunteers} />
            <Tile label="Upcoming events" value={stats.upcoming_events} />
            <Tile label="iPhones with the app" value={stats.ios_devices} />
            <Tile label="Android phones with the app" value={stats.android_devices} />
          </div>

          <div className="row wrap">
            <Status ok={stats.push_configured} label="Push notifications" />
            <Status ok={stats.sms_configured} label="Text messages" />
          </div>
        </>
      )}

      <div className="row wrap actions">
        <Link className="button" to="/notifications">Send a push notification</Link>
        <Link className="button" to="/texts">Send a text</Link>
        <Link className="button" to="/events">See event signups</Link>
      </div>

      <h2>Recently sent</h2>
      <MessageList messages={messages.slice(0, 8)} />
      {messages.length > 8 && <Link to="/history">See all</Link>}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile">
      <div className="tile-value">{value.toLocaleString()}</div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`status ${ok ? "ok" : "off"}`}>
      <span className="dot" /> {label}: {ok ? "ready" : "not set up on the server"}
    </span>
  );
}
