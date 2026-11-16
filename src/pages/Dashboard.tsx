import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import MessageList from "../components/MessageList";
import { plural, useLoad } from "../util";

const COLLAPSED_KEY = "vkc-admin-recent-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const { data, setData, error } = useLoad(() => Promise.all([api.stats(), api.messages()]));
  const [stats, messages] = data ?? [null, []];
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // storage blocked: the choice just won't be remembered
    }
  };

  const removeMessage = (id: string) =>
    setData((d) => (d ? [d[0], d[1].filter((m) => m.id !== id)] : d));

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {error && <div className="alert error">{error}</div>}

      {stats && (
        <>
          <div className="tiles">
            <Tile label="Volunteers" value={stats.volunteers} />
            <Tile label="Upcoming opportunities" value={stats.upcoming_events} />
            <Tile label="iPhones with the app" value={stats.ios_devices} />
            <Tile label="Android phones with the app" value={stats.android_devices} />
          </div>

          <div className="row wrap">
            <Status ok={stats.push_configured} label="Push notifications" />
            <Status ok={stats.sms_configured} label="Text messages" />
            <Status ok={!!stats.email_configured} label="Email" />
          </div>
        </>
      )}

      <div className="row wrap actions">
        <Link className="button" to="/notifications">Send a push notification</Link>
        <Link className="button" to="/texts">Send a text</Link>
        <Link className="button" to="/emails">Send an email</Link>
        <Link className="button" to="/send">Send on several channels</Link>
        <Link className="button" to="/opportunities">See signups and check-ins</Link>
      </div>

      <div className="section-head">
        <h2>Recently sent</h2>
        <button className="small-btn" onClick={toggleCollapsed} aria-expanded={!collapsed}>
          {collapsed ? `Show${messages.length ? ` (${plural(Math.min(messages.length, 8), "message")})` : ""}` : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <>
          <MessageList messages={messages.slice(0, 8)} onDeleted={removeMessage} />
          {messages.length > 8 && <Link to="/history">See all</Link>}
        </>
      )}
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
