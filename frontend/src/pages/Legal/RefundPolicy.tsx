import { Link } from "react-router-dom";
import { Brand } from "../../components/Brand";

export function RefundPolicy() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" to="/"><Brand /></Link>
        <nav className="main-nav" aria-label="Legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/refund" className="active">Refund</Link></nav>
        <Link className="admin-link" to="/">Back to site →</Link>
      </header>
      <main className="legal-page">
        <div className="legal-header">
          <div className="eyebrow">Legal • Last updated: 12 September 2026</div>
          <h1>Refund & Cancellation Policy</h1>
          <p>Clear rules so you know what to expect. No hidden fees.</p>
        </div>

        <section>
          <h2>1. Free browsing</h2>
          <p>Reading stories, browsing opportunities, and joining communities on EYE is free. No payment or refund is needed for free features.</p>
        </section>

        <section>
          <h2>2. Paid features (if any)</h2>
          <p>If we introduce paid features (e.g., premium briefings, application reviews, or events), this section will apply. Currently no paid checkout is live. This policy is published proactively to meet app store and consumer law requirements.</p>
          <ul>
            <li><strong>14-day cooling-off:</strong> For digital services not yet started, you may cancel within 14 days for a full refund where required by Ghana Consumer Protection or EU/UK law.</li>
            <li><strong>After service starts:</strong> If you request a service to start immediately (the usual for digital content), you acknowledge you lose the 14-day right once performance has begun, but we will still consider good-faith refunds.</li>
            <li><strong>Subscriptions:</strong> If we offer a recurring newsletter-plus plan, you can cancel anytime. Cancellation stops future charges; already-billed periods are non-refundable after delivery unless required by law or we agree otherwise.</li>
          </ul>
        </section>

        <section>
          <h2>3. How to request a refund</h2>
          <ol>
            <li>Email <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> with subject “Refund — [your email]” within 14 days of payment.</li>
            <li>Include receipt/transaction ID and reason.</li>
            <li>We respond within 5 business days and, if approved, refund to the original payment method within 10 business days.</li>
          </ol>
        </section>

        <section>
          <h2>4. Non-refundable cases</h2>
          <ul>
            <li>Free listings or community access</li>
            <li>Fees paid to third parties (e.g., external application fees) — we never charge those</li>
            <li>Abuse, fraud, or violation of <Link to="/terms">Terms</Link></li>
          </ul>
        </section>

        <section>
          <h2>5. Contact</h2>
          <div className="legal-contact-card">
            <p>EYE Billing, No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria<br/>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a></p>
          </div>
        </section>
      </main>
      <footer className="site-footer"><Brand /><p>© 2026 EYE</p><div className="footer-meta"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
    </div>
  );
}
