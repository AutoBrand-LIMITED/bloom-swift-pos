import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
const recipientSearchMocks = vi.hoisted(() => ({
  searchOdooRecipients: vi.fn(),
}));

vi.mock("@/hooks/useGoogleAddressSuggestions", () => ({
  useGoogleAddressSuggestions: addressHookMocks.useGoogleAddressSuggestions,
}));
vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  searchOdooRecipients: recipientSearchMocks.searchOdooRecipients,
}));

const Harness = ({ initialSplits = [] }: { initialSplits?: DeliverySplit[] }) => {
  const [splits, setSplits] = useState<DeliverySplit[]>(initialSplits);
  const [activeHistoryAddressSplitId, setActiveHistoryAddressSplitId] = useState<string>();
  return (
    <>
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
        orderingCustomerId={42}
        senderPartnerId={42}
        activeHistoryAddressSplitId={activeHistoryAddressSplitId}
        onHistoryAddressTargetChange={setActiveHistoryAddressSplitId}
      />
      <output data-testid="split-state">{JSON.stringify(splits)}</output>
      <output data-testid="active-history-address-split">{activeHistoryAddressSplitId || "primary"}</output>
    </>
  );
};

const boundSplit = (
  id: string,
  recipientPartnerId: number,
  recipientName: string,
): DeliverySplit => ({
  id,
  fulfillmentType: "delivery",
  deliveryDate: "2026-08-18",
  deliveryTimeMode: "specified",
  deliveryTime: "15:00",
  deliveryRegion: "九龍",
  deliveryDistrict: "觀塘區",
  deliveryArea: "觀塘",
  deliveryDetail: `${recipientName} address`,
  deliveryAddress: `${recipientName} address`,
  deliveryGoogleAddress: `${recipientName} address`,
  deliveryBuilding: "",
  deliveryFloor: "",
  deliveryUnit: "",
  recipientType: "personal",
  recipientCompanyName: "",
  recipientName,
  recipientPhone: "61234567",
  recipientPartnerId,
  deliveryPerson: "",
  failedDeliveryAction: "none",
  deliveryNote: "",
  giftCardEnabled: false,
  giftCardMessage: "",
  itemAllocations: [],
});

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
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([]);
  });

  it("creates an independent destination and allows switching it to pickup", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    expect(screen.getByRole("button", { name: "送貨" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "自取" }));
    expect(screen.getByText(/自取訂單只需選擇日期及時間/)).toBeVisible();
  });

  it("targets the split destination that the cashier is editing", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const splits = JSON.parse(screen.getByTestId("split-state").textContent || "[]");
    const destinationThree = screen.getByRole("group", { name: "拆單收貨點 3" });

    fireEvent.mouseEnter(destinationThree);

    expect(screen.getByTestId("active-history-address-split")).toHaveTextContent(splits[1].id);
    expect(within(destinationThree).getByText("過往地址套用目標")).toBeVisible();

    fireEvent.focus(within(destinationThree).getByPlaceholderText("搜尋並選擇 Google 地址"));
    expect(screen.getByTestId("active-history-address-split")).toHaveTextContent(splits[1].id);
  });

  it("applies the sender name and phone to a split destination in one update", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));

    expect(screen.getByLabelText(/收貨人姓名／聯絡人姓名/)).toHaveValue("Ms Chan");
    expect(screen.getByLabelText("收貨人電話")).toHaveValue("61234567");
    const state = JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0];
    expect(state).toHaveProperty("recipientPartnerId", 42);
    expect(state).not.toHaveProperty("recipientOccasions");
    expect(state).not.toHaveProperty("recipientOccasionsVersion");
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

  it("keeps two split occasion lists and cards independent", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));

    const initialState = JSON.parse(screen.getByTestId("split-state").textContent || "[]");
    expect(initialState[0]).toMatchObject({ giftCardEnabled: false, giftCardMessage: "" });
    expect(initialState[0]).toHaveProperty("recipientOccasions", []);
    expect(initialState[1]).toMatchObject({ giftCardEnabled: false, giftCardMessage: "" });
    expect(initialState[1]).toHaveProperty("recipientOccasions", []);

    fireEvent.click(screen.getByRole("button", { name: "新增額外收貨資料 2 收花人重要日子" }));
    fireEvent.click(screen.getByRole("button", { name: "新增額外收貨資料 3 收花人重要日子" }));
    fireEvent.change(screen.getByLabelText("額外收貨資料 2 收花人重要日子 1 日期"), {
      target: { value: "1990-01-02" },
    });
    fireEvent.change(screen.getByLabelText("額外收貨資料 3 收花人重要日子 1 日期"), {
      target: { value: "1985-11-12" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "拆單收貨點 2 心意卡開關" }));
    fireEvent.change(screen.getByLabelText("拆單收貨點 2 心意卡內容"), {
      target: { value: "Destination two" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "拆單收貨點 3 心意卡開關" }));
    fireEvent.change(screen.getByLabelText("拆單收貨點 3 心意卡內容"), {
      target: { value: "Destination three" },
    });

    const state = JSON.parse(screen.getByTestId("split-state").textContent || "[]");
    expect(state[0]).toMatchObject({
      recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
      giftCardEnabled: true,
      giftCardMessage: "Destination two",
    });
    expect(state[1]).toMatchObject({
      recipientOccasions: [{ type: "birthday", date: "1985-11-12" }],
      giftCardEnabled: true,
      giftCardMessage: "Destination three",
    });
  });

  it("stores a suggested shipping partner until a recipient identity field changes", async () => {
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([{
      id: 90,
      recipientType: "personal",
      recipientCompanyName: null,
      recipientName: "Ms Gift",
      recipientPhone: "6123 4567",
      recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
      recipientOccasionsVersion: "recipient-85-v4",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 85,
      orderingCustomerId: 42,
      orderingCustomerName: null,
      orderingCustomerPhone: null,
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    }]);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const phone = screen.getByLabelText("收貨人電話");
    fireEvent.change(phone, { target: { value: "6" } });
    fireEvent.focus(phone);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    fireEvent.click(screen.getByRole("option", { name: /Ms Gift/ }));

    expect(JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0])
      .toMatchObject({
        recipientName: "Ms Gift",
        recipientPartnerId: 85,
        recipientOccasionsVersion: "recipient-85-v4",
      });

    fireEvent.change(screen.getByLabelText("額外收貨資料 2 收花人重要日子 1 日期"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "拆單收貨點 2 心意卡開關" }));
    fireEvent.change(screen.getByLabelText("拆單收貨點 2 心意卡內容"), {
      target: { value: "Keep the binding" },
    });
    expect(JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0])
      .toMatchObject({
        recipientPartnerId: 85,
        recipientOccasions: [{ type: "birthday", date: "" }],
        recipientOccasionsVersion: "recipient-85-v4",
      });

    fireEvent.change(screen.getByLabelText(/收貨人姓名／聯絡人姓名/), {
      target: { value: "Different Recipient" },
    });
    const changed = JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0];
    expect(changed).not.toHaveProperty("recipientPartnerId");
    expect(changed).not.toHaveProperty("recipientOccasionsVersion");
  });

  it("keeps an omitted suggestion birthday unknown while retaining its split binding", async () => {
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([{
      id: 91,
      recipientType: "personal",
      recipientCompanyName: null,
      recipientName: "Unknown Birthday",
      recipientPhone: "6123 4567",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 85,
      orderingCustomerId: 42,
      orderingCustomerName: null,
      orderingCustomerPhone: null,
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    }]);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const phone = screen.getByLabelText("收貨人電話");
    fireEvent.change(phone, { target: { value: "6" } });
    fireEvent.focus(phone);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    fireEvent.click(screen.getByRole("option", { name: /Unknown Birthday/ }));

    const state = JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0];
    expect(state).toHaveProperty("recipientPartnerId", 85);
    expect(state).not.toHaveProperty("recipientOccasions");
    expect(state).not.toHaveProperty("recipientBirthday");
  });

  it("keeps an explicit null suggestion birthday as a split clear", async () => {
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([{
      id: 92,
      recipientType: "personal",
      recipientCompanyName: null,
      recipientName: "Known Empty Birthday",
      recipientPhone: "6123 4567",
      recipientBirthday: null,
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 86,
      orderingCustomerId: 42,
      orderingCustomerName: null,
      orderingCustomerPhone: null,
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    }]);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const phone = screen.getByLabelText("收貨人電話");
    fireEvent.change(phone, { target: { value: "6" } });
    fireEvent.focus(phone);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    fireEvent.click(screen.getByRole("option", { name: /Known Empty Birthday/ }));

    expect(JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0])
      .toMatchObject({ recipientPartnerId: 86, recipientOccasions: [] });
  });

  it("keeps independent D2 and D3 partner bindings through occasion and card edits", () => {
    render(<Harness initialSplits={[
      boundSplit("split-2", 85, "Second Recipient"),
      boundSplit("split-3", 86, "Third Recipient"),
    ]} />);

    fireEvent.click(screen.getByRole("button", { name: "新增額外收貨資料 2 收花人重要日子" }));
    fireEvent.change(screen.getByLabelText("額外收貨資料 2 收花人重要日子 1 日期"), {
      target: { value: "1990-01-02" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "拆單收貨點 3 心意卡開關" }));
    fireEvent.change(screen.getByLabelText("拆單收貨點 3 心意卡內容"), {
      target: { value: "D3 card" },
    });

    const state = JSON.parse(screen.getByTestId("split-state").textContent || "[]");
    expect(state[0]).toMatchObject({
      recipientPartnerId: 85,
      recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
    });
    expect(state[1]).toMatchObject({
      recipientPartnerId: 86,
      giftCardEnabled: true,
      giftCardMessage: "D3 card",
    });
  });

  it("copies a foreign recipient without retaining its Odoo partner binding", async () => {
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([{
      id: 93,
      recipientType: "personal",
      recipientCompanyName: null,
      recipientName: "Other Customer Recipient",
      recipientPhone: "6123 4567",
      recipientOccasions: [{ id: 9, type: "birthday", date: "1992-03-04" }],
      recipientOccasionsVersion: "b".repeat(64),
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 85,
      orderingCustomerId: 99,
      orderingCustomerName: "Other Customer",
      orderingCustomerPhone: "69999999",
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    }]);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    const phone = screen.getByLabelText("收貨人電話");
    fireEvent.change(phone, { target: { value: "6" } });
    fireEvent.focus(phone);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    fireEvent.click(screen.getByRole("option", { name: /Other Customer Recipient/ }));

    const state = JSON.parse(screen.getByTestId("split-state").textContent || "[]")[0];
    expect(state).toMatchObject({
      recipientName: "Other Customer Recipient",
      recipientOccasions: [{ type: "birthday", date: "1992-03-04" }],
    });
    expect(state).not.toHaveProperty("recipientPartnerId");
    expect(state).not.toHaveProperty("recipientOccasionsVersion");
    expect(state.recipientOccasions[0]).not.toHaveProperty("id");
    expect(screen.queryByRole("button", { name: "只套用收貨人" })).not.toBeInTheDocument();
  });
});
