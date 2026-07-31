import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BusinessDetailsSection from "@/components/pos/BusinessDetailsSection";

const renderSection = (
  sourceReference = "",
  onSourceReferenceChange = vi.fn(),
) => render(
  <BusinessDetailsSection
    customerGroup=""
    senderDoNumber=""
    recipientDoNumber=""
    sourceReference={sourceReference}
    department=""
    terms=""
    onCustomerGroupChange={vi.fn()}
    onSenderDoNumberChange={vi.fn()}
    onRecipientDoNumberChange={vi.fn()}
    onSourceReferenceChange={onSourceReferenceChange}
    onDepartmentChange={vi.fn()}
    onTermsChange={vi.fn()}
  />,
);

describe("BusinessDetailsSection disclosure", () => {
  it("keeps optional fields collapsed and shows a filled-field summary", () => {
    const onSourceReferenceChange = vi.fn();
    renderSection("PO-300", onSourceReferenceChange);

    const toggle = screen.getByRole("button", { name: "業務資料 1 項已填" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("客戶參考／PO 編號")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("客戶參考／PO 編號")).toHaveValue("PO-300");

    fireEvent.change(screen.getByLabelText("客戶參考／PO 編號"), {
      target: { value: "PO-301" },
    });
    expect(onSourceReferenceChange).toHaveBeenCalledWith("PO-301");
  });

  it("labels an empty collapsed section as optional", () => {
    renderSection();

    expect(screen.getByRole("button", { name: "業務資料 選填" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
