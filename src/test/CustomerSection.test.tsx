import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import CustomerSection from "@/components/pos/CustomerSection";

const noop = vi.fn();

function Harness() {
  const [senderName, setSenderName] = useState("");

  return (
    <CustomerSection
      phone="9123 4567"
      customerName="Secretary Chan"
      senderName={senderName}
      customerType="personal"
      companyName=""
      onPhoneChange={noop}
      onNameChange={noop}
      onSenderNameChange={setSenderName}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={noop}
      phoneError={false}
      senderNameError={false}
      selectedCustomer={null}
    />
  );
}

describe("CustomerSection gift sender", () => {
  it("keeps the ordering customer and gift sender as separate inputs", () => {
    render(<Harness />);

    const senderInput = screen.getByLabelText(/送花人名稱/);
    fireEvent.change(senderInput, { target: { value: "Director Lee" } });
    expect(senderInput).toHaveValue("Director Lee");
    expect(screen.getByLabelText("下單人／聯絡人")).toHaveValue("Secretary Chan");

    fireEvent.click(screen.getByRole("button", { name: "同客戶相同" }));
    expect(senderInput).toHaveValue("Secretary Chan");
  });
});
