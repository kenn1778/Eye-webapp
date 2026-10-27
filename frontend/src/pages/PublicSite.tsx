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
const CAROUSEL_SIZE = 4;
const CAROUSEL_INTERVAL = 6000;
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

  // Featured carousel: the newest stories lead the page, reference-style.
  const featuredStories = useMemo(() => {
    const withImages = stories.filter((story) => story.image);
    const pool = withImages.length > 0 ? withImages : stories;
    return pool.slice(0, CAROUSEL_SIZE);
  }, [stories]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const carouselPausedRef = useRef(false);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [featuredStories.length]);

  useEffect(() => {
    if (featuredStories.length <= 1 || navigator.webdriver) return;
    const intervalId = window.setInterval(() => {
      if (carouselPausedRef.current) return;
      setFeaturedIndex((current) => (current + 1) % featuredStories.length);
    }, CAROUSEL_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, [featuredStories.length]);

  const showFeatured = (index: number) => {
    if (featuredStories.length === 0) return;
    setFeaturedIndex(((index % featuredStories.length) + featuredStories.length) % featuredStories.length);
  };

  // The first story stays out of the grid so it is not duplicated right under the hero.
  const featuredStory = stories[0];
  // Identity check works because both lists hold the same story objects.
  const cardStories = filtered.filter((story) => story !== featuredStory);
  const totalPages = Math.max(1, Math.ceil(cardStories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStories = cardStories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = cardStories.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, cardStories.length);

  // Sidebar "popular" list: the stories right after the lead.
  const popularStories = useMemo(() => {
    const pool = stories.length > 1 ? stories.slice(1) : stories;
    return pool.slice(0, 4);
  }, [stories]);
  const trendingStories = useMemo(() => stories.slice(0, 5), [stories]);
  const categoryCounts = useMemo(
    () =>
      availableCategories.map((name) => ({
        name,
        count: name === "All stories" ? stories.length : stories.filter((story) => story.category === name).length,
      })),
    [availableCategories, stories],
  );

  const focusSearch = () => {
    document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => document.getElementById("story-search")?.focus({ preventScroll: true }), 450);
  };
  const scrollToNewsletter = () => document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth" });
  const goToCategory = (name: string) => {
    setCategory(name);
    setPage(1);
    document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setPage(1);
  }, [category, query]);

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
        <a className="brand-link header-brand" href="#top" onClick={() => setMenuOpen(false)}>
          <Brand />
          <span className="header-brand-text">
            <span className="header-brand-tagline">Scholarships, work &amp; culture</span>
          </span>
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
          <a className={activeNav === "stories" ? "active" : ""} href="#stories" aria-current={activeNav === "stories" ? "location" : undefined} onClick={() => { setActiveNav("stories"); setMenuOpen(false); }}>Stories</a>
          <a className={activeNav === "opportunities" ? "active" : ""} href="#opportunities" aria-current={activeNav === "opportunities" ? "location" : undefined} onClick={() => { setActiveNav("opportunities"); setMenuOpen(false); }}>Opportunities</a>
          <a className={activeNav === "communities" ? "active" : ""} href="#communities" aria-current={activeNav === "communities" ? "location" : undefined} onClick={() => { setActiveNav("communities"); setMenuOpen(false); }}>Communities</a>
          <a className={activeNav === "about" ? "active" : ""} href="#about" aria-current={activeNav === "about" ? "location" : undefined} onClick={() => { setActiveNav("about"); setMenuOpen(false); }}>About</a>
          {MEMBERSHIP_ENABLED && (
            <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          )}
          <button className="admin-link" type="button" onClick={() => { setMenuOpen(false); openAdmin(); }}>
            Admin workspace <span aria-hidden="true">-&gt;</span>
          </button>
        </nav>
        <div className="header-actions">
          <button className="header-search-btn" type="button" aria-label="Search stories" onClick={focusSearch}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" /><path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          <button className="header-subscribe-btn" type="button" onClick={scrollToNewsletter}>Subscribe</button>
          <button className="admin-link" type="button" onClick={() => openAdmin()}>
            <span className="admin-link-label">Admin workspace</span> <span aria-hidden="true">-&gt;</span>
          </button>
        </div>
      </header>
      <main id="main-content" className="page-fade">
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
            <button className="text-button" type="button" onClick={scrollToNewsletter}>
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
              <p>The reads leading this week, handpicked for your next step.</p>
            </div>
            <span className="section-number">01 / 04</span>
          </div>
          {featuredStories.length > 0 && (
            <div
              className="feature-carousel"
              onMouseEnter={() => { carouselPausedRef.current = true; }}
              onMouseLeave={() => { carouselPausedRef.current = false; }}
            >
              {featuredStories.map((story, index) => (
                <article
                  key={story.id ?? story.title}
                  className={index === featuredIndex ? "feature-slide is-active" : "feature-slide"}
                  aria-hidden={index !== featuredIndex}
                >
                  <div className="feature-slide-image">
                    {story.image && (
                      <img
                        src={story.image}
                        alt={story.title}
                        loading={index === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className="feature-slide-body">
                    <div className="feature-eyebrow">Featured story</div>
                    <h3>
                      <Link to={`/story/${story.id}`} className="feature-title-link">{story.title}</Link>
                    </h3>
                    <p className="feature-excerpt">{story.excerpt}</p>
                    <div className="feature-slide-actions">
                      {story.actionUrl ? (
                        <a
                          className="feature-read-btn"
                          href={story.actionUrl}
                          target="_blank"
                          rel={outboundRel(story.actionUrl)}
                          onClick={() => trackEvent("Outbound link", { url: story.actionUrl ?? "" })}
                        >
                          {story.actionLabel} <span aria-hidden="true">-&gt;</span>
                        </a>
                      ) : (
                        <button className="feature-read-btn" type="button" onClick={() => setSelectedStory(story)}>
                          Read the story <span aria-hidden="true">-&gt;</span>
                        </button>
                      )}
                      <div className="feature-slide-meta">
                        <span className="feature-category-chip">{story.category}</span>
                        <span>{story.meta}</span>
                        {story.sponsored && <SponsoredBadge />}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              <div className="feature-carousel-controls">
                <div className="feature-carousel-dots" role="group" aria-label="Featured story selector">
                  {featuredStories.map((story, index) => (
                    <button
                      key={story.id ?? story.title}
                      type="button"
                      className={index === featuredIndex ? "feature-dot is-active" : "feature-dot"}
                      aria-label={`Show featured story ${index + 1} of ${featuredStories.length}`}
                      aria-current={index === featuredIndex}
                      onClick={() => showFeatured(index)}
                    />
                  ))}
                </div>
                <div className="feature-carousel-arrows">
                  <button className="feature-arrow" type="button" aria-label="Previous story" onClick={() => showFeatured(featuredIndex - 1)}>&larr;</button>
                  <button className="feature-arrow" type="button" aria-label="Next story" onClick={() => showFeatured(featuredIndex + 1)}>&rarr;</button>
                </div>
              </div>
            </div>
          )}
        </section>
        </Reveal>
        <Reveal>
        <section className="latest-section" id="opportunities" aria-labelledby="latest-title">
          <div className="section-heading">
            <div className="latest-heading">
              <div className="eyebrow">Freshly curated</div>
              <h2 id="latest-title">Worth your attention</h2>
              <p>Ideas, opportunities, and stories selected for your next step.</p>
            </div>
            <span className="section-number">02 / 04</span>
          </div>
          <div className="latest-layout">
            <div className="latest-main">
              <div className="latest-toolbar">
                <div className="latest-results" aria-live="polite">
                  <span>{cardStories.length === 0 ? "No stories" : "Showing " + rangeStart + "-" + rangeEnd + " of " + cardStories.length + (cardStories.length === 1 ? " story" : " stories")}</span>
                  {category !== "All stories" && <span className="latest-filter-label">in {category}</span>}
                </div>
                <label className="search-field" htmlFor="story-search">
                  <span className="sr-only">Search stories</span>
                  <input
                    id="story-search"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                    placeholder="Search stories and topics"
                  />
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" /><path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </label>
              </div>
              <div className="category-tabs" role="group" aria-label="Filter stories by category">
                {availableCategories.map((item) => (
                  <button
                    className={category === item ? "category-tab selected" : "category-tab"}
                    key={item}
                    type="button"
                    onClick={() => { setCategory(item); setPage(1); }}
                    aria-pressed={category === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="story-grid">
                {pageStories.map((story) => (
                  <article className="story-card" key={story.title} onClick={() => setSelectedStory(story)}>
                    <div className="story-card-image">
                      {story.image && <img src={story.image} alt="" loading="lazy" decoding="async" />}
                      <span className="story-label">{story.category}</span>
                    </div>
                    <div className="story-card-content">
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
                      <small className="card-disclaimer">Info may change &mdash; verify on official source.</small>
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
                  <span className="latest-empty-icon" aria-hidden="true">&#8981;</span>
                  <h3>No stories found</h3>
                  <p>Try another search or choose a different category.</p>
                  <button type="button" onClick={() => { setQuery(""); setCategory("All stories"); setPage(1); }}>Clear filters</button>
                </div>
              )}
            </div>
            <aside className="latest-sidebar">
              <div className="sidebar-card">
                <h3 className="sidebar-card-title">Popular this week</h3>
                <div className="popular-list">
                  {popularStories.map((story) => (
                    <button className="popular-item" key={story.id ?? story.title} type="button" onClick={() => setSelectedStory(story)}>
                      <span className="popular-thumb">
                        {story.image && <img src={story.image} alt="" loading="lazy" decoding="async" />}
                      </span>
                      <span className="popular-body">
                        <span className="popular-title">{story.title}</span>
                        <span className="popular-meta">{story.category} &middot; {story.meta}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
        </Reveal>

        <AdSlot placement="in-content" />
        <Reveal>
        <section className="insight-band" id="insights" aria-labelledby="insights-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Explore by interest</div>
              <h2 id="insights-title">Find your next move</h2>
            </div>
            <span className="section-number">03 / 04</span>
          </div>
          <div className="insight-grid">
            <div className="insight-panel">
              <h3 className="insight-panel-title">
                Browse categories
                <button className="view-all-link" type="button" onClick={() => goToCategory("All stories")}>
                  All stories <span aria-hidden="true">-&gt;</span>
                </button>
              </h3>
              <div className="category-tiles">
                {categoryCounts.filter(({ name, count }) => name === "All stories" || count > 0).map(({ name, count }) => (
                  <button className="category-tile" key={name} type="button" onClick={() => goToCategory(name)}>
                    <span className="category-tile-name">{name}</span>
                    <span className="category-tile-count">{count} {count === 1 ? "story" : "stories"}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="insight-panel">
              <h3 className="insight-panel-title">Trending now</h3>
              <div className="trending-list">
                {trendingStories.map((story, index) => (
                  <button className="trending-item" key={story.id ?? story.title} type="button" onClick={() => setSelectedStory(story)}>
                    <span className="trending-rank" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="trending-body">
                      <span className="trending-title">{story.title}</span>
                      <span className="trending-meta">{story.category}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="author-card">
            <span className="author-card-avatar" aria-hidden="true">A</span>
            <div>
              <div className="author-card-name">Alozie Izuchukwu Johnkennedy</div>
              <div className="author-card-role">Founder and editor of EYE. Writes about scholarships, first jobs, and building a career on your own terms.</div>
              <a className="author-card-link" href="mailto:teckennedy177@gmail.com">Write to the editor <span aria-hidden="true">-&gt;</span></a>
            </div>
          </div>
        </section>
        </Reveal>
        <Reveal>
        <section className="communities-section" id="communities" aria-labelledby="communities-title">
          <div className="section-heading">
            <div><div className="eyebrow">Better, together</div><h2 id="communities-title">Find your community</h2></div>
            <span className="section-number">04 / 04</span>
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
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="7.4" cy="6.1" r="2.8" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 16c.3-2.7 2.2-4.3 4.9-4.3s4.6 1.6 4.9 4.3M13 4.3a2.4 2.4 0 0 1 0 4.6m1.2 2.7c1.9.4 3 1.8 3.3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
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

      {selectedStory && <div className="client-modal-backdrop" role="presentation" onClick={() => setSelectedStory(undefined)}><article className="story-reader" role="dialog" aria-modal="true" aria-labelledby="story-reader-title" onClick={(event) => event.stopPropagation()}><button ref={readerCloseRef} className="reader-close" type="button" onClick={() => setSelectedStory(undefined)} aria-label="Close story">X</button><div className="reader-image" style={{ backgroundImage: `url(${selectedStory.image})` }} role="img" aria-label={selectedStory.title} /><div className="reader-content"><span className="story-label">{selectedStory.category}</span>{selectedStory.sponsored && <SponsoredBadge />}<h2 id="story-reader-title">{selectedStory.title}</h2><div className="story-meta">{selectedStory.meta}</div><p>{selectedStory.excerpt}</p>{selectedStory.content ? selectedStory.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${selectedStory.id ?? selectedStory.title}-${index}`}>{paragraph}</p>) : <p>Explore the details, deadlines, and next steps in this published story.</p>}{selectedStory.linkHeaderUrl && <img className="reader-linked-media" src={selectedStory.linkHeaderUrl} alt="Post attachment" loading="lazy" />}{selectedStory.audioUrl && <audio className="reader-audio" controls preload="none" src={selectedStory.audioUrl}>Your browser does not support audio playback.</audio>}{selectedStory.videoUrl && <video className="reader-video" controls preload="metadata" src={selectedStory.videoUrl}>Your browser does not support video playback.</video>}{selectedStory.actionUrl && <a className="button button-dark" href={selectedStory.actionUrl} target="_blank" rel={outboundRel(selectedStory.actionUrl)} onClick={() => trackEvent("Outbound link", { url: selectedStory.actionUrl ?? "" })}>{selectedStory.actionLabel || "Open opportunity"} -&gt;</a>}</div></article></div>}
      <Reveal>
      <section className="newsletter-section" id="newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-card">
          <div className="newsletter-card-left">
            <div className="newsletter-eyebrow"><span className="newsletter-live-dot" aria-hidden="true" /> Weekly brief <span>Every Monday at 7am</span></div>
            <h2 id="newsletter-title">Get the opportunities that actually matter</h2>
            <p className="newsletter-card-copy">
              One curated email. Scholarships, internships, and culture filtered for builders, not browsers.
              Join students and early career builders across Africa.
            </p>
            <NewsletterForm variant="card" buttonLabel="Join free" />
          </div>
          <div className="newsletter-card-right" aria-hidden="true">
            <div className="newsletter-preview">
              <div className="preview-header"><span className="preview-brand-mark" aria-hidden="true">E</span><span className="preview-subject">EYE WEEKLY <span>ISSUE 47</span></span><span className="preview-date">MON, 7:00 AM</span></div>
              <div className="preview-line" style={{ width: "92%" }} />
              <div className="preview-line" style={{ width: "86%" }} />
              <div className="preview-line" style={{ width: "78%" }} />
              <div className="preview-pill"><span aria-hidden="true">&#10022;</span> 3 scholarships closing this week</div>
            </div>
          </div>
        </div>
      </section>
      </Reveal>

      <AdSlot placement="footer" />

      <footer className="site-footer" id="about">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <Brand />
            <p className="footer-brand-tagline">A useful publication for people in motion.</p>
            <details className="footer-disclosure">
              <summary className="footer-tagline">Business details</summary>
              <div className="business-details">
                <p><strong>Alozie Izuchukwu Johnkennedy</strong> &mdash; No. 14 Lawal Street, Alimosho, Akowonjo, Lagos State, Nigeria</p>
                <p>Business: Sole proprietor (Nigeria) &bull; Mon&ndash;Fri 9am&ndash;5pm WAT</p>
                <p>Email: <a href="mailto:teckennedy177@gmail.com">teckennedy177@gmail.com</a> &bull; Phone: 07086193675 / +234 708 619 3675</p>
                <p className="footer-disclaimer">Images: <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License</a> &bull; Fonts: <a href="https://fonts.google.com" target="_blank" rel="noreferrer">Google Fonts (OFL)</a></p>
              </div>
            </details>
            <div className="footer-social">
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="EYE on X">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="M12.6 1h2.2L9.9 6.9 15.7 15h-4.5l-3.5-4.6L3.6 15H1.4l5.3-6.3L1.1 1h4.6l3.2 4.2L12.6 1Zm-.8 12.7h1.2L4.9 2.2H3.6l8.2 11.5Z" /></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="EYE on Instagram">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="3.6" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" /><circle cx="11.6" cy="4.4" r=".9" fill="currentColor" /></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="EYE on LinkedIn">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor"><path d="M3.4 2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM2.2 6h2.4v8H2.2V6Zm4 0h2.3v1.1h.03c.32-.6 1.1-1.24 2.27-1.24 2.43 0 2.88 1.6 2.88 3.68V14h-2.4v-3.9c0-.93-.02-2.13-1.3-2.13-1.3 0-1.5 1.01-1.5 2.06V14H6.2V6Z" /></svg>
              </a>
              <a href="mailto:teckennedy177@gmail.com" aria-label="Email EYE">
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              </a>
            </div>
          </div>
          <nav className="footer-col" aria-label="Explore">
            <h3 className="footer-heading">Explore</h3>
            <a className="footer-link" href="#stories">Stories</a>
            <a className="footer-link" href="#opportunities">Opportunities</a>
            <a className="footer-link" href="#communities">Communities</a>
            <a className="footer-link" href="#newsletter">Newsletter</a>
            {MEMBERSHIP_ENABLED && <Link className="footer-link" to="/pricing">Pricing</Link>}
          </nav>
          <nav className="footer-col" aria-label="Categories">
            <h3 className="footer-heading">Categories</h3>
            {categoryCounts.filter(({ name }) => name !== "All stories").slice(0, 5).map(({ name }) => (
              <button className="footer-link footer-category-link" key={name} type="button" onClick={() => goToCategory(name)}>{name}</button>
            ))}
          </nav>
          <nav className="footer-col" aria-label="Support">
            <h3 className="footer-heading">Support</h3>
            <a className="footer-link" href="mailto:teckennedy177@gmail.com">Contact us</a>
            <a className="footer-link" href="mailto:teckennedy177@gmail.com">Advertise</a>
            <a className="footer-link" href="#newsletter">Subscribe</a>
            <button className="footer-link footer-category-link" type="button" onClick={() => window.dispatchEvent(new Event("eye-open-cookie-settings"))}>Cookie preferences</button>
          </nav>
          <div className="footer-col footer-newsletter-col">
            <h3 className="footer-heading">The weekly brief</h3>
            <p className="footer-newsletter-copy">Scholarships, first-job leads, and culture worth your time. Every Monday, 7am.</p>
            <NewsletterForm variant="footer" placeholder="you@example.com" buttonLabel="Subscribe" showBenefits={false} />
          </div>
        </div>
        <PolicyBar />
        <div className="footer-meta">
          <span>&copy; 2026 EYE. All rights reserved.</span>
          <a href="mailto:teckennedy177@gmail.com">Contact</a>
        </div>
      </footer>
      {showBackToTop && (
        <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
          <span aria-hidden="true">&uarr;</span>
        </button>
      )}
      </div>
    </>
  );
}
