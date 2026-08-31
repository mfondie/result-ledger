import { useState } from "react";
import { signIn } from "../lib/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // supabase's onAuthStateChange listener in App.jsx picks up the new
      // session automatically — nothing else to do here.
    } catch (err) {
      setError(err.message || "Could not sign in — check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <form className="card" onSubmit={submit}>
        <h1 className="page-title">Sign in</h1>
        <p className="help-text">
          Ask your department's superadmin for an account if you don't have one yet — accounts
          are created from inside the app, not by signing up here.
        </p>
        {error && <div className="error-text">{error}</div>}
        <div className="form-grid">
          <label className="field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Signing in\u2026" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
