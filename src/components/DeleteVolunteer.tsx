import { useState } from "react";
import { AdminVolunteer, api } from "../api";
import Modal from "./Modal";

interface Props {
  volunteer: AdminVolunteer;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export default function DeleteVolunteer({ volunteer, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteVolunteer(volunteer.id);
      onDeleted(volunteer.id);
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Modal title="Delete volunteer?" onClose={onClose}>
      <div className="stack">
        <p>
          This permanently deletes <strong>{volunteer.name}</strong> ({volunteer.email}), including their logged hours
          and event signups. They'll be signed out of the app and would need to register again. This can't be undone.
        </p>
        {error && <div className="alert error">{error}</div>}
        <div className="row">
          <button className="danger" onClick={remove} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
          <button onClick={onClose} disabled={deleting}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
