import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useGoogleAddressSuggestions,
} from "@/hooks/useGoogleAddressSuggestions";
import type {
  GoogleAddressSelection,
  PlainGoogleAddressComponent,
} from "@/lib/hk-address";

const googleMocks = vi.hoisted(() => ({
  loadGooglePlacesLibrary: vi.fn(),
  fetchAutocompleteSuggestions: vi.fn(),
}));

vi.mock("@/lib/google-maps", () => ({
  loadGooglePlacesLibrary: googleMocks.loadGooglePlacesLibrary,
}));

let sessionTokenCount = 0;

class FakeSessionToken {
  readonly id = ++sessionTokenCount;
}

const makePrediction = (
  label: string,
  formattedAddress = label,
  fetchFields = vi.fn().mockResolvedValue(undefined),
  mainText: string | null = label.split(",")[0],
  addressComponents: PlainGoogleAddressComponent[] = [],
) => {
  const place = {
    formattedAddress,
    addressComponents,
    fetchFields,
  };
  const prediction = {
    text: { toString: () => label },
    mainText: mainText === null ? null : { toString: () => mainText },
    secondaryText: { toString: () => label.split(",").slice(1).join(",").trim() },
    toPlace: () => place,
  };
  return { prediction, place, fetchFields };
};

interface HarnessProps {
  value: string;
  region?: string;
  district?: string;
  area?: string;
  onAddressSelect?: (selection: GoogleAddressSelection) => void;
}

const Harness = ({
  value,
  region = "九龍",
  district = "觀塘區",
  area = "觀塘",
  onAddressSelect = vi.fn(),
}: HarnessProps) => {
  const {
    suggestions,
    status,
    clearSuggestions,
    selectSuggestion,
  } = useGoogleAddressSuggestions({
    value,
    region,
    district,
    area,
    onAddressSelect,
  });

  return (
    <div>
      <span data-testid="status">{status}</span>
      <button type="button" onClick={() => clearSuggestions(true)}>
        clear suggestions
      </button>
      {suggestions.map((suggestion) => (
        <button
          type="button"
          key={suggestion.label}
          onClick={() => void selectSuggestion(suggestion)}
        >
          {suggestion.mainText}
        </button>
      ))}
    </div>
  );
};

