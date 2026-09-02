import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeliverySection from "@/components/pos/DeliverySection";
import type { DeliverySlot } from "@/lib/odoo-api";

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

const slots: DeliverySlot[] = [
  { id: 11, displayLabel: "上午 09:00-13:00", startTime: "09:00", endTime: "13:00" },
  { id: 12, displayLabel: "下午 13:00-18:00", startTime: "13:00", endTime: "18:00" },
];

function renderSection(overrides: Partial<React.ComponentProps<typeof DeliverySection>> = {}) {
  const props: React.ComponentProps<typeof DeliverySection> = {
    fulfillmentType: "delivery",
    deliveryDate: "2026-07-17",
    deliveryTime: "",
    deliveryTimeMode: undefined,
    deliverySlotId: undefined,
    deliverySlots: slots,
    deliverySlotsLoading: false,
    deliverySlotsError: null,
    deliveryTimeError: null,
    legacyDeliveryTime: false,
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    deliveryBuilding: "",
    deliveryFloor: "",
    deliveryUnit: "",
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    onDateChange: vi.fn(),
    onFulfillmentTypeChange: vi.fn(),
    onTimeChange: vi.fn(),
    onSlotChange: vi.fn(),
    onSpecifiedTimeSelect: vi.fn(),
    onRetryDeliverySlots: vi.fn(),
    onRegionChange: vi.fn(),
    onDistrictChange: vi.fn(),
    onAreaChange: vi.fn(),
    onDetailChange: vi.fn(),
    onBuildingChange: vi.fn(),
    onFloorChange: vi.fn(),
    onUnitChange: vi.fn(),
    onGoogleAddressSelect: vi.fn(),
    onRecipientTypeChange: vi.fn(),
    onRecipientCompanyNameChange: vi.fn(),
    onRecipientNameChange: vi.fn(),
    onRecipientPhoneChange: vi.fn(),
    onRecipientSuggestionSelect: vi.fn(),
    onRecipientAndCustomerSuggestionSelect: vi.fn(),
    onDeliveryPersonChange: vi.fn(),
    onFailedDeliveryActionChange: vi.fn(),
    ...overrides,
  };
  render(<DeliverySection {...props} />);
  return props;
}

