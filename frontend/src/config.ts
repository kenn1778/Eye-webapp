// Build-time flag: when off, /admin routes aren't registered and the admin
// bundle never loads. See .env.example for the Vite env vars.

export const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === "true";

// When off, the /pricing route and its nav link are not registered, so the
// default build is unchanged.
export const MEMBERSHIP_ENABLED = import.meta.env.VITE_ENABLE_MEMBERSHIP === "true";