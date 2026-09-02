import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RecipientOccasionEditor from "@/components/pos/RecipientOccasionEditor";

describe("RecipientOccasionEditor", () => {
  it("adds an occasion using the delivery date without asking for a year", () => {
    const onChange = vi.fn();
    render(
      <RecipientOccasionEditor
        occasions={[]}
        deliveryDate="2026-09-02"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新增收花人重要日子" }));
    expect(onChange).toHaveBeenLastCalledWith([{
      type: "birthday",
      date: "2026-09-02",
      autoDateFromDelivery: true,
    }]);
    expect(screen.queryByRole("textbox", { name: /日期/ })).not.toBeInTheDocument();
    expect(screen.getByText("日期自動跟收貨點送貨日；無需輸入年份。")).toBeVisible();
  });

  it("requires a delivery date before adding an occasion", () => {
    render(
      <RecipientOccasionEditor occasions={[]} deliveryDate="" onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "新增收花人重要日子" })).toBeDisabled();
    expect(screen.getByText("請先選擇這個收貨點的送貨日期。")).toBeVisible();
  });

  it("keeps saved contact occasions and allows editing their type and label", () => {
    const onChange = vi.fn();
    render(
      <RecipientOccasionEditor
        occasions={[{ id: 7, type: "other", label: "", date: "1990-10-01" }]}
        deliveryDate="2026-09-02"
        onChange={onChange}
      />,
    );

    const customLabel = screen.getByLabelText("收花人重要日子 1 自訂名稱");
    expect(customLabel).toBeRequired();
    expect(screen.getByLabelText("收花人重要日子 1 日期")).toHaveTextContent("10 月 1 日");
    fireEvent.change(customLabel, { target: { value: "相識紀念日" } });
    expect(onChange).toHaveBeenLastCalledWith([{
      id: 7,
      type: "other",
      label: "相識紀念日",
      date: "1990-10-01",
    }]);

    fireEvent.click(screen.getByRole("button", { name: "移除收花人重要日子 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("moves a newly added occasion when its destination delivery date changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RecipientOccasionEditor
        occasions={[{
          type: "birthday",
          date: "2026-09-02",
          autoDateFromDelivery: true,
        }]}
        deliveryDate="2026-09-02"
        onChange={onChange}
      />,
    );

    rerender(
      <RecipientOccasionEditor
        occasions={[{
          type: "birthday",
          date: "2026-09-02",
          autoDateFromDelivery: true,
        }]}
        deliveryDate="2026-09-03"
        onChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenLastCalledWith([{
      type: "birthday",
      date: "2026-09-03",
      autoDateFromDelivery: true,
    }]);
  });

  it("keeps following the last delivery date after the date is cleared and reselected", () => {
    const onChange = vi.fn();
    const occasion = [{
      type: "birthday" as const,
      date: "2026-09-02",
      autoDateFromDelivery: true as const,
    }];
    const { rerender } = render(
      <RecipientOccasionEditor
        occasions={occasion}
        deliveryDate="2026-09-02"
        onChange={onChange}
      />,
    );

    rerender(
      <RecipientOccasionEditor occasions={occasion} deliveryDate="" onChange={onChange} />,
    );
    rerender(
      <RecipientOccasionEditor
        occasions={occasion}
        deliveryDate="2026-09-04"
        onChange={onChange}
      />,
    );

    expect(onChange).toHaveBeenLastCalledWith([{
      type: "birthday",
      date: "2026-09-04",
      autoDateFromDelivery: true,
    }]);
  });

  it("never infers that a saved id-less occasion is delivery-date managed", () => {
    const onChange = vi.fn();
    const savedOccasion = [{ type: "birthday" as const, date: "2026-09-02" }];
    const { rerender } = render(
      <RecipientOccasionEditor
        occasions={savedOccasion}
        deliveryDate="2026-09-02"
        onChange={onChange}
      />,
    );

    rerender(
      <RecipientOccasionEditor
        occasions={savedOccasion}
        deliveryDate="2026-09-03"
        onChange={onChange}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("收花人重要日子 1 日期")).toHaveTextContent("9 月 2 日");
  });
});