describe("DeliverySection delivery time controls", () => {
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

  it("renders backend slots as touch choices and returns the selected slot", () => {
    const props = renderSection({ deliveryTimeMode: "slot", deliverySlotId: 11 });

    expect(screen.getByRole("radio", { name: "上午 09:00-13:00" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "下午 13:00-18:00" }));

    expect(props.onSlotChange).toHaveBeenCalledWith(slots[1]);
  });

  it("shows only date and time details for pickup orders", () => {
    const props = renderSection({ fulfillmentType: "pickup" });

    expect(screen.getByText(/自取訂單只需選擇日期及時間/)).toBeVisible();
    expect(screen.queryByLabelText("送貨地區")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/收貨人姓名/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /送貨/ }));
    expect(props.onFulfillmentTypeChange).toHaveBeenCalledWith("delivery");
  });

  it("copies the sender into the recipient fields with one confirmation", () => {
    const props = renderSection({
      senderType: "company",
      senderCompanyName: "Sender Limited",
      senderName: "Ms Chan",
      senderPhone: "+852 6123 4567",
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));

    expect(props.onRecipientTypeChange).toHaveBeenCalledWith("company");
    expect(props.onRecipientCompanyNameChange).toHaveBeenCalledWith("Sender Limited");
    expect(props.onRecipientNameChange).toHaveBeenCalledWith("Ms Chan");
    expect(props.onRecipientPhoneChange).toHaveBeenCalledWith("+852 6123 4567");
  });

  it("copies all sender fields through one atomic recipient update when provided", () => {
    const onRecipientDetailsChange = vi.fn();
    const props = renderSection({
      senderType: "company",
      senderCompanyName: "Sender Limited",
      senderName: "Ms Chan",
      senderPhone: "+852 6123 4567",
      onRecipientDetailsChange,
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));

    expect(onRecipientDetailsChange).toHaveBeenCalledTimes(1);
    expect(onRecipientDetailsChange).toHaveBeenCalledWith({
      type: "company",
      companyName: "Sender Limited",
      name: "Ms Chan",
      phone: "+852 6123 4567",
      occasions: [],
    });
    expect(props.onRecipientTypeChange).not.toHaveBeenCalled();
    expect(props.onRecipientCompanyNameChange).not.toHaveBeenCalled();
    expect(props.onRecipientNameChange).not.toHaveBeenCalled();
    expect(props.onRecipientPhoneChange).not.toHaveBeenCalled();
  });

  it("lets the parent preserve the verified sender partner binding", () => {
    const onUseSenderAsRecipient = vi.fn();
    renderSection({
      senderName: "Ms Chan",
      senderPhone: "+852 6123 4567",
      onUseSenderAsRecipient,
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));

    expect(onUseSenderAsRecipient).toHaveBeenCalledWith({
      type: "personal",
      companyName: "",
      name: "Ms Chan",
      phone: "+852 6123 4567",
      occasions: [],
    });
  });

  it("restores the previous recipient when same-as-sender is cancelled", () => {
    const props = renderSectionProps({
      recipientType: "personal",
      recipientCompanyName: "",
      recipientName: "Original Recipient",
      recipientPhone: "+852 6999 9999",
      senderType: "company",
      senderCompanyName: "Sender Limited",
      senderName: "Ms Chan",
      senderPhone: "+852 6123 4567",
    });
    const view = render(<DeliverySection {...props} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "收貨人同送花人相同" }));
    view.rerender(<DeliverySection
      {...props}
      recipientType="company"
      recipientCompanyName="Sender Limited"
      recipientName="Ms Chan"
      recipientPhone="+852 6123 4567"
    />);

    const checkbox = screen.getByRole("checkbox", { name: "收貨人同送花人相同" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(props.onRecipientTypeChange).toHaveBeenLastCalledWith("personal");
    expect(props.onRecipientCompanyNameChange).toHaveBeenLastCalledWith("");
    expect(props.onRecipientNameChange).toHaveBeenLastCalledWith("Original Recipient");
    expect(props.onRecipientPhoneChange).toHaveBeenLastCalledWith("+852 6999 9999");
  });

  it("toggles company recipient details while keeping the contact required", () => {
    const props = renderSection({
      recipientType: "company",
      recipientCompanyName: "Company Recipient Limited",
      recipientCompanyNameError: "公司收貨人必須輸入公司名稱",
    });

    expect(screen.getByRole("button", { name: /公司/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/收貨公司名稱/)).toHaveValue("Company Recipient Limited");
    expect(screen.getByLabelText(/收貨公司名稱/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/聯絡人姓名/)).toBeRequired();

    fireEvent.click(screen.getByRole("button", { name: /個人/ }));
    expect(props.onRecipientTypeChange).toHaveBeenCalledWith("personal");
  });

  it("searches historical recipients from the first phone digit and applies a suggestion", async () => {
    const suggestion = {
      id: 90,
      recipientType: "personal" as const,
      recipientCompanyName: null,
      recipientName: "Ms Gift",
      recipientPhone: "6123 4567",
      recipientOccasions: [{ type: "birthday" as const, date: "1990-01-02" }],
      recipientOccasionsVersion: "recipient-45-v2",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 45,
      orderingCustomerId: null,
      orderingCustomerName: null,
      orderingCustomerPhone: null,
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    };
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([suggestion]);
    const props = renderSection({
      recipientPhone: "6",
      onRecipientSuggestionSelect: vi.fn(),
    });

    fireEvent.focus(screen.getByLabelText(/收貨人電話/));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect(recipientSearchMocks.searchOdooRecipients).toHaveBeenCalledWith(
      "6",
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("option", { name: /Ms Gift/ }));
    expect(props.onRecipientSuggestionSelect).toHaveBeenCalledWith(suggestion);
  });

  it("edits repeatable recipient occasion types without asking for a full date", () => {
    const onRecipientOccasionsChange = vi.fn();
    renderSection({
      recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
      onRecipientOccasionsChange,
    });

    const birthday = screen.getByLabelText("收貨方式 收花人重要日子 1 日期");
    expect(birthday).toHaveTextContent("1 月 2 日");

    fireEvent.click(screen.getByRole("combobox", { name: "收貨方式 收花人重要日子 1 類型" }));
    fireEvent.click(screen.getByRole("option", { name: "週年" }));
    expect(onRecipientOccasionsChange).toHaveBeenCalledWith([{
      type: "anniversary",
      date: "1990-01-02",
    }]);
  });

  it("offers an explicit new-recipient action when the search has no matches", async () => {
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([]);
    const onConfirmNewRecipient = vi.fn();
    renderSection({
      recipientName: "Wong Ng",
      recipientPhone: "67610705",
      onConfirmNewRecipient,
    });

    fireEvent.focus(screen.getByLabelText(/收貨人姓名/));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(screen.getByText("未找到過往收貨人")).toBeVisible();
    expect(screen.getByTestId("recipient-resolution-panel")).toHaveTextContent(
      "當前資料有效時仍可繼續下單",
    );
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox", { name: "過往收貨人搜尋結果" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "確認新增收貨人" }));

    expect(onConfirmNewRecipient).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("recipient-resolution-panel")).toHaveTextContent(
      "已確認當前收貨人",
    );
    expect(screen.queryByRole("listbox", { name: "過往收貨人搜尋結果" })).not.toBeInTheDocument();
  });

  it("keeps a correlated recipient lookup error visible and retryable after the dropdown closes", async () => {
    recipientSearchMocks.searchOdooRecipients.mockRejectedValue(new Error("Recipient timeout"));
    renderSection({
      recipientName: "Wong Ng",
      recipientPhone: "67610705",
    });

    fireEvent.focus(screen.getByLabelText(/收貨人姓名/));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(screen.getByText("Recipient timeout")).toBeVisible();
    fireEvent.mouseDown(document.body);
    expect(screen.getByTestId("recipient-resolution-panel")).toHaveTextContent(
      "當前有效收貨資料不會因此被阻擋",
    );
    fireEvent.click(screen.getByRole("button", { name: /重試收貨人搜尋/ }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(recipientSearchMocks.searchOdooRecipients).toHaveBeenCalledTimes(2);
  });

  it("searches historical recipients by recipient company name", async () => {
    const suggestion = {
      id: 92,
      recipientType: "company" as const,
      recipientCompanyName: "Flower Trading Limited",
      recipientName: "Ms Lee",
      recipientPhone: "6123 4567",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 47,
      orderingCustomerId: null,
      orderingCustomerName: null,
      orderingCustomerPhone: null,
      orderingCustomerEmail: null,
      orderingCustomerBillingAddress: null,
    };
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([suggestion]);
    const props = renderSection({
      recipientType: "company",
      recipientCompanyName: "Flower",
    });

    fireEvent.focus(screen.getByLabelText(/收貨公司名稱/));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(recipientSearchMocks.searchOdooRecipients).toHaveBeenCalledWith(
      "Flower",
      expect.any(AbortSignal),
    );
    fireEvent.click(screen.getByRole("option", { name: /Flower Trading Limited/ }));
    expect(props.onRecipientSuggestionSelect).toHaveBeenCalledWith(suggestion);
  });

  it("shows the linked ordering customer and supports combined or recipient-only apply", async () => {
    const suggestion = {
      id: 91,
      recipientType: "personal" as const,
      recipientCompanyName: null,
      recipientName: "Jay Ng",
      recipientPhone: "67610707",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 46,
      orderingCustomerId: 42,
      orderingCustomerName: "Secretary Chan",
      orderingCustomerPhone: "91234567",
      orderingCustomerEmail: "accounts@example.com",
      orderingCustomerBillingAddress: "Central",
    };
    recipientSearchMocks.searchOdooRecipients.mockResolvedValue([suggestion]);
    const props = renderSection({ recipientPhone: "6761" });
    const phoneInput = screen.getByLabelText(/收貨人電話/);

    fireEvent.focus(phoneInput);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(screen.getByText("下單人：Secretary Chan · 91234567")).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: /Jay Ng/ }));
    expect(props.onRecipientAndCustomerSuggestionSelect).toHaveBeenCalledWith(suggestion);
    expect(props.onRecipientSuggestionSelect).not.toHaveBeenCalled();

    fireEvent.focus(phoneInput);
    expect(await screen.findByRole("button", { name: "只套用收貨人" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "只套用收貨人" }));
    expect(props.onRecipientSuggestionSelect).toHaveBeenCalledWith(suggestion);
    expect(recipientSearchMocks.searchOdooRecipients).toHaveBeenCalledTimes(1);
  });

  it("uses roving focus and arrow keys to select the next delivery choice", async () => {
    const props = renderSection({ deliveryTimeMode: "slot", deliverySlotId: 11 });
    const morning = screen.getByRole("radio", { name: "上午 09:00-13:00" });
    const afternoon = screen.getByRole("radio", { name: "下午 13:00-18:00" });

    await act(async () => {
      morning.focus();
      fireEvent.keyDown(morning, { key: "ArrowRight", code: "ArrowRight" });
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyUp(afternoon, { key: "ArrowRight", code: "ArrowRight" });
    });

    expect(afternoon).toHaveFocus();
    expect(props.onSlotChange).toHaveBeenCalledWith(slots[1]);
  });

  it("shows the frozen pending snapshot when the live slot keeps its ID but changes label", () => {
    renderSection({
      deliveryTime: "上午 09:00-13:00",
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      frozenSlotSelection: { slotId: 11, snapshot: "上午 09:00-13:00" },
      deliverySlots: [{ ...slots[0], displayLabel: "早上 09:00-13:00（新）" }, slots[1]],
    });

    expect(screen.getByRole("radio", { name: "上午 09:00-13:00" })).toBeChecked();
    expect(screen.queryByText("早上 09:00-13:00（新）")).not.toBeInTheDocument();
  });

  it("shows a specified-time selector in 15-minute intervals", () => {
    const props = renderSection({
      deliveryTimeMode: "specified",
      deliveryTimeError: "請輸入指定送貨時間",
    });

    const hourSelector = screen.getByRole("combobox", { name: "指定送貨時間 小時" });
    const minuteSelector = screen.getByRole("combobox", { name: "指定送貨時間 分鐘" });
    expect(hourSelector).toHaveAttribute("aria-invalid", "true");
    expect(minuteSelector).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("指定時間可能另收附加費")).toBeVisible();
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent("請輸入指定送貨時間");

    fireEvent.click(hourSelector);
    fireEvent.click(screen.getByRole("option", { name: "上午 10 時" }));
    fireEvent.click(minuteSelector);
    expect(screen.queryByRole("option", { name: "02 分" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "15 分" }));
    expect(props.onTimeChange).toHaveBeenCalledWith("10:15");
  });

  it("renders loading, error/retry, and empty backend states without hiding specified time", () => {
    const { rerender } = render(<DeliverySection
      {...renderSectionProps({ deliverySlots: [], deliverySlotsLoading: true })}
    />);
    expect(screen.getByText("正在載入標準時段...")).toBeVisible();

    const retry = vi.fn();
    rerender(<DeliverySection {...renderSectionProps({
      deliverySlots: [],
      deliverySlotsLoading: false,
      deliverySlotsError: "時段服務暫時不可用",
      onRetryDeliverySlots: retry,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: /重試/ }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(<DeliverySection {...renderSectionProps({ deliverySlots: [] })} />);
    expect(screen.getByText("目前沒有標準時段")).toBeVisible();
    expect(screen.getByRole("radio", { name: "指定時間" })).toBeVisible();
  });

  it("shows legacy pending time as read-only and requires a new mode selection", () => {
    renderSection({ legacyDeliveryTime: true, deliveryTime: "14:00", deliverySlots: [] });

    expect(screen.getByRole("textbox", { name: "舊格式送貨時間" })).toHaveValue("14:00");
    expect(screen.getByRole("textbox", { name: "舊格式送貨時間" })).toHaveAttribute("readonly");
    expect(screen.getByRole("radio", { name: "指定時間" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("請重新選擇");
  });

  it("shows accessible inline errors for required delivery details", () => {
    renderSection({
      deliveryDate: "",
      deliveryDateError: "請選擇送貨日期",
      deliveryTimeError: "請選擇送貨時間",
      deliveryAddressError: "請輸入送貨地址",
      recipientNameError: "請輸入收花人姓名",
      recipientPhoneError: "請輸入收花人電話",
    });

    expect(screen.getByLabelText("送貨日期")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/送貨地址/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/收貨人姓名/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/收貨人電話/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert")).toHaveLength(5);
  });

  it("uses the existing detail field as the only Google address input", () => {
    const props = renderSection();
    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");

    expect(screen.queryByLabelText("Google 地址搜尋")).not.toBeInTheDocument();
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    fireEvent.focus(input);
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    fireEvent.change(input, { target: { value: "巧" } });

    expect(props.onDetailChange).toHaveBeenCalledWith("巧");
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it("does not search a programmatically populated address until the user edits it", () => {
    const { rerender } = render(
      <DeliverySection {...renderSectionProps({ deliveryDetail: "" })} />,
    );
    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "巧" } });
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );

    rerender(
      <DeliverySection {...renderSectionProps({
        deliveryDetail: "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      })} />,
    );
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.queryByTitle("Google Map")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /顯示 Google 地圖/ }));
    expect(screen.getByTitle("Google Map")).toBeVisible();
  });

  it("resets manual-search intent when only the address hierarchy changes", () => {
    const { rerender } = render(
      <DeliverySection {...renderSectionProps({ deliveryDetail: "" })} />,
    );
    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "巧" } });

    rerender(
      <DeliverySection {...renderSectionProps({ deliveryDetail: "巧" })} />,
    );
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );

    rerender(
      <DeliverySection {...renderSectionProps({
        deliveryRegion: "九龍",
        deliveryDistrict: "觀塘區",
        deliveryArea: "觀塘",
        deliveryDetail: "巧",
      })} />,
    );
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("stops autocomplete immediately after a Google suggestion is selected", () => {
    renderSection({ deliveryDetail: "巧" });
    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "巧運" } });
    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );

    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];
    act(() => {
      hookOptions.onAddressSelect({
        address: "巧運工業大廈, 觀塘駿業街66號",
        region: "九龍",
        district: "觀塘區",
        area: "觀塘",
      });
    });

    expect(addressHookMocks.useGoogleAddressSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("forwards a complete Google hierarchy as one structured selection", () => {
    const props = renderSection({
      deliveryRegion: "香港島",
      deliveryDistrict: "中西區",
      deliveryArea: "中環",
      deliveryDetail: "巧",
    });
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "巧運工業大廈, 觀塘駿業街66號",
        region: "九龍",
        district: "觀塘區",
        area: "觀塘",
      });
    });

    expect(props.onGoogleAddressSelect).toHaveBeenCalledOnce();
    expect(props.onGoogleAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈, 觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("clears the previous area for a district-only Google result", () => {
    const props = renderSection({
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "九龍灣",
      deliveryDetail: "巧",
    });
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "巧運工業大廈, 觀塘駿業街66號",
        region: "九龍",
        district: "觀塘區",
        area: "",
      });
    });

    expect(props.onGoogleAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈, 觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("clears incompatible stale children for a partial Google result", () => {
    const props = renderSection({
      deliveryRegion: "香港島",
      deliveryDistrict: "中西區",
      deliveryArea: "中環",
      deliveryDetail: "巧",
    });
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "觀塘駿業街66號",
        region: "九龍",
        district: "觀塘區",
        area: "",
      });
    });

    expect(props.onGoogleAddressSelect).toHaveBeenCalledWith({
      address: "觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("clears manual hierarchy when Google components and legacy prefix are unresolved", () => {
    const props = renderSection({
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "觀塘",
      deliveryDetail: "巧",
    });
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "觀塘駿業街66號",
        region: "",
        district: "",
        area: "",
      });
    });

    expect(props.onGoogleAddressSelect).toHaveBeenCalledWith({
      address: "觀塘駿業街66號",
      region: "",
      district: "",
      area: "",
    });
  });

  it("preserves the legacy recognised-prefix fallback when components are unresolved", () => {
    const props = renderSection({
      deliveryRegion: "",
      deliveryDistrict: "",
      deliveryArea: "",
      deliveryDetail: "巧",
    });
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "九龍 觀塘區 觀塘 巧運工業大廈",
        region: "",
        district: "",
        area: "",
      });
    });

    expect(props.onGoogleAddressSelect).toHaveBeenCalledWith({
      address: "巧運工業大廈",
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("authorizes the map signature calculated from the selected Google hierarchy", () => {
    const onGoogleAddressSelect = vi.fn();
    const props = renderSectionProps({
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "九龍灣",
      deliveryDetail: "巧",
      onGoogleAddressSelect,
    });
    const { rerender } = render(<DeliverySection {...props} />);
    const calls = addressHookMocks.useGoogleAddressSuggestions.mock.calls;
    const hookOptions = calls[calls.length - 1][0];

    act(() => {
      hookOptions.onAddressSelect({
        address: "巧運工業大廈, 觀塘駿業街66號",
        region: "九龍",
        district: "觀塘區",
        area: "",
      });
    });
    const selectedAddress = onGoogleAddressSelect.mock.calls.at(-1)?.[0];
    expect(selectedAddress).toEqual({
      address: "巧運工業大廈, 觀塘駿業街66號",
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
    rerender(<DeliverySection
      {...props}
      deliveryRegion={selectedAddress?.region ?? ""}
      deliveryDistrict={selectedAddress?.district ?? ""}
      deliveryArea={selectedAddress?.area ?? ""}
      deliveryDetail={selectedAddress?.address ?? ""}
    />);

    const map = screen.getByTitle("Google Map");
    expect(map).toBeVisible();
    expect(map).toHaveAttribute(
      "src",
      `https://www.google.com/maps?q=${encodeURIComponent(
        "九龍 觀塘區 巧運工業大廈, 觀塘駿業街66號 香港",
      )}&output=embed`,
    );
  });

  it("never renders a map for a replacement address before fresh authorization", () => {
    const { rerender } = render(
      <DeliverySection {...renderSectionProps({ deliveryDetail: "舊地址" })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /顯示 Google 地圖/ }));
    expect(screen.getByTitle("Google Map")).toBeVisible();

    rerender(
      <DeliverySection {...renderSectionProps({ deliveryDetail: "新地址" })} />,
    );

    expect(screen.queryByTitle("Google Map")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /顯示 Google 地圖/ })).toBeVisible();
  });

  it("shows Google suggestions directly below the detail field and selects one", () => {
    const suggestion = {
      label: "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      mainText: "巧運工業大廈",
      secondaryText: "6 巧明街, 觀塘, 香港",
      prediction: {},
    };
    addressHookMocks.useGoogleAddressSuggestions.mockReturnValue({
      suggestions: [suggestion],
      status: "ready",
      clearSuggestions: addressHookMocks.clearSuggestions,
      refreshSuggestions: addressHookMocks.refreshSuggestions,
      selectSuggestion: addressHookMocks.selectSuggestion,
    });
    renderSection({ deliveryDetail: "巧" });

    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");
    const option = screen.getByRole("option", { name: /巧運工業大廈/ });
    expect(input.parentElement).toContainElement(screen.getByRole("listbox", { name: "Google 地址建議" }));

    fireEvent.click(option);
    expect(addressHookMocks.selectSuggestion).toHaveBeenCalledWith(suggestion);
  });

  it("supports keyboard selection and dismissing the suggestion list", () => {
    const suggestion = {
      label: "巧運工業大廈, 6 巧明街, 觀塘, 香港",
      mainText: "巧運工業大廈",
      secondaryText: "6 巧明街, 觀塘, 香港",
      prediction: {},
    };
    addressHookMocks.useGoogleAddressSuggestions.mockReturnValue({
      suggestions: [suggestion],
      status: "ready",
      clearSuggestions: addressHookMocks.clearSuggestions,
      refreshSuggestions: addressHookMocks.refreshSuggestions,
      selectSuggestion: addressHookMocks.selectSuggestion,
    });
    renderSection({ deliveryDetail: "巧" });
    const input = screen.getByPlaceholderText("搜尋並選擇 Google 地址");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(addressHookMocks.selectSuggestion).toHaveBeenCalledWith(suggestion);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(addressHookMocks.clearSuggestions).toHaveBeenCalledWith(true);

    fireEvent.keyDown(input, { key: "Tab" });
    expect(addressHookMocks.clearSuggestions).toHaveBeenLastCalledWith(true);
  });

  it("keeps all manual address controls visible when Google is unavailable", () => {
    addressHookMocks.useGoogleAddressSuggestions.mockReturnValue({
      suggestions: [],
      status: "unavailable",
      clearSuggestions: addressHookMocks.clearSuggestions,
      refreshSuggestions: addressHookMocks.refreshSuggestions,
      selectSuggestion: addressHookMocks.selectSuggestion,
    });
    renderSection();

    expect(screen.getByText("Google 地址建議暫時不可用；你可以繼續手動輸入。")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "送貨地區" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "送貨分區" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "送貨地點" })).toBeDisabled();
    expect(screen.getByPlaceholderText("搜尋並選擇 Google 地址")).toBeEnabled();
  });
});

