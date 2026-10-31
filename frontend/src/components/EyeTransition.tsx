import { useEffect, useState } from "react";

// Global transition overlay: the blinking eye covers async moments such as a
// fresh load, a newsletter signup, joining a community, or posting a review.
// Any component can fire it without prop drilling via showEyeTransition().

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
          <svg
            className="eye-svg is-loading"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 160 100"
            aria-hidden="true"
          >
            <defs>
              <clipPath id="eyeTransitionClip">
                <path d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" />
              </clipPath>
            </defs>
            <path
              className="eye-outline"
              d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z"
              fill="#0d9488"
              fillOpacity=".12"
              stroke="#0d9488"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g className="eye-iris-group">
              <ellipse className="eye-iris" cx="80" cy="51" rx="28" ry="31" fill="#14b8a6" />
              <ellipse className="eye-pupil" cx="80" cy="51" rx="12" ry="15" fill="#ccfbf1" />
              <circle className="eye-glint" cx="84" cy="45" r="4" fill="#f0fdfa" />
            </g>
            <g className="eye-lids" clipPath="url(#eyeTransitionClip)">
              <rect className="eye-lid eye-lid-top" x="10" y="10" width="140" height="41" fill="currentColor" />
              <rect className="eye-lid eye-lid-bottom" x="10" y="51" width="140" height="41" fill="currentColor" />
            </g>
          </svg>
        </span>
        <div className="eye-loader-text">
          <span className="eyebrow">Expl00r</span>
          <span className="loader-dots" aria-hidden="true"><span /><span /><span /></span>
        </div>
      </div>
    </div>
  );
}
