import { SponsoredBadge } from "../SponsoredBadge";
import { outboundRel } from "../../lib/monetization";
import { trackEvent } from "../../lib/analytics";
import type { Story } from "../../types";

type StoryReaderModalProps = {
  story: Story;
  onClose: () => void;
};

// Reader modal: only used for seeded stories that have no server id.
export function StoryReaderModal({ story, onClose }: StoryReaderModalProps) {
  return (
    <div className="client-modal-backdrop" role="presentation" onClick={onClose}>
      <article className="story-reader" role="dialog" aria-modal="true" aria-labelledby="story-reader-title" onClick={(event) => event.stopPropagation()}>
        <button className="reader-close" type="button" onClick={onClose} aria-label="Close story">X</button>
        <div className="reader-image" style={{ backgroundImage: `url(${story.image})` }} role="img" aria-label={story.title} />
        <div className="reader-content">
          <span className="story-label">{story.category}</span>
          {story.sponsored && <SponsoredBadge />}
          <h2 id="story-reader-title">{story.title}</h2>
          <div className="story-meta">{story.meta}</div>
          <p>{story.excerpt}</p>
          {story.content
            ? story.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
                <p key={`${story.id ?? story.title}-${index}`}>{paragraph}</p>
              ))
            : <p>Explore the details, deadlines, and next steps in this published story.</p>}
          {story.actionUrl && (
            <a
              className="button button-dark"
              href={story.actionUrl}
              target="_blank"
              rel={outboundRel(story.actionUrl)}
              onClick={() => trackEvent("Outbound link", { url: story.actionUrl ?? "" })}
            >
              {story.actionLabel || "Open opportunity"} &rarr;
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
