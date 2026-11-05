import { useEffect, useState } from "react";

// Global transition overlay: the pulsing Xplore badge covers async moments such
// as a fresh load, a newsletter signup, joining a community, or posting a
// review. Any component can fire it without prop drilling via showEyeTransition().

const TRANSITION_EVENT = "eye:transition";
const DEFAULT_MS = 1500;
const FADE_MS = 420;

export function showEyeTransition(durationMs: number = DEFAULT_MS): void {
  window.dispatchEvent(new CustomEvent(TRANSITION_EVENT, { detail: durationMs }));
}

export function EyeTransition() {
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let hideTimer = 0;
    let removeTimer = 0;
    const onShow = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const duration = typeof detail === "number" && detail > 0 ? detail : DEFAULT_MS;
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
      setLeaving(false);
      setActive(true);
      hideTimer = window.setTimeout(() => setLeaving(true), duration);
      removeTimer = window.setTimeout(() => {
        setActive(false);
        setLeaving(false);
      }, duration + FADE_MS);
    };
    window.addEventListener(TRANSITION_EVENT, onShow);
    return () => {
      window.removeEventListener(TRANSITION_EVENT, onShow);
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  // Freeze the page while the overlay covers it so nothing is clicked mid-flight.
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("eye-transition-lock");
    return () => document.body.classList.remove("eye-transition-lock");
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={leaving ? "eye-transition is-leaving" : "eye-transition"}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="One moment"
    >
      <div className="eye-loader-card">
        <span className="brand-icon" aria-hidden="true">
          <img
            className="xplore-loader-badge"
            src="/xplore-badge.png"
            alt=""
            width={84}
            height={84}
            decoding="async"
            fetchPriority="high"
          />
        </span>
        <div className="eye-loader-text">
          <span className="eyebrow">Xplore</span>
          <span className="loader-dots" aria-hidden="true"><span /><span /><span /></span>
        </div>
      </div>
    </div>
  );
}
