import { describe, expect, it } from "vitest";

import {
  createFrontendReleaseManifest,
  DEFAULT_API_CONTRACT_VERSION,
} from "../../release-manifest";

describe("frontend release manifest", () => {
  it("records the shared release and backend contract", () => {
    expect(
      createFrontendReleaseManifest({
        VITE_POS_RELEASE_ID: " uat-20260814-abcd1234 ",
        VITE_REQUIRED_BACKEND_CONTRACT: "1.0",
        VITE_BACKEND_URL: "https://backend.example.com/",
      }),
    ).toEqual({
      schemaVersion: 1,
      service: "frontend",
      releaseId: "uat-20260814-abcd1234",
      requiredBackendContract: "1.0",
      backendUrl: "https://backend.example.com",
    });
  });

  it("marks manual builds as unmanaged instead of inventing a matching release", () => {
    expect(createFrontendReleaseManifest({})).toEqual({
      schemaVersion: 1,
      service: "frontend",
      releaseId: "unmanaged",
      requiredBackendContract: DEFAULT_API_CONTRACT_VERSION,
      backendUrl: "",
    });
  });
});
