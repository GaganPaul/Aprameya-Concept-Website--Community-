/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMBER_SEASON_ID?: string
  readonly VITE_EMBER_SEASON_START?: string
  readonly VITE_EMBER_SEASON_END?: string
  readonly VITE_EMBER_HALL_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
