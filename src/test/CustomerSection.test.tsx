import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomerSection from "@/components/pos/CustomerSection";
import { normalizePhoneNumber } from "@/lib/checkout-validation";

const { searchOdooCustomers } = vi.hoisted(() => ({
  searchOdooCustomers: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  searchOdooCustomers,
}));

const noop = vi.fn();
const selectCustomer = vi.fn();
const selectCustomerAndRecipient = vi.fn();
const emptyBusinessProps = {
  customerEmail: "",
  billingAddress: "",
  onCustomerEmailChange: noop,
  onBillingAddressChange: noop,
};

function Harness() {
  const [senderName, setSenderName] = useState("");

  return (
    <CustomerSection
      phone="9123 4567"
      customerName="Secretary Chan"
      senderName={senderName}
      customerType="personal"
      companyName=""
      {...emptyBusinessProps}
      onPhoneChange={noop}
      onNameChange={noop}
      onSenderNameChange={setSenderName}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={selectCustomer}
      onCustomerAndRecipientSelect={selectCustomerAndRecipient}
      selectedCustomer={null}
    />
  );
}

function CustomerLookupHarness() {
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);

  return (
    <CustomerSection
      phone={phone}
      customerName={customerName}
      senderName=""
      customerType="personal"
      companyName=""
      {...emptyBusinessProps}
      onPhoneChange={(value) => {
        setPhone(value);
        const normalized = normalizePhoneNumber(value);
        setConfirmedPhone((current) => (
          current && current !== normalized ? null : current
        ));
      }}
      onNameChange={setCustomerName}
      onSenderNameChange={noop}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={selectCustomer}
      onCustomerAndRecipientSelect={selectCustomerAndRecipient}
      selectedCustomer={null}
      confirmedNewCustomerPhone={confirmedPhone}
      onConfirmNewCustomer={setConfirmedPhone}
    />
  );
}

