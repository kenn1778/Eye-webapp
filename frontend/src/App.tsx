import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./App.css";
import type { Story } from "./types";
import { seedStories } from "./data/seedData";
import { PublicSite } from "./pages/PublicSite";
import { AdminWorkspace } from "./pages/Admin/AdminWorkspace";
import { AdminLogin } from "./pages/Admin/AdminLogin";
import { PrivacyPolicy } from "./pages/Legal/PrivacyPolicy";
import { Terms } from "./pages/Legal/Terms";
import { RefundPolicy } from "./pages/Legal/RefundPolicy";
import { CookiesPolicy } from "./pages/Legal/CookiesPolicy";
import { CookieConsent } from "./components/CookieConsent";

// Small full-screen loader shown on first paint.
// Keeps the eye blinking for 2.1s so the app feels alive instead of a blank flash.
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

// Centralised routes so navigation is URL-driven and shareable.
// Public stays at /, admin is protected behind /admin/login.
function AppRoutes() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [publishedStories, setPublishedStories] = useState<Story[]>([]);

  const allStories = [...publishedStories, ...seedStories];

  const handleLogin = () => {
    setIsAuthenticated(true);
    navigate("/admin", { replace: true });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    navigate("/", { replace: true });
  };

  const handlePublish = (story: Story) => {
    setPublishedStories((prev) => [story, ...prev]);
    navigate("/", { replace: true });
  };

  const openAdmin = () => {
    if (isAuthenticated) navigate("/admin");
    else navigate("/admin/login");
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicSite stories={allStories} openAdmin={openAdmin} />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/refund" element={<RefundPolicy />} />
        <Route path="/cookies" element={<CookiesPolicy />} />
        <Route
          path="/admin/login"
          element={
            isAuthenticated ? (
              <Navigate to="/admin" replace />
            ) : (
              <AdminLogin onLogin={handleLogin} onBack={() => navigate("/")} />
            )
          }
        />
        <Route
          path="/admin/*"
          element={
            isAuthenticated ? (
              <AdminWorkspace closeAdmin={handleLogout} onPublish={handlePublish} />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieConsent />
    </>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setIsLoading(false), 2100);
    return () => window.clearTimeout(t);
  }, []);

  if (isLoading) return <EyeLoader />;

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
