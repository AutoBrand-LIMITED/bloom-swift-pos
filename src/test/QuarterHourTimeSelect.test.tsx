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

  it("shows AM/PM, hour, and minute as separate controls", () => {
    render(
      <QuarterHourTimeSelect
        id="visible-range"
        label="指定送貨時間"
        value="09:15-10:00"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "指定送貨時間 From（由） 上午" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 小時" }))
      .toHaveValue("09");
    expect(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }))
      .toHaveValue("15");
    expect(screen.getByRole("button", { name: "指定送貨時間 To（至） 上午" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 小時" }))
      .toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 分鐘" }))
      .toHaveValue("00");
  });

  it("lets staff choose hour and minute from dropdowns as well as type them", () => {
    const onChange = vi.fn();
    render(
      <QuarterHourTimeSelect
        id="editable-range"
        label="指定送貨時間"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "選擇指定送貨時間 From（由） 小時" }));
    fireEvent.click(screen.getByRole("button", { name: "指定送貨時間 From（由） 小時 10" }));
    fireEvent.click(screen.getByRole("button", { name: "選擇指定送貨時間 From（由） 分鐘" }));
    fireEvent.click(screen.getByRole("button", { name: "指定送貨時間 From（由） 分鐘 15" }));

    expect(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 小時" }))
      .toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }))
      .toHaveValue("15");
    expect(onChange).toHaveBeenLastCalledWith("10:15-11:15");

    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 小時" }), {
      target: { value: "1" },
    });
    expect(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 小時" }))
      .toHaveValue("1");
  });

  it("does not show an error while an endpoint is only partly entered", () => {
    render(
      <QuarterHourTimeSelect
        id="partial-range"
        label="指定送貨時間"
        value=""
        onChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }), {
      target: { value: "00" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
    expect(screen.getAllByRole("textbox")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "指定送貨時間 From（由） 下午" }));
    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 小時" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }), {
      target: { value: "30" },
    });
    expect(onChange).toHaveBeenCalledWith("15:30-16:30");

    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 小時" }), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 To（至） 分鐘" }), {
      target: { value: "00" },
    });
    expect(onChange).toHaveBeenCalledWith("15:30-17:00");
  });

  it("rejects non-quarter-hour minutes and accepts manual correction", () => {
    const onChange = vi.fn();
    render(
      <QuarterHourTimeSelect
        id="manual-time"
        label="指定送貨時間"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 小時" }), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }), {
      target: { value: "02" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("分鐘只可輸入 00、15、30 或 45");
    expect(onChange).toHaveBeenLastCalledWith("");

    fireEvent.change(screen.getByRole("textbox", { name: "指定送貨時間 From（由） 分鐘" }), {
      target: { value: "15" },
    });
    expect(onChange).toHaveBeenLastCalledWith("10:15-11:15");
  });
});
