import { startTransition, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AdminMetrics, Story } from "../../types";
import { emptyMetrics, seedAdminPosts, adminTabs } from "../../data/seedData";
import { Brand } from "../../components/Brand";
import { AdminEditor } from "../../components/AdminEditor";
import { AdminSectionView } from "./AdminSectionView";

const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 360;
const DEFAULT_SIDEBAR_WIDTH = 240;

const METRICS_POLL_INTERVAL_MS = 30_000;

const METRICS_ENDPOINT = "/api/v1/admin/metrics";

const METRIC_CARDS: ReadonlyArray<{ label: string; value: keyof AdminMetrics; accent?: boolean }> = [
  { label: "Total posts", value: "totalPosts" },
  { label: "Published", value: "publishedPosts", accent: true },
  { label: "Scheduled", value: "scheduledPosts" },
  { label: "Total views", value: "totalViews" },
];

// Guard against a malformed payload so the cards never render NaN.
function isValidAdminMetrics(value: unknown): value is AdminMetrics {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ["totalPosts", "publishedPosts", "scheduledPosts", "totalViews"].every(
    (key) => typeof record[key] === "number" && Number.isFinite(record[key] as number),
  );
}

type AdminWorkspaceProps = {
  closeAdmin: () => void;
  onPublish: (story: Story) => void;
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
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  const refreshMetrics = useCallback(async () => {
    if (!apiBaseUrl) return;
    try {
      const response = await fetch(`${apiBaseUrl}${METRICS_ENDPOINT}`, { credentials: "include" });
      if (!response.ok) return;

      const payload: unknown = await response.json();
      if (!isValidAdminMetrics(payload)) return;

      // Low priority so a background refresh never blocks typing or clicks.
      startTransition(() => setMetrics(payload));
    } catch {
      // network down; keep the last known value
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshMetrics();
    if (!apiBaseUrl) return;
    const interval = window.setInterval(() => void refreshMetrics(), METRICS_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [apiBaseUrl, refreshMetrics]);

  const visiblePosts = useMemo(
    () =>
      seedAdminPosts.filter(
        (post) =>
          (activeTab === "All posts" || post.status === activeTab) &&
          (!query.trim() ||
            `${post.title} ${post.type} ${post.author}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [activeTab, query],
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
            <span className="sidebar-count">{seedAdminPosts.length}</span>
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
          <button className={`sidebar-item ${activeSection === "Settings" ? "selected" : ""}`} type="button" onClick={() => selectSection("Settings")}>
            <span className="sidebar-icon icon-settings" aria-hidden="true" />Settings
          </button>
          <button className="profile-row" type="button" onClick={requestLogout} aria-label="Log out of admin workspace">
            <span className="avatar">AO</span>
            <span>
              <strong>Amara Osei</strong>
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
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
            >
              !
            </button>
            <button className="avatar avatar-top" type="button" onClick={requestLogout} aria-label="Log out of admin workspace">
              AO
            </button>
          </div>
        </header>
        <main className="admin-content">
          {/* Overview renders here; other sections go through AdminSectionView. "New post" is excluded since it just opens the editor. */}
          {activeSection !== "Overview" && activeSection !== "New post" && (
            <AdminSectionView section={activeSection} onNewPost={() => setShowEditor(true)} />
          )}
          {activeSection === "Overview" && (
            <>
          <div className="admin-heading">
            <div>
              <div className="eyebrow">Saturday, 12 September 2026</div>
              <h1>Good morning, Amara.</h1>
              <p>Here&apos;s what&apos;s moving across EYE today.</p>
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
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Content desk</div>
                <h2>Recent posts</h2>
              </div>
              <button className="panel-link" type="button">
                View all -&gt;
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
                <span>Last updated</span>
                <span>Author</span>
                <span />
              </div>
              {visiblePosts.map((post) => (
                <div className="table-row" key={post.title}>
                  <div className="post-title-cell">
                    <span
                      className={`post-thumb ${post.status.toLowerCase()}`}
                    />
                    <strong>{post.title}</strong>
                  </div>
                  <span className="muted-cell">{post.type}</span>
                  <span>
                    <span
                      className={`status-pill ${post.status.toLowerCase()}`}
                    >
                      {post.status}
                    </span>
                  </span>
                  <span className="muted-cell">{post.updated}</span>
                  <span className="muted-cell">{post.author}</span>
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
          onPublish={(story) => {
            onPublish(story);
            setSaved(true);
            setShowEditor(false);
          }}
        />
      )}
      {saved && (
        <div className="toast" role="status">
          Published to the public site.
        </div>
      )}
      {showLogoutDialog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowLogoutDialog(false)}>
          <section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={(event) => event.stopPropagation()}>
            <div className="logout-icon">↗</div>
            <div className="eyebrow">Admin session</div>
            <h2 id="logout-title">Log out of EYE?</h2>
            <p>Your publishing workspace will close. You can sign in again when you are ready.</p>
            <div className="logout-actions"><button className="button-secondary" type="button" onClick={() => setShowLogoutDialog(false)}>Stay signed in</button><button className="admin-primary" type="button" onClick={closeAdmin}>Log out</button></div>
          </section>
        </div>
      )}
    </div>
  );
}