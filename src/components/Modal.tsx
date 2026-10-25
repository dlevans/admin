import { ReactNode, useEffect, useRef } from "react";

/** Native <dialog> as a modal: Esc and the backdrop close it, focus is trapped by the browser. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="modal-inner">
        <div className="row between">
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
