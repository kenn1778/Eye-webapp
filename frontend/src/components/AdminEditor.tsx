// AdminEditor - modal for creating a new post

import { useState } from "react";
import type { Story } from "../types";
import { seedStories } from "../data/seedData";

// Props - what the parent must give this component
// close: function to hide the modal
// onPublish: function to send the new story to the parent
type AdminEditorProps = {
  close: () => void;
  onPublish: (story: Story) => void;
};

// AdminEditor - the full modal form
export function AdminEditor({ close: closeEditor, onPublish }: AdminEditorProps) {
    const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("Scholarships");
  const [sourceUrl, setSourceUrl] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("Apply now");
  const [tags, setTags] = useState(["scholarship", "funding"]);
  const [tagInput, setTagInput] = useState("");
  const [slug, setSlug] = useState("new-scholarship-opportunity");
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [postHeaderFile, setPostHeaderFile] = useState<File>();
  const [linkHeaderFile, setLinkHeaderFile] = useState<File>();
  const [audioFile, setAudioFile] = useState<File>();
  const [videoFile, setVideoFile] = useState<File>();
  const [visibility, setVisibility] = useState("Public");
  const [publishMode, setPublishMode] = useState("Save draft");
  const [autosave, setAutosave] = useState("Autosaved just now");
  const [hasUnsavedChanges] = useState(true); // always true for this demo

    const sourceValid = !sourceUrl || /^https?:\/\//i.test(sourceUrl); // empty = valid, or must be http
  const actionValid = !actionUrl || /^https?:\/\//i.test(actionUrl);

  // addTag - takes text in tagInput, cleans it, adds to tags list
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-"); // "My Tag" -> "my-tag"
    if (tag && !tags.includes(tag)) setTags([...tags, tag]); // only add if not duplicate
    setTagInput(""); // clear input after adding
  };

  // close - asks "are you sure?" if there are unsaved changes
  const close = () => {
    if (
      !hasUnsavedChanges ||
      window.confirm("You have unsaved changes. Exit without saving?")
    )
      closeEditor(); // actually close if no changes or user confirms
  };

  // publish - builds a Story object from form fields and sends it up
  const publish = () =>
    onPublish({
      title: title || "New scholarship opportunity", // fallback if empty
      excerpt: excerpt || "A new opportunity is now available for readers.",
      category,
      meta: "Just published  /  12 Sep 2026",
      image: featuredImageUrl || seedStories[1].image, // use fallback image
      actionUrl: actionUrl || undefined, // undefined if empty
      actionLabel: actionLabel || "View opportunity",
    });

    return (
    // backdrop - dark overlay, clicking it closes the modal
    <div className="modal-backdrop" role="presentation" onClick={close}>
      {/* modal box - clicking inside does NOT close (stopPropagation) */}
      <section
        className="editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header - title + close button */}
        <div className="modal-heading">
          <div>
            <div className="eyebrow">New content</div>
            <h2 id="editor-title">Create a post</h2>
            <p className="modal-subtitle">
              Prepare the story, destination, and publishing details before it
              goes live.
            </p>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={close}
            aria-label="Close editor"
          >
            X
          </button>
        </div>
        {/* Status bar - shows saved time */}
        <div className="editor-status">
          <span className="status-live">SAVED</span> {autosave}
          <span className="revision-label">Revision 1</span>
        </div>
        {/* Post title input */}
        <label className="editor-label">
          Post title
          <input
            value={title}
            placeholder="Give your story a clear, useful title"
            onChange={(event) => {
              setTitle(event.target.value);
              setAutosave("Autosaving...");
            }}
            onBlur={() => setAutosave("Autosaved just now")}
          />
        </label>
        {/* Permalink - editable slug */}
        <div className="permalink-row">
          <span className="permalink-label">Permalink</span>
          <span className="permalink-prefix">theeyes.org/post/</span>
          <input
            value={slug}
            onChange={(event) =>
              setSlug(
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
              )
            }
            aria-label="Post slug"
          />
          <button className="permalink-edit" type="button">
            Edit
          </button>
        </div>
        {/* Two columns - content type + category */}
        <div className="editor-two-col">
          <label className="editor-label">
            Content type
            <select>
              <option>Scholarship</option>
              <option>News</option>
              <option>Opportunity</option>
              <option>Guide</option>
              <option>Music</option>
              <option>Video</option>
              <option>Entertainment</option>
            </select>
          </label>
          <label className="editor-label">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option>Scholarships</option>
              <option>Work</option>
              <option>Culture</option>
              <option>Scholarship tips</option>
              <option>News</option>
              <option>Opportunities</option>
              <option>Guides</option>
              <option>Music</option>
              <option>Video</option>
            </select>
          </label>
        </div>
        {/* Excerpt */}
        <label className="editor-label">
          Excerpt
          <textarea
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            rows={3}
            placeholder="A short summary for cards and search results"
          />
        </label>
        {/* Body content */}
        <label className="editor-label">
          Body content
          <textarea
            className="body-editor"
            rows={6}
            placeholder="Write the main story here. Add headings, links, quotes, and media."
          />
        </label>
        {/* Divider */}
        <div className="editor-divider">
          <span>Taxonomy and media</span>
          <small>Organize the post for discovery.</small>
        </div>
        {/* Tags */}
        <label className="editor-label">
          Tags
          <div className="tag-input">
            <div className="tag-list">
              {tags.map((tag) => (
                <button
                  type="button"
                  className="tag-chip"
                  key={tag}
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                >
                  {tag} x
                </button>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Add a tag and press Enter"
            />
          </div>
          <small className="field-help">
            Use focused terms readers may search for.
          </small>
        </label>
        {/* Featured image URL */}
        <label className="editor-label">
          Featured image URL
          <input
            type="url"
            value={featuredImageUrl}
            onChange={(event) => setFeaturedImageUrl(event.target.value)}
            placeholder="https://images.example.org/cover.jpg"
          />
        </label>
        {/* Media attachments grid - 4 cards */}
        <div className="attachment-grid" aria-label="Post media attachments">
          <label className="attachment-card">
            <span className="attachment-icon">?</span>
            <strong>Post header</strong>
            <small>Image or video shown at the top of the post.</small>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => setPostHeaderFile(event.target.files?.[0])}
            />
            <span className="file-name">
              {postHeaderFile?.name || "Attach image or video"}
            </span>
          </label>
          <label className="attachment-card">
            <span className="attachment-icon">?</span>
            <strong>Link header</strong>
            <small>Media preview displayed with the destination link.</small>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => setLinkHeaderFile(event.target.files?.[0])}
            />
            <span className="file-name">
              {linkHeaderFile?.name || "Attach link media"}
            </span>
          </label>
          <label className="attachment-card">
            <span className="attachment-icon">?</span>
            <strong>Audio</strong>
            <small>Attach an audio player to the published story.</small>
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setAudioFile(event.target.files?.[0])}
            />
            <span className="file-name">{audioFile?.name || "Attach audio"}</span>
          </label>
          <label className="attachment-card">
            <span className="attachment-icon">?</span>
            <strong>Video</strong>
            <small>Attach a responsive video player to the post.</small>
            <input
              type="file"
              accept="video/*"
              onChange={(event) => setVideoFile(event.target.files?.[0])}
            />
            <span className="file-name">{videoFile?.name || "Attach video"}</span>
          </label>
        </div>
        {/* Preview if URL provided */}
        {featuredImageUrl && (
          <div
            className="featured-preview"
            style={{ backgroundImage: `url(${featuredImageUrl})` }}
            role="img"
            aria-label="Featured image preview"
          >
            <span>Featured image preview</span>
          </div>
        )}
        <div className="editor-divider">
          <span>Link integration</span>
          <small>Connect readers to the official source and next action.</small>
        </div>
        {/* Source + Action URLs */}
        <div className="editor-two-col">
          <label className="editor-label">
            Source URL
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://official-source.org/notice"
              aria-invalid={!sourceValid}
            />
            <small
              className={sourceValid ? "field-help" : "field-help invalid"}
            >
              {sourceValid
                ? "Used for attribution."
                : "Use a full URL beginning with http:// or https://."}
            </small>
          </label>
          <label className="editor-label">
            Action URL
            <input
              type="url"
              value={actionUrl}
              onChange={(event) => setActionUrl(event.target.value)}
              placeholder="https://apply.example.org"
              aria-invalid={!actionValid}
            />
            <small
              className={actionValid ? "field-help" : "field-help invalid"}
            >
              {actionValid
                ? "Readers click this destination."
                : "Use a full URL beginning with http:// or https://."}
            </small>
          </label>
        </div>
        <div className="editor-two-col">
          <label className="editor-label">
            Action button label
            <select
              value={actionLabel}
              onChange={(event) => setActionLabel(event.target.value)}
            >
              <option>Apply now</option>
              <option>View official notice</option>
              <option>Register</option>
              <option>Read source</option>
            </select>
          </label>
          <div className="url-preview">
            <span className="preview-label">Reader preview</span>
            <a
              href={actionValid && actionUrl ? actionUrl : "#"}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (!actionValid || !actionUrl) event.preventDefault();
              }}
            >
              {actionLabel} -&gt;
            </a>
          </div>
        </div>
        <div className="editor-divider">
          <span>Publishing and SEO</span>
          <small>Control visibility and search presentation.</small>
        </div>
        <div className="editor-two-col">
          <label className="editor-label">
            Visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option>Public</option>
              <option>Private</option>
              <option>Password protected</option>
            </select>
          </label>
          <label className="editor-label">
            Publish
            <select
              value={publishMode}
              onChange={(event) => setPublishMode(event.target.value)}
            >
              <option>Save draft</option>
              <option>Publish immediately</option>
              <option>Schedule for later</option>
            </select>
          </label>
        </div>
        <div className="editor-two-col">
          <label className="editor-label">
            Deadline
            <input type="date" />
          </label>
          <label className="editor-label">
            SEO description
            <input placeholder="Describe this post in 150 characters" />
          </label>
        </div>
        {/* Bottom buttons */}
        <div className="editor-actions">
          <button className="button-secondary" type="button" onClick={close}>
            Cancel
          </button>
          <button
            className="admin-primary"
            type="button"
            disabled={!sourceValid || !actionValid}
            onClick={publish}
          >
            {publishMode === "Publish immediately"
              ? "Publish post"
              : publishMode === "Schedule for later"
                ? "Schedule post"
                : "Save draft"}
          </button>
        </div>
      </section>
    </div>
  );
}