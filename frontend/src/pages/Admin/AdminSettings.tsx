// AdminSettings - workspace preferences + team

import { useState } from "react";
import type { TeamRole, TeamMember } from "../../types";

export function AdminSettings() {
  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState("Amara Osei");
  const [email, setEmail] = useState("amara@theeyes.org");
  const [twoFactor, setTwoFactor] = useState(false);
  const [publicSubmissions, setPublicSubmissions] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Moderator");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: "Nia Harper", email: "nia@theeyes.org", role: "Moderator", status: "Active" },
    { name: "David Kim", email: "david@theeyes.org", role: "Administrator", status: "Active" },
  ]);
  const save = () => setSaved(true);
  const inviteMember = () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail || teamMembers.some((member) => member.email === normalizedEmail)) return;
    setTeamMembers([...teamMembers, { name: normalizedEmail.split("@")[0], email: normalizedEmail, role: inviteRole, status: "Invited" }]);
    setInviteEmail("");
  };
  const removeMember = (emailToRemove: string) => setTeamMembers(teamMembers.filter((member) => member.email !== emailToRemove));
  return (
    <section className="workspace-view">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">Workspace preferences</div>
          <h1>Settings</h1>
          <p>Configure how EYE publishes and presents content.</p>
        </div>
        {saved && <span className="settings-saved">Saved just now</span>}
      </div>
      <div className="settings-grid">
        <div className="admin-panel settings-panel">
          <div className="eyebrow">Publication</div>
          <h2>Editorial defaults</h2>
          <label className="setting-row"><span><strong>Public submissions</strong><small>Allow approved editors to submit drafts.</small></span><input type="checkbox" checked={publicSubmissions} onChange={(event) => setPublicSubmissions(event.target.checked)} /></label>
          <label className="setting-row"><span><strong>Auto-generate excerpts</strong><small>Suggest card summaries from body content.</small></span><input type="checkbox" defaultChecked /></label>
          <label className="setting-row"><span><strong>Link health checks</strong><small>Monitor source and application URLs.</small></span><input type="checkbox" defaultChecked /></label>
          <label className="setting-row"><span><strong>Two-factor authentication</strong><small>Require a second step for administrator access.</small></span><input type="checkbox" checked={twoFactor} onChange={(event) => setTwoFactor(event.target.checked)} /></label>
        </div>
        <div className="admin-panel settings-panel">
          <div className="eyebrow">Account</div>
          <h2>Administrator profile</h2>
          <label className="editor-label">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label className="editor-label">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="editor-label">New password<input type="password" placeholder="Leave blank to keep current password" /></label>
          <button className="admin-primary" type="button" onClick={save}>Save settings</button>
        </div>
      </div>
      <div className="admin-panel team-panel">
        <div className="team-heading"><div><div className="eyebrow">Owner controls</div><h2>Team access</h2><p>Invite trusted people to help publish. Your owner account keeps full control.</p></div><span className="owner-badge">Owner</span></div>
        <div className="permission-legend"><span><strong>Moderator</strong> Create drafts, edit assigned posts, and manage media.</span><span><strong>Administrator</strong> Publish, schedule, manage categories, and moderate communities.</span></div>
        <div className="invite-row"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="colleague@theeyes.org" aria-label="Team member email" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as TeamRole)} aria-label="Team member role"><option>Moderator</option><option>Administrator</option></select><button className="admin-primary" type="button" onClick={inviteMember}>Send invite</button></div>
        <div className="team-list">{teamMembers.map((member) => <div className="team-member" key={member.email}><span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span><div className="team-member-info"><strong>{member.name}</strong><small>{member.email}</small></div><span className={`status-pill ${member.status === "Active" ? "published" : "scheduled"}`}>{member.status}</span><span className="role-pill">{member.role}</span><button className="row-menu" type="button" onClick={() => removeMember(member.email)} aria-label={`Remove ${member.name}`}>Remove</button></div>)}</div>
      </div>
    </section>
  );
}