describe("useGoogleAddressSuggestions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionTokenCount = 0;
    googleMocks.loadGooglePlacesLibrary.mockResolvedValue({
      AutocompleteSessionToken: FakeSessionToken,
      AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: googleMocks.fetchAutocompleteSuggestions,
      },
    });
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({ suggestions: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches after the first nonblank character with Hong Kong context", async () => {
    const { prediction } = makePrediction(
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: prediction }],
    });
    render(<Harness value="巧" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(googleMocks.fetchAutocompleteSuggestions).toHaveBeenCalledWith({
      input: "九龍 觀塘區 觀塘 巧",
      includedRegionCodes: ["hk"],
      language: "zh-HK",
      region: "HK",
      sessionToken: expect.any(FakeSessionToken),
    });
    expect(screen.getByRole("button", { name: /巧運工業大廈/ })).toBeVisible();
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("does not send floor or unit details to Google", async () => {
    render(<Harness value="巧運工業大廈 4樓 A室 B08" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(googleMocks.fetchAutocompleteSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "九龍 觀塘區 觀塘 巧運工業大廈",
      }),
    );
  });

  it("ignores an older response after the user continues typing", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const firstPrediction = makePrediction("舊地址").prediction;
    const secondPrediction = makePrediction("巧運工業大廈").prediction;
    googleMocks.fetchAutocompleteSuggestions
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce({ suggestions: [{ placePrediction: secondPrediction }] });

    const { rerender } = render(<Harness value="巧" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    rerender(<Harness value="巧運" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getByRole("button", { name: "巧運工業大廈" })).toBeVisible();

    await act(async () => {
      resolveFirst?.({ suggestions: [{ placePrediction: firstPrediction }] });
      await Promise.resolve();
    });

    expect(screen.queryByRole("button", { name: "舊地址" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "巧運工業大廈" })).toBeVisible();
  });

  it("fetches the formatted address and components and emits the canonical hierarchy", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "觀塘駿業街66號",
      undefined,
      undefined,
      [
        {
          longText: "香港",
          shortText: "HK",
          types: ["country"],
        },
        {
          longText: "九龍",
          shortText: "九龍",
          types: ["administrative_area_level_1"],
        },
        {
          longText: "觀塘",
          shortText: "觀塘",
          types: ["neighborhood"],
        },
      ],
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));
      await Promise.resolve();
    });

    expect(selected.fetchFields).toHaveBeenCalledWith({
      fields: ["formattedAddress", "addressComponents"],
    });
    expect(onAddressSelect).toHaveBeenCalledOnce();
    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈, 觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("emits a derived region for a district-only component", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "觀塘工業中心",
      "觀塘駿業街66號",
      undefined,
      undefined,
      [{
        longText: "觀塘區",
        shortText: "觀塘區",
        types: ["administrative_area_level_2"],
      }],
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="觀" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "觀塘工業中心" }));
      await Promise.resolve();
    });

    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "觀塘工業中心, 觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("keeps unknown components unresolved instead of using street substrings", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "大埔道大廈",
      "九龍大埔道123號",
      undefined,
      undefined,
      [
        {
          longText: "大埔道",
          shortText: "大埔道",
          types: ["route"],
        },
        {
          longText: "香港",
          shortText: "HK",
          types: ["country"],
        },
      ],
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="大" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "大埔道大廈" }));
      await Promise.resolve();
    });

    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "大埔道大廈, 九龍大埔道123號",
      region: "",
      district: "",
      area: "",
    });
  });

  it("does not duplicate a place name already in the formatted address", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "巧運工業大廈, 觀塘駿業街66號",
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));
      await Promise.resolve();
    });

    expect(selected.fetchFields).toHaveBeenCalledWith({
      fields: ["formattedAddress", "addressComponents"],
    });
    expect(onAddressSelect).toHaveBeenCalledOnce();
    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈, 觀塘駿業街66號",
      region: "",
      district: "",
      area: "",
    });
  });

  it("does not prepend the full suggestion label when mainText is unavailable", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈, 觀塘駿業街",
      "觀塘駿業街66號",
      vi.fn().mockResolvedValue(undefined),
      null,
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "巧運工業大廈, 觀塘駿業街",
        }),
      );
      await Promise.resolve();
    });

    expect(
      screen.queryByRole("button", {
        name: "巧運工業大廈, 觀塘駿業街",
      }),
    ).not.toBeInTheDocument();
    expect(onAddressSelect).toHaveBeenCalledOnce();
    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "觀塘駿業街66號",
      region: "",
      district: "",
      area: "",
    });
  });

  it("falls back safely when Google Places is unavailable", async () => {
    googleMocks.loadGooglePlacesLibrary.mockRejectedValue(
      new Error("Google unavailable"),
    );
    render(<Harness value="巧" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    expect(screen.queryByRole("button", { name: "巧運工業大廈" })).not.toBeInTheDocument();
  });

  it("does not publish a selection when Place Details fails", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "觀塘駿業街66號",
      vi.fn().mockRejectedValue(new Error("Place Details unavailable")),
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    expect(onAddressSelect).not.toHaveBeenCalled();
  });

  it("does not publish a selection without a formatted address", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction("巧運工業大廈", "   ");
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unavailable");
    expect(onAddressSelect).not.toHaveBeenCalled();
  });

  it("keeps an explicit selection when the suggestion list is dismissed", async () => {
    let resolveFields: (() => void) | undefined;
    const fetchFields = vi.fn(() => new Promise<void>((resolve) => {
      resolveFields = resolve;
    }));
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      fetchFields,
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    render(<Harness value="巧" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));
    fireEvent.click(screen.getByRole("button", { name: "clear suggestions" }));
    await act(async () => {
      resolveFields?.();
      await Promise.resolve();
    });

    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      region: "",
      district: "",
      area: "",
    });
  });

  it("does not apply a selected result after the address hierarchy changes", async () => {
    let resolveFields: (() => void) | undefined;
    const fetchFields = vi.fn(() => new Promise<void>((resolve) => {
      resolveFields = resolve;
    }));
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      fetchFields,
    );
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    const { rerender } = render(
      <Harness value="巧" onAddressSelect={onAddressSelect} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.click(screen.getByRole("button", { name: "巧運工業大廈" }));

    rerender(
      <Harness
        value="巧"
        region="香港島"
        district="中西區"
        area="中環"
        onAddressSelect={onAddressSelect}
      />,
    );
    await act(async () => {
      resolveFields?.();
      await Promise.resolve();
    });

    expect(onAddressSelect).not.toHaveBeenCalled();
  });

  it("searches the first edit after a same-value selection", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction("巧", "巧");
    googleMocks.fetchAutocompleteSuggestions.mockResolvedValue({
      suggestions: [{ placePrediction: selected.prediction }],
    });
    const { rerender } = render(
      <Harness value="巧" onAddressSelect={onAddressSelect} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "巧" }));
      await Promise.resolve();
    });
    expect(onAddressSelect).toHaveBeenCalledWith({
      address: "巧",
      region: "",
      district: "",
      area: "",
    });

    googleMocks.fetchAutocompleteSuggestions.mockClear();
    rerender(<Harness value="巧運" onAddressSelect={onAddressSelect} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(googleMocks.fetchAutocompleteSuggestions).toHaveBeenCalledOnce();
    expect(googleMocks.fetchAutocompleteSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ input: "九龍 觀塘區 觀塘 巧運" }),
    );
  });

  it("does not publish a late response after unmount", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    googleMocks.fetchAutocompleteSuggestions.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    const onAddressSelect = vi.fn();
    const { unmount } = render(
      <Harness value="巧" onAddressSelect={onAddressSelect} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    unmount();
    await act(async () => {
      resolveFetch?.({
        suggestions: [{ placePrediction: makePrediction("遲到地址").prediction }],
      });
      await Promise.resolve();
    });

    expect(onAddressSelect).not.toHaveBeenCalled();
  });
});
