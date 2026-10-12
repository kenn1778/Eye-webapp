import { useId } from "react";

export function HeroEye() {
  const uid = useId();
  const safeId = uid.replace(/:/g, "");
  const clipId = `heroEyeClip-${safeId}`;
  const irisClipId = `heroIrisClip-${safeId}`;

  return (
    <div className="hero-eye" aria-hidden="true">
      <svg
        className="eye-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 100"
      >
        <defs>
          {/* Both clips reuse the eye silhouette: the iris cannot spill outside
              the outline, and the lids need the same shape to cap it. */}
          <clipPath id={clipId}>
            <path d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" />
          </clipPath>
          <clipPath id={irisClipId}>
            <path d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" />
          </clipPath>
        </defs>
        <path className="eye-outline" d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" fill="#6c9a70" fillOpacity=".12" stroke="#4f7b57" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
        <g className="eye-iris-group" clipPath={`url(#${irisClipId})`}>
          <ellipse className="eye-iris" cx="80" cy="51" rx="28" ry="31" fill="#4f7b57"/>
          <ellipse className="eye-pupil" cx="80" cy="51" rx="12" ry="15" fill="#e9efbd"/>
          <circle className="eye-glint" cx="84" cy="45" r="4" fill="#f8f9f4"/>
        </g>
        <path className="eye-highlight-top" d="M17 46 C37 22 60 14 80 14 C103 14 124 24 143 48" fill="none" stroke="#6c9a70" strokeWidth="3" strokeLinecap="round" opacity=".8"/>
        <path className="eye-highlight-bottom" d="M21 58 C40 77 60 86 80 86 C101 86 121 77 140 56" fill="none" stroke="#6c9a70" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
        <g className="eye-lids" clipPath={`url(#${clipId})`}>
          <rect className="eye-lid eye-lid-top" x="10" y="10" width="140" height="41" fill="#f3f1e9" />
          <rect className="eye-lid eye-lid-bottom" x="10" y="51" width="140" height="41" fill="#f3f1e9" />
        </g>
      </svg>
    </div>
  );
}