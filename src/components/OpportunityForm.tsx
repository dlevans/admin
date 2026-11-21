import { FormEvent, useState } from "react";
import { api, Category, Opportunity, OpportunityInput } from "../api";
import { fromLocalInput, toLocalInput, useLoad } from "../util";
import Modal from "./Modal";

interface Props {
  opp?: Opportunity; // editing; otherwise creating a new Special opportunity
  onClose: () => void;
  onSaved: (opp: Opportunity) => void;
}

/** Next Saturday 9:00 AM, as a starting point for a new opportunity. */
function suggestedStart() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function OpportunityForm({ opp, onClose, onSaved }: Props) {
  const { data: categories } = useLoad<Category[]>(() => api.categories());
  const start = suggestedStart();
  const [f, setF] = useState({
    title: opp?.title ?? "",
    organization: opp?.organization ?? "VolunteerKC",
    description: opp?.description ?? "",
    start_at: toLocalInput(opp?.start_at ?? start.toISOString()),
    end_at: toLocalInput(opp?.end_at ?? new Date(start.getTime() + 3 * 3_600_000).toISOString()),
    location_name: opp?.location_name ?? "",
    address: opp?.address ?? "",
    city: opp?.city ?? "Kansas City",
    state: opp?.state ?? "MO",
    zip: opp?.zip ?? "",
    skills: (opp?.skills ?? []).join(", "),
    family_friendly: opp?.family_friendly ?? null,
    contact_email: opp?.contact_email ?? "",
    contact_phone: opp?.contact_phone ?? "",
    image_url: opp?.image_url ?? "",
  });
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set((opp?.categories ?? []).map((c) => c.id)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type TextKey = Exclude<keyof typeof f, "family_friendly">;
  const text = (key: TextKey) => ({
    value: f[key],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value }),
  });
  const toggleCategory = (id: string) => {
    const next = new Set(categoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCategoryIds(next);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (f.end_at <= f.start_at) {
      setError("The end has to be after the start.");
      return;
    }
    setSaving(true);
    setError(null);
    const skills = f.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const body: OpportunityInput = {
      title: f.title.trim(),
      organization: f.organization.trim() || "VolunteerKC",
      description: f.description.trim(),
      start_at: fromLocalInput(f.start_at)!,
      end_at: fromLocalInput(f.end_at)!,
      location_name: f.location_name.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      state: f.state.trim(),
      zip: f.zip.trim(),
      skills: skills.length ? skills : null,
      family_friendly: f.family_friendly,
      contact_email: f.contact_email.trim(),
      contact_phone: f.contact_phone.trim(),
      image_url: f.image_url.trim() || null,
      category_ids: [...categoryIds],
    };
    try {
      onSaved(opp ? await api.updateOpportunity(opp.id, body) : await api.createOpportunity(body));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={opp ? `Edit ${opp.title}` : "New Special opportunity"} onClose={onClose} wide>
      <form className="stack" onSubmit={save}>
        {!opp && (
          <p className="muted small" style={{ margin: 0 }}>
            Special opportunities are made here, not on the volunteerkc.com calendar. The website sync never changes or
            removes them. They show up in the app like any other opportunity.
          </p>
        )}
        <label>Title<input {...text("title")} required maxLength={300} autoFocus={!opp} /></label>
        <label>
          Description
          <textarea {...text("description")} rows={5} />
        </label>
        <div className="grid2">
          <label>Starts<input type="datetime-local" {...text("start_at")} required /></label>
          <label>Ends<input type="datetime-local" {...text("end_at")} required /></label>
          <label>Organization<input {...text("organization")} maxLength={300} /></label>
          <label>Location name<input {...text("location_name")} maxLength={300} placeholder="e.g. Harvesters warehouse" /></label>
          <label>Address<input {...text("address")} maxLength={300} /></label>
          <label>City<input {...text("city")} maxLength={100} /></label>
          <div className="grid2 tight">
            <label>State<input {...text("state")} maxLength={50} /></label>
            <label>ZIP<input {...text("zip")} maxLength={20} /></label>
          </div>
          <label>Contact email<input type="email" {...text("contact_email")} maxLength={254} /></label>
          <label>Contact phone<input type="tel" {...text("contact_phone")} maxLength={30} /></label>
          <label>Image URL<input type="url" {...text("image_url")} maxLength={1000} placeholder="https://…" /></label>
        </div>
        <label>
          Skills
          <input {...text("skills")} placeholder="e.g. lifting, Spanish" />
          <span className="muted small" style={{ fontWeight: 400 }}>Separate with commas.</span>
        </label>

        <fieldset className="edit-group">
          <legend>Categories</legend>
          {!categories ? (
            <p className="muted small">Loading…</p>
          ) : categories.length === 0 ? (
            <p className="muted small">No categories set up.</p>
          ) : (
            <div className="check-grid">
              {categories.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={categoryIds.has(c.id)} onChange={() => toggleCategory(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label>
          Family friendly
          <select
            value={f.family_friendly == null ? "" : String(f.family_friendly)}
            onChange={(e) => setF({ ...f, family_friendly: e.target.value === "" ? null : e.target.value === "true" })}
          >
            <option value="">Not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>

        {error && <div className="alert error">{error}</div>}
        <div className="row">
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : opp ? "Save changes" : "Create opportunity"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
