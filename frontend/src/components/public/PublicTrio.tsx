import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PublicReview } from "../../lib/adminApi";
import { NewsletterForm } from "../NewsletterForm";
import { initials } from "./publicShared";

type PublicTrioProps = {
  reviews: PublicReview[];
  testimonialIndex: number;
  setTestimonialIndex: Dispatch<SetStateAction<number>>;
  activeTestimonial: PublicReview | undefined;
  testimonialsPausedRef: MutableRefObject<boolean>;
  reviewFormOpen: boolean;
  setReviewFormOpen: Dispatch<SetStateAction<boolean>>;
  reviewName: string;
  setReviewName: Dispatch<SetStateAction<string>>;
  reviewRating: number;
  setReviewRating: Dispatch<SetStateAction<number>>;
  reviewHover: number;
  setReviewHover: Dispatch<SetStateAction<number>>;
  reviewComment: string;
  setReviewComment: Dispatch<SetStateAction<string>>;
  reviewError: string;
  reviewSubmitting: boolean;
  submitReview: (event: React.FormEvent) => void;
};

export function PublicTrio({
  reviews,
  testimonialIndex,
  setTestimonialIndex,
  activeTestimonial,
  testimonialsPausedRef,
  reviewFormOpen,
  setReviewFormOpen,
  reviewName,
  setReviewName,
  reviewRating,
  setReviewRating,
  reviewHover,
  setReviewHover,
  reviewComment,
  setReviewComment,
  reviewError,
  reviewSubmitting,
  submitReview,
}: PublicTrioProps) {
  return (
    <section className="bf-trio" aria-label="Newsletter, reader voices and Instagram">
      <div className="bf-panel bf-newsletter" id="newsletter">
        <h3 className="bf-panel-kicker">Newsletter</h3>
        <p className="bf-panel-title">Stay Updated with Our Latest Blogs</p>
        <p className="bf-panel-copy">Get tips, trends, and inspiration straight to your inbox.</p>
        <NewsletterForm variant="card" placeholder="Enter your email" buttonLabel="Subscribe" showBenefits={false} />
      </div>

      <div
        className="bf-panel bf-readers"
        onMouseEnter={() => { testimonialsPausedRef.current = true; }}
        onMouseLeave={() => { testimonialsPausedRef.current = false; }}
      >
        <h3 className="bf-panel-kicker">What Our Readers Say</h3>
        {activeTestimonial && (
          <figure className="bf-quote" key={activeTestimonial.id}>
            <span className="bf-quote-mark" aria-hidden="true">&ldquo;</span>
            <blockquote>{activeTestimonial.comment}</blockquote>
            <figcaption>
              <span className="bf-quote-avatar" aria-hidden="true">{initials(activeTestimonial.name)}</span>
              <span>&mdash; {activeTestimonial.name}</span>
            </figcaption>
          </figure>
        )}
        <div className="bf-quote-dots" role="group" aria-label="Reader testimonial selector">
          {reviews.map((review, index) => (
            <button
              key={review.id}
              type="button"
              className={index === testimonialIndex ? "bf-dot is-active" : "bf-dot"}
              aria-label={`Show testimonial ${index + 1} of ${reviews.length}`}
              aria-current={index === testimonialIndex}
              onClick={() => setTestimonialIndex(index)}
            />
          ))}
        </div>
        {reviewFormOpen ? (
          <form className="bf-review-form" onSubmit={submitReview}>
            <label>
              <span>Your name</span>
              <input type="text" value={reviewName} onChange={(event) => setReviewName(event.target.value)} placeholder="e.g. Adjoa M." maxLength={40} />
            </label>
            <div className="bf-star-picker" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={reviewRating === star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  className={star <= (reviewHover || reviewRating) ? "is-on" : ""}
                  onMouseEnter={() => setReviewHover(star)}
                  onMouseLeave={() => setReviewHover(0)}
                  onClick={() => setReviewRating(star)}
                >
                  &#9733;
                </button>
              ))}
            </div>
            <label>
              <span>Your review</span>
              <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="What did you find useful?" rows={3} maxLength={400} />
            </label>
            {reviewError && <p className="bf-form-error" role="alert">{reviewError}</p>}
            <div className="bf-review-actions">
              <button className="bf-btn" type="submit" disabled={reviewSubmitting}>{reviewSubmitting ? "Saving..." : "Post review"}</button>
              <button className="bf-btn bf-btn-ghost" type="button" onClick={() => setReviewFormOpen(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button className="bf-review-toggle" type="button" onClick={() => setReviewFormOpen(true)}>
            Leave a review <span aria-hidden="true">&rarr;</span>
          </button>
        )}
      </div>

      <div className="bf-panel bf-instagram">
        <div className="bf-side-head">
          <h3>Instagram</h3>
          <a className="bf-viewall" href="https://instagram.com" target="_blank" rel="noreferrer">
            Follow Us <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div className="bf-insta-grid">
          {[
            "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?auto=format&fit=crop&w=400&q=70",
            "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=400&q=70",
            "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=400&q=70",
            "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=400&q=70",
          ].map((src) => (
            <a key={src} href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Open Instagram post">
              <img src={src} alt="" loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
