// AdminSectionView - switches admin sub-pages

import { useState } from "react";
import { communities, seedAdminPosts } from "../../data/seedData";
import { AdminSettings } from "./AdminSettings";

// Props: which section to show, and function to open the editor
type AdminSectionViewProps = {
  section: string; // e.g., "Posts", "Calendar", "Media"
  onNewPost: () => void; // opens the "New post" modal
};

// AdminSectionView - switches UI based on section name
export function AdminSectionView({ section, onNewPost }: AdminSectionViewProps) {
  // local state for the "Categories" page - adding new categories
  const [categoryName, setCategoryName] = useState(""); // text in the add-category input
  const [categoriesList, setCategoriesList] = useState([
    "Scholarships",
    "Scholarship tips",
    "Work",
    "Culture",
  ]);

  // addCategory - push new category to list if not empty/duplicate
  const addCategory = () => {
    if (categoryName.trim() && !categoriesList.includes(categoryName.trim())) {
      setCategoriesList([...categoriesList, categoryName.trim()]);
      setCategoryName(""); // clear input after adding
    }
  };

  // Team -> show the full Settings page (which includes team management)
  if (section === "Team") {
    return <AdminSettings />;
  }

  // Posts -> table of all posts
  if (section === "Posts") {
    return (
      <section className="workspace-view">
        <div className="workspace-heading"><div><div className="eyebrow">Publishing library</div><h1>All posts</h1><p>Manage drafts, live stories, and scheduled publications.</p></div><button className="admin-primary" type="button" onClick={onNewPost}>+ New post</button></div>
        <div className="workspace-toolbar"><div className="admin-tabs"><button className="admin-tab active" type="button">All posts</button><button className="admin-tab" type="button">Published</button><button className="admin-tab" type="button">Drafts</button></div><label className="admin-search"><span>⌕</span><input placeholder="Search posts" /></label></div>
        <div className="admin-panel section-panel"><div className="posts-table"><div className="table-row table-header"><span>Post</span><span>Type</span><span>Status</span><span>Updated</span><span>Author</span><span /></div>{seedAdminPosts.map((post) => <div className="table-row" key={post.title}><div className="post-title-cell"><span className={`post-thumb ${post.status.toLowerCase()}`} /><strong>{post.title}</strong></div><span className="muted-cell">{post.type}</span><span className={`status-pill ${post.status.toLowerCase()}`}>{post.status}</span><span className="muted-cell">{post.updated}</span><span className="muted-cell">{post.author}</span><button className="row-menu" type="button">...</button></div>)}</div></div>
      </section>
    );
  }

  // Calendar -> monthly grid + upcoming list
  if (section === "Calendar") {
    return (
      <section className="workspace-view"><div className="workspace-heading"><div><div className="eyebrow">Editorial planning</div><h1>Publishing calendar</h1><p>Keep deadlines and scheduled stories visible at a glance.</p></div><button className="admin-primary" type="button" onClick={onNewPost}>+ Schedule post</button></div><div className="calendar-layout"><div className="admin-panel calendar-panel"><div className="calendar-top"><button type="button">&lt;</button><strong>September 2026</strong><button type="button">&gt;</button></div><div className="calendar-grid">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span className="calendar-day-name" key={day}>{day}</span>)}{Array.from({ length: 35 }, (_, index) => <button className={index === 13 || index === 16 ? "calendar-date has-event" : "calendar-date"} type="button" key={index}>{index < 5 ? "" : index - 5}</button>)}</div></div><div className="admin-panel upcoming-panel"><div className="eyebrow">Up next</div><h2>Scheduled stories</h2><div className="upcoming-item"><span className="schedule-date">14<span>SEP</span></span><div><strong>Remote internships accepting applications now</strong><small>09:00 AM · Opportunities</small></div></div><div className="upcoming-item"><span className="schedule-date">17<span>SEP</span></span><div><strong>How to build a portfolio with no experience</strong><small>12:30 PM · Guide</small></div></div></div></div></section>
    );
  }

  // Media -> grid of image/audio/video assets
  if (section === "Media") {
    return (
      <section className="workspace-view"><div className="workspace-heading"><div><div className="eyebrow">Asset library</div><h1>Media</h1><p>Upload, organize, and reuse images, audio, and video across posts.</p></div><button className="admin-primary" type="button" onClick={onNewPost}>+ Upload media</button></div><div className="media-filter"><button className="category-tab selected" type="button">All media</button><button className="category-tab" type="button">Images</button><button className="category-tab" type="button">Audio</button><button className="category-tab" type="button">Video</button></div><div className="media-grid">{["Campus discussion", "Autumn library", "Career conversation", "Audio interview"].map((asset, index) => <article className="media-asset" key={asset}><div className={`media-preview media-${index}`}><span>{index === 3 ? "♪" : index === 2 ? "▶" : "▧"}</span></div><div><strong>{asset}</strong><small>{index === 3 ? "Audio · 4:18" : index === 2 ? "Video · 12:40" : "Image · 1.8 MB"}</small></div></article>)}</div></section>
    );
  }

  // Categories -> list + add new
  if (section === "Categories") {
    return (
      <section className="workspace-view"><div className="workspace-heading"><div><div className="eyebrow">Content taxonomy</div><h1>Categories</h1><p>Keep the publication easy to browse and consistent to manage.</p></div></div><div className="admin-panel taxonomy-panel"><div className="taxonomy-add"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category name" /><button className="admin-primary" type="button" onClick={addCategory}>Add category</button></div><div className="category-list">{categoriesList.map((category) => <div className="category-row" key={category}><span className="category-symbol">#</span><strong>{category}</strong><span className="muted-cell">{category === "Scholarships" ? "8 posts" : category === "Work" ? "5 posts" : "3 posts"}</span><button className="row-menu" type="button">...</button></div>)}</div></div></section>
    );
  }

  // Communities -> admin view of community cards
  if (section === "Communities") {
    return (
      <section className="workspace-view">
        <div className="workspace-heading"><div><div className="eyebrow">Community management</div><h1>Communities</h1><p>Shape the rooms where readers connect around shared interests.</p></div><button className="admin-primary" type="button">+ New community</button></div>
        <div className="community-admin-grid">
          {communities.map((community) => <article className="admin-community-card" key={community.name}><div className={`community-art ${community.accent}`}><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span><span aria-hidden="true">◌</span></div><div className="admin-community-body"><div><span className="status-pill published">Active</span><span className="community-member-count">{community.members}</span></div><h2>{community.name}</h2><p>{community.description}</p><div className="community-admin-actions"><button className="button-secondary" type="button">Manage</button><button className="row-menu" type="button">...</button></div></div></article>)}
        </div>
        <div className="admin-panel community-guidance"><div className="eyebrow">Community standards</div><h2>Keep every room useful</h2><p>Moderators can feature posts, pin opportunities, review reports, and update each community&apos;s description from this workspace.</p></div>
      </section>
    );
  }

  // Fallback - show settings for any unknown section
  return <AdminSettings />;
}