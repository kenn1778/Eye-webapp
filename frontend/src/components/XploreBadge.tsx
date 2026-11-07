import { useId } from "react";

/**
 * The Xplore badge: a thin ring, an X whose arms stop short of the centre
 * with angled cuts, and the whole north-east diagonal drawn as a 3D gold
 * arrow (bottom-left shaft, long faceted kite head pointing up-right).
 *
 * It is rendered inline (not as an <img>) so the ring and the X arms use
 * currentColor — the mark follows the ink of whatever surface it sits on:
 * light header, dark header, always-dark footers, admin sidebar, loader.
 * No invert() trick, no duplicate dark file. The gold arrow keeps its
 * facets in every theme.
 *
 * Give it a `label` when it stands alone (login, admin brand); leave it
 * out when the wordmark "Xplore" sits right next to it (header/footer).
 */
export function XploreBadge({
  className,
  size = 40,
  label,
}: {
  className?: string;
  size?: number;
  label?: string;
}) {
  const uid = useId();
  const shaft = `${uid}-shaft`;
  const faceLit = `${uid}-lit`;
  const faceDark = `${uid}-dark`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={shaft} x1="31.03" y1="64.97" x2="58.95" y2="38.05" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a5a14" />
          <stop offset=".45" stopColor="#d9a63f" />
          <stop offset=".75" stopColor="#eec25e" />
          <stop offset="1" stopColor="#b8831f" />
        </linearGradient>
        <linearGradient id={faceLit} x1="52" y1="31" x2="71" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f8dfa0" />
          <stop offset="1" stopColor="#e2ae3c" />
        </linearGradient>
        <linearGradient id={faceDark} x1="57.9" y1="38.1" x2="63.91" y2="44.11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a4711b" />
          <stop offset="1" stopColor="#7e5510" />
        </linearGradient>
      </defs>

      {/* ring */}
      <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" />

      {/* the two visible arms of the X — they stop short of the centre, where
          the arrow passes; the butt caps leave the angled cuts */}
      <path d="M31.03 31.03 L43.23 43.23" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="butt" />
      <path d="M52.77 52.77 L64.97 64.97" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="butt" />

      {/* gold arrow — rounded shaft, long faceted kite head */}
      <path d="M31.03 64.97 L58.95 38.05" fill="none" stroke={`url(#${shaft})`} strokeWidth="9" strokeLinecap="butt" />
      <polygon points="71.5 24.5 51.89 32.09 57.9 38.1" fill={`url(#${faceLit})`} />
      <polygon points="71.5 24.5 57.9 38.1 63.91 44.11" fill={`url(#${faceDark})`} />

      {/* cylindrical highlight along the shaft */}
      <path
        d="M33.5 62.5 L56 40"
        fill="none"
        stroke="rgba(255,236,160,.5)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
