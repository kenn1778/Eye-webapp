// Build-time flag: when off, /admin routes aren't registered and the admin
// bundle never loads. See .env.example for the Vite env vars.

export const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === "true";