function renderSectionProps(
  overrides: Partial<React.ComponentProps<typeof DeliverySection>> = {},
): React.ComponentProps<typeof DeliverySection> {
  return {
    fulfillmentType: "delivery",
    deliveryDate: "2026-07-17",
    deliveryTime: "",
    deliveryTimeMode: undefined,
    deliverySlotId: undefined,
    deliverySlots: slots,
    deliverySlotsLoading: false,
    deliverySlotsError: null,
    deliveryTimeError: null,
    legacyDeliveryTime: false,
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    deliveryBuilding: "",
    deliveryFloor: "",
    deliveryUnit: "",
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    onDateChange: vi.fn(),
    onFulfillmentTypeChange: vi.fn(),
    onTimeChange: vi.fn(),
    onSlotChange: vi.fn(),
    onSpecifiedTimeSelect: vi.fn(),
    onRetryDeliverySlots: vi.fn(),
    onRegionChange: vi.fn(),
    onDistrictChange: vi.fn(),
    onAreaChange: vi.fn(),
    onDetailChange: vi.fn(),
    onBuildingChange: vi.fn(),
    onFloorChange: vi.fn(),
    onUnitChange: vi.fn(),
    onGoogleAddressSelect: vi.fn(),
    onRecipientTypeChange: vi.fn(),
    onRecipientCompanyNameChange: vi.fn(),
    onRecipientNameChange: vi.fn(),
    onRecipientPhoneChange: vi.fn(),
    onRecipientSuggestionSelect: vi.fn(),
    onRecipientAndCustomerSuggestionSelect: vi.fn(),
    onDeliveryPersonChange: vi.fn(),
    onFailedDeliveryActionChange: vi.fn(),
    ...overrides,
  };
}
