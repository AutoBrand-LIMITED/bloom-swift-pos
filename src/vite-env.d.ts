/// <reference types="vite/client" />
/// <reference types="google.maps" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_POS_RELEASE_ID?: string;
  readonly VITE_REQUIRED_BACKEND_CONTRACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
