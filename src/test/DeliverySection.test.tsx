import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeliverySection from "@/components/pos/DeliverySection";
import type { DeliverySlot } from "@/lib/odoo-api";

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
    googleAddressResetRevision: 0,
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
    onRecipientNameChange: vi.fn(),
    onRecipientPhoneChange: vi.fn(),
    onDeliveryPersonChange: vi.fn(),
    onFailedDeliveryActionChange: vi.fn(),
    ...overrides,
  };
  render(<DeliverySection {...props} />);
  return props;
}

describe("DeliverySection delivery time controls", () => {
  it("renders backend slots as touch choices and returns the selected slot", () => {
    const props = renderSection({ deliveryTimeMode: "slot", deliverySlotId: 11 });

    expect(screen.getByRole("radio", { name: "上午 09:00-13:00" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "下午 13:00-18:00" }));

    expect(props.onSlotChange).toHaveBeenCalledWith(slots[1]);
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

  it("keeps all manual address controls visible when Google is unavailable", () => {
    renderSection();

    expect(screen.getByText("Google 地址搜尋暫時不可用，請使用下方手動地址欄。")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "送貨地區" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "送貨分區" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "送貨地點" })).toBeDisabled();
    expect(screen.getByPlaceholderText("詳細地址（大廈名 / 樓層 / 室）")).toBeEnabled();
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
    googleAddressResetRevision: 0,
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
    onRecipientNameChange: vi.fn(),
    onRecipientPhoneChange: vi.fn(),
    onDeliveryPersonChange: vi.fn(),
    onFailedDeliveryActionChange: vi.fn(),
    ...overrides,
  };
}
