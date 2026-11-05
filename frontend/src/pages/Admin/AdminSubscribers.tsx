import { useCallback, useEffect, useState } from "react";
import { Pagination } from "../../components/Pagination";
import {
  fetchAdminSubscribers,
  deleteAdminSubscriber,
  type AdminSubscriber,
} from "../../lib/adminApi";

const PAGE_SIZE = 20;

export function AdminSubscribers() {
  const [items, setItems] = useState<{ items: AdminSubscriber[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminSubscribers(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    if (result) {
      setItems(result);
      setError("");
    } else {
      setError("Could not load subscribers. Check the API connection and try again.");
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (subscriber: AdminSubscriber) => {
    if (!window.confirm(`Are you sure you want to remove ${subscriber.email} from subscribers?`)) return;
    setDeletingId(subscriber.id);
    const success = await deleteAdminSubscriber(subscriber.id);
    if (success) {
      await load();
    } else {
      setError("Failed to delete subscriber. Please try again.");
    }
    setDeletingId(null);
  };

  const total = items?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Audience</div>
          <h1>Subscribers</h1>
          <p>{total === 0 ? "No subscribers yet." : `${total} email subscriber${total === 1 ? "" : "s"} on record.`}</p>
        </div>
        <div className="audit-pagination">
          <button className="button-secondary" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
      </div>
      {error && <p className="field-help invalid" role="alert">{error}</p>}
      <div className="admin-panel section-panel">
        {loading ? (
          <p className="audit-message" role="status">Loading subscribers...</p>
        ) : (items?.items.length ?? 0) === 0 ? (
          <p className="audit-message">No subscribers found.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Confirmed</th>
                    <th>Subscribed</th>
                    <th style={{ width: 100, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items!.items.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.email}</strong></td>
                      <td>
                        <span className={s.confirmed ? "audit-result success" : "audit-result failure"}>
                          {s.confirmed ? "Confirmed" : "Pending"}
                        </span>
                      </td>
                      <td className="muted-cell">{new Date(s.subscribedAt).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="button-danger"
                          type="button"
                          onClick={() => void handleDelete(s)}
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(next) => { setPage(next); document.querySelector(".admin-content")?.scrollTo({ top: 0, behavior: "smooth" }); }}
              label="Subscribers pagination"
              className="pagination-admin"
              showFirstLast
            />
          </>
        )}
      </div>
    </section>
  );
}
