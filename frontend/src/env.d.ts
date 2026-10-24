interface ImportMetaEnv {
  /** Base URL of the backend API. Defaults to http://localhost:4000. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
