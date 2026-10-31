import { Link, useNavigate } from "react-router-dom";
import { MEMBERSHIP_ENABLED } from "../../config";
import { SocialIcon } from "./publicShared";

type PublicFooterProps = {
  authorEmail: string;
  featuredCategoryTiles: { name: string; count: number }[];
  goToCategory: (name: string) => void;
  scrollToLatest: () => void;
  scrollToContact: () => void;
};

export function PublicFooter({ authorEmail, featuredCategoryTiles, goToCategory, scrollToLatest, scrollToContact }: PublicFooterProps) {
  const navigate = useNavigate();

  return (
    <footer className="bf-footer" id="about">
      <div className="bf-footer-grid">
        <div className="bf-footer-brand">
          <Link to="/" className="bf-brand bf-brand-light" aria-label="Exploor home">
            <img className="bf-brand-logo" src="/exploor-logo.gif" alt="" width={40} height={40} decoding="async" />
            <span className="bf-brand-text">
              <span className="bf-brand-name">Expl00r</span>
            </span>
          </Link>
          <p className="bf-footer-copy">
            Scholarships, work, ideas, and culture &mdash; a useful publication for people building a future on their own terms.
          </p>
          <div className="bf-footer-social">
            <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Exploor on X"><SocialIcon kind="x" /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Exploor on Facebook"><SocialIcon kind="facebook" /></a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Exploor on Instagram"><SocialIcon kind="instagram" /></a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="Exploor on LinkedIn"><SocialIcon kind="linkedin" /></a>
            <a href={`mailto:${authorEmail}`} aria-label="Email Exploor"><SocialIcon kind="mail" /></a>
          </div>
        </div>

        <nav className="bf-footer-col" aria-label="Quick links">
          <h3>Quick Links</h3>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Home</button>
          <button type="button" onClick={() => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" })}>About Us</button>
          <button type="button" onClick={scrollToLatest}>Blog</button>
          <button type="button" onClick={() => goToCategory("All stories")}>Categories</button>
          <button type="button" onClick={scrollToContact}>Contact</button>
          {MEMBERSHIP_ENABLED && <button type="button" onClick={() => navigate("/pricing")}>Pricing</button>}
        </nav>

        <nav className="bf-footer-col" aria-label="Categories">
          <h3>Categories</h3>
          {featuredCategoryTiles.map(({ name }) => (
            <button key={name} type="button" onClick={() => goToCategory(name)}>{name}</button>
          ))}
        </nav>

        <nav className="bf-footer-col" aria-label="Support">
          <h3>Support</h3>
          <button type="button" onClick={() => navigate("/terms")}>Terms &amp; Conditions</button>
          <button type="button" onClick={() => navigate("/privacy")}>Privacy Policy</button>
          <button type="button" onClick={() => navigate("/cookies")}>Cookies Policy</button>
          <button type="button" onClick={() => navigate("/refund")}>Refund Policy</button>
          <button type="button" onClick={() => window.dispatchEvent(new Event("eye-open-cookie-settings"))}>Cookie preferences</button>
        </nav>

        <div className="bf-footer-col bf-footer-contact" id="contact">
          <h3>Contact</h3>
          <p>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 18s6-5.1 6-9.5A6 6 0 1 0 4 8.5C4 12.9 10 18 10 18Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.5" /></svg>
            Cheveron Lekki Lagos State, Nigeria.
          </p>
          <p>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 3.5h3l1.5 4-2 1.5a11 11 0 0 0 4.5 4.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C8.6 17 3 11.4 2.5 5.1A1.5 1.5 0 0 1 4 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            <a href="tel:+2347086193675">+234 708 619 3675</a>
          </p>
          <p>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="m3.5 5.5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <a href={`mailto:${authorEmail}`}>{authorEmail}</a>
          </p>
        </div>
      </div>

      <div className="bf-footer-bar">
        <span>&copy; 2026 Expl00r. All rights reserved.</span>
        <nav aria-label="Legal">
          <button type="button" onClick={() => navigate("/privacy")}>Privacy Policy</button>
          <button type="button" onClick={() => navigate("/terms")}>Terms of Service</button>
          <a href="/sitemap.xml">Sitemap</a>
        </nav>
      </div>
    </footer>
  );
}
