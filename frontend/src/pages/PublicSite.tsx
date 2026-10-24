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
import { Pagination } from "../components/Pagination";
import { SponsoredBadge } from "../components/SponsoredBadge";
import { outboundRel } from "../lib/monetization";
import { trackEvent } from "../lib/analytics";
import { MEMBERSHIP_ENABLED } from "../config";
import { fetchCommunityMembership, setCommunityMembership } from "../lib/adminApi";
import scholarshipCommunityArt from "../../../pics-1/Scholarship seekers.jpg";
import creativeCommunityArt from "../../../pics-1/Creative careers.jpg";
import firstJobCommunityArt from "../../../pics-1/First job circle.jpg";

type PublicSiteProps = {
  stories: Story[];
  openAdmin: () => void;
  isAdmin: boolean;
  justPublished: boolean;
};

const heroWords = ["signal", "clarity", "momentum", "opportunity"];
const PAGE_SIZE = 6;
const communityArt: Record<string, { src: string; alt: string; width: number; height: number }> = {
  "Scholarship seekers": {
    src: scholarshipCommunityArt,
    alt: "Students walking together on campus, representing a supportive scholarship-seeker community",
    width: 612,
    height: 323,
  },
  "Creative careers": {
    src: creativeCommunityArt,
    alt: "A busy creative studio with people collaborating across shared work tables",
    width: 500,
    height: 333,
  },
  "First job circle": {
    src: firstJobCommunityArt,
    alt: "Three early-career colleagues discussing work together and sharing guidance",
    width: 500,
    height: 333,
  },
};