describe("CustomerSection gift sender", () => {
  beforeEach(() => {
    searchOdooCustomers.mockReset();
    selectCustomer.mockReset();
    selectCustomerAndRecipient.mockReset();
  });

  it("keeps the ordering customer and gift sender as separate inputs", () => {
    render(<Harness />);

    const senderInput = screen.getByLabelText(/送花人名稱/);
    fireEvent.change(senderInput, { target: { value: "Director Lee" } });
    expect(senderInput).toHaveValue("Director Lee");
    expect(screen.getByLabelText(/下單人／聯絡人/)).toHaveValue("Secretary Chan");

    fireEvent.click(screen.getByRole("button", { name: "同客戶相同" }));
    expect(senderInput).toHaveValue("Secretary Chan");
  });

  it("marks required customer fields invalid and exposes inline alerts", () => {
    render(
      <CustomerSection
        phone=""
        customerName=""
        senderName=""
        customerType="personal"
        companyName=""
        {...emptyBusinessProps}
        onPhoneChange={noop}
        onNameChange={noop}
        onSenderNameChange={noop}
        onCustomerTypeChange={noop}
        onCompanyNameChange={noop}
        onCustomerSelect={noop}
        onCustomerAndRecipientSelect={noop}
        phoneError="請輸入下單人電話"
        customerNameError="請輸入下單人／聯絡人名稱"
        senderNameError="請輸入送花人名稱"
        selectedCustomer={null}
      />,
    );

    expect(screen.getByLabelText(/下單人電話/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/下單人／聯絡人/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/送花人名稱/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("prompts only after a successful zero-result phone search and confirms the new customer", async () => {
    searchOdooCustomers.mockResolvedValue([]);
    render(<CustomerLookupHarness />);

    const phoneInput = screen.getByLabelText(/下單人電話/);
    fireEvent.change(phoneInput, { target: { value: "9123 4567" } });

    expect(await screen.findByText(/系統未有此電話號碼的客戶/)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "確認新增客戶" });
    expect(confirmButton).toHaveClass("min-h-11");

    fireEvent.click(confirmButton);

    expect(screen.getByText("已確認新增此電話客戶")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/下單人／聯絡人/)).toHaveFocus();
    });
    expect(screen.queryByText(/系統未有此電話號碼的客戶/)).not.toBeInTheDocument();
  });

  it("shows required company billing fields and the email field", () => {
    render(
      <CustomerSection
        phone="91234567"
        customerName="Company Contact"
        senderName="Company Contact"
        customerType="company"
        companyName=""
        customerEmail="accounts@example.com"
        billingAddress=""
        onPhoneChange={noop}
        onNameChange={noop}
        onSenderNameChange={noop}
        onCustomerTypeChange={noop}
        onCompanyNameChange={noop}
        onCustomerEmailChange={noop}
        onBillingAddressChange={noop}
        onCustomerSelect={noop}
        onCustomerAndRecipientSelect={noop}
        companyNameError="公司客戶必須輸入公司名稱"
        billingAddressError="公司客戶必須輸入帳單地址"
        selectedCustomer={null}
      />,
    );

    expect(screen.getByLabelText(/公司名稱/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/帳單地址/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/客戶電郵/)).toHaveValue("accounts@example.com");
  });

  it("does not offer new-customer confirmation when the Odoo search fails", async () => {
    searchOdooCustomers.mockRejectedValue(new Error("Odoo timeout"));
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/下單人電話/), {
      target: { value: "9123 4567" },
    });

    expect(await screen.findByText("Odoo timeout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認新增客戶" })).not.toBeInTheDocument();
  });

  it("invalidates a confirmed new customer when the normalized phone changes", async () => {
    searchOdooCustomers.mockResolvedValue([]);
    render(<CustomerLookupHarness />);

    const phoneInput = screen.getByLabelText(/下單人電話/);
    fireEvent.change(phoneInput, { target: { value: "9123 4567" } });
    fireEvent.click(await screen.findByRole("button", { name: "確認新增客戶" }));
    expect(screen.getByText("已確認新增此電話客戶")).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: "9123 4568" } });
    expect(screen.queryByText("已確認新增此電話客戶")).not.toBeInTheDocument();
    expect(await screen.findByText(/系統未有此電話號碼的客戶/)).toBeInTheDocument();
  });

  it("searches an exact Customer ID explicitly and lists every duplicate match", async () => {
    searchOdooCustomers.mockResolvedValue([
      {
        id: "odoo-41",
        odooPartnerId: 41,
        customerCode: "000A",
        name: "Customer One",
        phone: "91234567",
        history: [],
      },
      {
        id: "odoo-42",
        odooPartnerId: 42,
        customerCode: "000A",
        name: "Customer Two",
        phone: "92345678",
        history: [],
      },
    ]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "000a" },
    });

    expect(await screen.findByText("Customer One")).toBeInTheDocument();
    expect(screen.getByText("Customer Two")).toBeInTheDocument();
    expect(screen.getAllByText("客戶編號：000A")).toHaveLength(2);
    expect(searchOdooCustomers).toHaveBeenCalledWith(
      "000a",
      expect.any(AbortSignal),
      "customer_code",
    );

    fireEvent.click(screen.getByRole("button", { name: /Customer Two/ }));
    expect(selectCustomer).toHaveBeenCalledWith(expect.objectContaining({
      odooPartnerId: 42,
      customerCode: "000A",
    }));
  });

  it("offers matching actions for a linked ordering customer and recipient", async () => {
    searchOdooCustomers.mockResolvedValue([
      {
        id: "odoo-41",
        odooPartnerId: 41,
        name: "Customer One",
        phone: "91234567",
        history: [],
        recipientMatch: {
          name: "Mary Wong",
          phone: "6111 1111",
          resolved: true,
          deliveryAddress: "九龍觀塘巧明街 6 號",
          shippingPartnerId: 45,
        },
      },
      {
        id: "odoo-42",
        odooPartnerId: 42,
        name: "Customer Two",
        phone: "92345678",
        history: [],
        recipientMatch: { name: "Mary Wong", phone: "6111 1111", resolved: true },
      },
    ]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/下單人／聯絡人/), {
      target: { value: "Mary Wong" },
    });

    expect(await screen.findByText("Customer One")).toBeInTheDocument();
    expect(screen.getByText("Customer Two")).toBeInTheDocument();
    expect(screen.getAllByText("配對收件人：Mary Wong · 6111 1111")).toHaveLength(2);
    expect(searchOdooCustomers).toHaveBeenCalledWith(
      "Mary Wong",
      expect.any(AbortSignal),
      "general",
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Customer Two/ })[0]);
    expect(selectCustomerAndRecipient).toHaveBeenCalledWith(expect.objectContaining({
      odooPartnerId: 42,
      name: "Customer Two",
      phone: "92345678",
    }), expect.objectContaining({
      name: "Mary Wong",
      phone: "6111 1111",
    }));
    expect(selectCustomerAndRecipient.mock.calls[0][0]).not.toHaveProperty("recipientMatch");
  });

  it("shows Customer ID no-result only after a successful search without offering creation", async () => {
    searchOdooCustomers.mockResolvedValue([]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "missing-id" },
    });

    expect(await screen.findByText("未找到此客戶編號")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認新增客戶" })).not.toBeInTheDocument();
  });

  it("shows a Customer ID lookup error without also showing the no-result message", async () => {
    searchOdooCustomers.mockRejectedValue(new Error("Odoo timeout"));
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "000A" },
    });

    expect(await screen.findByText("Odoo timeout")).toBeInTheDocument();
    expect(screen.queryByText("未找到此客戶編號")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認新增客戶" })).not.toBeInTheDocument();
  });
});
