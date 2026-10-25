import { FormEvent, useState } from "react";
import { AdminVolunteer, api, VolunteerUpdate } from "../api";
import Modal from "./Modal";

interface Props {
  volunteer: AdminVolunteer;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (v: AdminVolunteer) => void;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm({ ...form, [key]: value });
  const text = (key: "name" | "email" | "phone" | "pronouns" | "address" | "city" | "state" | "zip") => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

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
    try {
      onSaved(await api.updateVolunteer(volunteer.id, body));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${volunteer.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="grid2">
          <label>Name<input {...text("name")} required maxLength={200} /></label>
          <label>Email<input type="email" {...text("email")} required maxLength={254} /></label>
          <label>Phone<input type="tel" {...text("phone")} maxLength={30} /></label>
          <label>Pronouns<input {...text("pronouns")} maxLength={50} /></label>
          <label>Birthdate<input type="date" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} required /></label>
          <label>Address<input {...text("address")} maxLength={300} /></label>
          <label>City<input {...text("city")} required maxLength={100} /></label>
          <div className="grid2 tight">
            <label>State<input {...text("state")} required maxLength={50} /></label>
            <label>ZIP<input {...text("zip")} maxLength={20} /></label>
          </div>
        </div>

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
