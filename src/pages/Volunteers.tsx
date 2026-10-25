import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminVolunteer, api } from "../api";
import { useAuth } from "../auth";
import DeleteVolunteer from "../components/DeleteVolunteer";
import EditVolunteer from "../components/EditVolunteer";
import { ComposePreset, plural, useLoad } from "../util";

export default function Volunteers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, setData, error, loading } = useLoad(() => api.volunteers());
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminVolunteer | null>(null);
  const [deleting, setDeleting] = useState<AdminVolunteer | null>(null);

  const saved = (v: AdminVolunteer) => {
    setData((list) => list && list.map((x) => (x.id === v.id ? v : x)));
    setEditing(null);
  };
  const deleted = (id: string) => {
    setData((list) => list && list.filter((x) => x.id !== id));
    const next = new Set(selected);
    next.delete(id);
    setSelected(next);
    setDeleting(null);
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((v) => !s || `${v.name} ${v.email} ${v.phone} ${v.city}`.toLowerCase().includes(s));
  }, [data, q]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allShown = rows.length > 0 && rows.every((v) => selected.has(v.id));
  const toggleAll = () => {
    const next = new Set(selected);
    rows.forEach((v) => (allShown ? next.delete(v.id) : next.add(v.id)));
    setSelected(next);
  };

  const compose = (to: string) =>
    navigate(to, { state: { audience: "volunteers", volunteerIds: [...selected] } satisfies ComposePreset });

  return (
    <div className="page">
      <h1>Volunteers</h1>
      <div className="row wrap between">
        <input type="search" className="search" placeholder="Search name, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <span className="muted small">{plural(selected.size, "selected", "selected")}</span>
          <button className="primary" disabled={!selected.size} onClick={() => compose("/texts")}>Text selected</button>
          <button disabled={!selected.size} onClick={() => compose("/notifications")}>Notify selected</button>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {data && (
        <div className="card flush">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all shown" /></th>
                <th>Name</th>
                <th>Phone</th>
                <th className="hide-sm">Email</th>
                <th className="hide-sm">City</th>
                <th title="Phones signed in to the app that can receive push notifications">App</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} onClick={() => toggle(v.id)} className={selected.has(v.id) ? "sel" : ""}>
                  <td><input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} onClick={(e) => e.stopPropagation()} /></td>
                  <td>
                    {v.name} {v.role === "admin" && <span className="badge">admin</span>}
                  </td>
                  <td>{v.phone || "—"}</td>
                  <td className="hide-sm">{v.email}</td>
                  <td className="hide-sm">{v.city}{v.state && `, ${v.state}`}</td>
                  <td className="muted small">{v.device_count ? plural(v.device_count, "device") : "—"}</td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="small-btn" onClick={() => setEditing(v)}>Edit</button>
                    <button
                      className="small-btn danger-outline"
                      onClick={() => setDeleting(v)}
                      disabled={v.id === user?.id}
                      title={v.id === user?.id ? "You can't delete your own account" : undefined}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="muted pad">No volunteers match.</p>}
        </div>
      )}

      {editing && <EditVolunteer volunteer={editing} isSelf={editing.id === user?.id} onClose={() => setEditing(null)} onSaved={saved} />}
      {deleting && <DeleteVolunteer volunteer={deleting} onClose={() => setDeleting(null)} onDeleted={deleted} />}
    </div>
  );
}
