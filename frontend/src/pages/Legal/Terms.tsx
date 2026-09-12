import { Link } from "react-router-dom";
import { Brand } from "../../components/Brand";

export function Terms() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand-link" to="/"><Brand /></Link>
        <nav className="main-nav" aria-label="Legal"><Link to="/privacy">Privacy</Link><Link to="/terms" className="active">Terms</Link><Link to="/cookies">Cookies</Link><Link to="/refund">Refund</Link></nav>
        <Link className="admin-link" to="/">Back to site →</Link>
      </header>
      <main className="legal-page">
        <div className="legal-header">
          <div className="eyebrow">Legal • Last updated: 12 September 2026</div>
          <h1>Terms & Conditions</h1>
          <p>Rules for using EYE. By browsing or subscribing, you agree to these terms.</p>
        </div>

        <section>
          <h2>1. About EYE</h2>
          <p>EYE publishes summaries and links to scholarships, internships, jobs, and cultural opportunities. We do not award funding and are not affiliated with the institutions listed unless explicitly stated.</p>
          <div className="legal-notice">
            <strong>Disclaimer:</strong> Listings are for information only. Eligibility, deadlines, and funding amounts change frequently. Always verify on the <em>official source</em> linked in each post before applying. We are not responsible for decisions, costs, or outcomes based on summaries.
          </div>
        </section>

        <section>
          <h2>2. Acceptable use</h2>
          <ul>
            <li>Do not scrape, overload, or attempt to bypass security.</li>
            <li>Do not use content to mislead others or impersonate EYE.</li>
            <li>Respect intellectual property — you may share links, but do not republish full articles without permission.</li>
          </ul>
        </section>

        <section>
          <h2>3. Intellectual property</h2>
          <p>Our original text, design, and EYE logo are © 2026 EYE. Third-party images are licensed via Unsplash (Unsplash License) and remain property of their creators. Google Fonts (Manrope, DM Mono, Playfair Display) are under the SIL Open Font License. If you own content and want it removed, email <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a>.</p>
        </section>

        <section>
          <h2>4. No guarantees & limitation of liability</h2>
          <p>Content is provided “as is” without warranties. To the extent permitted by Ghana law (and applicable local law where you access the service):</p>
          <ul>
            <li>We do not guarantee that every listing is current, complete, or that you will be eligible or successful.</li>
            <li>We are not liable for indirect, incidental, or consequential damages, or for reliance on listings. Our total liability for any claim is limited to GHS 500 or the amount you paid us in the last 12 months, whichever is lower (or minimum required by law).</li>
          </ul>
        </section>

        <section>
          <h2>5. User content</h2>
          <p>If you submit comments or community posts, you grant us a non-exclusive license to display them and you warrant you have the right to do so. We may moderate or remove content that is unlawful, spam, or harmful.</p>
        </section>

        <section>
          <h2>6. Links to third parties</h2>
          <p>Posts link to official sources. We do not control third-party sites, their privacy practices, or availability. Visiting them is at your own risk.</p>
        </section>

        <section>
          <h2>7. Subscriptions</h2>
          <p>Newsletters are free. You can unsubscribe via the link in every email. See <Link to="/privacy">Privacy Policy</Link> for how we handle your email. No purchase is required to browse.</p>
        </section>

        <section>
          <h2>8. Changes & governing law</h2>
          <p>We may update these terms and will post the new date above. Continued use after changes means you accept them.</p>
          <p><strong>Governing law:</strong> Laws of the Republic of Ghana. Disputes first via good-faith negotiation for 30 days, then courts of Accra, unless mandatory consumer law in your country requires otherwise.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <div className="legal-contact-card">
            <p>Alozie Izuchukwu Johnkennedy — No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria<br/>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a></p>
            <p>Registered as sole proprietor in Nigeria.</p>
          </div>
          <p><em>Not legal advice — have counsel review.</em></p>
        </section>
      </main>
      <footer className="site-footer"><Brand /><p>© 2026 EYE</p><div className="footer-meta"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></footer>
    </div>
  );
}
