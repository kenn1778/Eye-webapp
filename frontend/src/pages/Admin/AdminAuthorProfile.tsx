import { useEffect, useState, type FormEvent } from "react";
import { fetchAdminAuthorProfile, updateAdminAuthorProfile } from "../../lib/adminApi";
import type { AdminAuthorProfile } from "../../types";

/**
 * Editor for the public author card shown on the landing page. Saving updates
 * the AuthorProfile row the public /author endpoint serves.
 */
export function AdminAuthorProfileEditor() {
  const [form, setForm] = useState<AdminAuthorProfile>({
    name: "",
    role: "",
    bio: "",
    email: "",
    avatarUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminAuthorProfile().then((profile) => {
      if (cancelled) return;
      if (profile) setForm(profile);
      else setError("Could not load the author profile. Check the API connection and try again.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    const updated = await updateAdminAuthorProfile({
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim(),
      email: form.email.trim(),
      avatarUrl: form.avatarUrl?.trim() || null,
    });
    setSaving(false);
    if (!updated) {
      setError("Saving failed. Check the fields and try again.");
      return;
    }
    setForm(updated);
    setError("");
    setSaved(true);
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Public identity</div>
          <h1>Author profile</h1>
          <p>The card readers see on the landing page. Keep it accurate and personal.</p>
        </div>
      </div>
      {loading ? (
        <div className="admin-panel section-panel">
          <p className="audit-message" role="status">Loading profile...</p>
        </div>
      ) : (
        <form className="admin-panel section-panel author-profile-form" onSubmit={save}>
          <div className="author-profile-head">
            {form.avatarUrl ? (
              <img className="author-avatar" src={form.avatarUrl} alt="" width={64} height={64} />
            ) : (
              <span className="author-avatar author-avatar-fallback" aria-hidden="true">
                {form.name.slice(0, 2).toUpperCase() || "?"}
              </span>
            )}
            <div>
              <strong>{form.name || "Unnamed author"}</strong>
              <small>{form.role || "Role not set"}</small>
            </div>
          </div>
          <div className="editor-two-col">
            <label className="editor-label">
              Name
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="editor-label">
              Role
              <input
                required
                maxLength={120}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
              />
            </label>
          </div>
          <label className="editor-label">
            Bio
            <textarea
              required
              maxLength={600}
              rows={4}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
          </label>
          <div className="editor-two-col">
            <label className="editor-label">
              Email
              <input
                required
                type="email"
                maxLength={200}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className="editor-label">
              Avatar URL
              <input
                type="url"
                value={form.avatarUrl ?? ""}
                onChange={(event) => setForm({ ...form, avatarUrl: event.target.value || null })}
              />
            </label>
          </div>
          {error && <p className="field-help invalid" role="alert">{error}</p>}
          {saved && <p className="field-help" role="status">Profile saved. The public card updates immediately.</p>}
          <div className="editor-actions">
            <button className="admin-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
