/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AXIOM_TOKEN: string | undefined
  readonly VITE_AXIOM_DATASET: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
