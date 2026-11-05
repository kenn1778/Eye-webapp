import { useCallback, useEffect, useState } from "react";
import { deleteAdminReview, fetchAdminReviews, updateAdminReview, type AdminReview } from "../../lib/adminApi";
import { Pagination } from "../../components/Pagination";

const PAGE_SIZE = 10;

/**
 * Public visitor reviews. Submissions publish straight away, so this list is
 * the control: an editor can see what readers see and delete anything spammy
 * or regrettable. Deleting removes it from the site permanently.
 */
export function AdminReviews() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchAdminReviews>> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<AdminReview> & { id: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminReviews(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    if (result) {
      setItems(result);
      setError("");
    } else {
      setError("Could not load reviews. Check the API connection and try again.");
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = items?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const remove = async (review: { id: string; name: string }) => {
    if (!window.confirm(`Delete the review from ${review.name}? This cannot be undone.`)) return;
    if (!(await deleteAdminReview(review.id))) {
      setError("Could not delete this review. Try again.");
      return;
    }
    await load();
  };

  const startEdit = (review: AdminReview) => {
    setEditing({ id: review.id, name: review.name, rating: review.rating, comment: review.comment, published: review.published });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await updateAdminReview(editing.id, {
      name: editing.name,
      rating: editing.rating,
      comment: editing.comment,
      published: editing.published,
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save changes. Try again.");
      return;
    }
    setEditing(null);
    await load();
  };

  const reviews = items?.items ?? [];

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Reader voices</div>
          <h1>Reviews</h1>
          <p>
            {total === 0
              ? "No visitor reviews yet."
              : `${total} review${total === 1 ? "" : "s"} shown in the public carousel.`}
          </p>
        </div>
        <div className="audit-pagination">
          <button className="button-secondary" type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      {error && <p className="field-help invalid" role="alert">{error}</p>}
      <div className="admin-panel section-panel">
        {loading ? (
          <p className="audit-message" role="status">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="audit-message">No reviews found.</p>
        ) : (
          <div className="message-list">
            {reviews.map((review) => (
              <article className="message-row is-handled" key={review.id}>
                <button
                  className="message-summary"
                  type="button"
                  aria-expanded={openId === review.id}
                  onClick={() => setOpenId(openId === review.id ? null : review.id)}
                >
                  <span className="message-dot handled" aria-hidden="true" />
                  <span className="message-who">
                    <strong>{review.name}</strong>
                    <small>{"★".repeat(Math.min(5, Math.max(1, review.rating)))}</small>
                  </span>
                  <span className="message-subject">{review.comment || "(no comment)"}</span>
                  <time className="muted-cell" dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </time>
                </button>
                {openId === review.id && (
                  <div className="message-body">
                    {editing && editing.id === review.id ? (
                      <form
                        className="review-edit-form"
                        onSubmit={(e) => { e.preventDefault(); void saveEdit(); }}
                      >
                        <label>
                          Name
                          <input value={editing.name ?? ""} onChange={(e) => setEditing({...editing, name: e.target.value})} />
                        </label>
                        <label>
                          Rating
                          <select value={editing.rating ?? 5} onChange={(e) => setEditing({...editing, rating: Number(e.target.value)})}>
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
                          </select>
                        </label>
                        <label>
                          Comment
                          <textarea value={editing.comment ?? ""} onChange={(e) => setEditing({...editing, comment: e.target.value})} />
                        </label>
                        <label>
                          Published
                          <input type="checkbox" checked={editing.published ?? true} onChange={(e) => setEditing({...editing, published: e.target.checked})} />
                        </label>
                        <div className="message-actions">
                          <button className="button-secondary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                          <button className="button-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p>{review.comment || "(no comment)"}</p>
                        <div className="message-actions">
                          <button className="button-secondary" type="button" onClick={() => startEdit(review)}>Edit review</button>
                          <button
                            className="button-secondary danger"
                            type="button"
                            onClick={() => void remove(review)}
                          >
                            Delete review
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {!loading && reviews.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              document.querySelector(".admin-content")?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            label="Reviews pagination"
            className="pagination-admin"
          />
        )}
      </div>
    </section>
  );
}
