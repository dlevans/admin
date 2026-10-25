import { useState } from "react";
import { api } from "../api";
import MessageList from "../components/MessageList";
import { useLoad } from "../util";

export default function History() {
  const [channel, setChannel] = useState<"push" | "sms" | undefined>();
  const { data, error, loading } = useLoad(() => api.messages(channel), [channel]);

  return (
    <div className="page">
      <h1>History</h1>
      <div className="seg inline">
        {([undefined, "push", "sms"] as const).map((ch) => (
          <button key={ch ?? "all"} className={channel === ch ? "on" : ""} onClick={() => setChannel(ch)}>
            {ch === "push" ? "Push" : ch === "sms" ? "Texts" : "All"}
          </button>
        ))}
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading && !data ? <p className="muted">Loading…</p> : <MessageList messages={data ?? []} />}
    </div>
  );
}
