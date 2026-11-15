import { useMemo, useState } from "react";
import { BASE, RawResponse, rawRequest } from "../api";
import { useLoad } from "../util";

// Lists every route from the API's own OpenAPI spec (/VKC/openapi.json), so new endpoints
// show up here without changing this page. Requests go out with the admin's token.

type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  anyOf?: Schema[];
  allOf?: Schema[];
  default?: unknown;
  example?: unknown;
};

interface Param {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  schema?: Schema;
  description?: string;
}

interface Operation {
  summary?: string;
  tags?: string[];
  parameters?: Param[];
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  security?: unknown[];
}

interface Spec {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
}

interface Endpoint {
  key: string;
  method: string;
  path: string;
  tag: string;
  op: Operation;
}

const METHODS = ["get", "post", "put", "patch", "delete"];

async function loadSpec(): Promise<Spec> {
  const res = await fetch(`${BASE}/openapi.json`);
  if (!res.ok) throw new Error(`Couldn't load ${BASE}/openapi.json (${res.status})`);
  return res.json();
}

/** Build a sample JSON value for a request body from its schema. */
function sample(schema: Schema | undefined, spec: Spec, depth = 0): unknown {
  if (!schema || depth > 5) return null;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop()!;
    return sample(spec.components?.schemas?.[name], spec, depth + 1);
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  const variants = schema.anyOf ?? schema.allOf;
  if (variants) return sample(variants.find((v) => v.type !== "null") ?? variants[0], spec, depth + 1);
  switch (schema.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = sample(v, spec, depth + 1);
      return out;
    }
    case "array":
      return [sample(schema.items, spec, depth + 1)];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "string":
      if (schema.format === "date") return new Date().toISOString().slice(0, 10);
      if (schema.format === "date-time") return new Date().toISOString();
      if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
      if (schema.format === "email") return "someone@example.com";
      return "";
    default:
      return null;
  }
}

export default function ApiTester() {
  const { data: spec, error, loading, reload } = useLoad(loadSpec);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!spec) return [];
    const q = filter.trim().toLowerCase();
    const map = new Map<string, Endpoint[]>();
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const method of METHODS) {
        const op = ops[method];
        if (!op) continue;
        const ep = { key: `${method} ${path}`, method: method.toUpperCase(), path, tag: op.tags?.[0] ?? "other", op };
        if (q && !`${ep.method} ${path} ${op.summary ?? ""} ${ep.tag}`.toLowerCase().includes(q)) continue;
        if (!map.has(ep.tag)) map.set(ep.tag, []);
        map.get(ep.tag)!.push(ep);
      }
    }
    return [...map.entries()];
  }, [spec, filter]);

  const total = groups.reduce((n, [, eps]) => n + eps.length, 0);

  return (
    <div className="page">
      <h1>API tester</h1>
      <p className="muted">
        Every endpoint the live API offers, read from <code>{BASE}/openapi.json</code>. Requests are sent as you, with your
        admin login. GET requests only read data; anything else changes live data and asks you to confirm first.
      </p>
      <div className="row wrap" style={{ marginBottom: "1rem" }}>
        <input
          className="search"
          placeholder="Filter, e.g. opportunities or POST"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={reload} disabled={loading}>
          Reload list
        </button>
        {spec && <span className="muted small">{total} endpoints</span>}
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading && !spec && <p className="muted">Loading…</p>}
      {spec &&
        groups.map(([tag, eps]) => (
          <section key={tag}>
            <h2 className="cap">{tag}</h2>
            <div className="card flush">
              {eps.map((ep) => (
                <EndpointRow
                  key={ep.key}
                  ep={ep}
                  spec={spec}
                  open={open === ep.key}
                  onToggle={() => setOpen(open === ep.key ? null : ep.key)}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function EndpointRow({ ep, spec, open, onToggle }: { ep: Endpoint; spec: Spec; open: boolean; onToggle: () => void }) {
  const params = (ep.op.parameters ?? []).filter((p) => p.in === "path" || p.in === "query");
  const bodySchema = ep.op.requestBody?.content?.["application/json"]?.schema;
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState(() => (bodySchema ? JSON.stringify(sample(bodySchema, spec), null, 2) : ""));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RawResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isRead = ep.method === "GET";
  const missing = params.filter((p) => p.required && !values[p.name]?.trim()).map((p) => p.name);

  function buildUrl() {
    let path = ep.path;
    const query = new URLSearchParams();
    for (const p of params) {
      const v = values[p.name]?.trim();
      if (p.in === "path") path = path.replace(`{${p.name}}`, encodeURIComponent(v ?? ""));
      else if (v) query.set(p.name, v);
    }
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
  }

  async function send() {
    setConfirming(false);
    setErr(null);
    if (body.trim()) {
      try {
        JSON.parse(body);
      } catch {
        setErr("The request body isn't valid JSON.");
        return;
      }
    }
    setBusy(true);
    try {
      setResult(await rawRequest(ep.method, buildUrl(), bodySchema ? body.trim() : undefined));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  let pretty = result?.body ?? "";
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    // not JSON, show as-is
  }
  const itemCount = (() => {
    try {
      const parsed = JSON.parse(result?.body ?? "");
      return Array.isArray(parsed) ? parsed.length : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="ep">
      <button className="ep-head" onClick={onToggle} aria-expanded={open}>
        <span className={`method m-${ep.method.toLowerCase()}`}>{ep.method}</span>
        <code className="ep-path">{ep.path}</code>
        <span className="muted small grow ep-sum">{ep.op.summary}</span>
        {!ep.op.security && <span className="muted small">no login</span>}
      </button>
      {open && (
        <div className="ep-body stack">
          {params.length > 0 && (
            <div className="ep-params">
              {params.map((p) => (
                <label key={p.name}>
                  <span>
                    {p.name} <span className="muted small">({p.in}{p.required ? ", required" : ""})</span>
                  </span>
                  <input
                    value={values[p.name] ?? ""}
                    placeholder={p.schema?.format ?? p.schema?.type ?? ""}
                    onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
          {bodySchema && (
            <label>
              Request body (JSON)
              <textarea className="mono" rows={Math.min(14, body.split("\n").length + 1)} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
          )}
          <div className="row wrap">
            {confirming ? (
              <div className="confirm grow">
                <p>
                  <strong>{ep.method} {buildUrl()}</strong> runs against the live API and can change real data
                  (or send real messages). Send it?
                </p>
                <div className="row">
                  <button className="danger" onClick={send}>Yes, send it</button>
                  <button onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="primary" disabled={busy || missing.length > 0} onClick={() => (isRead ? send() : setConfirming(true))}>
                {busy ? "Sending…" : "Send"}
              </button>
            )}
            {missing.length > 0 && !confirming && <span className="muted small">Fill in: {missing.join(", ")}</span>}
          </div>
          {err && <div className="alert error">{err}</div>}
          {result && (
            <div>
              <div className="row small" style={{ marginBottom: ".4rem" }}>
                <span className={`badge ${result.status < 400 ? "sent" : "failed"}`}>
                  {result.status} {result.statusText}
                </span>
                <span className="muted">{result.ms} ms</span>
                {itemCount !== null && <span className="muted">{itemCount} {itemCount === 1 ? "item" : "items"}</span>}
              </div>
              <pre className="ep-out">{pretty || <span className="muted">(empty response)</span>}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
