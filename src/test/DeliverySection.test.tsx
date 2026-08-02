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
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    onDateChange: vi.fn(),
    onTimeChange: vi.fn(),
    onSlotChange: vi.fn(),
    onSpecifiedTimeSelect: vi.fn(),
    onRetryDeliverySlots: vi.fn(),
    onRegionChange: vi.fn(),
    onDistrictChange: vi.fn(),
    onAreaChange: vi.fn(),
    onDetailChange: vi.fn(),
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

  it("shows the specified-time input, surcharge hint, and inline error", () => {
    const props = renderSection({
      deliveryTimeMode: "specified",
      deliveryTimeError: "請輸入指定送貨時間",
    });

    const input = screen.getByRole("textbox", { name: "指定送貨時間" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("指定時間可能另收附加費")).toBeVisible();
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent("請輸入指定送貨時間");

    fireEvent.change(input, { target: { value: "上午 10 時前" } });
    expect(props.onTimeChange).toHaveBeenCalledWith("上午 10 時前");
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
    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");

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
    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");
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
    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");
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
    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");
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

  it("retains a compatible manual area for a district-only Google result", () => {
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
      area: "九龍灣",
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

  it("retains valid manual controls when Google components are unresolved", () => {
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
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
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

  it("authorizes the map signature calculated from the merged hierarchy", () => {
    const props = renderSectionProps({
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "九龍灣",
      deliveryDetail: "巧",
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
    rerender(<DeliverySection
      {...props}
      deliveryDetail="巧運工業大廈, 觀塘駿業街66號"
    />);

    const map = screen.getByTitle("Google Map");
    expect(map).toBeVisible();
    expect(map).toHaveAttribute(
      "src",
      `https://www.google.com/maps?q=${encodeURIComponent(
        "九龍 觀塘區 九龍灣 巧運工業大廈, 觀塘駿業街66號 香港",
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

    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");
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
    const input = screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）");

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
    expect(screen.getByPlaceholderText("詳細地址（輸入即顯示 Google 建議）")).toBeEnabled();
  });
});

function renderSectionProps(
  overrides: Partial<React.ComponentProps<typeof DeliverySection>> = {},
): React.ComponentProps<typeof DeliverySection> {
  return {
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
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    onDateChange: vi.fn(),
    onTimeChange: vi.fn(),
    onSlotChange: vi.fn(),
    onSpecifiedTimeSelect: vi.fn(),
    onRetryDeliverySlots: vi.fn(),
    onRegionChange: vi.fn(),
    onDistrictChange: vi.fn(),
    onAreaChange: vi.fn(),
    onDetailChange: vi.fn(),
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
