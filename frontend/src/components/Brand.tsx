/**
 * The app logo: the Xplore badge (X-and-arrow mark in a ring). CSS flips it
 * to white on dark surfaces (.brand-gif contexts keep it round everywhere).
 */
export function Brand() {
  return (
    <img
      className="brand brand-gif"
      src="/xplore-badge.png"
      alt="Xplore"
      width={40}
      height={40}
      decoding="async"
      fetchPriority="high"
    />
  );
}
