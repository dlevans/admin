import { FormEvent, useRef, useState } from "react";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  // Uncontrolled on purpose: a controlled input makes React mirror the password into the DOM value attribute.
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), passwordRef.current?.value ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <img src="./vkc_logo.png" alt="" className="login-logo" />
        <h1>VolunteerKC Admin</h1>
        <p className="muted">Sign in with your VolunteerKC app account. Admin access is required.</p>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            ref={passwordRef}
            required
          />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