export function PublicSite({ stories, openAdmin, isAdmin, justPublished }: PublicSiteProps) {
  const [isShrunk, setIsShrunk] = useState(false);
  const [activeNav, setActiveNav] = useState(() => {
    const hash = window.location.hash.slice(1);
    return ["stories", "opportunities", "communities", "about"].includes(hash) ? hash : "stories";
  });
  const [wordIndex, setWordIndex] = useState(0);
  const [prevWordIndex, setPrevWordIndex] = useState(0);
  // Ref mirrors the index so the timer reads the live value instead of a stale state closure.
  const wordIndexRef = useRef(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      setIsShrunk(window.scrollY > 32);
      const nearPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
      setShowBackToTop(window.scrollY > 600 && !nearPageEnd);
    };
    // passive so the page keeps scrolling smoothly; we never call preventDefault here.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = ["stories", "opportunities", "communities", "about"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    const updateActiveSection = () => {
      const activationPoint = window.innerHeight * 0.65;
      const currentSection = sections
        .filter((section) => section.getBoundingClientRect().top <= activationPoint)
        .at(-1);
      if (currentSection) setActiveNav(currentSection.id);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
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
  const [page, setPage] = useState(1);
  const [selectedStory, setSelectedStory] = useState<Story>();
  // <NewsletterForm /> owns its own state, so no newsletter state lives here.
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [communityCounts, setCommunityCounts] = useState<Record<string, number>>({});
  const [communityMessage, setCommunityMessage] = useState("");
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
  const totalPages = Math.max(1, Math.ceil(cardStories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStories = cardStories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = cardStories.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, cardStories.length);

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

  useEffect(() => {
    let cancelled = false;
    void Promise.all(communities.map(async (community) => ({
      name: community.name,
      membership: await fetchCommunityMembership(community.name),
    }))).then((results) => {
      if (cancelled) return;
      setJoinedCommunities(results.filter((item) => item.membership?.joined).map((item) => item.name));
      setCommunityCounts(Object.fromEntries(results.filter((item) => item.membership).map((item) => [item.name, item.membership!.members])));
    });
    return () => { cancelled = true; };
  }, []);

  const toggleCommunity = async (name: string, joined: boolean): Promise<boolean> => {
    setCommunityMessage("");
    const result = await setCommunityMembership(name, joined);
    if (!result) {
      setCommunityMessage("Community membership could not be saved. Please try again.");
      return false;
    }
    setJoinedCommunities((current) => result.joined
      ? current.includes(name) ? current : [...current, name]
      : current.filter((item) => item !== name));
    setCommunityCounts((current) => ({ ...current, [name]: result.members }));
    return true;
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
        <nav id="site-menu" className={menuOpen ? "main-nav is-open" : "main-nav"} 
        aria-label="Main navigation">
          <a className={activeNav === "stories" ? "active" : ""} 
          href="#stories" aria-current={activeNav === "stories" ? "location" : undefined} 
          onClick={() => { setActiveNav("stories"); setMenuOpen(false); }}>
            Stories
          </a>
          <a className={activeNav === "opportunities" ? "active" : ""} 
          href="#opportunities" aria-current={activeNav === "opportunities" ? "location" : undefined} 
          onClick={() => { setActiveNav("opportunities"); setMenuOpen(false); }}>Opportunities</a>
          <a className={activeNav === "communities" ? "active" : ""} 
          href="#communities" aria-current={activeNav === "communities" ? "location" : undefined} 
          onClick={() => { setActiveNav("communities"); setMenuOpen(false); }}>Communities</a>
          <a className={activeNav === "about" ? "active" : ""} 
          href="#about" aria-current={activeNav === "about" ? "location" : undefined} 
          onClick={() => { setActiveNav("about"); setMenuOpen(false); }}>About</a>
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
          <div className="hero-kicker"><span aria-hidden="true" /> For the next chapter</div>
          <h1>
            Find the{" "}
            <span className="hero-rotator" style={{visibility:"hidden"}}>
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
              Get the weekly brief <span aria-hidden="true">-&gt;</span>
            </button>
          </div>
          <div className="hero-proof" aria-label="What EYE covers">
            <span>Scholarships</span><span>Work</span><span>Ideas</span><span>Culture</span>
          </div>
          <div className="hero-scroll-hint" aria-hidden="true">
            <span className="hero-scroll-mouse"><span /></span>
            <span className="hero-scroll-label">Scroll</span>
          </div>
        </section>
        {isAdmin && justPublished && (
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
            <div className="feature-section-heading">
              <div className="eyebrow">Editor&apos;s pick</div>
              <h2>Start with a good story</h2>
              <p>A handpicked read to help you find your next step.</p>
            </div>
            <span className="section-number">01 / 04</span>
          </div>
          <article className="feature-story">
            <div className="feature-image">
              {featuredStory.image && (
                <img src={featuredStory.image} alt={featuredStory.title} fetchPriority="high" decoding="async" />
              )}
            </div>
            <div className="feature-content">
              <div className="feature-meta-row">
                <span className="feature-pick-label"><span aria-hidden="true">✦</span> Featured story</span>
                <span className="feature-category">{featuredStory.category}</span>
              </div>
              {featuredStory.sponsored && <SponsoredBadge />}
              <h3>{featuredStory.title}</h3>
              <p>{featuredStory.excerpt}</p>
              <div className="feature-story-meta">{featuredStory.meta}</div>
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
        <section className="latest-section" id="opportunities" aria-labelledby="latest-title">
          <div className="latest-toolbar">
            <div className="latest-heading">
              <div className="eyebrow">Freshly curated</div>
              <h2 id="latest-title">Worth your attention</h2>
              <p>Ideas, opportunities, and stories selected for your next step.</p>
            </div>
            <label className="search-field" htmlFor="story-search">
              <span className="sr-only">Search stories</span>
              <input
                id="story-search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search stories and topics"
              />
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6"/><path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </label>
          </div>
          <div className="category-tabs" role="group" aria-label="Filter stories by category">
            {availableCategories.map((item) => (
              <button
                className={
                  category === item ? "category-tab selected" : "category-tab"
                }
                key={item}
                type="button"
                onClick={() => { setCategory(item); setPage(1); }}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="latest-results" aria-live="polite">
            <span>{cardStories.length === 0 ? "No stories" : "Showing " + rangeStart + "-" + rangeEnd + " of " + cardStories.length + (cardStories.length === 1 ? " story" : " stories")}</span>
            {category !== "All stories" && <span className="latest-filter-label">in {category}</span>}
          </div>
          <div className="story-grid">
            {pageStories.map((story) => (
              <article className="story-card" key={story.title} onClick={() => setSelectedStory(story)}>
                <div className="story-card-image">
                  {story.image && <img src={story.image} alt="" loading="lazy" decoding="async" />}
                </div>
                <div className="story-card-content">
                  <span className="story-label">{story.category}</span>
                  {story.sponsored && <SponsoredBadge />}
                  <Link to={`/story/${story.id}`} className="story-link"><h3>{story.title}</h3></Link>
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
                  <small className="card-disclaimer">Info may change â€” verify on official source.</small>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            label="Stories pagination"
          />
          {cardStories.length === 0 && (
            <div className="latest-empty-state">
              <span className="latest-empty-icon" aria-hidden="true">⌕</span>
              <h3>No stories found</h3>
              <p>Try another search or choose a different category.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("All stories"); setPage(1); }}>Clear filters</button>
            </div>
          )}
        </section>
        </Reveal>
        <AdSlot placement="in-content" />
        <Reveal>
        <section className="communities-section" id="communities" aria-labelledby="communities-title">
          <div className="section-heading">
            <div><div className="eyebrow">Better, together</div><h2 id="communities-title">Find your community</h2></div>
            <span className="section-number">03 / 03</span>
          </div>
          <div className="communities-intro-row">
            <p className="communities-intro">Find people who understand your next step. Share useful leads, ask better questions, and build momentum together.</p>
            <div className="community-values" aria-label="Community benefits">
              <span>Share useful leads</span><span>Get support</span><span>Grow together</span>
            </div>
          </div>
          {communityMessage && <p className="review-error" role="alert">{communityMessage}</p>}
          <div className="community-grid">
            {communities.map((community) => {
              const isJoined = joinedCommunities.includes(community.name);
              return (
                <article className="community-card" key={community.name}>
                  <div className={`community-art ${community.accent}`}>
                    <img className="community-art-image" src={communityArt[community.name].src} alt={communityArt[community.name].alt} width={communityArt[community.name].width} height={communityArt[community.name].height} loading="lazy" decoding="async" />
                  </div>
                  <div className="community-card-body">
                    <span className="community-card-label"><span aria-hidden="true" /> EYE community</span>
                    <h3>{community.name}</h3>
                    <p>{community.description}</p>
                    <div className="community-footer">
                      <span className="community-member-count">
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="7.4" cy="6.1" r="2.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2.5 16c.3-2.7 2.2-4.3 4.9-4.3s4.6 1.6 4.9 4.3M13 4.3a2.4 2.4 0 0 1 0 4.6m1.2 2.7c1.9.4 3 1.8 3.3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        {communityCounts[community.name] ?? 0} members
                      </span>
                      {isJoined ? (
                        <button type="button" className="community-action-btn chat-open-btn" onClick={() => setActiveChat(community)}>Open chat <span aria-hidden="true">-&gt;</span></button>
                      ) : (
                        <button
                          className="community-action-btn"
                          aria-label={`Join ${community.name} and open chat`}
                          type="button"
                          onClick={async () => {
                            if (await toggleCommunity(community.name, true)) setActiveChat(community);
                          }}
                        >
                          Join community <span aria-hidden="true">-&gt;</span>
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
            void toggleCommunity(activeChat.name, false).then((left) => {
              if (left) setActiveChat(null);
            });
          }}
        />
      )}

      {selectedStory && <div className="client-modal-backdrop" role="presentation" 
      onClick={() => setSelectedStory(undefined)}><article className="story-reader" 
      role="dialog" aria-modal="true" aria-labelledby="story-reader-title" 
      onClick={(event) => event.stopPropagation()}><button ref={readerCloseRef} 
      className="reader-close" type="button" 
      onClick={() => setSelectedStory(undefined)} aria-label="Close story">X</button><div className="reader-image"
      style={{ backgroundImage: `url(${selectedStory.image})` }} role="img" 
      aria-label={selectedStory.title} /><div className="reader-content"><span 
      className="story-label">{selectedStory.category}</span>{selectedStory.sponsored && <SponsoredBadge />}<h2 id="story-reader-title">{selectedStory.title}</h2><div 
      className="story-meta">{selectedStory.meta}</div><p>{selectedStory.excerpt}</p>{selectedStory.content ? selectedStory.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${selectedStory.id ?? selectedStory.title}-${index}`}>{paragraph}</p>) :
      <p>Explore the details, deadlines, and next steps in this published story.</p>}{selectedStory.linkHeaderUrl && <img className="reader-linked-media" src={selectedStory.linkHeaderUrl} alt="Post attachment" loading="lazy" />}{selectedStory.audioUrl && 
      <audio className="reader-audio" controls preload="none" src={selectedStory.audioUrl}>Your browser does not support audio playback.</audio>}{selectedStory.videoUrl && <video className="reader-video" controls preload="metadata" src={selectedStory.videoUrl}>Your browser does not support video playback.</video>}{selectedStory.actionUrl && <a className="button button-dark" href={selectedStory.actionUrl} target="_blank" rel={outboundRel(selectedStory.actionUrl)} onClick={() => trackEvent("Outbound link", { url: selectedStory.actionUrl ?? "" })}>{selectedStory.actionLabel || "Open opportunity"} -&gt;</a>}</div></article></div>}
      <Reveal>
      <section className="newsletter-section" id="newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-card">
          <div className="newsletter-card-left">
            <div className="newsletter-eyebrow"><span className="newsletter-live-dot" aria-hidden="true" /> Weekly brief <span>Every Monday at 7am</span></div>
            <h2 id="newsletter-title">Get the opportunities that actually matter</h2>
            <p className="newsletter-card-copy">
              One curated email. Scholarships, internships, and culture  filtered for builders, not browsers.
              Join students and early career builders across Africa.
            </p>
            
            <NewsletterForm variant="card" buttonLabel="Join free" />
            <p className="newsletter-trust">
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path 
              d="M8 1.5 13 3.4v3.8c0 3.1-2.1 5.8-5 7.3-2.9-1.5-5-4.2-5-7.3V3.4L8 1.5Z" 
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path 
              d="m5.7 7.8 1.5 1.5 3.2-3.2" stroke="currentColor" strokeWidth="1.3" 
              strokeLinecap="round" strokeLinejoin="round"/></svg>
              No spam. Your email is stored securely. <Link to="/privacy">Privacy</Link><span className="newsletter-trust-separator" aria-hidden="true">·</span><a href="#stories">See past briefs</a>
            </p>
          </div>
          <div className="newsletter-card-right" aria-hidden="true">
            <div className="newsletter-preview">
              <div className="preview-header"><span className="preview-brand-mark" aria-hidden="true">E</span><span className="preview-subject">EYE WEEKLY <span>ISSUE 47</span></span><span className="preview-date">MON, 7:00 AM</span></div>
              <div className="preview-line" style={{ width: "92%" }} />
              <div className="preview-line" style={{ width: "86%" }} />
              <div className="preview-line" style={{ width: "78%" }} />
              <div className="preview-pill"><span aria-hidden="true">✦</span> 3 scholarships closing this week</div>
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
              <p><strong>Alozie Izuchukwu Johnkennedy</strong> â€” No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria</p>
              <p>Business: Sole proprietor (Nigeria) â€¢ Monâ€“Fri 9amâ€“5pm WAT</p>
              <p>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> â€¢ Phone: 07086193675 / +234 708 619 3675</p>
              <p className="footer-disclaimer">Images: <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License</a> â€¢ Fonts: <a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts (OFL)</a></p>
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
          <h3 className="footer-nav-title">The EYE weekly brief</h3>
          <p className="footer-newsletter-copy">A thoughtful note with scholarships, first-job leads, and culture worth your time.</p>
          <NewsletterForm variant="footer" placeholder="you@example.com" buttonLabel="Subscribe" showBenefits={false} />
        </div>
        <PolicyBar />
        <div className="footer-meta">
          <span>Â© 2026 EYE. All rights reserved.</span>
          <button className="footer-cookie-link" type="button" onClick={() => window.dispatchEvent(new Event("eye-open-cookie-settings"))}>Cookie preferences</button>
          <a href="mailto:teckennedy177@gmail.com">Contact</a>
        </div>
      </footer>
      {showBackToTop && (
        <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
          <span aria-hidden="true">â†‘</span>
        </button>
      )}
      </div>
    </>
  );
}
