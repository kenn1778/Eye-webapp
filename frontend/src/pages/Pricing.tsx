import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PolicyBar } from "../components/PolicyBar";
import {
  fetchPlans,
  startCheckout,
  verifyCheckout,
  formatPrice,
  type MembershipPlan,
} from "../lib/membership";

type Status = "idle" | "loading" | "error" | "success";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Premium membership page. Reachable only when VITE_ENABLE_MEMBERSHIP is on.
export function Pricing() {
  const [searchParams] = useSearchParams();
  // A reference in the URL means we just returned from Paystack.
  const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currency, setCurrency] = useState("NGN");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(reference ? "loading" : "idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((data) => {
        if (cancelled) return;
        setPlans(data.plans);
        setCurrency(data.currency);
        setEnabled(data.enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Returning from Paystack: confirm the payment before showing success.
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    verifyCheckout(reference)
      .then((result) => {
        if (cancelled) return;
        setStatus(result.active ? "success" : "error");
        setMessage(result.active ? "You are a member. Welcome aboard." : "Payment was not completed.");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not verify payment.");
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const { authorizationUrl } = await startCheckout(address, plans[0]?.id ?? "premium-monthly");
      window.location.href = authorizationUrl;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
    }
  };

  const isBusy = status === "loading";
  const isDisabled = isBusy || enabled === false;

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" to="/"><Brand /></Link>
        <nav className="main-nav" aria-label="Main">
          <Link to="/">Home</Link>
          <Link to="/#stories">Stories</Link>
          <Link to="/#newsletter">Newsletter</Link>
        </nav>
        <Link className="admin-link" to="/">Back to site →</Link>
      </header>
      <PolicyBar />
      <main className="pricing-page">
        <div className="pricing-header">
          <div className="eyebrow">Membership</div>
          <h1>Go further with EYE Premium</h1>
          <p className="pricing-lede">
            Early access to scholarships, personalised matches, deadline reminders, and the full archive.
          </p>
        </div>

        {enabled === false && (
          <p className="pricing-note" role="status">
            Membership is not open yet. Check back soon.
          </p>
        )}

        {plans.map((plan) => (
          <section className="pricing-card" key={plan.id}>
            <div className="pricing-card-head">
              <h2>{plan.name}</h2>
              <p className="pricing-price">
                {formatPrice(plan.amountKobo, currency)}
                <span>/{plan.interval}</span>
              </p>
            </div>
            <ul className="pricing-benefits">
              <li>Early access to new scholarships</li>
              <li>Personalised opportunity matches</li>
              <li>Deadline reminders by email</li>
              <li>Full archive and guides</li>
            </ul>
            <form className="pricing-form" onSubmit={onSubmit} noValidate>
              <label className="sr-only" htmlFor="pricing-email">Email address</label>
              <input
                id="pricing-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isDisabled}
                maxLength={254}
              />
              <button className="button button-dark" type="submit" disabled={isDisabled}>
                {isBusy ? "Starting…" : "Become a member"}
              </button>
            </form>
            {message && (
              <p
                className={`pricing-msg ${status === "error" ? "is-error" : ""} ${status === "success" ? "is-success" : ""}`}
                role="status"
              >
                {message}
              </p>
            )}
            <p className="pricing-trust">Secure payment via Paystack. Cancel anytime.</p>
          </section>
        ))}
      </main>
    </div>
  );
}
