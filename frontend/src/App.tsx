import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import type { Story } from "./types";
import { seedStories } from "./data/seedData";
import { PublicSite } from "./pages/PublicSite";
import StoryPage from "./pages/StoryPage";
import { PrivacyPolicy } from "./pages/Legal/PrivacyPolicy";
import { Terms } from "./pages/Legal/Terms";
import { RefundPolicy } from "./pages/Legal/RefundPolicy";
import { CookiesPolicy } from "./pages/Legal/CookiesPolicy";
import { CookieConsent } from "./components/CookieConsent";
import { ADMIN_ENABLED, MEMBERSHIP_ENABLED } from "./config";
import SubscribePopup from "./components/SubscribePopup";
import { getSession, logout } from "./lib/auth";
import { createPost, fetchPublicPosts, type PostRecord } from "./lib/adminApi";

const AdminLogin = lazy(() =>
  import("./pages/Admin/AdminLogin").then((module) => ({ default: module.AdminLogin })),
);
const AdminWorkspace = lazy(() =>
  import("./pages/Admin/AdminWorkspace").then((module) => ({ default: module.AdminWorkspace })),
);
const Pricing = lazy(() =>
  import("./pages/Pricing").then((module) => ({ default: module.Pricing })),
);

const PUBLIC_STORIES_CACHE_KEY = "eye:public-stories:v1";

function toStory(post: PostRecord): Story {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    meta: `Published ${new Date(post.updatedAt).toLocaleDateString()}`,
    image: post.image,
    actionUrl: post.actionUrl ?? undefined,
    actionLabel: post.actionLabel ?? undefined,
    status: "published",
    mediaAssetId: post.mediaAssetId ?? undefined,
    linkHeaderAssetId: post.linkHeaderAssetId ?? undefined,
    audioAssetId: post.audioAssetId ?? undefined,
    videoAssetId: post.videoAssetId ?? undefined,
    linkHeaderUrl: post.linkHeaderUrl,
    audioUrl: post.audioUrl,
    videoUrl: post.videoUrl,
  };
}

function readCachedStories(): Story[] {
  try {
    const raw = window.localStorage.getItem(PUBLIC_STORIES_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Story => {
      if (typeof item !== "object" || item === null) return false;
      const story = item as Partial<Story>;
      return typeof story.title === "string" && typeof story.excerpt === "string" &&
        typeof story.category === "string" && typeof story.image === "string" && typeof story.meta === "string";
    });
  } catch {
    return [];
  }
}

