/// <reference types="vite/client" />

// Only non-secret, build-time flags belong here. Anything prefixed VITE_ is
// inlined into the public bundle, so never add credentials or API keys.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_ADMIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}