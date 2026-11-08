import { useCallback, useEffect, useState } from "react";
import { Pagination } from "../../components/Pagination";
import {
  fetchAdminSubscribers,
  deleteAdminSubscriber,
  setAdminSubscriberConfirmed,
  confirmAllPendingSubscribers,
  type AdminSubscriber,
} from "../../lib/adminApi";

const PAGE_SIZE = 20;

export function AdminSubscribers() {
  const [items, setItems] = useState<{ items: AdminSubscriber[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

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
      setMessage("");
      await load();
    } else {
      setError("Failed to delete subscriber. Please try again.");
    }
    setDeletingId(null);
  };

  const handleConfirm = async (subscriber: AdminSubscriber) => {
    setSavingId(subscriber.id);
    setError("");
    setMessage("");
    const success = await setAdminSubscriberConfirmed(subscriber.id, true);
    if (success) {
      setMessage(`${subscriber.email} approved - they now receive newsletter emails.`);
      await load();
    } else {
      setError("Failed to approve this subscriber. Please try again.");
    }
    setSavingId(null);
  };

  const handleConfirmAll = async () => {
    const pending = items?.items.filter((s) => !s.confirmed).length ?? 0;
    if (!window.confirm(
      pending === 1
        ? "Approve the pending subscriber? This page covers the first 20 rows; older pending rows are approved too."
        : `Approve all ${pending} pending subscribers? This page covers the first 20 rows; older pending rows are approved too.`,
    )) return;
    setBulkSaving(true);
    setError("");
    setMessage("");
    const count = await confirmAllPendingSubscribers();
    if (count !== null) {
      setMessage(count === 0 ? "No pending subscribers - everyone is already approved." : `Approved ${count} subscriber${count === 1 ? "" : "s"}. They now receive newsletter emails.`);
      await load();
    } else {
      setError("Failed to approve all pending subscribers. Please try again.");
    }
    setBulkSaving(false);
  };

  const pendingOnPage = items?.items.filter((s) => !s.confirmed).length ?? 0;
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
          {pendingOnPage > 0 && (
            <button className="admin-primary" type="button" onClick={() => void handleConfirmAll()} disabled={bulkSaving}>
              {bulkSaving ? "Approving..." : `Approve all pending (${pendingOnPage})`}
            </button>
          )}
          <button className="button-secondary" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
      </div>
      {error && <p className="field-help invalid" role="alert">{error}</p>}
      {message && <p className="review-success" role="status">{message}</p>}
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
                    <th style={{ width: 170, textAlign: "right" }}>Actions</th>
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
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!s.confirmed && (
                          <button
                            className="button-secondary subscriber-approve"
                            type="button"
                            onClick={() => void handleConfirm(s)}
                            disabled={savingId === s.id || deletingId === s.id}
                          >
                            {savingId === s.id ? "Approving..." : "Approve"}
                          </button>
                        )}
                        <button
                          className="button-danger"
                          type="button"
                          onClick={() => void handleDelete(s)}
                          disabled={deletingId === s.id || savingId === s.id}
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
