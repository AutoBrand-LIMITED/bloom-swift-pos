import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useGoogleAddressSuggestions,
} from "@/hooks/useGoogleAddressSuggestions";

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
) => {
  const place = {
    formattedAddress,
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
  onAddressSelect?: (address: string) => void;
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

  it("fetches only the formatted address and preserves an omitted place name", async () => {
    const onAddressSelect = vi.fn();
    const selected = makePrediction(
      "巧運工業大廈",
      "觀塘駿業街66號",
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
      fields: ["formattedAddress"],
    });
    expect(onAddressSelect).toHaveBeenCalledOnce();
    expect(onAddressSelect).toHaveBeenCalledWith(
      "巧運工業大廈, 觀塘駿業街66號",
    );
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
      fields: ["formattedAddress"],
    });
    expect(onAddressSelect).toHaveBeenCalledOnce();
    expect(onAddressSelect).toHaveBeenCalledWith(
      "巧運工業大廈, 觀塘駿業街66號",
    );
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
    expect(onAddressSelect).toHaveBeenCalledWith("觀塘駿業街66號");
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

    expect(onAddressSelect).toHaveBeenCalledWith(
      "巧運工業大廈, 6 巧明街, 觀塘, 香港",
    );
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
    expect(onAddressSelect).toHaveBeenCalledWith("巧");

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
