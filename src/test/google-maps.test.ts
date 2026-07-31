import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loaderMocks = vi.hoisted(() => ({
  importLibrary: vi.fn(),
  setOptions: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => loaderMocks);

describe("Google Maps loader", () => {
  beforeEach(() => {
    vi.resetModules();
    loaderMocks.importLibrary.mockReset();
    loaderMocks.setOptions.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["", "[SENSITIVE]", "[REDACTED]"])(
    "rejects unavailable key value %j without starting Google",
    async (key) => {
      vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", key);
      const { loadGooglePlacesLibrary } = await import("@/lib/google-maps");

      await expect(loadGooglePlacesLibrary()).rejects.toThrow(
        "Google 地址搜尋暫時不可用",
      );
      expect(loaderMocks.setOptions).not.toHaveBeenCalled();
      expect(loaderMocks.importLibrary).not.toHaveBeenCalled();
    },
  );

  it("configures the official loader once and caches the Places library", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "browser-key-for-test");
    const placesLibrary = { PlaceAutocompleteElement: class {} };
    loaderMocks.importLibrary.mockResolvedValue(placesLibrary);
    const { loadGooglePlacesLibrary } = await import("@/lib/google-maps");

    const first = loadGooglePlacesLibrary();
    const second = loadGooglePlacesLibrary();

    expect(first).toBe(second);
    await expect(first).resolves.toBe(placesLibrary);
    expect(loaderMocks.setOptions).toHaveBeenCalledOnce();
    expect(loaderMocks.setOptions).toHaveBeenCalledWith({
      key: "browser-key-for-test",
      v: "weekly",
      language: "zh-HK",
      region: "HK",
      authReferrerPolicy: "origin",
    });
    expect(loaderMocks.importLibrary).toHaveBeenCalledOnce();
    expect(loaderMocks.importLibrary).toHaveBeenCalledWith("places");
  });

  it("returns a safe error and permits a retry after a runtime load failure", async () => {
    const key = "do-not-expose-this-key";
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", key);
    loaderMocks.importLibrary
      .mockRejectedValueOnce(new Error(`Google rejected ${key}`))
      .mockResolvedValueOnce({ PlaceAutocompleteElement: class {} });
    const { loadGooglePlacesLibrary } = await import("@/lib/google-maps");

    let firstError: unknown;
    try {
      await loadGooglePlacesLibrary();
    } catch (error) {
      firstError = error;
    }
    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toBe("Google 地址搜尋暫時不可用");
    expect((firstError as Error).message).not.toContain(key);

    await expect(loadGooglePlacesLibrary()).resolves.toBeDefined();
    expect(loaderMocks.importLibrary).toHaveBeenCalledTimes(2);
    expect(loaderMocks.setOptions).toHaveBeenCalledOnce();
  });
});
