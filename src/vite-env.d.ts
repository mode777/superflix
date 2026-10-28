/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PB_URL?: string;
  readonly VITE_DATA_SOURCE?: 'mock' | 'pocketbase';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
