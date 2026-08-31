import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RecipientOccasionEditor from "@/components/pos/RecipientOccasionEditor";

describe("RecipientOccasionEditor", () => {
  it("adds, edits, and removes compact accessible occasion rows", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RecipientOccasionEditor occasions={[]} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新增收花人重要日子" }));
    expect(onChange).toHaveBeenLastCalledWith([{ type: "birthday", date: "" }]);

    rerender(
      <RecipientOccasionEditor
        occasions={[{ type: "other", label: "", date: "2026-10-01" }]}
        onChange={onChange}
      />,
    );
    const customLabel = screen.getByLabelText("收花人重要日子 1 自訂名稱");
    expect(customLabel).toBeRequired();
    fireEvent.change(customLabel, { target: { value: "相識紀念日" } });
    expect(onChange).toHaveBeenLastCalledWith([{
      type: "other",
      label: "相識紀念日",
      date: "2026-10-01",
    }]);

    fireEvent.click(screen.getByRole("button", { name: "移除收花人重要日子 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
