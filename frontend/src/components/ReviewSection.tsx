import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchPublicReviews, submitPublicReview } from "../lib/adminApi";

type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
};

const MAX_STARS = 5;
const SUCCESS_MESSAGE_MS = 4000;

function stripHtml(input: string): string {
  // eslint-disable-next-line no-control-regex -- intentional: strip ASCII control characters from email input
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // The confirmation clears itself; cancel it if the section unmounts first.
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicReviews().then((result) => {
      if (cancelled) return;
      if (result) setReviews(result.map((item) => ({ ...item, date: new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) })));
      else setError("Reviews could not be loaded. Please refresh and try again.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(
    () => () => {
      if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    },
    [],
  );

  // 0 when there are no reviews, so the summary score never renders as NaN.
  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  function validate(cleanName: string, cleanComment: string): string | null {
    if (!cleanName) return "Please add your name.";
    if (cleanName.length > 40) return "Name must be 40 characters or fewer.";
    if (rating < 1) return "Please pick a star rating.";
    if (cleanComment.length < 5) return "Please write a short review (at least 5 characters).";
    if (cleanComment.length > 400) return "Review must be 400 characters or fewer.";
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Clean the input before validating and storing; the card renders it as text.
    const sanitizedName = stripHtml(name.trim());
    const sanitizedComment = stripHtml(comment.trim());
    const cleanName = sanitizedName;
    const cleanComment = sanitizedComment;

    const validationError = validate(cleanName, cleanComment);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);
    const saved = await submitPublicReview({ name: cleanName, rating, comment: cleanComment });
    setSubmitting(false);
    if (!saved) {
      setError("Your review could not be saved. Please try again.");
      return;
    }
    const review: Review = {
      id: saved.id,
      name: saved.name,
      rating: saved.rating,
      comment: saved.comment,
      date: formatDate(),
    };
    setReviews((prev) => [review, ...prev]);
    setName("");
    setRating(0);
    setComment("");
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
          <div className="eyebrow">Reader feedback</div>
          <h2 id="reviews-title">What visitors say</h2>
          <p className="review-intro">Honest notes from people finding their next opportunity with EYE.</p>
        </div>
        <span className="section-number">04 / 04</span>
      </div>

      <div className="review-layout">
        <div className="review-summary">
          <div className="review-summary-top">
            <span className="review-summary-label">Average rating</span>
            <span className="review-summary-icon" aria-hidden="true">✦</span>
          </div>
          <div className="review-summary-score-row">
            <div className="review-score">{reviews.length === 0 ? "—" : average.toFixed(1)}</div>
            <div className="review-summary-detail">
              <Stars value={Math.round(average)} />
              <p className="review-count">
                {reviews.length === 0
                  ? "No reviews yet"
                  : `Based on ${reviews.length} reader review${reviews.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <p className="review-note">Your perspective helps the EYE community grow.</p>
        </div>

        <form className="review-form" onSubmit={handleSubmit} aria-label="Leave a review">
          <div className="review-form-heading">
            <div>
              <span className="review-form-kicker">Your experience</span>
              <h3>Leave a review</h3>
            </div>
            <span className="review-form-private">Shared with readers</span>
          </div>
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
          <button className="button button-dark review-submit" type="submit" disabled={loading || submitting}>{submitting ? "Saving..." : "Post review"} <span aria-hidden="true">&rarr;</span></button>
        </form>
      </div>

      <div className="review-grid">
        {reviews.length === 0 && (
          <p className="review-empty">{loading ? "Loading reviews..." : "Be the first to leave a review."}</p>
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