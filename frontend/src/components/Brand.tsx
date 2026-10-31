/**
 * The app logo. The animated mark is shared by the admin workspace, the legal
 * pages, and pricing; CSS keeps it round in every context (.brand-gif).
 */
export function Brand() {
  return (
    <img
      className="brand brand-gif"
      src="/exploor-logo.gif"
      alt="Exploor"
      width={40}
      height={40}
      decoding="async"
    />
  );
}
