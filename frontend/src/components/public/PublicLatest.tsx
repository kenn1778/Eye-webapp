import { Link } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";
import type { Story } from "../../types";
import { Pagination } from "../Pagination";
import { SponsoredBadge } from "../SponsoredBadge";
import { storyDate, storyViews } from "./publicShared";

type PublicLatestProps = {
  filtered: Story[];
  pageStories: Story[];
  currentPage: number;
  totalPages: number;
  popularStories: Story[];
  category: string;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  setCategory: (name: string) => void;
  setPage: Dispatch<SetStateAction<number>>;
  openStory: (story: Story) => void;
  setSelectedStory: (story: Story) => void;
  submitSearch: (value: string) => void;
  goToCategory: (name: string) => void;
  scrollToLatest: () => void;
};

export function PublicLatest({
  filtered,
  pageStories,
  currentPage,
  totalPages,
  popularStories,
  category,
  query,
  setQuery,
  setCategory,
  setPage,
  openStory,
  setSelectedStory,
  submitSearch,
  goToCategory,
  scrollToLatest,
}: PublicLatestProps) {
  return (
    <section className="bf-latest" id="latest" aria-labelledby="latest-title">
      <div className="bf-section-head">
        <h2 id="latest-title">Latest Blog Posts</h2>
        <button className="bf-viewall" type="button" onClick={() => goToCategory("All stories")}>
          View All <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
      <div className="bf-latest-layout">
        <div className="bf-latest-main">
          <p className="bf-latest-count" aria-live="polite">
            {filtered.length === 0
              ? "No stories match your filters"
              : `Showing ${pageStories.length} of ${filtered.length} ${filtered.length === 1 ? "story" : "stories"}${category !== "All stories" ? ` in ${category}` : ""}`}
          </p>
          <div className="bf-post-grid">
            {pageStories.map((story) => (
              <article className="bf-post-card" key={story.id ?? story.title}>
                <button className="bf-post-media" type="button" onClick={() => openStory(story)} aria-label={`Open ${story.title}`}>
                  {story.image && <img src={story.image} alt="" loading="lazy" decoding="async" />}
                  <span className="bf-chip">{story.category}</span>
                </button>
                <h3 className="bf-post-title">
                  <Link to={story.id ? `/story/${story.id}` : "#"} onClick={(event) => { if (!story.id) { event.preventDefault(); setSelectedStory(story); } }}>
                    {story.title}
                  </Link>
                </h3>
                <div className="bf-post-meta">
                  <span>{storyDate(story)}</span>
                  <span className="bf-views">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" /></svg>
                    {storyViews(story)}
                  </span>
                  {story.sponsored && <SponsoredBadge />}
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="bf-empty">
              <h3>No stories found</h3>
              <p>Try another search or choose a different category.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("All stories"); setPage(1); }}>Clear filters</button>
            </div>
          )}
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              scrollToLatest();
            }}
            label="Latest posts pagination"
          />
        </div>

        <aside className="bf-sidebar">
          <form
            className="bf-sidebar-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(query);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles..."
              aria-label="Search articles"
            />
            <button type="submit" aria-label="Search">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" /><path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </form>

          <div className="bf-popular">
            <div className="bf-side-head">
              <h3>Popular Posts</h3>
              <button className="bf-viewall" type="button" onClick={() => goToCategory("All stories")}>
                View All <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
            <div className="bf-popular-list">
              {popularStories.map((story) => (
                <button className="bf-popular-item" key={story.id ?? story.title} type="button" onClick={() => openStory(story)}>
                  <span className="bf-popular-thumb">
                    {story.image && <img src={story.image} alt="" loading="lazy" decoding="async" />}
                  </span>
                  <span className="bf-popular-body">
                    <span className="bf-popular-title">{story.title}</span>
                    <span className="bf-popular-meta">
                      {storyDate(story)}
                      <span className="bf-views">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" /></svg>
                        {storyViews(story)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
