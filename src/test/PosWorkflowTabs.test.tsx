import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PosWorkflowTabs, { type WorkflowSection } from "@/components/pos/PosWorkflowTabs";

const sections: WorkflowSection[] = [
  { id: "customer", label: "下單人", status: "complete" },
  { id: "items", label: "商品", status: "error", errorCount: 2 },
  { id: "delivery", label: "收貨及送貨", status: "pending" },
  { id: "notes", label: "備註及心意卡", status: "optional" },
  { id: "payment", label: "付款及確認", status: "pending" },
];

describe("PosWorkflowTabs", () => {
  it("shows progress states and identifies the active step", () => {
    render(
      <PosWorkflowTabs
        sections={sections}
        activeSection="customer"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "1. 下單人，已完成" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "2. 商品，2 項待修正" })).toBeVisible();
    expect(screen.getByRole("button", { name: "4. 備註及心意卡，選填" })).toBeVisible();
  });

  it("navigates to the selected workflow section", () => {
    const onSelect = vi.fn();
    render(
      <PosWorkflowTabs
        sections={sections}
        activeSection="customer"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "3. 收貨及送貨，待填" }));

    expect(onSelect).toHaveBeenCalledWith("delivery");
  });
});
