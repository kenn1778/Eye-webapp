import { Link } from "react-router-dom";
import { Brand } from "../../components/Brand";
import { PolicyBar } from "../../components/PolicyBar";

export function PrivacyPolicy() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" to="/"><Brand /></Link>
        <nav className="main-nav" aria-label="Main"><Link to="/">Home</Link><Link to="/#stories">Stories</Link><Link to="/#newsletter">Newsletter</Link></nav>
        <Link className="admin-link" to="/">Back to site →</Link>
      </header>
      <PolicyBar />
      <main className="legal-page">
        <div className="legal-header">
          <div className="eyebrow">Legal • Effective: 12 September 2026 • Version 2.0</div>
          <h1>Privacy Policy</h1>
          <p>EYE (“we”, “us”) respects your privacy. This policy explains what we collect, why, how long we keep it, and your rights under Ghana Data Protection Act 2012 (Act 843), EU GDPR, and California CCPA/CPRA. Read it with our <Link to="/terms">Terms</Link> and <Link to="/cookies">Cookies Policy</Link>.</p>
          <div className="legal-notice">
            <strong>Plain English summary:</strong> We only collect your email if you ask for the weekly brief. We do not sell data, we do not track you across sites without consent, and you can delete your data anytime via <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a>.
          </div>
        </div>

        <div className="legal-toc">
          <strong>Contents:</strong> <a href="#collect">1. What we collect</a> • <a href="#use">2. Use</a> • <a href="#basis">3. Legal basis</a> • <a href="#cookies">4. Cookies</a> • <a href="#sharing">5. Sharing</a> • <a href="#transfers">6. Transfers</a> • <a href="#retention">7. Retention</a> • <a href="#rights">8. Your rights</a> • <a href="#security">9. Security</a> • <a href="#children">10. Children</a> • <a href="#changes">11. Changes</a> • <a href="#contact">12. Contact</a>
        </div>

        <section id="collect">
          <h2>1. What we collect — data minimization</h2>
          <p>We collect only what is necessary for the feature you use:</p>
          <ul>
            <li><strong>Newsletter email + consent timestamp + IP (at signup)</strong> — only when you submit <a href="/#newsletter">the newsletter form</a> and tick “I agree”. Stored until you unsubscribe. No name, phone, or address required.</li>
            <li><strong>Technical data</strong> — IP, browser, device, pages viewed, referrer, via strictly necessary cookies (<code>eye:consent</code>, <code>eye:subscribed</code>) or, if you accept, analytics cookies. See <Link to="/cookies">Cookies Policy</Link>.</li>
            <li><strong>Admin workspace</strong> — email, display name, and password hash for invited team members only. No public user accounts.</li>
            <li><strong>Support emails</strong> — content of messages you send to hello@ or privacy@.</li>
          </ul>
          <p><strong>We do NOT collect:</strong> payment cards (browsing is free), location, biometrics, sensitive personal data, or cross-site profiles without explicit consent.</p>
        </section>

        <section id="use">
          <h2>2. How we use it</h2>
          <ul>
            <li>Send the weekly brief you requested (and service emails like confirmation).</li>
            <li>Secure the site, prevent spam/bots (honeypot + rate limiting), and fix bugs.</li>
            <li>Understand which stories are useful — <em>only if you accept analytics</em>.</li>
            <li>Comply with law and enforce our <Link to="/terms">Terms</Link>.</li>
          </ul>
          <p>We <strong>never</strong> sell your email, trade it, or share it with advertisers or data brokers.</p>
        </section>

        <section id="basis">
          <h2>3. Legal basis</h2>
          <ul>
            <li><strong>Consent (GDPR Art.6(1)(a), Ghana DPA s.18)</strong> — newsletter and non-essential cookies. Withdraw anytime via unsubscribe link or <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a>.</li>
            <li><strong>Legitimate interest (Art.6(1)(f))</strong> — security, fraud prevention, and aggregated analytics with minimal privacy impact.</li>
            <li><strong>Contract (Art.6(1)(b))</strong> — providing the admin workspace to invited members.</li>
            <li><strong>Legal obligation</strong> — where Ghana law requires retention.</li>
          </ul>
        </section>

        <section id="cookies">
          <h2>4. Cookies & tracking</h2>
          <p>We use only:</p>
          <ul>
            <li><strong>Strictly necessary:</strong> <code>eye:consent</code> (your cookie choice, 12 months), <code>eye:subscribed</code> (prevent duplicate submits, 12 months).</li>
            <li><strong>Analytics (opt-in only):</strong> _ga/_gid if you click “Accept” in the cookie banner. No advertising pixels without consent.</li>
          </ul>
          <p>Third-party embeds that may set cookies: <strong>Google Fonts</strong> (fonts.googleapis.com) and <strong>Unsplash</strong> (images.unsplash.com). See <Link to="/cookies">Cookies Policy</Link> for details and how to block.</p>
        </section>

        <section id="sharing">
          <h2>5. Who we share with (processors only)</h2>
          <ul>
            <li><strong>Email delivery</strong> — e.g., Resend/Brevo/Amazon SES — only to deliver what you requested, under DPA.</li>
            <li><strong>Hosting/CDN</strong> — e.g., Cloudflare/Vercel — to serve the site fast and securely.</li>
            <li><strong>No sale, no brokers, no ad networks.</strong></li>
          </ul>
        </section>

        <section id="transfers">
          <h2>6. International transfers</h2>
          <p>Servers may be outside Ghana/EU. Where we transfer, we use safeguards such as EU Standard Contractual Clauses or adequacy decisions and limit data to what is needed.</p>
        </section>

        <section id="retention">
          <h2>7. How long we keep it</h2>
          <ul>
            <li>Newsletter emails: until you unsubscribe or request deletion; suppression list kept 24 months to respect “do not email”.</li>
            <li>Logs: up to 12 months, then anonymized.</li>
            <li>Unsubscribed: removed from active list within 30 days.</li>
          </ul>
        </section>

        <section id="rights">
          <h2>8. Your rights (Ghana/EU/California)</h2>
          <p>You may have rights to access, correct, delete, restrict, object, portability, and to withdraw consent. California residents may also have “Do Not Sell/Share” and “Limit Use” rights — we do not sell/share, so no opt-out needed, but we honor requests.</p>
          <ul>
            <li>Unsubscribe: link in every email (one click).</li>
            <li>Access/delete: email <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> — we reply within 30 days (Ghana DPA/GDPR) or 45 days (CCPA).</li>
            <li>Complaints: Ghana Data Protection Commission, your EU DPA, or California AG.</li>
          </ul>
        </section>

        <section id="security">
          <h2>9. Security</h2>
          <p>TLS in transit, encryption at rest for emails, access limited to authorized staff, and regular reviews. No system is 100% secure — if we learn of a breach affecting your data, we will notify you and the relevant authority within 72 hours where required.</p>
        </section>

        <section id="children">
          <h2>10. Children</h2>
          <p>Not for children under 16. If a child provided an email, contact us for prompt deletion.</p>
        </section>

        <section id="changes">
          <h2>11. Changes</h2>
          <p>We will post updates here, change the “Effective” date, and for material changes email subscribers or show a notice. Check this page periodically.</p>
        </section>

        <section id="contact">
          <h2>12. Contact & controller</h2>
          <div className="legal-contact-card">
            <p><strong>Data controller:</strong> EYE — Scholarship & Opportunities Publication</p>
            <p><strong>Controller:</strong></p>
            <p>Alozie Izuchukwu Johnkennedy<br/>
            No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria<br/>
            Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a><br/>
            Phone: 07086193675 / +234 708 619 3675 • Lagos, Nigeria<br/>
            Business: Sole proprietor (Nigeria) • NDPA compliant</p>
            <p><strong>Have a Nigerian counsel review before launch.</strong></p>
          </div>
          <p><em>This template is not legal advice.</em></p>
        </section>
      </main>
      <footer className="site-footer"><Brand /><p>© 2026 EYE</p><div className="footer-meta"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/refund">Refund</Link></div></footer>
    </div>
  );
}
