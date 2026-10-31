import { useEffect, useRef, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import type { Story } from "../types";
import { pingPostView } from "../lib/adminApi";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function toStory(post: any): Story {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    meta: "",
    image: post.image,
    actionUrl: post.actionUrl || undefined,
    actionLabel: post.actionLabel || undefined,
    sponsored: false,
    status: post.status,
    mediaAssetId: post.mediaAssetId,
    linkHeaderAssetId: post.linkHeaderAssetId,
    audioAssetId: post.audioAssetId,
    videoAssetId: post.videoAssetId,
    linkHeaderUrl: post.linkHeaderUrl || null,
    audioUrl: post.audioUrl || null,
    videoUrl: post.videoUrl || null,
    views: post.viewCount ?? 0,
  };
}

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // One ping per page visit; the backend also dedupes per visitor id.
  const pingedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/posts/${id}`, { credentials: "include" });
        if (res.status === 404) { if (!cancelled) setNotFound(true); return; } if (!res.ok) throw new Error("Failed to load post");
        const post = await res.json();
        if (!post) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!cancelled) setStory(toStory(post));
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!story || !story.id || pingedRef.current) return;
    pingedRef.current = true;
    void pingPostView(story.id);
  }, [story]);

  useEffect(() => {
    if (!story) return;
    document.title = `${story.title} | Expl00r`;
    const desc = story.excerpt || story.title;
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (meta) meta.content = desc;
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = story.title;
    const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (ogDesc) ogDesc.content = desc;
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (ogUrl) ogUrl.content = `${window.location.origin}/story/${story.id}`;

    const existing = document.getElementById("story-jsonld");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "story-jsonld";
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: story.title,
      description: desc,
      datePublished: new Date().toISOString(),
      image: story.image || undefined,
      author: { "@type": "Organization", name: "Expl00r" },
      url: `${window.location.origin}/story/${story.id}`
    });
    document.head.appendChild(script);

    return () => {
      document.title = "Expl00r | Share ideas, Inspire Minds";
    };
  }, [story]);

  if (loading) {
    return (
      <main className="bf-story-page page-fade">
        <p className="bf-story-loading">Loading&hellip;</p>
      </main>
    );
  }
  if (notFound || !story) return <Navigate to="/" replace />;

  const published = story.meta ? story.meta.replace(/^Published\s+/i, "") : "";

  return (
    <main className="bf-story-page page-fade">
      <header className="bf-story-hero">
        <div className="bf-story-hero-inner">
          <Link to="/" className="bf-story-back">&larr; Back to stories</Link>
          <span className="bf-chip bf-chip-static">{story.category}</span>
          <h1>{story.title}</h1>
          <div className="bf-story-meta">
            {published && <span>{published}</span>}
            <span className="bf-views">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10S5.5 4.8 10 4.8 17.5 10 17.5 10 14.5 15.2 10 15.2 2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" /></svg>
              {story.views ?? 0} views
            </span>
          </div>
        </div>
      </header>
      <article className="bf-story-article">
        {story.image && (
          <div className="bf-story-image">
            <img src={story.image} alt={story.title} loading="eager" decoding="async" />
          </div>
        )}
        <div className="bf-story-body">
          <p className="bf-story-lede">{story.excerpt}</p>
          {(story.content || "").split(/\n{2,}/).filter(Boolean).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          {story.linkHeaderUrl && <img className="bf-story-attachment" src={story.linkHeaderUrl} alt="Post attachment" loading="lazy" />}
          {story.audioUrl && <audio className="bf-story-audio" controls preload="none" src={story.audioUrl}>Your browser does not support audio playback.</audio>}
          {story.videoUrl && <video className="bf-story-video" controls preload="metadata" src={story.videoUrl}>Your browser does not support video playback.</video>}
          {story.actionUrl && (
            <a
              className="bf-btn bf-story-cta"
              href={story.actionUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {story.actionLabel || "Open opportunity"} <span aria-hidden="true">&rarr;</span>
            </a>
          )}
        </div>
      </article>
    </main>
  );
}
