import { useEffect, useState } from "react";
import { fetchAuditLog, type AuditLogEntry } from "../../lib/adminApi";
import { communities } from "../../data/seedData";
import { AdminSettings } from "./AdminSettings";
import { AdminPosts } from "./AdminPosts";
import { AdminMedia } from "./AdminMedia";
import { AdminMessages } from "./AdminMessages";
import { AdminAuthorProfileEditor } from "./AdminAuthorProfile";

type AdminSectionViewProps = {
  section: string;
  onNewPost: () => void;
  displayName?: string;
  onProfileSaved?: (name: string) => void;
};

export function AdminSectionView({ section, onNewPost, onProfileSaved }: AdminSectionViewProps) {
  const [categoryName, setCategoryName] = useState("");
  const [categoriesList, setCategoriesList] = useState([
    "Scholarships",
    "Scholarship tips",
    "Work",
    "Culture",
  ]);

  const addCategory = () => {
    if (categoryName.trim() && !categoriesList.includes(categoryName.trim())) {
      setCategoriesList([...categoriesList, categoryName.trim()]);
      setCategoryName("");
    }
  };

  if (section === "Audit") {
    return <AuditLogView />;
  }

  // Team lives inside the Settings page.
  if (section === "Team") {
    return <AdminSettings onProfileSaved={onProfileSaved} />;
  }

  if (section === "Posts") {
    return <AdminPosts onNewPost={onNewPost} />;
  }

  if (section === "Messages") {
    return <AdminMessages />;
  }

  if (section === "Author profile") {
    return <AdminAuthorProfileEditor />;
  }

  if (section === "Calendar") {
    return (
      <section className="workspace-view"><div className="workspace-heading"><div><div className="eyebrow">Editorial planning</div><h1>Publishing calendar</h1><p>Keep deadlines and scheduled stories visible at a glance.</p></div><button className="admin-primary" type="button" onClick={onNewPost}>+ Schedule post</button></div><div className="calendar-layout"><div className="admin-panel calendar-panel"><div className="calendar-top"><button type="button">&lt;</button><strong>September 2026</strong><button type="button">&gt;</button></div><div className="calendar-grid">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span className="calendar-day-name" key={day}>{day}</span>)}{Array.from({ length: 35 }, (_, index) => <button className={index === 13 || index === 16 ? "calendar-date has-event" : "calendar-date"} type="button" key={index}>{index < 5 ? "" : index - 5}</button>)}</div></div><div className="admin-panel upcoming-panel"><div className="eyebrow">Up next</div><h2>Scheduled stories</h2><div className="upcoming-item"><span className="schedule-date">14<span>SEP</span></span><div><strong>Remote internships accepting applications now</strong><small>09:00 AM Â· Opportunities</small></div></div><div className="upcoming-item"><span className="schedule-date">17<span>SEP</span></span><div><strong>How to build a portfolio with no experience</strong><small>12:30 PM Â· Guide</small></div></div></div></div></section>
    );
  }

  if (section === "Media") {
    return <AdminMedia />;
  }

  if (section === "Categories") {
    return (
      <section className="workspace-view"><div className="workspace-heading"><div><div className="eyebrow">Content taxonomy</div><h1>Categories</h1><p>Keep the publication easy to browse and consistent to manage.</p></div></div><div className="admin-panel taxonomy-panel"><div className="taxonomy-add"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category name" /><button className="admin-primary" type="button" onClick={addCategory}>Add category</button></div><div className="category-list">{categoriesList.map((category) => <div className="category-row" key={category}><span className="category-symbol">#</span><strong>{category}</strong><span className="muted-cell">{category === "Scholarships" ? "8 posts" : category === "Work" ? "5 posts" : "3 posts"}</span><button className="row-menu" type="button">...</button></div>)}</div></div></section>
    );
  }

  if (section === "Communities") {
    return (
      <section className="workspace-view">
        <div className="workspace-heading"><div><div className="eyebrow">Community management</div><h1>Communities</h1><p>Shape the rooms where readers connect around shared interests.</p></div><button className="admin-primary" type="button">+ New community</button></div>
        <div className="community-admin-grid">
          {communities.map((community) => <article className="admin-community-card" key={community.name}><div className={`community-art ${community.accent}`}><span aria-hidden="true">â—Œ</span><span aria-hidden="true">â—Œ</span><span aria-hidden="true">â—Œ</span></div><div className="admin-community-body"><div><span className="status-pill published">Active</span><span className="community-member-count">{community.members}</span></div><h2>{community.name}</h2><p>{community.description}</p><div className="community-admin-actions"><button className="button-secondary" type="button">Manage</button><button className="row-menu" type="button">...</button></div></div></article>)}
        </div>
        <div className="admin-panel community-guidance"><div className="eyebrow">Community standards</div><h2>Keep every room useful</h2><p>Moderators can feature posts, pin opportunities, review reports, and update each community&apos;s description from this workspace.</p></div>
      </section>
    );
  }

  // Unknown section: fall back to Settings.
  return <AdminSettings onProfileSaved={onProfileSaved} />;
}

function AuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    let cancelled = false;
    void fetchAuditLog(pageSize, filter || undefined, offset).then((result) => {
      if (cancelled) return;
      setError(!result);
      if (result) {
        setEntries(result.items);
        setTotal(result.total);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filter, offset, refreshCount]);

  const changeFilter = (resource: string) => {
    setLoading(true);
    setFilter(resource);
    setOffset(0);
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Security trail</div>
          <h1>Audit log</h1>
          <p>Review successful and failed changes made through the admin API.</p>
        </div>
        <button className="button-secondary" type="button" onClick={() => { setLoading(true); setRefreshCount((count) => count + 1); }} disabled={loading}>Refresh</button>
      </div>
      <div className="workspace-toolbar">
        <div className="admin-tabs">
          {["", "post", "notification", "profile"].map((r) => (
            <button
              key={r || "all"}
              className={filter === r ? "admin-tab active" : "admin-tab"}
              type="button"
              onClick={() => changeFilter(r)}
            >
              {r ? (r === "notification" ? "Notifications" : `${r.charAt(0).toUpperCase()}${r.slice(1)}s`) : "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-panel section-panel">
        {loading ? (
          <p className="audit-message" role="status">Loading audit trail...</p>
        ) : error ? (
          <p className="audit-message" role="alert">Could not load audit records. Check your connection and try again.</p>
        ) : entries.length === 0 ? (
          <p className="audit-message">No audit entries yet.</p>
        ) : (
          <div className="posts-table audit-table">
            <div className="table-row table-header" role="row">
              <span>Action</span>
              <span>Actor</span>
              <span>Result</span>
              <span>When</span>
            </div>
            {entries.map((entry) => (
              <div className="table-row" key={entry.id}>
                <span className="muted-cell audit-action" title={entry.path}>
                  <strong>{entry.action}</strong>
                  <small>{entry.method} {entry.path}</small>
                </span>
                <span className="muted-cell">{entry.actorEmail}</span>
                <span className={entry.success ? "audit-result success" : "audit-result failure"}>
                  {entry.success ? "Success" : `Failed · ${entry.statusCode}`}
                </span>
                <time className="muted-cell" dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        )}
        <div className="audit-pagination">
          <span>{total === 0 ? "0 records" : `${offset + 1}–${Math.min(offset + entries.length, total)} of ${total}`}</span>
          <div>
            <button className="button-secondary" type="button" onClick={() => { setLoading(true); setOffset(Math.max(0, offset - pageSize)); }} disabled={loading || offset === 0}>
              Previous
            </button>
            <button className="button-secondary" type="button" onClick={() => { setLoading(true); setOffset(offset + pageSize); }} disabled={loading || offset + pageSize >= total}>
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
