import { startTransition, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AdminInsights, AdminMetrics, AdminNotification, ActivityPoint, Story } from "../../types";
import { emptyMetrics, adminTabs } from "../../data/seedData";
import { Brand } from "../../components/Brand";
import { ThemeToggle } from "../../components/ThemeToggle";
import { AdminEditor } from "../../components/AdminEditor";
import { AdminSectionView } from "./AdminSectionView";
import { AdminNotifications } from "./AdminNotifications";
import { AdminActivityChart } from "./AdminActivityChart";
import {
  fetchActivity,
  fetchInsights,
  fetchMetrics,
  fetchNotifications,
  fetchPosts,
  fetchAdminProfile,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../lib/adminApi";

const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 360;
const DEFAULT_SIDEBAR_WIDTH = 240;

const POLL_INTERVAL_MS = 30_000;
const RECENT_POSTS_LIMIT = 5;
const ACTIVITY_DAYS = 14;

const METRIC_CARDS: ReadonlyArray<{ label: string; value: keyof AdminMetrics; accent?: boolean }> = [
  { label: "Subscribers", value: "subscribers", accent: true },
  { label: "Post views", value: "views" },
  { label: "Posts", value: "posts" },
  { label: "Messages", value: "messages" },
  { label: "Chat messages", value: "chatMessages" },
  { label: "Unread alerts", value: "unreadNotifications" },
];

type AdminWorkspaceProps = {
  closeAdmin: () => void;
  onPublish: (story: Story) => Promise<boolean>;
};

export function AdminWorkspace({ closeAdmin, onPublish }: AdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("All posts");
  const [query, setQuery] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("Overview");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  // On phones the sidebar is an off-canvas drawer, so start it closed.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 761px)").matches;
  });
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  // Keep the drawer closed on phones (<=760px), where it becomes an off-canvas panel.
  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const syncDrawer = () => {
      if (mobileQuery.matches) {
        setSidebarOpen(false);
      }
    };
    syncDrawer();
    mobileQuery.addEventListener("change", syncDrawer);
    return () => mobileQuery.removeEventListener("change", syncDrawer);
  }, []);
  const [metrics, setMetrics] = useState<AdminMetrics>(emptyMetrics);
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [savedPosts, setSavedPosts] = useState<Awaited<ReturnType<typeof fetchPosts>>>(null);
  const [adminName, setAdminName] = useState("Administrator");

  const refresh = useCallback(async () => {
    const [nextMetrics, nextInsights, nextActivity, nextNotifications, nextPosts, profile] = await Promise.all([
      fetchMetrics(),
      fetchInsights(),
      fetchActivity(ACTIVITY_DAYS),
      fetchNotifications(20),
      fetchPosts("", 20, 0),
      fetchAdminProfile(),
    ]);

    // Low priority so a background refresh never blocks typing or clicks.
    startTransition(() => {
      if (nextMetrics) setMetrics(nextMetrics);
      if (nextInsights) setInsights(nextInsights);
      if (nextActivity) setActivity(nextActivity);
      if (nextPosts) setSavedPosts(nextPosts);
      if (profile) setAdminName(profile.name);
      if (nextNotifications) {
        setNotifications(nextNotifications.notifications);
        setUnread(nextNotifications.unread);
      }
    });
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const handleReadNotification = useCallback(
    (id: string) => {
      const target = notifications.find((item) => item.id === id);
      if (target && !target.read) setUnread((count) => Math.max(0, count - 1));
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      void markNotificationRead(id);
    },
    [notifications],
  );

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnread(0);
    void markAllNotificationsRead();
  }, []);

  const visiblePosts = useMemo(
    () =>
      (savedPosts?.items ?? []).filter(
        (post) =>
          (activeTab === "All posts" || post.status === activeTab.toLowerCase()) &&
          (!query.trim() ||
            `${post.title} ${post.category}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [activeTab, query, savedPosts],
  );

  // On phones, picking a section should also close the drawer so the panel shows.
  const selectSection = (section: string) => {
    setActiveSection(section);
    if (window.matchMedia("(max-width: 760px)").matches) setSidebarOpen(false);
  };
  const requestLogout = () => setShowLogoutDialog(true);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, event.clientX)));
    };
    const stopResize = () => setIsResizingSidebar(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [isResizingSidebar]);

  // Width lives in a CSS variable so the stylesheet owns the layout maths.
  return (
    <div className={`admin-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${isResizingSidebar ? "sidebar-resizing" : ""}`} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      {sidebarOpen && <button className="sidebar-overlay" type="button" aria-label="Close admin navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className="admin-sidebar">
          <button className="sidebar-resize-handle" type="button" aria-label="Resize admin navigation" onPointerDown={() => setIsResizingSidebar(true)} />
        <div className="admin-brand">
          <Brand />
          <span className="workspace-label">WORKSPACE</span>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">Publish</span>
          <button className={`sidebar-item ${activeSection === "Overview" ? "selected" : ""}`} type="button" onClick={() => selectSection("Overview")}>
            <span className="sidebar-icon icon-overview" aria-hidden="true" />Overview
          </button>
          <button
            className="sidebar-item"
            type="button"
            onClick={() => { selectSection("New post"); setShowEditor(true) }}
          >
            <span className="sidebar-icon icon-new" aria-hidden="true" />New post
          </button>
          <button className={`sidebar-item ${activeSection === "Posts" ? "selected" : ""}`} type="button" onClick={() => selectSection("Posts")}>
            <span className="sidebar-icon icon-posts" aria-hidden="true" />Posts{" "}
            <span className="sidebar-count">{savedPosts?.total ?? 0}</span>
          </button>
          <button className={`sidebar-item ${activeSection === "Messages" ? "selected" : ""}`} type="button" onClick={() => selectSection("Messages")}>
            <span className="sidebar-icon icon-messages" aria-hidden="true" />Messages
            {metrics.unreadMessages > 0 && <span className="sidebar-count alert">{metrics.unreadMessages}</span>}
          </button>
          <button className={`sidebar-item ${activeSection === "Author profile" ? "selected" : ""}`} type="button" onClick={() => selectSection("Author profile")}>
            <span className="sidebar-icon icon-author" aria-hidden="true" />Author profile
          </button>
          <button className={`sidebar-item ${activeSection === "Calendar" ? "selected" : ""}`} type="button" onClick={() => selectSection("Calendar")}>
            <span className="sidebar-icon icon-calendar" aria-hidden="true" />Calendar
          </button>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">Library</span>
          <button className={`sidebar-item ${activeSection === "Media" ? "selected" : ""}`} type="button" onClick={() => selectSection("Media")}>
            <span className="sidebar-icon icon-media" aria-hidden="true" />Media
          </button>
          <button className={`sidebar-item ${activeSection === "Categories" ? "selected" : ""}`} type="button" onClick={() => selectSection("Categories")}>
            <span className="sidebar-icon icon-categories" aria-hidden="true" />Categories
          </button>
          <button className={`sidebar-item ${activeSection === "Communities" ? "selected" : ""}`} type="button" onClick={() => selectSection("Communities")}>
            <span className="sidebar-icon icon-communities" aria-hidden="true" />Communities
          </button>
          <button className={`sidebar-item ${activeSection === "Team" ? "selected" : ""}`} type="button" onClick={() => selectSection("Team")}>
            <span className="sidebar-icon icon-team" aria-hidden="true" />Team access
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className={`sidebar-item ${activeSection === "Audit" ? "selected" : ""}`} type="button" onClick={() => selectSection("Audit")}>
            <span className="sidebar-icon icon-calendar" aria-hidden="true" />Audit log
          </button>
          <button className={`sidebar-item ${activeSection === "Settings" ? "selected" : ""}`} type="button" onClick={() => selectSection("Settings")}>
            <span className="sidebar-icon icon-settings" aria-hidden="true" />Settings
          </button>
          <button className="profile-row" type="button" onClick={requestLogout} aria-label="Log out of admin workspace">
            <span className="avatar">{adminName.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{adminName}</strong>
              <small>Administrator</small>
            </span>
            <span className="profile-more">...</span>
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="menu-toggle" type="button" aria-label={sidebarOpen ? "Close admin navigation" : "Open admin navigation"} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><span /><span /><span /></button>
          <button className="back-public" type="button" onClick={closeAdmin}>
            &lt;- View public site
          </button>
          <div className="topbar-actions">
            <AdminNotifications
              notifications={notifications}
              unread={unread}
              onRead={handleReadNotification}
              onMarkAllRead={handleMarkAllRead}
            />
            <ThemeToggle variant="admin" />
            <button className="avatar avatar-top" type="button" onClick={requestLogout} aria-label="Log out of admin workspace">
              {adminName.slice(0, 2).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="admin-content">
          {/* Overview renders here; other sections go through AdminSectionView. "New post" is excluded since it just opens the editor. */}
          {activeSection !== "Overview" && activeSection !== "New post" && (
            <AdminSectionView section={activeSection} onNewPost={() => setShowEditor(true)} onProfileSaved={setAdminName} />
          )}
          {activeSection === "Overview" && (
            <>
          <div className="admin-heading">
            <div>
              <div className="eyebrow">Saturday, 12 September 2026</div>
              <h1>Good morning, {adminName}.</h1>
              <p>Here&apos;s what&apos;s moving across Expl00r today.</p>
            </div>
            <button
              className="admin-primary"
              type="button"
              onClick={() => setShowEditor(true)}
            >
              <span>+</span> New post
            </button>
          </div>
          <section className="metrics-grid">
            {METRIC_CARDS.map(({ label, value, accent }) => (
              <div key={value} className={accent ? "metric-card accent" : "metric-card"}>
                <span className="metric-label">{label}</span>
                <strong>{metrics[value]}</strong>
                <span className="metric-trend">Live count</span>
              </div>
            ))}
          </section>
          <section className="admin-panel insights-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">App insights</div>
                <h2>Growth &amp; engagement</h2>
              </div>
              <span className="live-indicator">Live</span>
            </div>
            <div className="insights-grid">
              <div className="insight-tile">
                <span className="insight-label">Subscribers</span>
                <strong>{insights?.subscribers.total ?? metrics.subscribers}</strong>
                <span className="insight-delta">
                  {insights ? `+${insights.subscribers.last7Days} this week` : "Awaiting data"}
                </span>
              </div>
              <div className="insight-tile">
                <span className="insight-label">Chat messages</span>
                <strong>{insights?.chat.total ?? metrics.chatMessages}</strong>
                <span className="insight-delta">
                  {insights ? `+${insights.chat.last7Days} this week` : "Awaiting data"}
                </span>
              </div>
              <div className="insight-tile">
                <span className="insight-label">Post views</span>
                <strong>{insights?.views.total ?? metrics.views}</strong>
                <span className="insight-delta">All-time reads</span>
              </div>
              <div className="insight-tile">
                <span className="insight-label">Contact messages</span>
                <strong>{insights?.messages.total ?? metrics.messages}</strong>
                <span className="insight-delta">
                  {insights ? `+${insights.messages.last7Days} this week` : "Awaiting data"}
                </span>
              </div>
              <div className="insight-tile">
                <span className="insight-label">Reviews</span>
                <strong>{insights?.reviews.total ?? metrics.reviews}</strong>
                <span className="insight-delta">
                  {insights && insights.reviews.total > 0
                    ? `${insights.reviews.averageRating} avg rating`
                    : "No ratings yet"}
                </span>
              </div>
              <div className="insight-tile">
                <span className="insight-label">Top community</span>
                <strong className="insight-name">
                  {insights?.topCommunities[0]?.name ?? "\u2014"}
                </strong>
                <span className="insight-delta">
                  {insights?.topCommunities[0]
                    ? `${insights.topCommunities[0].messages} messages`
                    : "No messages yet"}
                </span>
              </div>
            </div>
            <div className="activity-block">
              <div className="activity-block-head">
                <div className="eyebrow">Activity flow</div>
                <span className="activity-range">Last {ACTIVITY_DAYS} days</span>
              </div>
              <AdminActivityChart series={activity} />
            </div>
          </section>
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Content desk</div>
                <h2>Recent posts</h2>
              </div>
              <button className="panel-link" type="button" onClick={() => selectSection("Posts")}>
                View all posts -&gt;
              </button>
            </div>
            <div className="post-toolbar">
              <div className="admin-tabs" role="tablist">
                {adminTabs.map((tab) => (
                  <button
                    className={
                      activeTab === tab ? "admin-tab active" : "admin-tab"
                    }
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    role="tab"
                    aria-selected={activeTab === tab}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <label className="admin-search">
                <span aria-hidden="true">?</span>
                <span className="sr-only">Search posts</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search posts"
                />
              </label>
            </div>
            <div className="posts-table">
              <div className="table-row table-header">
                <span>Post</span>
                <span>Type</span>
                <span>Status</span>
                <span>Views</span>
                <span>Last updated</span>
                <span>Author</span>
                <span />
              </div>
              {visiblePosts.slice(0, RECENT_POSTS_LIMIT).map((post) => (
                <div className="table-row" key={post.id}>
                  <div className="post-title-cell">
                    <span
                      className={`post-thumb ${post.status}`}
                    />
                    <strong>{post.title}</strong>
                  </div>
                  <span className="muted-cell">{post.category}</span>
                  <span>
                    <span
                      className={`status-pill ${post.status}`}
                    >
                      {post.status[0].toUpperCase() + post.status.slice(1)}
                    </span>
                  </span>
                  <span className="muted-cell views-cell">{post.viewCount ?? 0}</span>
                  <span className="muted-cell">{new Date(post.updatedAt).toLocaleDateString()}</span>
                  <span className="muted-cell">{adminName}</span>
                  <button className="row-menu" type="button">
                    ...
                  </button>
                </div>
              ))}
            </div>
          </section>
            </>
          )}
        </main>
      </div>
      {showEditor && (
        <AdminEditor
          close={() => setShowEditor(false)}
          onPublish={async (story) => {
            const success = await onPublish(story);
            if (success) {
              setSaved(true);
              setShowEditor(false);
              void refresh();
            }
            return success;
          }}
        />
      )}
      {saved && (
        <div className="toast" role="status">
          Post saved successfully.
        </div>
      )}
      {showLogoutDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowLogoutDialog(false)}>
          <section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={(event) => event.stopPropagation()}>
            <div className="logout-icon">â†—</div>
            <div className="eyebrow">Admin session</div>
            <h2 id="logout-title">Log out of Expl00r?</h2>
            <p>Your publishing workspace will close. You can sign in again when you are ready.</p>
            <div className="logout-actions"><button className="button-secondary" type="button" onClick={() => setShowLogoutDialog(false)}>Stay signed in</button><button className="admin-primary" type="button" onClick={closeAdmin}>Log out</button></div>
          </section>
        </div>
      )}
    </div>
  );
}