import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import type { Story } from "../types";

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
  };
}

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
    if (!story) return;
    document.title = `${story.title} | EYE`;
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
      author: { "@type": "Organization", name: "EYE" },
      url: `${window.location.origin}/story/${story.id}`
    });
    document.head.appendChild(script);

    return () => {
      document.title = "EYE | Scholarships, Work, Ideas, and Culture";
    };
  }, [story]);

  if (loading) return <main className="story-page"><p>Loading…</p></main>;
  if (notFound || !story) return <Navigate to="/" replace />;

  return (
    <main className="story-page">
      <Link to="/" className="back-link">← Back to stories</Link>
      <article>
        <h1>{story.title}</h1>
        {story.image && (
          <img src={story.image} alt={story.title} loading="eager" decoding="async" />
        )}
        <div className="story-content">
          <p>{story.excerpt}</p>
          <p>{story.content || ""}</p>
        </div>
      </article>
    </main>
  );
}