import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "../../components/Brand";
import { login, requestPasswordReset } from "../../lib/auth";

type AdminLoginProps = {
  onLogin: () => void;
  onBack: () => void;
};

// Client-side attempt limiter only. Server-side rate limiting is still required.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [resetNotice, setResetNotice] = useState("");

  useEffect(() => {
    if (!locked) return;
    const timer = window.setTimeout(() => setLocked(false), LOCKOUT_MS);
    return () => window.clearTimeout(timer);
  }, [locked]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked) {
      setError("Too many attempts. Try again in a minute.");
      return;
    }
    if (!email.trim() || password.length < 4) {
      setError("Enter a valid email and a password with at least 4 characters.");
      return;
    }
    setPending(true);
    setError("");
    const result = await login(email, password);
    setPending(false);
    if (!result.ok) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLocked(true);
        setError("Too many failed attempts. Sign-in is locked for 60 seconds.");
        setFailedAttempts(0);
      } else {
        setError(result.error);
      }
      return;
    }
    onLogin();
  };

  const handleForgotPassword = async () => {
    await requestPasswordReset(email);
    // Kept vague on purpose so a visitor can't probe which addresses exist.
    setResetNotice(
      "If that address is registered, a single-use reset link (valid for 30 minutes) has been sent. If it does not arrive, contact the workspace owner.",
    );
  };
  return (
    <div className="login-shell">
      <main className="login-card">
        <button className="login-back" type="button" onClick={onBack}>&lt;- Back to Expl00r</button>
        <div className="login-brand"><Brand /></div>
        <div className="eyebrow">Private workspace</div>
        <h1>Welcome back.</h1>
        <p className="login-intro">Sign in to publish stories, manage your media, and keep your communities moving.</p>
        <form onSubmit={submit} className="login-form">
          <label className="editor-label">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@theeyes.org" autoComplete="email" maxLength={120} /></label>
          <label className="editor-label">Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" maxLength={128} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <div className="login-options"><label><input type="checkbox" defaultChecked /> Remember me</label><button type="button" className="login-link" onClick={handleForgotPassword}>Forgot password?</button></div>
          {resetNotice && <p className="login-error" role="status">{resetNotice}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="admin-primary login-submit" type="submit" disabled={pending || locked}>{pending ? "Signing in..." : <>Sign in <span aria-hidden="true">-&gt;</span></>}</button>
        </form>
        <p className="login-footnote">Protected admin access. Sessions are signed and expire automatically.</p>
      </main>
    </div>
  );
}