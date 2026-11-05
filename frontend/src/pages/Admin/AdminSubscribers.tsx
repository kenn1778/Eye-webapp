import { useCallback, useEffect, useState } from "react";
import { Pagination } from "../../components/Pagination";

const PAGE_SIZE = 20;

type Subscriber = {
  id: string;
  email: string;
  confirmed: boolean;
  subscribedAt: string;
};

async function fetchSubscribers(limit: number, offset: number): Promise<{ items: Subscriber[]; total: number } | null> {
  const API_BASE = import.meta.env.VITE_PUBLIC_API_URL ?? "";
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API_BASE}/api/v1/admin/subscribers?${params}`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

export function AdminSubscribers() {
  const [items, setItems] = useState<{ items: Subscriber[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchSubscribers(PAGE_SIZE, (page - 1) * PAGE_SIZE);
    if (result) {
      setItems(result);
      setError("");
    } else {
      setError("Could not load subscribers. Check the API connection and try again.");
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { void load(); }, [load]);

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
                  </tr>
                </thead>
                <tbody>
                  {items!.items.map(s => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td>{s.confirmed ? "Yes" : "Pending"}</td>
                      <td>{new Date(s.subscribedAt).toLocaleString()}</td>
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
            />
          </>
        )}
      </div>
    </section>
  );
}
