/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'demo' (default) or 'live'. */
  readonly VITE_DATA_PROVIDER?: 'demo' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
