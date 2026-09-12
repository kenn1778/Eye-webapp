// AdminWorkspace - dashboard shell

import { startTransition, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AdminMetrics, Story } from "../../types";
import { emptyMetrics, seedAdminPosts, adminTabs } from "../../data/seedData";
import { Brand } from "../../components/Brand";
import { AdminEditor } from "../../components/AdminEditor";
import { AdminSectionView } from "./AdminSectionView";

// Props: closeAdmin = log out, onPublish = send new story to public site
type AdminWorkspaceProps = {
  closeAdmin: () => void;
  onPublish: (story: Story) => void;
};

// AdminWorkspace - the whole admin layout
export function AdminWorkspace({ closeAdmin, onPublish }: AdminWorkspaceProps) {
  // activeTab - which post filter is selected (All/Published/Draft/Scheduled)
  const [activeTab, setActiveTab] = useState("All posts");
  // query - search text for filtering posts
  const [query, setQuery] = useState("");
  // showEditor - whether the "New post" modal is open
  const [showEditor, setShowEditor] = useState(false);
  // saved - shows "Published!" toast briefly
  const [saved, setSaved] = useState(false);
  // activeSection - which sidebar page is open (Overview, Posts, etc.)
  const [activeSection, setActiveSection] = useState("Overview");
  // showLogoutDialog - confirm logout popup
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  // sidebarOpen - is the left nav visible? (collapsible on mobile)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // sidebarWidth - draggable width of sidebar (in pixels)
  const [sidebarWidth, setSidebarWidth] = useState(240);
  // isResizingSidebar - true while user is dragging the resize handle
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  // metrics - numbers for the 4 dashboard cards, fetched from API
  const [metrics, setMetrics] = useState<AdminMetrics>(emptyMetrics);
  // apiBaseUrl - optional backend URL from env var VITE_API_BASE_URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  // refreshMetrics - fetches latest dashboard numbers from backend
  const refreshMetrics = useCallback(async () => {
    if (!apiBaseUrl) return; // no backend configured -> skip
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/admin/metrics`, { credentials: "include" });
      if (!response.ok) return; // API error -> keep old numbers
      const nextMetrics = (await response.json()) as AdminMetrics;
      startTransition(() => setMetrics(nextMetrics)); // smooth React update
    } catch {
      // network down -> keep last known value
    }
  }, [apiBaseUrl]);

  // Poll metrics on mount and every 30 seconds
  useEffect(() => {
    void refreshMetrics(); // fetch immediately
    if (!apiBaseUrl) return;
    const interval = window.setInterval(() => void refreshMetrics(), 30000); // every 30s
    return () => window.clearInterval(interval); // cleanup on unmount
  }, [apiBaseUrl, refreshMetrics]);

  // visiblePosts - filtered list based on tab + search query
  const visiblePosts = useMemo(
    () =>
      seedAdminPosts.filter(
        (post) =>
          (activeTab === "All posts" || post.status === activeTab) && // match tab
          (!query.trim() ||
            `${post.title} ${post.type} ${post.author}`
              .toLowerCase()
              .includes(query.toLowerCase())), // match search text
      ),
    [activeTab, query],
  );

  // requestLogout - shows the confirm dialog
  const requestLogout = () => setShowLogoutDialog(true);

  // Handle dragging the sidebar resize handle
  useEffect(() => {
    if (!isResizingSidebar) return; // only when dragging
    const handlePointerMove = (event: PointerEvent) => {
      // clamp width between 190 and 360 px
      setSidebarWidth(Math.min(360, Math.max(190, event.clientX)));
    };
    const stopResize = () => setIsResizingSidebar(false); // stop on release
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };
  }, [isResizingSidebar]);

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
          <button className={`sidebar-item ${activeSection === "Overview" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Overview")}>
            <span className="sidebar-icon icon-overview" aria-hidden="true" />Overview
          </button>
          <button
            className="sidebar-item"
            type="button"
            onClick={() => { setActiveSection("New post"); setShowEditor(true) }}
          >
            <span className="sidebar-icon icon-new" aria-hidden="true" />New post
          </button>
          <button className={`sidebar-item ${activeSection === "Posts" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Posts")}>
            <span className="sidebar-icon icon-posts" aria-hidden="true" />Posts{" "}
            <span className="sidebar-count">24</span>
          </button>
          <button className={`sidebar-item ${activeSection === "Calendar" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Calendar")}>
            <span className="sidebar-icon icon-calendar" aria-hidden="true" />Calendar
          </button>
        </div>
        <div className="sidebar-section">
          <span className="sidebar-label">Library</span>
          <button className={`sidebar-item ${activeSection === "Media" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Media")}>
            <span className="sidebar-icon icon-media" aria-hidden="true" />Media
          </button>
          <button className={`sidebar-item ${activeSection === "Categories" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Categories")}>
            <span className="sidebar-icon icon-categories" aria-hidden="true" />Categories
          </button>
          <button className={`sidebar-item ${activeSection === "Communities" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Communities")}>
            <span className="sidebar-icon icon-communities" aria-hidden="true" />Communities
          </button>
          <button className={`sidebar-item ${activeSection === "Team" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Team")}>
            <span className="sidebar-icon icon-team" aria-hidden="true" />Team access
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className={`sidebar-item ${activeSection === "Settings" ? "selected" : ""}`} type="button" onClick={() => setActiveSection("Settings")}>
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
            <div className="metric-card">
              <span className="metric-label">Total posts</span>
              <strong>{metrics.totalPosts}</strong>
              <span className="metric-trend">Live count</span>
            </div>
            <div className="metric-card accent">
              <span className="metric-label">Published</span>
              <strong>{metrics.publishedPosts}</strong>
              <span className="metric-trend">Live count</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Scheduled</span>
              <strong>{metrics.scheduledPosts}</strong>
              <span className="metric-trend">Live count</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Total views</span>
              <strong>{metrics.totalViews}</strong>
              <span className="metric-trend">Live count</span>
            </div>
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