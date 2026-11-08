// Shared YouTube / direct-video link parsing. The admin can paste any everyday
// YouTube URL shape (watch, share, shorts, live, embed) or a direct video file
// link; the public section renders an iframe for YouTube and a native <video>
// element for files.

const VIDEO_FILE_EXTS = new Set([".mp4", ".webm", ".m4v", ".mov", ".ogv"]);

export function parseVideoUrl(rawUrl) {
  const url = String(rawUrl ?? "").trim();
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  // Direct video file (self-hosted or any CDN) -> native <video>.
  const path = parsed.pathname.toLowerCase();
  if (VIDEO_FILE_EXTS.has(path.slice(path.lastIndexOf(".")))) {
    return { kind: "file", url };
  }

  const last = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";

  // youtube.com/shorts/ID, /live/ID, /embed/ID
  if ((host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") &&
      ["shorts", "live", "embed", "v"].includes(parsed.pathname.split("/").filter(Boolean)[0])) {
    const id = parsed.pathname.split("/").filter(Boolean)[1];
    if (isYouTubeId(id)) return { kind: "youtube", id };
  }

  // youtu.be/ID - share links carry the id as the path, options in the query.
  if (host === "youtu.be" && isYouTubeId(last)) {
    return { kind: "youtube", id: last };
  }

  // youtube.com/watch?v=ID
  if ((host === "youtube.com" || host === "m.youtube.com") &&
      parsed.pathname === "/watch" &&
      isYouTubeId(parsed.searchParams.get("v"))) {
    return { kind: "youtube", id: parsed.searchParams.get("v") };
  }

  // Attribution link youtube.com/attribution_link?u=/watch%3Fv%3DID
  if (host === "youtube.com" && parsed.pathname === "/attribution_link") {
    const inner = new URL(parsed.searchParams.get("u") ?? "", "https://www.youtube.com");
    if (isYouTubeId(inner.searchParams.get("v"))) {
      return { kind: "youtube", id: inner.searchParams.get("v") };
    }
  }

  return null;
}

const isYouTubeId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{6,20}$/.test(value);

// Privacy-enhanced embed host keeps visitor cookies out of the player.
export function embedUrl(id, startSeconds) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (Number.isFinite(startSeconds) && startSeconds > 0) {
    params.set("start", String(Math.floor(startSeconds)));
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}
