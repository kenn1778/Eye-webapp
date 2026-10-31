import { useCallback, useEffect, useState } from "react";
import {
  deleteAdminMessage,
  fetchAdminMessages,
  setMessageHandled,
} from "../../lib/adminApi";
import type { AdminContactMessage } from "../../types";
import { Pagination } from "../../components/Pagination";

const PAGE_SIZE = 10;
const FILTERS = [
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
  { key: "handled", label: "Handled" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/**
 * Inbox for the public contact form. Messages arrive unhandled; the editor
 * marks them handled after replying by email, or deletes spam outright.
 */
export function AdminMessages() {
  const [filter, setFilter] = useState<FilterKey>("unread");
  const [messages, setMessages] = useState<AdminContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const handled = filter === "unread" ? false : filter === "handled" ? true : undefined;
    const result = await fetchAdminMessages(PAGE_SIZE, (page - 1) * PAGE_SIZE, handled);
    if (result) {
      setMessages(result.items);
      setTotal(result.total);
      setUnread(result.unread);
      setError("");
    } else {
      setError("Could not load messages. Check the API connection and try again.");
    }
    setLoading(false);
  }, [filter, page]);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleHandled = async (message: AdminContactMessage) => {
    const next = !message.handled;
    const previous = messages;
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, handled: next } : item)),
    );
    setUnread((count) => Math.max(0, count + (next ? -1 : 1)));
    if (!(await setMessageHandled(message.id, next))) {
      setMessages(previous);
      setUnread((count) => count + (next ? 1 : -1));
      setError("Could not update this message. Try again.");
    }
  };

  const remove = async (message: AdminContactMessage) => {
    if (!window.confirm(`Delete the message from ${message.name}? This cannot be undone.`)) return;
    if (!(await deleteAdminMessage(message.id))) {
      setError("Could not delete this message. Try again.");
      return;
    }
    await load();
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Reader inbox</div>
          <h1>Messages</h1>
          <p>
            {unread === 0
              ? "Every contact message has been handled."
              : `${unread} message${unread === 1 ? "" : "s"} waiting for a reply.`}
          </p>
        </div>
        <div className="audit-pagination">
          <button className="button-secondary" type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>
      <div className="workspace-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Filter messages">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? "admin-tab active" : "admin-tab"}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => {
                setFilter(item.key);
                setPage(1);
                setLoading(true);
              }}
            >
              {item.label}
              {item.key === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="field-help invalid" role="alert">{error}</p>}
      <div className="admin-panel section-panel">
        {loading ? (
          <p className="audit-message" role="status">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="audit-message">No {filter === "all" ? "" : filter} messages found.</p>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <article
                className={`message-row ${message.handled ? "is-handled" : "is-unread"}`}
                key={message.id}
              >
                <button
                  className="message-summary"
                  type="button"
                  aria-expanded={openId === message.id}
                  onClick={() => setOpenId(openId === message.id ? null : message.id)}
                >
                  <span className={`message-dot ${message.handled ? "handled" : "unread"}`} aria-hidden="true" />
                  <span className="message-who">
                    <strong>{message.name}</strong>
                    <small>{message.email}</small>
                  </span>
                  <span className="message-subject">{message.subject || "(no subject)"}</span>
                  <time className="muted-cell" dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleDateString()}
                  </time>
                </button>
                {openId === message.id && (
                  <div className="message-body">
                    <p>{message.message}</p>
                    <div className="message-actions">
                      <a className="button-secondary" href={`mailto:${message.email}?subject=Re: ${encodeURIComponent(message.subject || "your message")}`}>
                        Reply by email
                      </a>
                      <button className="button-secondary" type="button" onClick={() => void toggleHandled(message)}>
                        {message.handled ? "Mark unread" : "Mark handled"}
                      </button>
                      <button className="button-secondary danger" type="button" onClick={() => void remove(message)}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {!loading && messages.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              document.querySelector(".admin-content")?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            label="Messages pagination"
            className="pagination-admin"
          />
        )}
      </div>
    </section>
  );
}
