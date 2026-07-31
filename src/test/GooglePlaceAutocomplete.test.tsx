import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GooglePlaceAutocomplete from "@/components/pos/GooglePlaceAutocomplete";

const mapsMocks = vi.hoisted(() => ({
  hasUsableGoogleMapsApiKey: vi.fn(),
  loadGooglePlacesLibrary: vi.fn(),
}));

vi.mock("@/lib/google-maps", () => ({
  GoogleMapsUnavailableError: class extends Error {},
  ...mapsMocks,
}));

let latestOptions: google.maps.places.PlaceAutocompleteElementOptions | undefined;

class FakePlaceAutocompleteElement extends HTMLElement {
  value = "";

  constructor(options?: google.maps.places.PlaceAutocompleteElementOptions) {
    super();
    latestOptions = options;
  }
}

customElements.define("fake-place-autocomplete", FakePlaceAutocompleteElement);

const getAutocomplete = () => (
  document.querySelector("fake-place-autocomplete") as FakePlaceAutocompleteElement | null
);

const selectPlace = async (
  formattedAddress: string | null,
  fetchFields = vi.fn().mockResolvedValue(undefined),
) => {
  const place = {
    formattedAddress,
    fetchFields,
  };
  const event = new Event("gmp-select");
  Object.defineProperty(event, "placePrediction", {
    value: { toPlace: () => place },
  });

  await act(async () => {
    getAutocomplete()?.dispatchEvent(event);
    await Promise.resolve();
  });

  return fetchFields;
};

describe("GooglePlaceAutocomplete", () => {
  beforeEach(() => {
    latestOptions = undefined;
    mapsMocks.hasUsableGoogleMapsApiKey.mockReset();
    mapsMocks.loadGooglePlacesLibrary.mockReset();
    mapsMocks.hasUsableGoogleMapsApiKey.mockReturnValue(true);
    mapsMocks.loadGooglePlacesLibrary.mockResolvedValue({
      PlaceAutocompleteElement: FakePlaceAutocompleteElement,
    });
  });

  it("loads a Hong Kong-only widget and returns the selected formatted address", async () => {
    const onAddressSelect = vi.fn();
    render(
      <GooglePlaceAutocomplete
        onAddressSelect={onAddressSelect}
        resetRevision={0}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Google 地址搜尋")).toBeInTheDocument();
    });
    expect(latestOptions).toMatchObject({
      includedRegionCodes: ["hk"],
      requestedLanguage: "zh-HK",
      requestedRegion: "hk",
    });

    const fetchFields = await selectPlace(
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
    );

    expect(fetchFields).toHaveBeenCalledWith({ fields: ["formattedAddress"] });
    expect(onAddressSelect).toHaveBeenCalledWith(
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
    );
    expect(screen.getByText("請從 Google 建議清單揀選地址；仍可在下方手動修改。")).toBeVisible();
  });

  it("shows manual-entry guidance when no usable browser key is present", () => {
    mapsMocks.hasUsableGoogleMapsApiKey.mockReturnValue(false);

    render(
      <GooglePlaceAutocomplete onAddressSelect={vi.fn()} resetRevision={0} />,
    );

    expect(screen.getByText("Google 地址搜尋暫時不可用，請使用下方手動地址欄。")).toBeVisible();
    expect(mapsMocks.loadGooglePlacesLibrary).not.toHaveBeenCalled();
  });

  it("ignores an in-flight selection after the component unmounts", async () => {
    let resolveFetch: (() => void) | undefined;
    const fetchFields = vi.fn(() => new Promise<void>((resolve) => {
      resolveFetch = resolve;
    }));
    const onAddressSelect = vi.fn();
    const { unmount } = render(
      <GooglePlaceAutocomplete
        onAddressSelect={onAddressSelect}
        resetRevision={0}
      />,
    );
    await waitFor(() => expect(getAutocomplete()).toBeInTheDocument());

    const selection = selectPlace("Late address", fetchFields);
    unmount();
    resolveFetch?.();
    await selection;

    expect(onAddressSelect).not.toHaveBeenCalled();
  });

  it("falls back safely when Google reports a runtime widget error", async () => {
    render(
      <GooglePlaceAutocomplete onAddressSelect={vi.fn()} resetRevision={0} />,
    );
    await waitFor(() => expect(getAutocomplete()).toBeInTheDocument());

    act(() => {
      getAutocomplete()?.dispatchEvent(new Event("gmp-error"));
    });

    expect(screen.getByText("Google 地址搜尋暫時不可用，請使用下方手動地址欄。")).toBeVisible();
  });

  it("recreates an empty widget when the form reset revision changes", async () => {
    const onAddressSelect = vi.fn();
    const { rerender } = render(
      <GooglePlaceAutocomplete
        onAddressSelect={onAddressSelect}
        resetRevision={0}
      />,
    );
    await waitFor(() => expect(getAutocomplete()).toBeInTheDocument());
    const firstAutocomplete = getAutocomplete();
    if (firstAutocomplete) firstAutocomplete.value = "stale typed address";

    rerender(
      <GooglePlaceAutocomplete
        onAddressSelect={onAddressSelect}
        resetRevision={1}
      />,
    );

    await waitFor(() => {
      expect(getAutocomplete()).toBeInTheDocument();
      expect(getAutocomplete()).not.toBe(firstAutocomplete);
    });
    expect(getAutocomplete()?.value).toBe("");
    expect(mapsMocks.loadGooglePlacesLibrary).toHaveBeenCalledTimes(2);
  });

  it("ignores an in-flight selection after Google reports a widget error", async () => {
    let resolveFetch: (() => void) | undefined;
    const fetchFields = vi.fn(() => new Promise<void>((resolve) => {
      resolveFetch = resolve;
    }));
    const onAddressSelect = vi.fn();
    render(
      <GooglePlaceAutocomplete
        onAddressSelect={onAddressSelect}
        resetRevision={0}
      />,
    );
    await waitFor(() => expect(getAutocomplete()).toBeInTheDocument());

    await selectPlace("Stale address", fetchFields);
    act(() => {
      getAutocomplete()?.dispatchEvent(new Event("gmp-error"));
    });
    resolveFetch?.();
    await act(async () => {
      await Promise.resolve();
    });

    expect(onAddressSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Google 地址搜尋暫時不可用，請使用下方手動地址欄。")).toBeVisible();
  });
});
