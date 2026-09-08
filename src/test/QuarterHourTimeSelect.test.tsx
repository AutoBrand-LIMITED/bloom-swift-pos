import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import QuarterHourTimeSelect from "@/components/pos/QuarterHourTimeSelect";
import { QUARTER_HOUR_DELIVERY_TIME_OPTIONS } from "@/lib/delivery-time-options";

describe("QuarterHourTimeSelect", () => {
  it("offers a complete day in 15-minute intervals", () => {
    expect(QUARTER_HOUR_DELIVERY_TIME_OPTIONS).toHaveLength(96);
    expect(QUARTER_HOUR_DELIVERY_TIME_OPTIONS.slice(0, 5)).toEqual([
      { value: "00:00", label: "上午 12:00" },
      { value: "00:15", label: "上午 12:15" },
      { value: "00:30", label: "上午 12:30" },
      { value: "00:45", label: "上午 12:45" },
      { value: "01:00", label: "上午 01:00" },
    ]);
    expect(QUARTER_HOUR_DELIVERY_TIME_OPTIONS.at(-1)).toEqual({
      value: "23:45",
      label: "下午 11:45",
    });
  });

  it("shows the complete From and To times in two clear fields", () => {
    render(
      <QuarterHourTimeSelect
        id="visible-range"
        label="指定送貨時間"
        value="09:15-10:00"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "指定送貨時間 From（由）" }))
      .toHaveTextContent("上午 09:15");
    expect(screen.getByRole("combobox", { name: "指定送貨時間 To（至）" }))
      .toHaveTextContent("上午 10:00");
  });

  it("preserves a legacy free-text time until a standard time range is selected", () => {
    const onChange = vi.fn();
    render(
      <QuarterHourTimeSelect
        id="legacy-time"
        label="指定送貨時間"
        value="下午 3 時前"
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/原有時間：下午 3 時前/)).toBeVisible();

    expect(screen.getByText("From（由）")).toBeVisible();
    expect(screen.getByText("To（至）")).toBeVisible();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    fireEvent.click(screen.getByRole("combobox", { name: "指定送貨時間 From（由）" }));
    fireEvent.click(screen.getByRole("option", { name: "下午 03:30" }));
    expect(onChange).toHaveBeenCalledWith("15:30-16:30");

    fireEvent.click(screen.getByRole("combobox", { name: "指定送貨時間 To（至）" }));
    fireEvent.click(screen.getByRole("option", { name: "下午 05:00" }));
    expect(onChange).toHaveBeenCalledWith("15:30-17:00");
  });
});
