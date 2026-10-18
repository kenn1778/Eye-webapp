import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

function stripHtml(input: string): string {
  // eslint-disable-next-line no-control-regex -- intentional: strip ASCII control characters from email input
  return input.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "");
}

type Status = "idle" | "loading" | "success" | "error";

type Props = {
  variant?: "footer" | "card" | "hero";
  placeholder?: string;
  buttonLabel?: string;
  showBenefits?: boolean;
};

const SUCCESS_RESET_MS = 6000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function NewsletterForm({
  variant = "card",
  placeholder = "you@example.com",
  buttonLabel = "Subscribe",
  showBenefits = true,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  // Bot trap: real users never see or fill this field.
  const [honeypot, setHoneypot] = useState("");
  // Explicit GDPR consent - required before we accept an address.
  const [consentChecked, setConsentChecked] = useState(false);

  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

  // Cancel the idle reset if the form unmounts first.
  const resetTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function subscribeViaApi(base: string, address: string): Promise<string> {
    const response = await fetch(`${base}/api/v1/newsletter/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address, source: variant, hp: honeypot }),
    });

    const data = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message || "Could not subscribe. Try again.");
    }
    return data.message || "Check your email - we sent a confirmation link.";
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sanitizedEmail = stripHtml(email.trim());
    // Lowercase so duplicate detection and the API agree on one canonical form.
    const address = sanitizedEmail.toLowerCase();

    // Honeypot tripped: drop silently so bots get no signal.
    if (honeypot) return;

    if (!consentChecked) {
      setStatus("error");
      setMessage("Please agree to the Privacy Policy to subscribe.");
      return;
    }

    if (sanitizedEmail.length > 254) {
      setStatus("error");
      setMessage("Email must be 254 characters or fewer.");
      return;
    }

    if (!isValidEmail(address)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const confirmation = await subscribeViaApi(apiBase ?? "", address);

      setStatus("success");
      setMessage(confirmation);

      setEmail("");

      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        setStatus("idle");
        setMessage("");
      }, SUCCESS_RESET_MS);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  return (
    <div className={`newsletter-pro newsletter-pro--${variant}`}>
      {showBenefits && variant === "card" && (
        <ul className="newsletter-benefits" aria-label="What you get">
          <li><span aria-hidden="true">&check;</span> Curated scholarships &amp; deadlines</li>
          <li><span aria-hidden="true">&check;</span> First-job &amp; internship leads</li>
          <li><span aria-hidden="true">&check;</span> Culture, audio &amp; ideas &mdash; one email / week</li>
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

        <label className="consent-row">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            required
            aria-required="true"
          />{" "}
          <span>
            I agree to receive the weekly brief and accept the <Link to="/privacy">Privacy Policy</Link>. <em>Required.</em>
          </span>
        </label>

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
            maxLength={254}
          />
          <button
            type="submit"
            className={`button button-dark newsletter-pro-btn ${isSuccess ? "is-success" : ""}`}
            disabled={isLoading || isSuccess || !email.trim()}
            aria-busy={isLoading}
          >
            {isLoading && <span className="btn-spinner" aria-hidden="true" />}
            {isSuccess && <span aria-hidden="true">&check;</span>}
            <span>{isLoading ? "Joining..." : isSuccess ? "Done" : buttonLabel}</span>
            {!isLoading && !isSuccess && <span aria-hidden="true">&rarr;</span>}
          </button>
        </div>

        <div
          id={`nl-msg-${variant}`}
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`newsletter-pro-msg ${status === "error" ? "is-error" : ""} ${isSuccess ? "is-success" : ""}`}
        >
          {message ? (
            <span>{message}</span>
          ) : (
            <span className="newsletter-pro-hint">
              No spam. Your email is stored securely. View <Link to="/privacy">privacy</Link>.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}