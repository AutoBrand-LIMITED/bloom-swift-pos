import {
  importLibrary,
  setOptions,
  type LibraryMap,
} from "@googlemaps/js-api-loader";

const MASKED_ENV_VALUES = new Set(["[SENSITIVE]", "[REDACTED]"]);

let loaderConfigured = false;
let placesLibraryPromise: Promise<LibraryMap["places"]> | undefined;

export class GoogleMapsUnavailableError extends Error {
  constructor(message = "Google 地址搜尋暫時不可用") {
    super(message);
    this.name = "GoogleMapsUnavailableError";
  }
}

const googleMapsApiKey = () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

export const hasUsableGoogleMapsApiKey = () => {
  const key = googleMapsApiKey();
  return Boolean(key) && !MASKED_ENV_VALUES.has(key.toUpperCase());
};

export const loadGooglePlacesLibrary = (): Promise<LibraryMap["places"]> => {
  const key = googleMapsApiKey();
  if (!key || MASKED_ENV_VALUES.has(key.toUpperCase())) {
    return Promise.reject(new GoogleMapsUnavailableError());
  }

  if (!loaderConfigured) {
    setOptions({
      key,
      v: "weekly",
      language: "zh-HK",
      region: "HK",
      authReferrerPolicy: "origin",
    });
    loaderConfigured = true;
  }

  if (!placesLibraryPromise) {
    placesLibraryPromise = importLibrary("places").catch(() => {
      placesLibraryPromise = undefined;
      throw new GoogleMapsUnavailableError();
    });
  }

  return placesLibraryPromise;
};
