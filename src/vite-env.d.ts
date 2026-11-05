/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to hide the site-wide prototype notice. Any other value (or unset) shows it. */
  readonly VITE_DEMO_MODE?: string
  /** "demo" (default, GitHub Pages) or "api" (local development against the Fastify catalog API). */
  readonly VITE_CATALOG_SOURCE?: string
  /** "demo" (default, GitHub Pages prototype sign-in) or "api" (local development against the Fastify auth API). */
  readonly VITE_AUTH_SOURCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
