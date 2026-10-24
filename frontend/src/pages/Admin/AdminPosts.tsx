import { useCallback, useEffect, useState, type FormEvent } from "react";
import { deletePost, fetchPosts, restorePost, updatePost, type PostRecord } from "../../lib/adminApi";
import { Pagination } from "../../components/Pagination";

const FILTERS = ["all", "published", "draft", "scheduled", "trash"] as const;
const PAGE_SIZE = 10;

type PostForm = Pick<PostRecord, "title" | "content" | "excerpt" | "category" | "image" | "actionUrl" | "actionLabel" | "status">;

const emptyForm: PostForm = {
  title: "",
  content: "",
  excerpt: "",
  category: "Scholarships",
  image: "",
  actionUrl: null,
  actionLabel: "Apply now",
  status: "draft",
};

export function AdminPosts({ onNewPost }: { onNewPost: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchPosts(search, PAGE_SIZE, (page - 1) * PAGE_SIZE, filter === "all" ? undefined : filter);
    if (result) {
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setPosts(result.items);
      setTotal(result.total);
      setError("");
    } else {
      setError("Could not load posts. Check the API/database connection and try again.");
    }
    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => {
    let cancelled = false;
    void fetchPosts(search, PAGE_SIZE, (page - 1) * PAGE_SIZE, filter === "all" ? undefined : filter).then((result) => {
      if (cancelled) return;
      if (result) {
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setPosts(result.items);
        setTotal(result.total);
        setError("");
      } else {
        setError("Could not load posts. Check the API/database connection and try again.");
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [filter, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startEdit = (post: PostRecord) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      category: post.category,
      image: post.image,
      actionUrl: post.actionUrl,
      actionLabel: post.actionLabel,
      status: post.status,
    });
    setError("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    const updated = await updatePost(editingId, {
      ...form,
      actionUrl: form.actionUrl?.trim() || null,
      actionLabel: form.actionLabel?.trim() || null,
    });
    setSaving(false);
    if (!updated) {
      setError("Post update failed. Your changes were not saved.");
      return;
    }
    setEditingId(null);
    await load();
  };

  const moveToTrash = async (post: PostRecord) => {
    if (!window.confirm(`Move “${post.title}” to trash? You can restore it later.`)) return;
    if (!(await deletePost(post.id))) {
      setError("Could not move this post to trash.");
      return;
    }
    await load();
  };

  const restore = async (post: PostRecord) => {
    if (!(await restorePost(post.id))) {
      setError("Could not restore this post.");
      return;
    }
    await load();
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div><div className="eyebrow">Publishing library</div><h1>Posts</h1><p>{total} saved posts. Drafts stay private; published posts are visible to readers.</p></div>
        <div className="audit-pagination">
          <button className="button-secondary" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
          <button className="admin-primary" type="button" onClick={onNewPost}>+ New post</button>
        </div>
      </div>
      <div className="workspace-toolbar">
        <div className="admin-tabs" role="tablist" aria-label="Filter posts">
          {FILTERS.map((item) => <button key={item} className={filter === item ? "admin-tab active" : "admin-tab"} type="button" role="tab" aria-selected={filter === item} onClick={() => { setFilter(item); setPage(1); setLoading(true); }}>{item === "all" ? "All posts" : item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
        <label className="admin-search"><span className="sr-only">Search saved posts</span><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} placeholder="Search saved posts" /></label>
      </div>
      {error && <p className="field-help invalid" role="alert">{error}</p>}
      {editingId && (
        <form className="admin-panel post-edit-form" onSubmit={save}>
          <div className="panel-heading"><div><div className="eyebrow">Edit saved content</div><h2>{form.title || "Untitled post"}</h2></div></div>
          <div className="editor-two-col">
            <label className="editor-label">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label className="editor-label">Category<input required maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          </div>
          <label className="editor-label">Excerpt<textarea maxLength={400} rows={2} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></label>
          <label className="editor-label">Body<textarea required rows={7} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
          <div className="editor-two-col">
            <label className="editor-label">Image URL<input type="url" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} /></label>
            <label className="editor-label">Action URL<input type="url" value={form.actionUrl ?? ""} onChange={(event) => setForm({ ...form, actionUrl: event.target.value || null })} /></label>
          </div>
          <div className="editor-two-col">
            <label className="editor-label">Action button<input maxLength={80} value={form.actionLabel ?? ""} onChange={(event) => setForm({ ...form, actionLabel: event.target.value || null })} /></label>
            <label className="editor-label">Visibility<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PostForm["status"] })}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select></label>
          </div>
          <div className="editor-actions"><button className="button-secondary" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="admin-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
        </form>
      )}
      <div className="admin-panel section-panel">
        {loading ? <p className="audit-message" role="status">Loading posts...</p> : posts.length === 0 ? <p className="audit-message">No {filter === "all" ? "saved" : filter} posts found.</p> : (
          <div className="posts-table">
            <div className="table-row table-header"><span>Post</span><span>Category</span><span>Status</span><span>Updated</span><span>Actions</span></div>
            {posts.map((post) => <div className="table-row admin-post-row" key={post.id}>
              <div className="post-title-cell"><strong>{post.title}</strong><small>{post.excerpt}</small></div>
              <span className="muted-cell">{post.category}</span>
              <span className={`status-pill ${post.deletedAt ? "draft" : post.status}`}>{post.deletedAt ? "Trash" : post.status}</span>
              <time className="muted-cell" dateTime={post.updatedAt}>{new Date(post.updatedAt).toLocaleDateString()}</time>
              <span className="admin-post-actions">
                {post.deletedAt ? <button className="button-secondary" type="button" onClick={() => void restore(post)}>Restore</button> : <><button className="button-secondary" type="button" onClick={() => startEdit(post)}>Edit</button><button className="button-secondary" type="button" onClick={() => void moveToTrash(post)}>Trash</button></>}
              </span>
            </div>)}
          </div>
        )}
        {!loading && posts.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              document.querySelector(".admin-content")?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            label="Posts pagination"
            className="pagination-admin"
          />
        )}
      </div>
    </section>
  );
}
