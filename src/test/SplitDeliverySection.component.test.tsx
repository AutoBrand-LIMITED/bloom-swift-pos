import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SplitDeliverySection from "@/components/pos/SplitDeliverySection";
import type { DeliverySplit } from "@/types/order";

const addressHookMocks = vi.hoisted(() => ({
  useGoogleAddressSuggestions: vi.fn(),
  clearSuggestions: vi.fn(),
  refreshSuggestions: vi.fn(),
  selectSuggestion: vi.fn(),
}));

vi.mock("@/hooks/useGoogleAddressSuggestions", () => ({
  useGoogleAddressSuggestions: addressHookMocks.useGoogleAddressSuggestions,
}));

const Harness = () => {
  const [splits, setSplits] = useState<DeliverySplit[]>([]);
  return (
    <SplitDeliverySection
      items={[{ id: "line-1", name: "Bouquet", price: 100, quantity: 2 }]}
      splits={splits}
      onChange={setSplits}
      defaultDeliveryDate="2026-08-18"
      defaultDeliveryTime="上午 09:00-13:00"
      defaultDeliveryTimeMode="slot"
      defaultDeliverySlotId={1}
      deliverySlots={[]}
      deliverySlotsLoading={false}
      deliverySlotsError={null}
      onRetryDeliverySlots={vi.fn()}
      senderType="personal"
      senderCompanyName=""
      senderName="Ms Chan"
      senderPhone="61234567"
    />
  );
};

describe("SplitDeliverySection fulfillment controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addressHookMocks.useGoogleAddressSuggestions.mockReturnValue({
      suggestions: [],
      status: "idle",
      clearSuggestions: addressHookMocks.clearSuggestions,
      refreshSuggestions: addressHookMocks.refreshSuggestions,
      selectSuggestion: addressHookMocks.selectSuggestion,
    });
  });

  it("creates an independent destination and allows switching it to pickup", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    expect(screen.getByRole("button", { name: "送貨" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "自取" }));
    expect(screen.getByText(/自取訂單只需選擇日期及時間/)).toBeVisible();
  });

  it("applies the sender name and phone to a split destination in one update", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));

    expect(screen.getByLabelText(/收貨人姓名／聯絡人姓名/)).toHaveValue("Ms Chan");
    expect(screen.getByLabelText("收貨人電話")).toHaveValue("61234567");
  });

  it("applies a Google address hierarchy to one split destination atomically", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const hookOptions = addressHookMocks.useGoogleAddressSuggestions.mock.calls.at(-1)?.[0];
    act(() => {
      hookOptions.onAddressSelect({
        address: "香港灣仔軒尼詩道 1 號",
        region: "香港島",
        district: "灣仔區",
        area: "灣仔",
      });
    });

    expect(screen.getByRole("combobox", { name: "送貨地區" })).toHaveTextContent("香港島");
    expect(screen.getByRole("combobox", { name: "送貨分區" })).toHaveTextContent("灣仔區");
    expect(screen.getByRole("combobox", { name: "送貨地點" })).toHaveTextContent("灣仔");
    expect(screen.getByPlaceholderText("搜尋並選擇 Google 地址")).toHaveValue(
      "香港灣仔軒尼詩道 1 號",
    );
  });

  it("keeps manual region and district selections in the controlled split", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const region = screen.getByRole("combobox", { name: "送貨地區" });
    fireEvent.click(region);
    fireEvent.click(screen.getByRole("option", { name: "九龍" }));

    expect(region).toHaveTextContent("九龍");
    const district = screen.getByRole("combobox", { name: "送貨分區" });
    expect(district).toBeEnabled();
    fireEvent.click(district);
    fireEvent.click(screen.getByRole("option", { name: "觀塘區" }));

    expect(region).toHaveTextContent("九龍");
    expect(district).toHaveTextContent("觀塘區");
    expect(screen.getByRole("combobox", { name: "送貨地點" })).toBeEnabled();
  });
});
