import type { Community } from "../../types";
import { communityArt } from "./publicShared";

type PublicCommunitiesProps = {
  communities: Community[];
  joinedCommunities: string[];
  communityCounts: Record<string, number>;
  communityMessage: string;
  joinCommunity: (community: Community) => void;
  setActiveChat: (community: Community) => void;
};

export function PublicCommunities({
  communities,
  joinedCommunities,
  communityCounts,
  communityMessage,
  joinCommunity,
  setActiveChat,
}: PublicCommunitiesProps) {
  return (
    <section className="bf-communities" id="communities" aria-labelledby="communities-title">
      <div className="bf-section-head">
        <h2 id="communities-title">Join a Community</h2>
        <span className="bf-section-note">Share leads, ask better questions, build momentum together.</span>
      </div>
      {communityMessage && <p className="bf-form-error" role="alert">{communityMessage}</p>}
      <div className="bf-community-grid">
        {communities.map((community) => {
          const isJoined = joinedCommunities.includes(community.name);
          return (
            <article className="bf-community-card" key={community.name}>
              <div className="bf-community-art">
                <img
                  src={communityArt[community.name].src}
                  alt={communityArt[community.name].alt}
                  width={communityArt[community.name].width}
                  height={communityArt[community.name].height}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="bf-community-body">
                <h3>{community.name}</h3>
                <p>{community.description}</p>
                <div className="bf-community-foot">
                  <span className="bf-community-count">
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="7.4" cy="6.1" r="2.8" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 16c.3-2.7 2.2-4.3 4.9-4.3s4.6 1.6 4.9 4.3M13 4.3a2.4 2.4 0 0 1 0 4.6m1.2 2.7c1.9.4 3 1.8 3.3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                    {communityCounts[community.name] ?? 0} members
                  </span>
                  {isJoined ? (
                    <button type="button" className="bf-btn bf-btn-ghost" onClick={() => setActiveChat(community)}>
                      Open chat <span aria-hidden="true">&rarr;</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bf-btn"
                      aria-label={`Join ${community.name} and open chat`}
                      onClick={() => joinCommunity(community)}
                    >
                      Join community <span aria-hidden="true">&rarr;</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
