import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { TeamRole } from "../../types";
import {
  changeAdminPassword,
  deleteModerator,
  fetchAdminProfile,
  fetchModerators,
  inviteModerator,
  updateAdminProfile,
  updateModerator,
  type ModeratorRecord,
} from "../../lib/adminApi";

export function AdminSettings({ onProfileSaved }: { onProfileSaved?: (name: string) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Moderator");
  const [members, setMembers] = useState<ModeratorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [profile, moderators] = await Promise.all([fetchAdminProfile(), fetchModerators()]);
    if (profile) {
      setDisplayName(profile.name);
      setEmail(profile.email);
    }
    if (moderators) setMembers(moderators);
    if (!profile || !moderators) setError("Some settings could not be loaded. Check the API/database connection.");
    else setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchAdminProfile(), fetchModerators()]).then(([profile, moderators]) => {
      if (cancelled) return;
      if (profile) {
        setDisplayName(profile.name);
        setEmail(profile.email);
      }
      if (moderators) setMembers(moderators);
      setError(!profile || !moderators ? "Some settings could not be loaded. Check the API/database connection." : "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const saved = await updateAdminProfile({ name: displayName.trim(), email: email.trim().toLowerCase() });
    setSaving(false);
    if (!saved) {
      setError("Profile could not be saved. Check that the email is valid and not already in use.");
      return;
    }
    setDisplayName(saved.name);
    setEmail(saved.email);
    onProfileSaved?.(saved.name);
    setMessage("Profile saved.");
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const result = await changeAdminPassword(currentPassword, newPassword);
    setSaving(false);
    if (!result) {
      setError("Password was not changed. Check the current password and API connection.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMessage(result);
  };

  const addModerator = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const member = await inviteModerator({ email: inviteEmail.trim().toLowerCase(), role: inviteRole });
    if (!member) {
      setError("Could not add this team member. The email may already be on the team.");
      return;
    }
    setMembers((current) => [member, ...current]);
    setInviteEmail("");
    setMessage("Invitation saved. Email delivery is not configured; share the invite manually.");
  };

  const changeRole = async (member: ModeratorRecord, role: TeamRole) => {
    const updated = await updateModerator(member.id, { role });
    if (!updated) {
      setError(`Could not update ${member.email}'s role.`);
      return;
    }
    setMembers((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const removeMember = async (member: ModeratorRecord) => {
    if (!window.confirm(`Remove ${member.email} from team access?`)) return;
    if (!(await deleteModerator(member.id))) {
      setError(`Could not remove ${member.email}.`);
      return;
    }
    setMembers((current) => current.filter((item) => item.id !== member.id));
  };

  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div><div className="eyebrow">Workspace preferences</div><h1>Settings</h1><p>Manage your administrator account and persisted team invitations.</p></div>
        <button className="button-secondary" type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading}>Refresh</button>
      </div>
      {message && <p className="review-success" role="status">{message}</p>}
      {error && <p className="review-error" role="alert">{error}</p>}
      <div className="settings-grid">
        <form className="admin-panel settings-panel" onSubmit={saveProfile}>
          <div className="eyebrow">Account</div><h2>Administrator profile</h2>
          <label className="editor-label">Display name<input required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="editor-label">Email address<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <button className="admin-primary" type="submit" disabled={loading || saving}>{saving ? "Saving..." : "Save profile"}</button>
        </form>
        <form className="admin-panel settings-panel" onSubmit={savePassword}>
          <div className="eyebrow">Security</div><h2>Change password</h2>
          <label className="editor-label">Current password<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="editor-label">New password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small className="field-help">Use at least 12 characters.</small></label>
          <button className="admin-primary" type="submit" disabled={loading || saving || !currentPassword || newPassword.length < 12}>{saving ? "Saving..." : "Change password"}</button>
        </form>
      </div>
      <div className="admin-panel team-panel">
        <div className="team-heading"><div><div className="eyebrow">Owner controls</div><h2>Team access</h2><p>Saved invitations are pending until a separate moderator sign-in and email delivery are configured.</p></div><span className="owner-badge">Owner</span></div>
        <form className="invite-row" onSubmit={addModerator}><input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="colleague@example.com" aria-label="Team member email" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as TeamRole)} aria-label="Team member role"><option>Moderator</option><option>Administrator</option></select><button className="admin-primary" type="submit">Add team member</button></form>
        {loading ? <p className="audit-message" role="status">Loading team...</p> : members.length === 0 ? <p className="audit-message">No team invitations yet.</p> : <div className="team-list">{members.map((member) => <div className="team-member" key={member.id}><span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span><div className="team-member-info"><strong>{member.name}</strong><small>{member.email}</small></div><span className={`status-pill ${member.status === "Active" ? "published" : "scheduled"}`}>{member.status}</span><select aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => void changeRole(member, event.target.value as TeamRole)}><option>Moderator</option><option>Administrator</option></select><button className="button-secondary" type="button" onClick={() => void removeMember(member)}>Remove</button></div>)}</div>}
      </div>
    </section>
  );
}
