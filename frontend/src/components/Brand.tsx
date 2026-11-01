/**
 * The app logo. The animated mark is shared by the admin workspace, the legal
 * pages, and pricing; CSS keeps it round in every context (.brand-gif).
 */
export function Brand() {
  return (
    <picture>
      <source srcSet="/exploor-logo.webp" type="image/webp" />
      <img
        className="brand brand-gif"
        src="/exploor-logo.gif"
        alt="Xplore"
        width={40}
        height={40}
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  );
}
