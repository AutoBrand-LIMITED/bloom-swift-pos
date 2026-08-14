export const DEFAULT_API_CONTRACT_VERSION = "1.0";

export interface FrontendReleaseManifest {
  schemaVersion: 1;
  service: "frontend";
  releaseId: string;
  requiredBackendContract: string;
  backendUrl: string;
}

const readValue = (
  env: Record<string, string | undefined>,
  key: string,
  fallback: string,
) => env[key]?.trim() || fallback;

export const createFrontendReleaseManifest = (
  env: Record<string, string | undefined>,
): FrontendReleaseManifest => ({
  schemaVersion: 1,
  service: "frontend",
  releaseId: readValue(env, "VITE_POS_RELEASE_ID", "unmanaged"),
  requiredBackendContract: readValue(
    env,
    "VITE_REQUIRED_BACKEND_CONTRACT",
    DEFAULT_API_CONTRACT_VERSION,
  ),
  backendUrl: readValue(env, "VITE_BACKEND_URL", "").replace(/\/$/, ""),
});
