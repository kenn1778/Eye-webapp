import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Story, Community } from "../types";
import { categories, communities } from "../data/seedData";
import { CommunityChat } from "../components/CommunityChat";
import { Reveal } from "../components/Reveal";
import { AdSlot } from "../components/AdSlot";
import { showEyeTransition } from "../components/EyeTransition";
import { MEMBERSHIP_ENABLED } from "../config";
import { PublicHeader, type NavDropdownItems } from "../components/public/PublicHeader";
import { PublicHero } from "../components/public/PublicHero";
import { PublicLatest } from "../components/public/PublicLatest";
import { PublicDiscover } from "../components/public/PublicDiscover";
import { PublicCommunities } from "../components/public/PublicCommunities";
import { PublicTrio } from "../components/public/PublicTrio";
import { PublicFooter } from "../components/public/PublicFooter";
import { StoryReaderModal } from "../components/public/StoryReaderModal";
import {
  PAGE_SIZE,
  CAROUSEL_SIZE,
  CAROUSEL_INTERVAL,
  TESTIMONIAL_INTERVAL,
  fallbackTestimonials,
} from "../components/public/publicShared";
import {
  fetchCommunityMembership,
  setCommunityMembership,
  fetchPublicCategories,
  fetchPopularPosts,
  fetchTrendingPosts,
  fetchAuthorProfile,
  fetchPublicReviews,
  submitPublicReview,
  type PublicCategory,
  type AuthorProfile,
  type PublicReview,
} from "../lib/adminApi";

type PublicSiteProps = {
  stories: Story[];
  openAdmin: () => void;
  isAdmin: boolean;
  justPublished: boolean;
};

