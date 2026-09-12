import { useEffect, useId, useRef, useState } from "react";

// Brand mark used across header, footer and sidebar.
// Handles the eye interactions - blink, hover to close, letter hover and mouse tracking.
export function Brand() {
  const [hoveredLetter, setHoveredLetter] = useState<number | null>(null);
  const [eyeHovered, setEyeHovered] = useState(false);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const letters = ["E", "Y", "E"] as const;
  const uid = useId();
  const safeId = uid.replace(/:/g, "");
  const clipId = `eyeClip-${safeId}`;
  const titleId = `eyeTitle-${safeId}`;

  // Make the iris follow the cursor. Keeps the eye feeling alive.
  // Falls back to a slow idle drift when the mouse is still.
  useEffect(() => {
    let raf = 0;
    let lx = 0, ly = 0;
    let idlePhase = 0;
    let idleId: number | undefined;

    const onMove = (e: MouseEvent) => {
      if (eyeHovered || hoveredLetter !== null || !iconRef.current) return;

      const rect = iconRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);

      const maxX = 5.5, maxY = 3.2;
      const tx = Math.max(-maxX, Math.min(maxX, dx * maxX));
      const ty = Math.max(-maxY, Math.min(maxY, dy * maxY));

      lx += (tx - lx) * 0.18;
      ly += (ty - ly) * 0.18;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setEyePos({ x: lx, y: ly }));
    };

    const startIdle = () => {
      idleId = window.setInterval(() => {
        if (eyeHovered || hoveredLetter !== null) return;
        idlePhase += 0.04;
        const ix = Math.sin(idlePhase) * 2.2;
        const iy = Math.cos(idlePhase * 0.7) * 1.1;
        setEyePos(p => ({ x: p.x * 0.85 + ix * 0.15, y: p.y * 0.85 + iy * 0.15 }));
      }, 50);
    };

    startIdle();
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      if (idleId) clearInterval(idleId);
    };
  }, [eyeHovered, hoveredLetter]);

  const isTracking = (Math.abs(eyePos.x) > 0.1 || Math.abs(eyePos.y) > 0.1) && !eyeHovered && hoveredLetter === null;

  return (
    <span
      className={`brand ${eyeHovered ? "is-eye-hovered" : ""} ${hoveredLetter !== null ? `is-letter-${hoveredLetter}` : ""} ${isTracking ? "is-tracking" : ""}`}
      style={{ ["--eye-x" as string]: `${eyePos.x}px`, ["--eye-y" as string]: `${eyePos.y}px` } as React.CSSProperties}
    >
      <span
        ref={iconRef}
        className="brand-icon"
        aria-hidden="true"
        onMouseEnter={() => setEyeHovered(true)}
        onMouseLeave={() => setEyeHovered(false)}
        onFocus={() => setEyeHovered(true)}
        onBlur={() => setEyeHovered(false)}
        tabIndex={-1}
      >
        <svg
          className={`eye-svg ${eyeHovered ? "is-closed" : ""} ${hoveredLetter !== null ? `is-letter-${hoveredLetter}` : ""} ${isTracking ? "is-tracking" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 160 100"
          role="img"
          aria-labelledby={titleId}
          style={{ ["--eye-x" as string]: `${eyePos.x}px`, ["--eye-y" as string]: `${eyePos.y}px` } as React.CSSProperties}
        >
          <title id={titleId}>EYE logo</title>
          <defs>
            <clipPath id={clipId}>
              <path d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" />
            </clipPath>
          </defs>
          <path className="eye-outline" d="M12 51 C38 18 62 10 80 10 C101 10 126 23 148 51 C126 78 102 90 80 90 C58 90 34 79 12 51Z" fill="#6c9a70" fillOpacity=".12" stroke="#4f7b57" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
          <g className="eye-iris-group">
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
      </span>

      <span className="brand-text" aria-label="EYE">
        {letters.map((ch, i) => (
          <span
            key={i}
            className={`brand-letter brand-letter-${i} ${hoveredLetter === i ? "is-hovered" : ""}`}
            onMouseEnter={() => setHoveredLetter(i)}
            onMouseLeave={() => setHoveredLetter(null)}
            onFocus={() => setHoveredLetter(i)}
            onBlur={() => setHoveredLetter(null)}
            tabIndex={0}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}