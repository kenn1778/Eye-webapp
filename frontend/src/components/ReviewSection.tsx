// ReviewSection - lets visitors rate and review the site.
//
// Frontend-preview behavior: reviews persist in this browser only, via
// localStorage. Nothing is sent anywhere and nothing is shared between
// visitors. A real review service will be connected with the backend.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createId, readJson, writeJson } from "../lib/storage";

type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
};

const STORAGE_KEY = "eye_visitor_reviews";
const MAX_STARS = 5;
/** How long the "review posted" confirmation stays on screen. */
const SUCCESS_MESSAGE_MS = 4000;

/**
 * Guards against hand-edited or outdated stored data.
 * Without this an object missing `name` would crash the card render below.
 */
function isReview(value: unknown): value is Review {
  if (typeof value !== "object" || value === null) return false;
  const review = value as Record<string, unknown>;
  return (
    typeof review.id === "string" &&
    typeof review.name === "string" &&
    typeof review.comment === "string" &&
    typeof review.date === "string" &&
    typeof review.rating === "number" &&
    review.rating >= 1 &&
    review.rating <= MAX_STARS
  );
}

/** Falls back to an empty list when storage is empty, blocked or corrupted. */
function loadReviews(): Review[] {
  return readJson<Review[]>([], STORAGE_KEY, (value): value is Review[] =>
    Array.isArray(value) && value.every(isReview),
  );
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "");
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Stars({ value }: { value: number }) {
  return (
    <span className="review-stars" aria-label={`${value} out of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => index + 1).map((star) => (
        <span key={star} className={star <= value ? "star is-on" : "star"} aria-hidden="true">&#9733;</span>
      ))}
    </span>
  );
}

export function ReviewSection() {
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // The confirmation clears itself; cancel it if the section unmounts first.
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    writeJson(STORAGE_KEY, reviews);
  }, [reviews]);

  useEffect(
    () => () => {
      if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    },
    [],
  );

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  /** @returns an error message, or null when the review is valid. */
  function validate(cleanName: string, cleanComment: string): string | null {
    if (!cleanName) return "Please add your name.";
    if (cleanName.length > 40) return "Name must be 40 characters or fewer.";
    if (rating < 1) return "Please pick a star rating.";
    if (cleanComment.length < 5) return "Please write a short review (at least 5 characters).";
    if (cleanComment.length > 400) return "Review must be 400 characters or fewer.";
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const sanitizedName = stripHtml(name.trim());
    const sanitizedComment = stripHtml(comment.trim());
    const cleanName = sanitizedName;
    const cleanComment = sanitizedComment;

    const validationError = validate(cleanName, cleanComment);
    if (validationError) {
      setError(validationError);
      return;
    }

    const review: Review = {
      id: createId("r"),
      name: cleanName,
      rating,
      comment: cleanComment,
      date: formatDate(),
    };

    setReviews((prev) => [review, ...prev]);
    setName("");
    setRating(0);
    setComment("");
    setError("");
    setSubmitted(true);

    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = null;
      setSubmitted(false);
    }, SUCCESS_MESSAGE_MS);
  };

  const stars = Array.from({ length: MAX_STARS }, (_, index) => index + 1);

  return (
    <section className="review-section" id="reviews" aria-labelledby="reviews-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">From the readers</div>
          <h2 id="reviews-title">What visitors say</h2>
        </div>
        <span className="section-number">04 / 04</span>
      </div>

      <div className="review-layout">
        <div className="review-summary">
          <div className="review-score">{reviews.length === 0 ? "—" : average.toFixed(1)}</div>
          <Stars value={Math.round(average)} />
          <p className="review-count">
            {reviews.length === 0
              ? "No reviews yet"
              : `${reviews.length} review${reviews.length === 1 ? "" : "s"} on this page`}
          </p>
          <p className="review-note">Reviews are stored in this browser for demo. A real review service will be connected with the backend.</p>
        </div>

        <form className="review-form" onSubmit={handleSubmit} aria-label="Leave a review">
          <h3>Leave a review</h3>
          <label className="review-field">
            <span>Your name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adjoa M." maxLength={40} />
          </label>
          <div className="review-field">
            <span>Your rating</span>
            <div className="star-picker" aria-label="Star rating">
              {stars.map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-pressed={rating === star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  className={`star-btn ${star <= (hoverRating || rating) ? "is-on" : ""}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onFocus={() => setHoverRating(star)}
                  onBlur={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  &#9733;
                </button>
              ))}
            </div>
          </div>
          <label className="review-field">
            <span>Your review</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you find useful?" rows={3} maxLength={400} />
          </label>
          {error && <p className="review-error" role="alert">{error}</p>}
          {submitted && <p className="review-success" role="status">Thanks &mdash; your review is now live on this page.</p>}
          <button className="button button-dark review-submit" type="submit">Post review <span aria-hidden="true">&rarr;</span></button>
        </form>
      </div>

      <div className="review-grid">
        {reviews.length === 0 && (
          <p className="review-empty">Be the first to leave a review above — it stays in this browser for the demo.</p>
        )}
        {reviews.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-card-top">
              <span className="review-avatar" aria-hidden="true">{review.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{review.name}</strong>
                <span className="review-date">{review.date}</span>
              </div>
              <Stars value={review.rating} />
            </div>
            <p>{review.comment}</p>
          </article>
        ))}
      </div>
    </section>
  );
}