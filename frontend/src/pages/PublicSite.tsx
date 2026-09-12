// PublicSite - public facing pages

import { useEffect, useMemo, useState } from "react";
import type { Story } from "../types";
import { categories, communities } from "../data/seedData";
import { Brand } from "../components/Brand";
import { PolicyBar } from "../components/PolicyBar";
import { NewsletterForm } from "../components/NewsletterForm";

// Props: stories to display, and function to open admin login
type PublicSiteProps = {
  stories: Story[]; // all stories including newly published
  openAdmin: () => void; // switch to admin view
};

// PublicSite - the full public page
export function PublicSite({ stories, openAdmin }: PublicSiteProps) {
  // isShrunk - true when user scrolls down >32px, header becomes compact
  const [isShrunk, setIsShrunk] = useState(false);
  // Listen to scroll to shrink header (eye text hides leaving only icon)
  useEffect(() => {
    const onScroll = () => setIsShrunk(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // category - which filter tab is selected (default All stories)
  const [category, setCategory] = useState("All stories");
  // query - text typed in the search box
  const [query, setQuery] = useState("");
  // selectedStory - which story is open in the popup modal, undefined = none
  const [selectedStory, setSelectedStory] = useState<Story>();
  // newsletter is now handled by <NewsletterForm /> (professional, API-ready)
  // joinedCommunities - list of community names the user has joined
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);

  // availableCategories - all category tabs, including any new ones from published stories
  // e.g., if a new story has category "Podcast", it adds a new tab
  const availableCategories = useMemo(
    () => [
      ...categories,
      ...stories
        .map((story) => story.category)
        .filter((item, index, items) => !categories.includes(item) && items.indexOf(item) === index),
    ],
    [stories],
  );

  // filtered - stories matching both category and search text
  const filtered = useMemo(
    () =>
      stories.filter((story) => {
        const text =
          `${story.title} ${story.excerpt} ${story.category}`.toLowerCase();
        return (
          (category === "All stories" || story.category === category) &&
          (!query.trim() || text.includes(query.toLowerCase()))
        );
      }),
    [category, query, stories],
  );

  // newest is the first story (treated as featured big card)
  const newest = stories[0];
  // cardStories are the rest, shown in grid
  const cardStories = filtered.filter((story) => story !== newest);

  // toggleCommunity - join or leave a community
  const toggleCommunity = (name: string) => {
    setJoinedCommunities((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="site-shell">
      {/* Header - sticky, shrinks on scroll (eye text hides) */}
      <header className={isShrunk ? "site-header is-shrunk" : "site-header"}>
        {/* Brand logo + EYE text - text hides on shrink/mobile */}
        <a className="brand-link" href="#top">
          <Brand />
        </a>
        {/* Main navigation - Stories, Opportunities, etc. */}
        <nav className="main-nav" aria-label="Main navigation">
          <a className="active" href="#stories">
            Stories
          </a>
          <a href="#opportunities">Opportunities</a>
          <a href="#communities">Communities</a>
          <a href="#about">About</a>
        </nav>
        {/* Admin button - goes to login */}
        <button className="admin-link" type="button" onClick={openAdmin}>
          Admin workspace <span aria-hidden="true">-&gt;</span>
        </button>
      </header>
      <PolicyBar />
      <main id="main-content">
        {/* Hero / Intro band - big headline */}
        <section className="intro-band">
          <div className="eyebrow">For the next chapter</div>
          <h1>
            Find the signal
            <br />
            <em>in the noise.</em>
          </h1>
          <p className="intro-copy">
            Scholarships, work, ideas, and culture for people building a future
            on their own terms.
          </p>
          <div className="intro-actions">
            <a className="button button-dark" href="#stories">
              Explore stories <span aria-hidden="true">-&gt;</span>
            </a>
            <button className="text-button" type="button" onClick={() => document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" })}>
              Get the weekly brief <span aria-hidden="true">+</span>
            </button>
          </div>
        </section>
        {/* Live banner - only shows after publishing a new post */}
        {stories.length > 4 && (
          <section className="published-notice" aria-live="polite">
            <span className="status-live">LIVE NOW</span>
            <strong>Your new post is visible to readers.</strong>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("opportunities")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              View published story -&gt;
            </button>
          </section>
        )}
        {/* Featured story - large card */}
        <section className="feature-section" id="stories">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Editor&apos;s pick</div>
              <h2>Start here</h2>
            </div>
            <span className="section-number">01 / 04</span>
          </div>
          <article className="feature-story">
            <div
              className="feature-image"
              style={{ backgroundImage: `url(${newest.image})` }}
              role="img"
              aria-label={newest.title}
            />
            <div className="feature-content">
              <span className="story-label">{newest.category}</span>
              <h3>{newest.title}</h3>
              <p>{newest.excerpt}</p>
              {newest.actionUrl ? (
                <a
                  className="story-link"
                  href={newest.actionUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {newest.actionLabel} <span aria-hidden="true">-&gt;</span>
                </a>
              ) : (
                <button className="story-link story-button" type="button" onClick={() => setSelectedStory(newest)}>Read the story <span aria-hidden="true">-&gt;</span></button>
              )}
            </div>
          </article>
        </section>
        {/* Latest stories - search + filter + grid */}
        <section className="latest-section" id="opportunities">
          <div className="latest-toolbar">
            <div>
              <div className="eyebrow">The latest</div>
              <h2>Worth your attention</h2>
            </div>
            <label className="search-field">
              <span className="sr-only">Search stories</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stories"
              />
              <span>/</span>
            </label>
          </div>
          <div className="category-tabs" role="tablist">
            {availableCategories.map((item) => (
              <button
                className={
                  category === item ? "category-tab selected" : "category-tab"
                }
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                role="tab"
                aria-selected={category === item}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="story-grid">
            {cardStories.map((story) => (
              <article className="story-card" key={story.title} onClick={() => setSelectedStory(story)}>
                <div
                  className="story-card-image"
                  style={{ backgroundImage: `url(${story.image})` }}
                  role="img"
                  aria-label={story.title}
                />
                <div className="story-card-content">
                  <span className="story-label">{story.category}</span>
                  <h3>{story.title}</h3>
                  <p>{story.excerpt}</p>
                  {story.actionUrl && (
                    <a
                      className="card-action"
                      href={story.actionUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {story.actionLabel} -&gt;
                    </a>
                  )}
                  <button className="card-read" type="button" onClick={(event) => { event.stopPropagation(); setSelectedStory(story); }}>Open story -&gt;</button>
                  <div className="story-meta">{story.meta}</div>
                  <small className="card-disclaimer">Info may change — verify on official source.</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        {/* Communities */}
        <section className="communities-section" id="communities" aria-labelledby="communities-title">
          <div className="section-heading">
            <div><div className="eyebrow">Find your people</div><h2 id="communities-title">Communities</h2></div>
            <span className="section-number">03 / 03</span>
          </div>
          <p className="communities-intro">Useful rooms for asking better questions, sharing leads, and finding momentum together.</p>
          <div className="community-grid">
            {communities.map((community) => <article className="community-card" key={community.name}><div className={`community-art ${community.accent}`}><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span></div><div className="community-card-body"><span className="story-label">Community</span><h3>{community.name}</h3><p>{community.description}</p><div className="community-footer"><span>{community.members}</span><button type="button" onClick={() => toggleCommunity(community.name)}>{joinedCommunities.includes(community.name) ? "Joined" : "Join community"} -&gt;</button></div></div></article>)}
          </div>
        </section>
      </main>
      {/* Story popup modal */}
      {selectedStory && <div className="client-modal-backdrop" role="presentation" onClick={() => setSelectedStory(undefined)}><article className="story-reader" role="dialog" aria-modal="true" aria-labelledby="story-reader-title" onClick={(event) => event.stopPropagation()}><button className="reader-close" type="button" onClick={() => setSelectedStory(undefined)} aria-label="Close story">X</button><div className="reader-image" style={{ backgroundImage: `url(${selectedStory.image})` }} role="img" aria-label={selectedStory.title} /><div className="reader-content"><span className="story-label">{selectedStory.category}</span><h2 id="story-reader-title">{selectedStory.title}</h2><div className="story-meta">{selectedStory.meta}</div><p>{selectedStory.excerpt}</p><p>Explore the details, deadlines, and next steps in this published story. The full editorial body will be supplied by the publishing service when backend content is connected.</p>{selectedStory.actionUrl && <a className="button button-dark" href={selectedStory.actionUrl} target="_blank" rel="noreferrer">{selectedStory.actionLabel || "Open opportunity"} -&gt;</a>}</div></article></div>}
      {/* Premium Newsletter - like Beehiiv/Substack */}
      <section className="newsletter-section" id="newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-card">
          <div className="newsletter-card-left">
            <div className="eyebrow">Weekly brief — every Monday 7am</div>
            <h2 id="newsletter-title">Get the opportunities that actually matter</h2>
            <p className="newsletter-card-copy">
              One curated email. Scholarships, internships, and culture — filtered for builders, not browsers.
              Join students and early-career builders across Ghana.
            </p>
            <NewsletterForm variant="card" buttonLabel="Join free" />
            <p className="newsletter-trust">
              <span aria-hidden="true">🔒</span> No spam. 1-click unsubscribe. <a href="#privacy">Privacy</a> • See <a href="#stories">past briefs</a>
            </p>
          </div>
          <div className="newsletter-card-right" aria-hidden="true">
            <div className="newsletter-preview">
              <div className="preview-header"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><span className="preview-subject">EYE — Weekly Brief #47</span></div>
              <div className="preview-line" style={{ width: "92%" }} />
              <div className="preview-line" style={{ width: "86%" }} />
              <div className="preview-line" style={{ width: "78%" }} />
              <div className="preview-pill">3 scholarships closing this week →</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - with real business details, copyright, and legal links */}
      <footer className="site-footer" id="about">
        <div className="footer-brand-col">
          <Brand />
          <p>A useful publication for people in motion.</p>
          <div className="business-details">
            <p><strong>Alozie Izuchukwu Johnkennedy</strong> — No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria</p>
            <p>Business: Sole proprietor (Nigeria) • Mon–Fri 9am–5pm WAT</p>
            <p>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> • Phone: 07086193675 / +234 708 619 3675</p>
            <p className="footer-disclaimer">Images: <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License</a> • Fonts: <a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts (OFL)</a></p>
          </div>
        </div>
        <div className="footer-newsletter">
          <NewsletterForm variant="footer" placeholder="you@example.com" buttonLabel="Subscribe" showBenefits={false} showSocialProof={false} />
        </div>
        <div className="footer-meta">
          <span>© 2026 EYE. All rights reserved.</span>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/cookies">Cookies</a>
          <a href="/refund">Refund</a>
          <a href="mailto:teckennedy177@gmail.com">Contact</a>
        </div>
      </footer>
      </div>
    </>
  );
}