import type { Story } from "../../types";
import type { AuthorProfile } from "../../lib/adminApi";
import { CategoryIcon, SocialIcon } from "./publicShared";

type PublicDiscoverProps = {
  featuredCategoryTiles: { name: string; count: number }[];
  trendingStories: Story[];
  author: AuthorProfile | null;
  authorName: string;
  authorFirstName: string;
  authorBio: string;
  authorEmail: string;
  goToCategory: (name: string) => void;
  openStory: (story: Story) => void;
};

export function PublicDiscover({
  featuredCategoryTiles,
  trendingStories,
  author,
  authorName,
  authorFirstName,
  authorBio,
  authorEmail,
  goToCategory,
  openStory,
}: PublicDiscoverProps) {
  return (
    <section className="bf-discover" id="discover" aria-label="Categories, trending and editor">
      <div className="bf-panel">
        <div className="bf-side-head">
          <h3>Featured Categories</h3>
          <button className="bf-viewall" type="button" onClick={() => goToCategory("All stories")}>
            View All <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
        <div className="bf-cat-tiles">
          {featuredCategoryTiles.map(({ name, count }) => (
            <button className="bf-cat-tile" key={name} type="button" onClick={() => goToCategory(name)}>
              <span className="bf-cat-icon"><CategoryIcon name={name} /></span>
              <span className="bf-cat-name">{name}</span>
              <span className="bf-cat-count">{count} {count === 1 ? "Post" : "Posts"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bf-panel">
        <div className="bf-side-head">
          <h3>Trending Articles</h3>
          <button className="bf-viewall" type="button" onClick={() => goToCategory("All stories")}>
            View All <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
        <ol className="bf-trending-list">
          {trendingStories.map((story, index) => (
            <li key={story.id ?? story.title}>
              <button type="button" onClick={() => openStory(story)}>
                <span className="bf-trending-rank" aria-hidden="true">{index + 1}</span>
                <span className="bf-trending-title">{story.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="bf-panel bf-author">
        <span className="bf-author-avatar" aria-hidden="true">
          {author?.avatarUrl ? <img src={author.avatarUrl} alt="" loading="lazy" /> : initials(authorName)}
        </span>
        <p className="bf-author-hi">Hi, I&apos;m {authorFirstName}</p>
        <p className="bf-author-bio">{authorBio}</p>
        <div className="bf-author-social">
          <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Exploor on X"><SocialIcon kind="x" /></a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Exploor on Instagram"><SocialIcon kind="instagram" /></a>
          <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="Exploor on LinkedIn"><SocialIcon kind="linkedin" /></a>
          <a href={`mailto:${authorEmail}`} aria-label="Email the editor"><SocialIcon kind="mail" /></a>
        </div>
      </div>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
