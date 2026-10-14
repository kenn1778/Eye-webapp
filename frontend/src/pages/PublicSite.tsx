import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Story } from "../types";
import { categories, communities } from "../data/seedData";
import { Brand } from "../components/Brand";
import { CommunityChat } from "../components/CommunityChat";
import type { Community } from "../types";
import { PolicyBar } from "../components/PolicyBar";
import { NewsletterForm } from "../components/NewsletterForm";
import { Reveal } from "../components/Reveal";
import { ReviewSection } from "../components/ReviewSection";
import { HeroEye } from "../components/HeroEye";
import { AdSlot } from "../components/AdSlot";
import { SponsoredBadge } from "../components/SponsoredBadge";
import { outboundRel } from "../lib/monetization";
import { trackEvent } from "../lib/analytics";
import { MEMBERSHIP_ENABLED } from "../config";

type PublicSiteProps = {
  stories: Story[];
  openAdmin: () => void;
};

const heroWords = ["signal", "clarity", "momentum", "opportunity"];

export function PublicSite({ stories, openAdmin }: PublicSiteProps) {
  const [isShrunk, setIsShrunk] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [prevWordIndex, setPrevWordIndex] = useState(0);
  // Ref mirrors the index so the timer reads the live value instead of a stale state closure.
  const wordIndexRef = useRef(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      setIsShrunk(window.scrollY > 32);
      setShowBackToTop(window.scrollY > 600);
    };
    // passive so the page keeps scrolling smoothly; we never call preventDefault here.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Frozen under automation so visual-regression snapshots stay deterministic.
    if (navigator.webdriver) return;
    const intervalId = window.setInterval(() => {
      // Publish the old index first so its word plays the leave transition before the swap.
      setPrevWordIndex(wordIndexRef.current);
      wordIndexRef.current = (wordIndexRef.current + 1) % heroWords.length;
      setWordIndex(wordIndexRef.current);
    }, 2600);
    return () => window.clearInterval(intervalId);
  }, []);

  // Drift the hero orbit circle toward the cursor via CSS vars, no re-render.
  const handleHeroMove = (event: ReactMouseEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    const rect = hero.getBoundingClientRect();
    // Cursor mapped to -0.5..0.5 so the orbit drifts evenly around center.
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    hero.style.setProperty("--orbit-x", `${(x * 34).toFixed(1)}px`);
    hero.style.setProperty("--orbit-y", `${(y * 22).toFixed(1)}px`);
  };
  const handleHeroLeave = () => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty("--orbit-x", "0px");
    hero.style.setProperty("--orbit-y", "0px");
  };

  const [category, setCategory] = useState("All stories");
  const [query, setQuery] = useState("");
  const [selectedStory, setSelectedStory] = useState<Story>();
  // <NewsletterForm /> owns its own state, so no newsletter state lives here.
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState<Community | null>(null);
  // The header keeps only the logo; every link lives in this dropdown.
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const availableCategories = useMemo(
    () => [
      ...categories,
      ...stories
        .map((story) => story.category)
        // Drop seeded categories, then de-dupe to first occurrence so tab order stays stable.
        .filter((item, index, items) => !categories.includes(item) && items.indexOf(item) === index),
    ],
    [stories],
  );

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

  // The first story becomes the large featured card.
  const featuredStory = stories[0];
  // Identity check works because both lists hold the same story objects.
  const cardStories = filtered.filter((story) => story !== featuredStory);

  useEffect(() => {
    if (!activeChat) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveChat(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeChat]);

  // Dismiss the header menu on Escape or a click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const readerCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!selectedStory) return;
    readerCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedStory(undefined); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedStory]);

  const toggleCommunity = (name: string) => {
    setJoinedCommunities((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="site-shell">
      <header ref={headerRef} className={isShrunk ? "site-header is-shrunk" : "site-header"}>
        <a className="brand-link" href="#top" onClick={() => setMenuOpen(false)}>
          <Brand />
        </a>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bars" aria-hidden="true"><span /><span /><span /></span>
        </button>
        <nav id="site-menu" className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
          <a className="active" href="#stories" onClick={() => setMenuOpen(false)}>
            Stories
          </a>
          <a href="#opportunities" onClick={() => setMenuOpen(false)}>Opportunities</a>
          <a href="#communities" onClick={() => setMenuOpen(false)}>Communities</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          {MEMBERSHIP_ENABLED && (
            <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          )}
          <button className="admin-link" type="button" onClick={() => { setMenuOpen(false); openAdmin(); }}>
            Admin workspace <span aria-hidden="true">-&gt;</span>
          </button>
        </nav>
      </header>
      <main id="main-content">
        <section
          className="intro-band"
          ref={heroRef}
          onMouseMove={handleHeroMove}
          onMouseLeave={handleHeroLeave}
        >
          <HeroEye />
          <div className="eyebrow">For the next chapter</div>
          <h1>
            Find the{" "}
            <span className="hero-rotator">
              <span className="sr-only" aria-live="polite">{heroWords[wordIndex]}</span>
              {heroWords.map((word, i) => (
                <span
                  key={word}
                  aria-hidden="true"
                  className={`hero-word ${i === wordIndex ? "is-active" : i === prevWordIndex ? "is-leaving" : ""}`}
                >
                  {word}
                </span>
              ))}
            </span>
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
          <div className="hero-scroll-hint" aria-hidden="true">
            <span className="hero-scroll-mouse"><span /></span>
            <span className="hero-scroll-label">Scroll</span>
          </div>
        </section>
        {/* Seed data ships four stories, so a fifth means a post was just published */}
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
        <AdSlot placement="leaderboard" />
        <Reveal>
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
              style={{ backgroundImage: `url(${featuredStory.image})` }}
              role="img"
              aria-label={featuredStory.title}
            />
            <div className="feature-content">
              <span className="story-label">{featuredStory.category}</span>
              {featuredStory.sponsored && <SponsoredBadge />}
              <h3>{featuredStory.title}</h3>
              <p>{featuredStory.excerpt}</p>
              {featuredStory.actionUrl ? (
                <a
                  className="story-link"
                  href={featuredStory.actionUrl}
                  target="_blank"
                  rel={outboundRel(featuredStory.actionUrl)}
                  onClick={() => trackEvent("Outbound link", { url: featuredStory.actionUrl ?? "" })}
                >
                  {featuredStory.actionLabel} <span aria-hidden="true">-&gt;</span>
                </a>
              ) : (
                <button className="story-link story-button" type="button" onClick={() => setSelectedStory(featuredStory)}>Read the story <span aria-hidden="true">-&gt;</span></button>
              )}
            </div>
          </article>
        </section>
        </Reveal>
        <Reveal>
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
                  {story.sponsored && <SponsoredBadge />}
                  <h3>{story.title}</h3>
                  <p>{story.excerpt}</p>
                  {story.actionUrl && (
                    <a
                      className="card-action"
                      href={story.actionUrl}
                      target="_blank"
                      rel={outboundRel(story.actionUrl)}
                      onClick={(event) => {
                        event.stopPropagation();
                        trackEvent("Outbound link", { url: story.actionUrl ?? "" });
                      }}
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
        </Reveal>
        <AdSlot placement="in-content" />
        <Reveal>
        <section className="communities-section" id="communities" aria-labelledby="communities-title">
          <div className="section-heading">
            <div><div className="eyebrow">Find your people</div><h2 id="communities-title">Communities</h2></div>
            <span className="section-number">03 / 03</span>
          </div>
          <p className="communities-intro">Useful rooms for asking better questions, sharing leads, and finding momentum together.</p>
          <div className="community-grid">
            {communities.map((community) => {
              const isJoined = joinedCommunities.includes(community.name);
              return (
                <article className="community-card" key={community.name}>
                  <div className={`community-art ${community.accent}`}><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span></div>
                  <div className="community-card-body">
                    <span className="story-label">Community</span>
                    <h3>{community.name}</h3>
                    <p>{community.description}</p>
                    <div className="community-footer">
                      <span>{community.members}</span>
                      {isJoined ? (
                        <button type="button" className="chat-open-btn" onClick={() => setActiveChat(community)}>Open chat →</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            toggleCommunity(community.name);
                            setActiveChat(community);
                          }}
                        >
                          Join & chat →
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        </Reveal>
      </main>
      <Reveal>
        <ReviewSection />
      </Reveal>
      {activeChat && (
        <CommunityChat
          key={activeChat.name}
          community={activeChat}
          onClose={() => setActiveChat(null)}
          onLeave={() => {
            toggleCommunity(activeChat.name);
            setActiveChat(null);
          }}
        />
      )}

      {selectedStory && <div className="client-modal-backdrop" role="presentation" onClick={() => setSelectedStory(undefined)}><article className="story-reader" role="dialog" aria-modal="true" aria-labelledby="story-reader-title" onClick={(event) => event.stopPropagation()}><button ref={readerCloseRef} className="reader-close" type="button" onClick={() => setSelectedStory(undefined)} aria-label="Close story">X</button><div className="reader-image" style={{ backgroundImage: `url(${selectedStory.image})` }} role="img" aria-label={selectedStory.title} /><div className="reader-content"><span className="story-label">{selectedStory.category}</span>{selectedStory.sponsored && <SponsoredBadge />}<h2 id="story-reader-title">{selectedStory.title}</h2><div className="story-meta">{selectedStory.meta}</div><p>{selectedStory.excerpt}</p><p>Explore the details, deadlines, and next steps in this published story. The full editorial body will be supplied by the publishing service when backend content is connected.</p>{selectedStory.actionUrl && <a className="button button-dark" href={selectedStory.actionUrl} target="_blank" rel={outboundRel(selectedStory.actionUrl)} onClick={() => trackEvent("Outbound link", { url: selectedStory.actionUrl ?? "" })}>{selectedStory.actionLabel || "Open opportunity"} -&gt;</a>}</div></article></div>}
      <Reveal>
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
      </Reveal>

      <AdSlot placement="footer" />

      <footer className="site-footer" id="about">
        <div className="footer-brand-col">
          <Brand />
          <details className="footer-disclosure">
            <summary className="footer-tagline">A useful publication for people in motion.</summary>
            <div className="business-details">
              <p><strong>Alozie Izuchukwu Johnkennedy</strong> — No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria</p>
              <p>Business: Sole proprietor (Nigeria) • Mon–Fri 9am–5pm WAT</p>
              <p>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> • Phone: 07086193675 / +234 708 619 3675</p>
              <p className="footer-disclaimer">Images: <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License</a> • Fonts: <a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts (OFL)</a></p>
            </div>
          </details>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <h3 className="footer-nav-title">Explore</h3>
          <a href="#stories">Stories</a>
          <a href="#opportunities">Opportunities</a>
          <a href="#communities">Communities</a>
          <a href="#newsletter">Newsletter</a>
        </nav>
        <div className="footer-newsletter">
          <NewsletterForm variant="footer" placeholder="you@example.com" buttonLabel="Subscribe" showBenefits={false} />
        </div>
        <PolicyBar />
        <div className="footer-meta">
          <span>© 2026 EYE. All rights reserved.</span>
          <a href="mailto:teckennedy177@gmail.com">Contact</a>
        </div>
      </footer>
      {showBackToTop && (
        <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
          <span aria-hidden="true">↑</span>
        </button>
      )}
      </div>
    </>
  );
}