export function PublicSite({ stories, openAdmin, isAdmin, justPublished }: PublicSiteProps) {
  const navigate = useNavigate();

  // ---------- header ----------
  const [isShrunk, setIsShrunk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // ---------- catalogue ----------
  const [category, setCategory] = useState("All stories");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedStory, setSelectedStory] = useState<Story>();

  // ---------- featured carousel ----------
  const featuredStories = useMemo(() => {
    const withImages = stories.filter((story) => story.image);
    const pool = withImages.length > 0 ? withImages : stories;
    return pool.slice(0, CAROUSEL_SIZE);
  }, [stories]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const carouselPausedRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);

  // ---------- remote content ----------
  const [remoteCategories, setRemoteCategories] = useState<PublicCategory[] | null>(null);
  const [popular, setPopular] = useState<Story[] | null>(null);
  const [trending, setTrending] = useState<Story[] | null>(null);
  const [author, setAuthor] = useState<AuthorProfile | null>(null);

  // ---------- reviews / testimonials ----------
  const [reviews, setReviews] = useState<PublicReview[]>(fallbackTestimonials);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const testimonialsPausedRef = useRef(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ---------- communities ----------
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [communityCounts, setCommunityCounts] = useState<Record<string, number>>({});
  const [communityMessage, setCommunityMessage] = useState("");
  const [activeChat, setActiveChat] = useState<Community | null>(null);

  // ---------- scroll effects ----------
  useEffect(() => {
    const onScroll = () => {
      setIsShrunk(window.scrollY > 24);
      const nearPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
      setShowBackToTop(window.scrollY > 600 && !nearPageEnd);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---------- remote data ----------
  useEffect(() => {
    let cancelled = false;
    void fetchPublicCategories().then((items) => {
      if (!cancelled && items && items.length > 0) setRemoteCategories(items);
    });
    void fetchPopularPosts(4).then((posts) => {
      if (!cancelled && posts && posts.length > 0) {
        setPopular(posts.map((post) => ({ ...post, meta: `Published ${new Date(post.updatedAt).toLocaleDateString()}`, views: post.viewCount ?? 0 }) as Story));
      }
    });
    void fetchTrendingPosts(5).then((posts) => {
      if (!cancelled && posts && posts.length > 0) {
        setTrending(posts.map((post) => ({ ...post, meta: `Published ${new Date(post.updatedAt).toLocaleDateString()}`, views: post.viewCount ?? 0 }) as Story));
      }
    });
    void fetchAuthorProfile().then((profile) => {
      if (!cancelled && profile) setAuthor(profile);
    });
    void fetchPublicReviews().then((items) => {
      if (!cancelled && items && items.length > 0) setReviews(items);
    });
    void Promise.all(
      communities.map(async (community) => ({ name: community.name, membership: await fetchCommunityMembership(community.name) })),
    ).then((results) => {
      if (cancelled) return;
      setJoinedCommunities(results.filter((item) => item.membership?.joined).map((item) => item.name));
      setCommunityCounts(Object.fromEntries(results.filter((item) => item.membership).map((item) => [item.name, item.membership!.members])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- carousel timers ----------
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

  useEffect(() => {
    if (reviews.length <= 1 || navigator.webdriver) return;
    const intervalId = window.setInterval(() => {
      if (testimonialsPausedRef.current) return;
      setTestimonialIndex((current) => (current + 1) % reviews.length);
    }, TESTIMONIAL_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, [reviews.length]);

  // ---------- filtering ----------
  const availableCategories = useMemo(
    () => [
      ...categories,
      ...stories
        .map((story) => story.category)
        .filter((item, index, items) => !categories.includes(item) && items.indexOf(item) === index),
    ],
    [stories],
  );

  const filtered = useMemo(
    () =>
      stories.filter((story) => {
        const text = `${story.title} ${story.excerpt} ${story.category}`.toLowerCase();
        return (
          (category === "All stories" || story.category === category) &&
          (!query.trim() || text.includes(query.toLowerCase()))
        );
      }),
    [category, query, stories],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStories = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const categoryCounts = useMemo<PublicCategory[]>(() => {
    if (remoteCategories && remoteCategories.length > 0) {
      return remoteCategories;
    }
    return availableCategories
      .filter((name) => name !== "All stories")
      .map((name) => ({ name, count: stories.filter((story) => story.category === name).length }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count);
  }, [remoteCategories, availableCategories, stories]);

  const popularStories = useMemo<Story[]>(() => {
    if (popular && popular.length > 0) return popular;
    const pool = stories.length > 1 ? stories.slice(1) : stories;
    return pool.slice(0, 4);
  }, [popular, stories]);

  const trendingStories = useMemo<Story[]>(() => {
    if (trending && trending.length > 0) return trending;
    return stories.slice(0, 5);
  }, [trending, stories]);

  const featuredCategoryTiles = useMemo(
    () => categoryCounts.filter(({ count }) => count > 0).slice(0, 4),
    [categoryCounts],
  );

  const activeTestimonial = reviews[testimonialIndex] ?? reviews[0];

  // ---------- interactions ----------
  const scrollToLatest = () => document.getElementById("latest")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToNewsletter = () => document.getElementById("newsletter")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goToCategory = (name: string) => {
    setCategory(name);
    setPage(1);
    setMenuOpen(false);
    setOpenDropdown(null);
    window.setTimeout(scrollToLatest, 60);
  };

  const openStory = (story: Story) => {
    if (story.id) {
      navigate(`/story/${story.id}`);
      return;
    }
    setSelectedStory(story);
  };

  const submitSearch = (value: string) => {
    setQuery(value);
    setPage(1);
    scrollToLatest();
  };

  useEffect(() => {
    setPage(1);
  }, [category, query]);

  // Close the mobile menu / dropdowns on Escape or outside click.
  useEffect(() => {
    if (!menuOpen && !openDropdown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setOpenDropdown(null);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setOpenDropdown(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen, openDropdown]);

  // Release the scroll lock when the menu closes; lock while it is open.
  useEffect(() => {
    document.body.classList.toggle("bf-menu-lock", menuOpen);
    return () => document.body.classList.remove("bf-menu-lock");
  }, [menuOpen]);

  // Close the mobile menu when the viewport grows past the breakpoint.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 961px)");
    const onChange = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveChat(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeChat]);

  useEffect(() => {
    if (!selectedStory) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStory(undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedStory]);

  const showFeatured = (index: number) => {
    if (featuredStories.length === 0) return;
    setFeaturedIndex(((index % featuredStories.length) + featuredStories.length) % featuredStories.length);
  };

  const onHeroTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };
  const onHeroTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const end = event.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    showFeatured(featuredIndex + (delta < 0 ? 1 : -1));
  };

  const toggleCommunity = async (name: string, joined: boolean): Promise<boolean> => {
    setCommunityMessage("");
    const result = await setCommunityMembership(name, joined);
    if (!result) {
      setCommunityMessage("Community membership could not be saved. Please try again.");
      return false;
    }
    setJoinedCommunities((current) =>
      result.joined ? (current.includes(name) ? current : [...current, name]) : current.filter((item) => item !== name),
    );
    setCommunityCounts((current) => ({ ...current, [name]: result.members }));
    return true;
  };

  const joinCommunity = async (community: Community) => {
    // The blinking eye covers the join request; the chat opens as it clears.
    showEyeTransition(1200);
    const joined = await toggleCommunity(community.name, true);
    if (joined) window.setTimeout(() => setActiveChat(community), 900);
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = reviewName.trim().replace(/<[^>]*>/g, "");
    const cleanComment = reviewComment.trim().replace(/<[^>]*>/g, "");
    if (!cleanName) return setReviewError("Please add your name.");
    if (reviewRating < 1) return setReviewError("Please pick a star rating.");
    if (cleanComment.length < 5) return setReviewError("Please write a short review (at least 5 characters).");
    if (cleanComment.length > 400) return setReviewError("Review must be 400 characters or fewer.");

    setReviewError("");
    setReviewSubmitting(true);
    const saved = await submitPublicReview({ name: cleanName, rating: reviewRating, comment: cleanComment });
    setReviewSubmitting(false);
    if (!saved) {
      setReviewError("Your review could not be saved. Please try again.");
      return;
    }
    setReviews((prev) => [saved, ...prev]);
    setTestimonialIndex(0);
    setReviewName("");
    setReviewRating(0);
    setReviewComment("");
    setReviewFormOpen(false);
    showEyeTransition(1500);
  };

  const navDropdownItems: NavDropdownItems = {
    categories: [
      ...featuredCategoryTiles.map(({ name }) => ({ label: name, action: () => goToCategory(name) })),
      { label: "All stories", action: () => goToCategory("All stories") },
    ],
    pages: [
      { label: "About the editor", action: () => document.getElementById("discover")?.scrollIntoView({ behavior: "smooth" }) },
      { label: "Newsletter", action: scrollToNewsletter },
      { label: "Privacy Policy", action: () => navigate("/privacy") },
      { label: "Terms of Service", action: () => navigate("/terms") },
      { label: "Cookie Policy", action: () => navigate("/cookies") },
      { label: "Admin workspace", action: openAdmin },
    ],
    ...(MEMBERSHIP_ENABLED
      ? {
          shop: [
            { label: "Membership", action: () => navigate("/pricing") },
            { label: "Refund policy", action: () => navigate("/refund") },
          ],
        }
      : {}),
  };

  const dropdownLabels: Record<string, string> = {
    categories: "Categories",
    pages: "Pages",
    ...(MEMBERSHIP_ENABLED ? { shop: "Shop" } : {}),
  };

  const authorName = author?.name ?? "Alozie Izuchukwu Johnkennedy";
  const authorFirstName = authorName.split(/\s+/)[2] ?? "there";
  const authorBio =
    author?.bio || "Software Engineer, builds web app and Writes about scholarships, first jobs, and building a career on your own terms.";
  const authorEmail = author?.email || "teckennedy177@gmail.com";

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to Content</a>
      <div className="site-shell">
        <PublicHeader
          headerRef={headerRef}
          isShrunk={isShrunk}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          query={query}
          setQuery={setQuery}
          navDropdownItems={navDropdownItems}
          dropdownLabels={dropdownLabels}
          scrollToLatest={scrollToLatest}
          scrollToNewsletter={scrollToNewsletter}
          scrollToContact={scrollToContact}
          submitSearch={submitSearch}
        />

        <main id="main-content" className="page-fade">
          {isAdmin && justPublished && (
            <section className="bf-published-notice" aria-live="polite">
              <span className="status-live">LIVE NOW</span>
              <strong>Your new post is visible to Readers.</strong>
              <button type="button" onClick={scrollToLatest}>View published story &rarr;</button>
            </section>
          )}

          <PublicHero
            featuredStories={featuredStories}
            featuredIndex={featuredIndex}
            showFeatured={showFeatured}
            onHeroTouchStart={onHeroTouchStart}
            onHeroTouchEnd={onHeroTouchEnd}
            carouselPausedRef={carouselPausedRef}
            openStory={openStory}
            setSelectedStory={setSelectedStory}
          />

          <AdSlot placement="leaderboard" />

          <Reveal>
            <PublicLatest
              filtered={filtered}
              pageStories={pageStories}
              currentPage={currentPage}
              totalPages={totalPages}
              popularStories={popularStories}
              category={category}
              query={query}
              setQuery={setQuery}
              setCategory={setCategory}
              setPage={setPage}
              openStory={openStory}
              setSelectedStory={setSelectedStory}
              submitSearch={submitSearch}
              goToCategory={goToCategory}
              scrollToLatest={scrollToLatest}
            />
          </Reveal>

          <Reveal>
            <PublicDiscover
              featuredCategoryTiles={featuredCategoryTiles}
              trendingStories={trendingStories}
              author={author}
              authorName={authorName}
              authorFirstName={authorFirstName}
              authorBio={authorBio}
              authorEmail={authorEmail}
              goToCategory={goToCategory}
              openStory={openStory}
            />
          </Reveal>

          <Reveal>
            <PublicCommunities
              communities={communities}
              joinedCommunities={joinedCommunities}
              communityCounts={communityCounts}
              communityMessage={communityMessage}
              joinCommunity={joinCommunity}
              setActiveChat={setActiveChat}
            />
          </Reveal>

          <AdSlot placement="in-content" />

          <Reveal>
            <PublicTrio
              reviews={reviews}
              testimonialIndex={testimonialIndex}
              setTestimonialIndex={setTestimonialIndex}
              activeTestimonial={activeTestimonial}
              testimonialsPausedRef={testimonialsPausedRef}
              reviewFormOpen={reviewFormOpen}
              setReviewFormOpen={setReviewFormOpen}
              reviewName={reviewName}
              setReviewName={setReviewName}
              reviewRating={reviewRating}
              setReviewRating={setReviewRating}
              reviewHover={reviewHover}
              setReviewHover={setReviewHover}
              reviewComment={reviewComment}
              setReviewComment={setReviewComment}
              reviewError={reviewError}
              reviewSubmitting={reviewSubmitting}
              submitReview={submitReview}
            />
          </Reveal>
        </main>

        <PublicFooter
          authorEmail={authorEmail}
          featuredCategoryTiles={featuredCategoryTiles}
          goToCategory={goToCategory}
          scrollToLatest={scrollToLatest}
          scrollToContact={scrollToContact}
        />

        {showBackToTop && (
          <button className="bf-back-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
            <span aria-hidden="true">&uarr;</span>
          </button>
        )}
      </div>

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

      {selectedStory && <StoryReaderModal story={selectedStory} onClose={() => setSelectedStory(undefined)} />}
    </>
  );
}
