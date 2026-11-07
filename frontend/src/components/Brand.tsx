import { XploreBadge } from "./XploreBadge";

/**
 * The app logo: the Xplore badge (ring + X + gold arrow), drawn inline so its
 * ink follows the surface colour automatically in light and dark mode.
 */
export function Brand() {
  return <XploreBadge className="brand brand-gif" size={40} label="Xplore" />;
}
