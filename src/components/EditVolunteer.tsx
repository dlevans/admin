import { FormEvent, useEffect, useState } from "react";
import { AdminVolunteer, api, AvailabilityWindow, Category, VolunteerUpdate } from "../api";
import Modal from "./Modal";

interface Props {
  volunteer: AdminVolunteer;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (v: AdminVolunteer) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The fields the volunteers list doesn't include; loaded from the detail endpoint. */
interface Extras {
  sex: string;
  abilities: string; // comma-separated in the form
  interestIds: Set<string>;
  availability: AvailabilityWindow[];
}

export default function EditVolunteer({ volunteer, isSelf, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: volunteer.name,
    email: volunteer.email,
    phone: volunteer.phone,
    pronouns: volunteer.pronouns ?? "",
    birthdate: volunteer.birthdate,
    address: volunteer.address ?? "",
    city: volunteer.city,
    state: volunteer.state,
    zip: volunteer.zip ?? "",
    background_check_complete: volunteer.background_check_complete,
    role: volunteer.role,
  });
  // null until loaded. If loading fails (older API), these fields are left out of the save so nothing is wiped.
  const [extras, setExtras] = useState<Extras | null>(null);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([api.volunteer(volunteer.id), api.categories()])
      .then(([d, cats]) => {
        if (!live) return;
        setCategories(cats);
        setExtras({
          sex: d.sex ?? "",
          abilities: d.abilities.join(", "),
          interestIds: new Set(d.interests.map((c) => c.id)),
          availability: d.availability.map(({ day, start_time, end_time }) => ({ day, start_time, end_time })),
        });
      })
      .catch((e: Error) => live && setExtrasError(e.message));
    return () => {
      live = false;
    };
  }, [volunteer.id]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm({ ...form, [key]: value });
  const text = (key: "name" | "email" | "phone" | "pronouns" | "address" | "city" | "state" | "zip") => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

  const setExtra = <K extends keyof Extras>(key: K, value: Extras[K]) => setExtras((x) => x && { ...x, [key]: value });
  const toggleInterest = (id: string) => {
    if (!extras) return;
    const next = new Set(extras.interestIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExtra("interestIds", next);
  };
  const setWindow = (i: number, patch: Partial<AvailabilityWindow>) =>
    extras && setExtra("availability", extras.availability.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const addWindow = () =>
    extras && setExtra("availability", [...extras.availability, { day: "Saturday", start_time: "9:00 AM", end_time: "12:00 PM" }]);
  const removeWindow = (i: number) => extras && setExtra("availability", extras.availability.filter((_, j) => j !== i));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Optional text fields: blank means "not given".
    const body: VolunteerUpdate = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pronouns: form.pronouns.trim() || null,
      address: form.address.trim() || null,
      zip: form.zip.trim() || null,
    };
    if (extras) {
      body.sex = extras.sex.trim() || null;
      body.abilities = extras.abilities.split(",").map((a) => a.trim()).filter(Boolean);
      body.interest_ids = [...extras.interestIds];
      body.availability = extras.availability.map((w) => ({
        day: w.day.trim(),
        start_time: w.start_time.trim(),
        end_time: w.end_time.trim(),
      }));
    }
    try {
      onSaved(await api.updateVolunteer(volunteer.id, body));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${volunteer.name}`} onClose={onClose} wide>
      <form className="stack" onSubmit={save}>
        <div className="grid2">
          <label>Name<input {...text("name")} required maxLength={200} /></label>
          <label>Email<input type="email" {...text("email")} required maxLength={254} /></label>
          <label>Phone<input type="tel" {...text("phone")} maxLength={30} /></label>
          <label>Pronouns<input {...text("pronouns")} maxLength={50} /></label>
          <label>Birthdate<input type="date" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} required /></label>
          <label>
            Sex
            <input
              value={extras?.sex ?? ""}
              onChange={(e) => setExtra("sex", e.target.value)}
              disabled={!extras}
              maxLength={50}
            />
          </label>
          <label>Address<input {...text("address")} maxLength={300} /></label>
          <label>City<input {...text("city")} required maxLength={100} /></label>
          <div className="grid2 tight">
            <label>State<input {...text("state")} required maxLength={50} /></label>
            <label>ZIP<input {...text("zip")} maxLength={20} /></label>
          </div>
        </div>

        {extrasError ? (
          <div className="alert error">
            Couldn't load sex, abilities, interests and availability ({extrasError}), so they can't be edited here
            right now. Saving won't change them.
          </div>
        ) : !extras ? (
          <p className="muted small">Loading abilities, interests and availability…</p>
        ) : (
          <>
            <label>
              Abilities
              <input
                value={extras.abilities}
                onChange={(e) => setExtra("abilities", e.target.value)}
                placeholder="e.g. Spanish, forklift, first aid"
              />
              <span className="muted small">Separate with commas.</span>
            </label>

            <fieldset className="edit-group">
              <legend>Interests</legend>
              {categories.length === 0 ? (
                <p className="muted small">No categories set up.</p>
              ) : (
                <div className="check-grid">
                  {categories.map((c) => (
                    <label key={c.id} className="check">
                      <input type="checkbox" checked={extras.interestIds.has(c.id)} onChange={() => toggleInterest(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="edit-group">
              <legend>Availability</legend>
              {extras.availability.length === 0 && <p className="muted small">None given.</p>}
              {extras.availability.map((w, i) => (
                <div key={i} className="avail-row">
                  <select value={w.day} onChange={(e) => setWindow(i, { day: e.target.value })} aria-label="Day">
                    {!DAYS.includes(w.day) && <option value={w.day}>{w.day}</option>}
                    {DAYS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <input
                    value={w.start_time}
                    onChange={(e) => setWindow(i, { start_time: e.target.value })}
                    placeholder="9:00 AM"
                    aria-label="From"
                    required
                    maxLength={20}
                  />
                  <span className="muted">to</span>
                  <input
                    value={w.end_time}
                    onChange={(e) => setWindow(i, { end_time: e.target.value })}
                    placeholder="1:00 PM"
                    aria-label="To"
                    required
                    maxLength={20}
                  />
                  <button type="button" className="small-btn danger-outline" onClick={() => removeWindow(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <div>
                <button type="button" className="small-btn" onClick={addWindow}>+ Add time</button>
              </div>
            </fieldset>
          </>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={form.background_check_complete}
            onChange={(e) => set("background_check_complete", e.target.checked)}
          />
          Background check complete
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.role === "admin"}
            disabled={isSelf}
            onChange={(e) => set("role", e.target.checked ? "admin" : "user")}
          />
          Admin (can sign in to this admin page)
          {isSelf && <span className="muted small">— you can't remove your own admin access</span>}
        </label>

        {error && <div className="alert error">{error}</div>}
        <div className="row">
          <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
