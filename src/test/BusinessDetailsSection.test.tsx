import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BusinessDetailsSection from "@/components/pos/BusinessDetailsSection";

const renderSection = (
  customerGroup = "",
  onCustomerGroupChange = vi.fn(),
) => render(
  <BusinessDetailsSection
    customerGroup={customerGroup}
    department=""
    onCustomerGroupChange={onCustomerGroupChange}
    onDepartmentChange={vi.fn()}
  />,
);

describe("BusinessDetailsSection disclosure", () => {
  it("keeps optional fields collapsed and shows a filled-field summary", () => {
    const onCustomerGroupChange = vi.fn();
    renderSection("Corporate", onCustomerGroupChange);

    const toggle = screen.getByRole("button", { name: "業務資料 1 項已填" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("客戶群組")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("客戶群組")).toHaveValue("Corporate");

    fireEvent.change(screen.getByLabelText("客戶群組"), {
      target: { value: "VIP" },
    });
    expect(onCustomerGroupChange).toHaveBeenCalledWith("VIP");
    expect(screen.queryByText(/DO 編號/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PO 編號/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("條款")).not.toBeInTheDocument();
  });

  it("labels an empty collapsed section as optional", () => {
    renderSection();

    expect(screen.getByRole("button", { name: "業務資料 選填" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
