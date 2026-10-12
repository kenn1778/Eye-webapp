// Build-time feature flags. Values come from Vite env vars (see .env.example).
// VITE_ENABLE_ADMIN gates the whole admin workspace. When off (the default),
// the /admin routes are not registered and the admin code is never loaded,
// keeping admin tooling out of production bundles unless deliberately enabled.

export const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === "true";