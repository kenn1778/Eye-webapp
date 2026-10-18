import { useState } from "react";
import type { Story } from "../types";
import { seedStories } from "../data/seedData";
import { uploadMediaFile } from "../lib/adminApi";

type AdminEditorProps = {
  close: () => void;
  onPublish: (story: Story) => Promise<boolean | void> | boolean | void;
};

type MediaRole = "post-header" | "link-header" | "audio" | "video";

export function AdminEditor({ close: closeEditor, onPublish }: AdminEditorProps) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Scholarships");
  const [sourceUrl, setSourceUrl] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("Apply now");
  const [tags, setTags] = useState(["scholarship", "funding"]);
  const [tagInput, setTagInput] = useState("");
  const [slug, setSlug] = useState("new-scholarship-opportunity");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<Partial<Record<MediaRole, string>>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Partial<Record<MediaRole, string>>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [visibility, setVisibility] = useState("Public");
  const [publishMode, setPublishMode] = useState("Save draft");
  const [autosave, setAutosave] = useState("Ready to save");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sourceValid = !sourceUrl || /^https?:\/\//i.test(sourceUrl);
  const actionValid = !actionUrl || /^https?:\/\//i.test(actionUrl);
  const imageValid = !featuredImageUrl || /^https?:\/\//i.test(featuredImageUrl);

  const addTag = () => {
    const normalizedTag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (normalizedTag && !tags.includes(normalizedTag)) setTags((current) => [...current, normalizedTag]);
    setTagInput("");
  };

  const close = () => {
    if (window.confirm("Close the editor? Any unsaved changes will be lost.")) closeEditor();
  };

  const uploadFile = async (file: File, role: MediaRole) => {
    setUploadingFile(true);
    setSaveError("");
    const asset = await uploadMediaFile(file, role === "post-header" ? title : "");
    setUploadingFile(false);
    if (!asset) {
      setSaveError(`Could not upload ${file.name} to S3. Check storage configuration and bucket CORS.`);
      return;
    }
    setMediaIds((current) => ({ ...current, [role]: asset.id }));
    setUploadedFiles((current) => ({ ...current, [role]: asset.filename }));
    if (role === "post-header") {
      setFeaturedImageUrl(asset.url);
      setFeaturedMediaId(asset.id);
    }
  };

  const publish = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      const status = publishMode === "Publish immediately" ? "published" : publishMode === "Schedule for later" ? "scheduled" : "draft";
      const result = await onPublish({
        title: title.trim(),
        excerpt: excerpt.trim() || content.trim().slice(0, 200),
        content: content.trim(),
        category,
        meta: status === "published" ? `Published ${new Date().toLocaleDateString()}` : status,
        image: featuredImageUrl || seedStories[1].image,
        actionUrl: actionUrl.trim() || undefined,
        actionLabel: actionLabel || undefined,
        status,
        mediaAssetId: featuredMediaId ?? undefined,
        linkHeaderAssetId: mediaIds["link-header"],
        audioAssetId: mediaIds.audio,
        videoAssetId: mediaIds.video,
      });
      if (result === false) setSaveError("The post could not be saved. Check the API/database connection and try again.");
    } catch {
      setSaveError("The post could not be saved. Check the API/database connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const fileInput = (role: MediaRole, label: string, description: string, accept: string) => (
    <label className="attachment-card" key={role}>
      <span className="attachment-icon" aria-hidden="true">↑</span>
      <strong>{label}</strong>
      <small>{description}</small>
      <input type="file" accept={accept} onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void uploadFile(file, role);
        event.currentTarget.value = "";
      }} />
      <span className="file-name">{uploadedFiles[role] || "Choose a file (stored in S3)"}</span>
    </label>
  );

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><div className="eyebrow">New content</div><h2 id="editor-title">Create a post</h2><p className="modal-subtitle">Prepare the story and media before publishing.</p></div>
          <button className="modal-close" type="button" onClick={close} aria-label="Close editor">X</button>
        </div>
        <div className="editor-status"><span className="status-live">{uploadingFile ? "UPLOADING" : featuredMediaId ? "S3 SAVED" : "DRAFT"}</span> {uploadingFile ? "Uploading media securely to S3..." : autosave}<span className="revision-label">Post data saves to the database</span></div>
        <label className="editor-label">Post title<input required value={title} placeholder="Give your story a clear, useful title" maxLength={150} onChange={(event) => { setTitle(event.target.value); setAutosave("Changes ready to save"); }} /></label>
        <div className="permalink-row"><span className="permalink-label">Permalink</span><span className="permalink-prefix">theeyes.org/post/</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} aria-label="Post slug" /><button className="permalink-edit" type="button">Edit</button></div>
        <div className="editor-two-col">
          <label className="editor-label">Content type<select><option>Scholarship</option><option>News</option><option>Opportunity</option><option>Guide</option><option>Music</option><option>Video</option><option>Entertainment</option></select></label>
          <label className="editor-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Scholarships</option><option>Work</option><option>Culture</option><option>Scholarship tips</option><option>News</option><option>Opportunities</option><option>Guides</option><option>Music</option><option>Video</option></select></label>
        </div>
        <label className="editor-label">Excerpt<textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={3} maxLength={400} placeholder="A short summary for cards and search results" /></label>
        <label className="editor-label">Body content<textarea className="body-editor" rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write the main story here." /></label>
        <div className="editor-divider"><span>Taxonomy and media</span><small>Uploads go to S3; media metadata and post links are stored in PostgreSQL.</small></div>
        <label className="editor-label">Tags<div className="tag-input"><div className="tag-list">{tags.map((tag) => <button type="button" className="tag-chip" key={tag} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>{tag} x</button>)}</div><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="Add a tag and press Enter" /></div><small className="field-help">Use focused terms readers may search for.</small></label>
        <label className="editor-label">Featured image URL<input type="url" value={featuredImageUrl} onChange={(event) => { setFeaturedImageUrl(event.target.value); setFeaturedMediaId(null); }} placeholder="https://images.example.org/cover.jpg" aria-invalid={!imageValid} />{!imageValid && <small className="field-help invalid">Use a full URL beginning with http:// or https://.</small>}</label>
        <div className="attachment-grid" aria-label="Post media attachments">
          {fileInput("post-header", "Post header", "Image shown with the published post.", "image/*")}
          {fileInput("link-header", "Link header", "Media preview attached to the official link.", "image/*,video/*")}
          {fileInput("audio", "Audio", "Attach an audio file to this post.", "audio/*")}
          {fileInput("video", "Video", "Attach a video file to this post.", "video/*")}
        </div>
        {imageValid && featuredImageUrl && <div className="featured-preview" style={{ backgroundImage: `url(${featuredImageUrl})` }} role="img" aria-label="Featured image preview"><span>Featured image preview</span></div>}
        <div className="editor-divider"><span>Link integration</span><small>Connect readers to the official source and next action.</small></div>
        <div className="editor-two-col">
          <label className="editor-label">Source URL<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://official-source.org/notice" aria-invalid={!sourceValid} /><small className={sourceValid ? "field-help" : "field-help invalid"}>{sourceValid ? "Used for attribution." : "Use a full URL beginning with http:// or https://."}</small></label>
          <label className="editor-label">Action URL<input type="url" value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="https://apply.example.org" aria-invalid={!actionValid} /><small className={actionValid ? "field-help" : "field-help invalid"}>{actionValid ? "Readers click this destination." : "Use a full URL beginning with http:// or https://."}</small></label>
        </div>
        <div className="editor-two-col">
          <label className="editor-label">Action button label<select value={actionLabel} onChange={(event) => setActionLabel(event.target.value)}><option>Apply now</option><option>View official notice</option><option>Register</option><option>Read source</option></select></label>
          <label className="editor-label">Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>Public</option><option>Private</option><option>Password protected</option></select></label>
        </div>
        <div className="editor-two-col">
          <label className="editor-label">Publish<select value={publishMode} onChange={(event) => setPublishMode(event.target.value)}><option>Save draft</option><option>Publish immediately</option><option>Schedule for later</option></select></label>
          <label className="editor-label">Deadline<input type="date" /></label>
        </div>
        <div className="editor-actions">
          <button className="button-secondary" type="button" onClick={close}>Cancel</button>
          {saveError && <p className="field-help invalid" role="alert">{saveError}</p>}
          <button className="admin-primary" type="button" disabled={!sourceValid || !actionValid || !imageValid || isSaving || uploadingFile || !title.trim() || !content.trim()} onClick={publish}>
            {isSaving ? "Saving..." : publishMode === "Publish immediately" ? "Publish post" : publishMode === "Schedule for later" ? "Schedule post" : "Save draft"}
          </button>
        </div>
      </section>
    </div>
  );
}
