// AdminLogin - sign in gate

import { useState, type FormEvent } from "react";
import { Brand } from "../../components/Brand";

type AdminLoginProps = {
  onLogin: () => void;
  onBack: () => void;
};

export function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [email, setEmail] = useState("admin@theeyes.org");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || password.length < 4) {
      setError("Enter a valid email and a password with at least 4 characters.");
      return;
    }
    onLogin();
  };
  return (
    <div className="login-shell">
      <div className="login-orbit" />
      <main className="login-card">
        <button className="login-back" type="button" onClick={onBack}>&lt;- Back to EYE</button>
        <div className="login-brand"><Brand /></div>
        <div className="eyebrow">Private workspace</div>
        <h1>Welcome back.</h1>
        <p className="login-intro">Sign in to publish stories, manage your media, and keep your communities moving.</p>
        <form onSubmit={submit} className="login-form">
          <label className="editor-label">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@theeyes.org" autoComplete="email" /></label>
          <label className="editor-label">Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <div className="login-options"><label><input type="checkbox" defaultChecked /> Remember me</label><button type="button" className="login-link">Forgot password?</button></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="admin-primary login-submit" type="submit">Sign in <span aria-hidden="true">-&gt;</span></button>
        </form>
        <p className="login-footnote">Protected admin access - Frontend preview mode</p>
      </main>
    </div>
  );
}