function writeCachedStories(stories: Story[]) {
  try {
    window.localStorage.setItem(PUBLIC_STORIES_CACHE_KEY, JSON.stringify(stories));
  } catch {
    return;
  }
}
// First-paint loader - the eye blink covers the gap before the app mounts.
function EyeLoader() {
  return (
    <div className="eye-loader" role="status" aria-live="polite" aria-busy="true" aria-label="Loading EYE">
      <div className="eye-loader-card">
        <span className="brand-icon is-loading" aria-hidden="true">
          <svg className="eye-svg is-loading" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" role="img" aria-hidden="true">
            <defs>
              <clipPath id="eyeLoaderClip">
                <path d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" />
              </clipPath>
            </defs>
            <path className="eye-outline" d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" fill="#6c9a70" fillOpacity=".12" stroke="#4f7b57" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
            <g className="eye-iris-group">
              <ellipse className="eye-iris" cx="80" cy="51" rx="28" ry="31" fill="#4f7b57"/>
              <ellipse className="eye-pupil" cx="80" cy="51" rx="12" ry="15" fill="#e9efbd"/>
              <circle className="eye-glint" cx="84" cy="45" r="4" fill="#f8f9f4"/>
            </g>
            <g className="eye-lids" clipPath="url(#eyeLoaderClip)">
              <rect className="eye-lid eye-lid-top" x="10" y="10" width="140" height="41" fill="#f3f1e9" />
              <rect className="eye-lid eye-lid-bottom" x="10" y="51" width="140" height="41" fill="#f3f1e9" />
            </g>
          </svg>
        </span>
        <div className="eye-loader-text">
          <span className="eyebrow">EYE</span>
          <span className="loader-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  // null until the session check resolves, so an already-authenticated user
  // never sees the login form flash.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [publishedStories, setPublishedStories] = useState<Story[]>(readCachedStories);
  const [postsReady, setPostsReady] = useState(publishedStories.length > 0);
  const [initialDelayDone, setInitialDelayDone] = useState(publishedStories.length > 0);
  const [justPublished, setJustPublished] = useState(false);

  const allStories = publishedStories.length > 0 ? publishedStories : seedStories;

  useEffect(() => {
    let cancelled = false;
    getSession().then((user) => {
      if (!cancelled) setIsAuthenticated(!!user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialDelayDone) return;
    const timer = window.setTimeout(() => setInitialDelayDone(true), 450);
    return () => window.clearTimeout(timer);
  }, [initialDelayDone]);

  useEffect(() => {
    if (!justPublished) return;
    const timer = window.setTimeout(() => setJustPublished(false), 12000);
    return () => window.clearTimeout(timer);
  }, [justPublished]);

  useEffect(() => {
    let cancelled = false;
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setPostsReady(true);
    }, 5000);
    const finish = () => {
      if (cancelled) return;
      window.clearTimeout(failSafe);
      setPostsReady(true);
    };
    void fetchPublicPosts().then((posts) => {
      if (cancelled) return;
      if (posts) {
        const stories = posts.map(toStory);
        setPublishedStories(stories);
        writeCachedStories(stories);
      }
      finish();
    }).catch(finish);
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
    };
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    navigate("/admin", { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    navigate("/", { replace: true });
  };

  const handlePublish = async (story: Story): Promise<boolean> => {
    const saved = await createPost({
      title: story.title,
      excerpt: story.excerpt,
      content: story.content ?? story.excerpt,
      category: story.category,
      image: story.image,
      actionUrl: story.actionUrl ?? null,
      actionLabel: story.actionLabel ?? null,
      status: story.status ?? "published",
      mediaAssetId: story.mediaAssetId,
      linkHeaderAssetId: story.linkHeaderAssetId,
      audioAssetId: story.audioAssetId,
      videoAssetId: story.videoAssetId,
    });
    if (!saved) return false;
    if (saved.status === "published") {
      const publishedStory = toStory(saved);
      const nextStories = [publishedStory, ...publishedStories.filter((item) => item.id !== publishedStory.id)];
      setPublishedStories(nextStories);
      writeCachedStories(nextStories);
      setJustPublished(true);
      navigate("/", { replace: true });
    }
    return true;
  };

  const openAdmin = () => {
    // Routes are already gated by ADMIN_ENABLED; this stops the entry point from
    // navigating into a non-existent admin area.
    if (!ADMIN_ENABLED) return;
    if (isAuthenticated) navigate("/admin");
    else navigate("/admin/login");
  };

  return (
    <>
      <Suspense fallback={<EyeLoader />}> <SubscribePopup />
        <Routes>
          <Route
            path="/"
            element={
              postsReady && initialDelayDone ? (
                <PublicSite
                  stories={allStories}
                  openAdmin={openAdmin}
                  isAdmin={isAuthenticated === true}
                  justPublished={justPublished}
                />
              ) : (
                <EyeLoader />
              )
            }
          />
          {MEMBERSHIP_ENABLED && <Route path="/pricing" element={<Pricing />} />}
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<RefundPolicy />} />
          <Route path="/cookies" element={<CookiesPolicy />} />
          {ADMIN_ENABLED && (
            <>
              <Route
                path="/admin/login"
                element={
                  isAuthenticated === null ? (
                    <EyeLoader />
                  ) : isAuthenticated ? (
                    <Navigate to="/admin" replace />
                  ) : (
                    <AdminLogin onLogin={handleLogin} onBack={() => navigate("/")} />
                  )
                }
              />
              <Route
                path="/admin/*"
                element={
                  isAuthenticated === null ? (
                    <EyeLoader />
                  ) : isAuthenticated ? (
                    <AdminWorkspace closeAdmin={handleLogout} onPublish={handlePublish} />
                  ) : (
                    <Navigate to="/admin/login" replace />
                  )
                }
              />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <CookieConsent />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
