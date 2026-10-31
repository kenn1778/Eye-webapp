import { Link } from "react-router-dom";
import type { Story } from "../../types";
import { SponsoredBadge } from "../SponsoredBadge";
import { storyDate, storyViews } from "./publicShared";

type PublicHeroProps = {
  featuredStories: Story[];
  featuredIndex: number;
  showFeatured: (index: number) => void;
  onHeroTouchStart: (event: React.TouchEvent) => void;
  onHeroTouchEnd: (event: React.TouchEvent) => void;
  carouselPausedRef: React.MutableRefObject<boolean>;
  openStory: (story: Story) => void;
  setSelectedStory: (story: Story) => void;
};

export function PublicHero({
  featuredStories,
  featuredIndex,
  showFeatured,
  onHeroTouchStart,
  onHeroTouchEnd,
  carouselPausedRef,
  openStory,
  setSelectedStory,
}: PublicHeroProps) {
  return (
    <section className="bf-hero" aria-label="Featured post">
      <div
        className="bf-hero-card"
        onMouseEnter={() => { carouselPausedRef.current = true; }}
        onMouseLeave={() => { carouselPausedRef.current = false; }}
        onTouchStart={onHeroTouchStart}
        onTouchEnd={onHeroTouchEnd}
      >
        {featuredStories.map((story, index) => (
          <article
            key={story.id ?? story.title}
            className={index === featuredIndex ? "bf-hero-slide is-active" : "bf-hero-slide"}
            aria-hidden={index !== featuredIndex}
          >
            <div className="bf-hero-media">
              {story.image && <img src={story.image} alt="" loading={index === 0 ? "eager" : "lazy"} decoding="async" />}
            </div>
            <div className="bf-hero-content">
              <span className="bf-eyebrow">Featured Post</span>
              <h1 className="bf-hero-title">
                <Link to={story.id ? `/story/${story.id}` : "#"} onClick={(event) => { if (!story.id) { event.preventDefault(); setSelectedStory(story); } }}>
                  {story.title}
                </Link>
              </h1>
              <p className="bf-hero-copy">{story.excerpt}</p>
              <div className="bf-hero-actions">
                <button className="bf-btn" type="button" onClick={() => openStory(story)}>
                  Read More <span aria-hidden="true">&rarr;</span>
                </button>
                <span className="bf-hero-meta">
                  <span>{storyDate(story)}</span>
                  <span className="bf-meta-dot" aria-hidden="true" />
                  <span className="bf-views">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" /></svg>
                    {storyViews(story)}
                  </span>
                  {story.sponsored && <SponsoredBadge />}
                </span>
              </div>
            </div>
          </article>
        ))}
        <div className="bf-hero-dots" role="group" aria-label="Featured post selector">
          {featuredStories.map((story, index) => (
            <button
              key={story.id ?? story.title}
              type="button"
              className={index === featuredIndex ? "bf-dot is-active" : "bf-dot"}
              aria-label={`Show featured post ${index + 1} of ${featuredStories.length}`}
              aria-current={index === featuredIndex}
              onClick={() => showFeatured(index)}
            />
          ))}
        </div>
      </div>
      <div className="bf-hero-arrows">
        <button className="bf-arrow" type="button" aria-label="Previous featured post" onClick={() => showFeatured(featuredIndex - 1)}>&larr;</button>
        <button className="bf-arrow" type="button" aria-label="Next featured post" onClick={() => showFeatured(featuredIndex + 1)}>&rarr;</button>
      </div>
    </section>
  );
}
