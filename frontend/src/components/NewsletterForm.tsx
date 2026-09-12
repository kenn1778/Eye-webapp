import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "error";

type Props = {
  variant?: "footer" | "card" | "hero";
  placeholder?: string;
  buttonLabel?: string;
  showBenefits?: boolean;
  showSocialProof?: boolean;
};

// Professional newsletter form - like Substack / Beehiiv
// Handles validation, loading, success, double opt-in, honeypot and API fallback
export function NewsletterForm({
  variant = "card",
  placeholder = "you@example.com",
  buttonLabel = "Subscribe",
  showBenefits = true,
  showSocialProof = true,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap - must stay empty
  const [consentChecked, setConsentChecked] = useState(false); // GDPR explicit consent

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

  const isValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();

    // honeypot - bots fill hidden field
    if (honeypot) return;

    if (!consentChecked) {
      setStatus("error");
      setMessage("Please agree to the Privacy Policy to subscribe.");
      return;
    }
    if (!isValid(clean)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    // prevent duplicate in this browser (like ConvertKit does)
    const key = "eye:subscribed";
    const existing = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    if (existing.includes(clean)) {
      setStatus("error");
      setMessage("You are already on the list. Check your inbox.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      if (apiBase) {
        // Real API - professional endpoint
        const res = await fetch(`${apiBase}/api/v1/newsletter/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: clean, source: variant, hp: honeypot }),
        });

        const data = (await res.json().catch(() => ({}))) as { message?: string };

        if (!res.ok) {
          throw new Error(data.message || "Could not subscribe. Try again.");
        }

        // success - double opt-in like high-end newsletters
        setStatus("success");
        setMessage(data.message || "Check your email — we sent a confirmation link.");
      } else {
        // Demo fallback - no backend configured, simulate network
        await new Promise((r) => setTimeout(r, 900));
        // simulate 8% chance of duplicate error for realism
        // if (Math.random() < 0.08) throw new Error("Already subscribed");

        setStatus("success");
        setMessage("You are on the list. Check your inbox for a confirmation.");
      }

      // remember locally so we show duplicate handling next time
      localStorage.setItem(key, JSON.stringify([...existing, clean]));
      setEmail("");

      // auto reset success after 6s like Beehiiv
      window.setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 6000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <div className={`newsletter-pro newsletter-pro--${variant}`}>
      {showBenefits && variant === "card" && (
        <ul className="newsletter-benefits" aria-label="What you get">
          <li><span aria-hidden="true">✓</span> Curated scholarships & deadlines</li>
          <li><span aria-hidden="true">✓</span> First-job & internship leads</li>
          <li><span aria-hidden="true">✓</span> Culture, audio & ideas — one email / week</li>
        </ul>
      )}

      <form onSubmit={onSubmit} className="newsletter-pro-form" noValidate>
        {/* Honeypot - visually hidden, bots fill it */}
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hp-field"
        />

        <label className="consent-row"><input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} required aria-required="true" /> <span>I agree to receive the weekly brief and accept the <a href="/privacy">Privacy Policy</a>. <em>Required.</em></span></label>
        <label htmlFor={`nl-${variant}`} className="sr-only">Email address</label>
        <div className="newsletter-pro-row">
          <input
            id={`nl-${variant}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={placeholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || isSuccess}
            aria-invalid={status === "error"}
            aria-describedby={message ? `nl-msg-${variant}` : undefined}
            className={status === "error" ? "is-error" : isSuccess ? "is-success" : ""}
          />
          <button
            type="submit"
            className={`button button-dark newsletter-pro-btn ${isSuccess ? "is-success" : ""}`}
            disabled={isLoading || isSuccess || !email.trim()}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : isSuccess ? (
              <span aria-hidden="true">✓</span>
            ) : null}
            <span>{isLoading ? "Joining..." : isSuccess ? "Done" : buttonLabel}</span>
            {!isLoading && !isSuccess && <span aria-hidden="true">→</span>}
          </button>
        </div>

        <div
          id={`nl-msg-${variant}`}
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`newsletter-pro-msg ${status === "error" ? "is-error" : ""} ${isSuccess ? "is-success" : ""}`}
        >
          {message && <span>{message}</span>}
          {!message && <span className="newsletter-pro-hint">No spam. Unsubscribe anytime. View <a href="#privacy">privacy</a>.</span>}
        </div>
      </form>

      {showSocialProof && (
        <div className="newsletter-social-proof">
          <div className="avatar-stack" aria-hidden="true">
            <span className="avatar-stack-item">A</span>
            <span className="avatar-stack-item">D</span>
            <span className="avatar-stack-item">N</span>
            <span className="avatar-stack-item">EY</span>
          </div>
          <div className="social-proof-text">
            <strong>Join readers across Ghana</strong> <span>— students & early-career builders</span>
            <small>Illustrative community — numbers shown in demo are examples only</small>
          </div>
        </div>
      )}
    </div>
  );
}
