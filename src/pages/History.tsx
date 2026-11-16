import { useState } from "react";
import { api, Channel } from "../api";
import MessageList from "../components/MessageList";
import { useLoad } from "../util";

const FILTERS: { value: Channel | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "push", label: "Push" },
  { value: "sms", label: "Texts" },
  { value: "email", label: "Emails" },
];

export default function History() {
  const [channel, setChannel] = useState<Channel | undefined>();
  const { data, setData, error, loading } = useLoad(() => api.messages(channel), [channel]);

  return (
    <div className="page">
      <h1>History</h1>
      <div className="seg inline">
        {FILTERS.map((f) => (
          <button key={f.value ?? "all"} className={channel === f.value ? "on" : ""} onClick={() => setChannel(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <MessageList messages={data ?? []} onDeleted={(id) => setData((d) => (d ?? []).filter((m) => m.id !== id))} />
      )}
    </div>
  );
}
