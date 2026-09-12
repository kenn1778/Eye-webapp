import { Link } from "react-router-dom";
import { Brand } from "../../components/Brand";

export function CookiesPolicy() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" to="/"><Brand /></Link>
        <nav className="main-nav" aria-label="Legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies" className="active">Cookies</Link><Link to="/refund">Refund</Link></nav>
        <Link className="admin-link" to="/">Back to site →</Link>
      </header>
      <main className="legal-page">
        <div className="legal-header">
          <div className="eyebrow">Legal • Last updated: 12 September 2026</div>
          <h1>Cookies Policy</h1>
          <p>How we use cookies and similar tech — and how you control them.</p>
        </div>

        <section>
          <h2>1. What are cookies?</h2>
          <p>Small text files stored on your device. We use them to keep the site working and, with your consent, to understand usage.</p>
        </section>

        <section>
          <h2>2. Types we use</h2>
          <table className="legal-table">
            <thead><tr><th>Type</th><th>Example</th><th>Purpose</th><th>Duration</th></tr></thead>
            <tbody>
              <tr><td>Strictly necessary</td><td><code>eye:consent</code>, <code>eye:subscribed</code></td><td>Remember cookie choice, prevent duplicate newsletter submits, keep login secure</td><td>Session to 12 months</td></tr>
              <tr><td>Functional</td><td><code>prefers-color</code> (if added)</td><td>Remember preferences</td><td>12 months</td></tr>
              <tr><td>Analytics (only with consent)</td><td>_ga, _gid (if you enable)</td><td>Count visits, see which stories are useful</td><td>Up to 24 months</td></tr>
            </tbody>
          </table>
          <p><strong>We do NOT use</strong> advertising or cross-site tracking cookies. No Facebook Pixel, no ad retargeting without explicit opt-in.</p>
        </section>

        <section>
          <h2>3. Third-party embeds</h2>
          <ul>
            <li><strong>Google Fonts</strong> (fonts.googleapis.com / fonts.gstatic.com) — fonts are loaded from Google. Google may log IP and user-agent per its <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>. We use <code>preconnect</code> and cache to minimize requests.</li>
            <li><strong>Unsplash images</strong> (images.unsplash.com) — post covers are hot-linked. Unsplash may see your IP when loading an image. Images are under the <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License</a> (free to use, no attribution required but credited where possible).</li>
            <li>No YouTube, no social embeds, no analytics by default — so no extra trackers until you consent.</li>
          </ul>
        </section>

        <section>
          <h2>4. Your choices</h2>
          <ul>
            <li><strong>Banner:</strong> Accept / Reject non-essential cookies on first visit. You can change later via “Cookie settings” in the footer.</li>
            <li><strong>Browser:</strong> Block or delete cookies in settings (e.g., Chrome: Settings → Privacy → Cookies).</li>
            <li><strong>Do Not Track:</strong> We respect DNT where feasible, but banner choice takes precedence.</li>
          </ul>
          <p>Blocking strictly necessary cookies may break login or newsletter duplicate protection.</p>
        </section>

        <section>
          <h2>5. How to withdraw consent</h2>
          <p>Click “Cookie settings” in the footer or clear <code>eye:consent</code> in browser storage. Analytics (if enabled) stops immediately.</p>
        </section>

        <section>
          <h2>6. Contact</h2>
          <p>Questions? <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a></p>
        </section>
      </main>
      <footer className="site-footer"><Brand /><p>© 2026 EYE</p><div className="footer-meta"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
    </div>
  );
}
