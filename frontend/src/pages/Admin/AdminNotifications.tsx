import { useEffect, useRef, useState } from "react";
import type { AdminNotification } from "../../types";

type AdminNotificationsProps = {
  notifications: AdminNotification[];
  unread: number;
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
};

// Compact "time ago" label; falls back to a date for anything older than a week.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_GLYPH: Record<string, string> = {
  subscriber: "\u2709",
  chat: "\u25cc",
  system: "\u2022",
};

export function AdminNotifications({
  notifications,
  unread,
  onRead,
  onMarkAllRead,
}: AdminNotificationsProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape, matching the public-site menu behaviour.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="icon-button"
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">!</span>
        {unread > 0 && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="notif-mark-all" type="button" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <p className="notif-empty">You&apos;re all caught up.</p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  className={item.read ? "notif-item" : "notif-item unread"}
                  type="button"
                  onClick={() => onRead(item.id)}
                >
                  <span className={`notif-icon ${item.type}`} aria-hidden="true">
                    {TYPE_GLYPH[item.type] ?? TYPE_GLYPH.system}
                  </span>
                  <span className="notif-body">
                    <strong>{item.title}</strong>
                    {item.body && <small>{item.body}</small>}
                    <span className="notif-meta">
                      {item.actor ? `${item.actor} \u00b7 ` : ""}
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
