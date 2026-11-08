import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type SiteVideo = {
  kind: "youtube" | "file";
  youtubeId: string | null;
  fileUrl: string | null;
  embedUrl: string | null;
  title?: string | null;
  note?: string | null;
  updatedAt?: string | null;
};

function isSiteVideo(value: unknown): value is SiteVideo {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.enabled === true &&
    (v.kind === "youtube" || v.kind === "file") &&
    (v.youtubeId === null || typeof v.youtubeId === "string") &&
    (v.fileUrl === null || typeof v.fileUrl === "string") &&
    (v.embedUrl === null || typeof v.embedUrl === "string")
  );
}

// The admin features a fresh video (usually daily); the section lives above
// the footer. Revalidates every few minutes and when the tab regains focus, so
// a same-day swap shows up on the site without a page deploy.
async function loadVideo(signal?: AbortSignal): Promise<SiteVideo | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/public/site-video`, {
      credentials: "include",
      signal,
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isSiteVideo(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function VideoSpotlight() {
  const [video, setVideo] = useState<SiteVideo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    void loadVideo(controller.signal).then((result) => { if (alive) setVideo(result); });

    const poller = window.setInterval(() => {
      void loadVideo().then((result) => { if (alive) setVideo(result); });
    }, 5 * 60 * 1000);
    const onFocus = () => { void loadVideo().then((result) => { if (alive) setVideo(result); }); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onFocus);

    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(poller);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Nothing configured (yet): render nothing so the page keeps its rhythm.
  if (!video) return null;

  const isYouTube = video.kind === "youtube" && video.embedUrl;

  return (
    <section className="bf-watch" id="watch" aria-label="Featured video">
      <div className="bf-watch-inner">
        <div className="bf-section-head">
          <div>
            <span className="bf-eyebrow">Watch</span>
            <h2 className="bf-watch-title">{video.title || "This week's featured video"}</h2>
          </div>
          {video.updatedAt && (
            <span className="bf-watch-meta">Updated {new Date(video.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
          )}
        </div>
        <div className="bf-watch-frame">
          {isYouTube ? (
            <iframe
              src={video.embedUrl ?? undefined}
              title={video.title || "Featured video"}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              src={video.fileUrl ?? undefined}
              controls
              preload="metadata"
              playsInline
            />
          )}
        </div>
        {video.note && <p className="bf-watch-note">{video.note}</p>}
      </div>
    </section>
  );
}
