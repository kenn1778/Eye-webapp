import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const STORAGE_KEY = "eye:subscribe-popup:dismissed";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function SubscribePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  const shouldShow = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return true;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return true;
      return Date.now() - ts > COOLDOWN_MS;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    const t = window.setTimeout(() => setOpen(true), 3000);
    return () => window.clearTimeout(t);
  }, [shouldShow]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/v1/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), source: "popup" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Signup failed");
      setStatus("success");
      setMessage(data?.message || "Check your email to confirm.");
      setTimeout(close, 1800);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Something went wrong. Try again.");
    }
  };

  if (!open) return null;

  return (
    <div className="subscribe-overlay" role="dialog" aria-modal="true" aria-labelledby="subscribe-title">
      <div className="subscribe-card" ref={dialogRef}>
        <button className="subscribe-close" aria-label="Close" onClick={close}>×</button>
        <h3 id="subscribe-title">Get early access & updates</h3>
        <p>Subscribe for scholarship alerts, application tips and new posts straight to your inbox.</p>
        <form onSubmit={submit} className="subscribe-form">
          <label htmlFor="subscribe-email" className="sr-only">Email</label>
          <input
            id="subscribe-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading" || status === "success"}
          />
          <button type="submit" disabled={status === "loading" || status === "success"} className="btn btn-primary">
            {status === "loading" ? "Subscribing…" : status === "success" ? "Subscribed" : "Subscribe"}
          </button>
        </form>
        {message && <p className="subscribe-message" role="status">{message}</p>}
        <p className="subscribe-note">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  );
}