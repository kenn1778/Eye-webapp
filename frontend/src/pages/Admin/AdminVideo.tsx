import { useEffect, useState, type FormEvent } from "react";
import {
  clearAdminSiteVideo,
  fetchAdminSiteVideo,
  saveAdminSiteVideo,
  type SiteVideoState,
} from "../../lib/adminApi";

// Workspace panel for the homepage video spotlight: paste a YouTube link (any
// common shape) or a direct video file URL, optionally add a title and a short
// note, and the public homepage picks it up on its next poll - no redeploy.
export function AdminVideo() {
  const [current, setCurrent] = useState<SiteVideoState | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchAdminSiteVideo().then((state) => {
      if (cancelled) return;
      if (state?.url) {
        setUrl(state.url);
        setTitle(state.title ?? "");
        setNote(state.note ?? "");
      }
      setCurrent(state);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const result = await saveAdminSiteVideo({
      url: url.trim(),
      title: title.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save the video.");
      return;
    }
    if (result.video) {
      setUrl(result.video.url ?? url.trim());
      setTitle(result.video.title ?? "");
      setNote(result.video.note ?? "");
      setCurrent(result.video);
    }
    setMessage("Video updated - the homepage shows it within a minute.");
  };

  const remove = async () => {
    if (!window.confirm("Remove the featured video? The homepage section will be hidden until you add a new link.")) return;
    setSaving(true);
    const ok = await clearAdminSiteVideo();
    setSaving(false);
    if (!ok) {
      setError("Could not remove the video.");
      return;
    }
    setUrl("");
    setTitle("");
    setNote("");
    setCurrent(null);
    setError("");
    setMessage("Featured video removed.");
  };

  const kindLabel = current?.parseError
    ? "Link saved, but it cannot be played yet"
    : current?.kind === "youtube"
      ? "YouTube"
      : current?.kind === "file"
        ? "Video file"
        : "Not set";

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Homepage spotlight</div>
          <h1>Daily video</h1>
          <p>Paste a YouTube link or a direct video file to feature above the site footer. Update it any time - no redeploy needed.</p>
        </div>
        {current?.url && (
          <button className="button-secondary" type="button" onClick={remove} disabled={saving}>Remove video</button>
        )}
      </div>
      <div className="admin-video-grid">
        <form className="admin-panel settings-panel" onSubmit={save}>
          <div className="eyebrow">Featured link</div>
          <h2>Video settings</h2>
          <label className="editor-label">
            Video link (YouTube or video file)
            <input
              required
              type="url"
              maxLength={2048}
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <small className="field-help">Accepts regular YouTube links, share links (youtu.be), Shorts, broadcasts and direct .mp4/.webm files.</small>
          </label>
          <label className="editor-label">
            Display title <span className="muted-cell-optional">(optional)</span>
            <input
              type="text"
              maxLength={140}
              placeholder="e.g. This week's featured opportunities"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="editor-label">
            Short note <span className="muted-cell-optional">(optional)</span>
            <input
              type="text"
              maxLength={240}
              placeholder="One line under the title"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button className="admin-primary" type="submit" disabled={loading || saving}>{saving ? "Saving..." : "Publish video"}</button>
          {message && <p className="review-success" role="status">{message}</p>}
          {error && <p className="review-error" role="alert">{error}</p>}
        </form>
        <div className="admin-panel settings-panel">
          <div className="eyebrow">Live preview</div>
          <h2>What visitors see</h2>
          {loading ? (
            <p className="audit-message" role="status">Loading current feature...</p>
          ) : current?.url && !current.parseError ? (
            <div className="admin-video-preview">
              {current.kind === "youtube" && current.embedUrl && (
                <iframe
                  src={current.embedUrl}
                  title="Featured video preview"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
              {current.kind === "file" && current.url && (
                <video src={current.url} controls preload="metadata" />
              )}
              <span className="status-pill published">{kindLabel}</span>
              {current?.title && <strong>{current.title}</strong>}
              {current?.note && <p>{current.note}</p>}
              {current?.updatedAt && (
                <small className="muted-cell">Updated {new Date(current.updatedAt).toLocaleString()}</small>
              )}
            </div>
          ) : current?.parseError ? (
            <p className="review-error" role="alert">The saved link cannot be played. Paste the video again from its YouTube watch page.</p>
          ) : (
            <p className="audit-message">No featured video yet. The homepage section stays hidden until you publish one.</p>
          )}
        </div>
      </div>
    </section>
  );
}
