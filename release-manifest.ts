export const DEFAULT_API_CONTRACT_VERSION = "1.0";

export interface FrontendReleaseManifest {
  schemaVersion: 1;
  service: "frontend";
  releaseId: string;
  requiredBackendContract: string;
  backendUrl: string;
  googleMapsConfigured: boolean;
}

const MASKED_BROWSER_ENV_VALUES = new Set([
  "[SENSITIVE]",
  "SENSITIVE",
  "[REDACTED]",
  "REDACTED",
  "***",
]);

const hasUsableGoogleMapsApiKey = (
  env: Record<string, string | undefined>,
): boolean => {
  const value = env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  return Boolean(value && !MASKED_BROWSER_ENV_VALUES.has(value.toUpperCase()));
};

export const assertBrowserBuildEnvIsUsable = (
  env: Record<string, string | undefined>,
): void => {
  const releaseId = env.VITE_POS_RELEASE_ID?.trim();
  const googleMapsApiKey = env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (googleMapsApiKey && MASKED_BROWSER_ENV_VALUES.has(googleMapsApiKey.toUpperCase())) {
    throw new Error(
      "VITE_GOOGLE_MAPS_API_KEY contains a redacted placeholder. Build on Vercel with the real browser key instead of using a pulled sensitive value.",
    );
  }

  if (env.VERCEL && (!releaseId || releaseId === "unmanaged")) {
    throw new Error(
      "VITE_POS_RELEASE_ID is required for Vercel releases. Use the aligned release command instead of an automatic or raw Vercel deployment.",
    );
  }

  const isManagedRelease = Boolean(
    env.VERCEL ||
      (releaseId && releaseId !== "unmanaged"),
  );
  if (isManagedRelease && !hasUsableGoogleMapsApiKey(env)) {
    throw new Error(
      "VITE_GOOGLE_MAPS_API_KEY is required for managed releases. Build remotely on Vercel so the configured Preview/Production value is injected.",
    );
  }
};

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
  googleMapsConfigured: hasUsableGoogleMapsApiKey(env),
});
