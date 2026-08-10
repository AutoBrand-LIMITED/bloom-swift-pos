import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomerSection from "@/components/pos/CustomerSection";
import { normalizePhoneNumber } from "@/lib/checkout-validation";

const { searchOdooCustomerAccount, searchOdooCustomers } = vi.hoisted(() => ({
  searchOdooCustomerAccount: vi.fn(),
  searchOdooCustomers: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  searchOdooCustomerAccount,
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
  const [customerCode, setCustomerCode] = useState("");

  return (
    <CustomerSection
      phone="9123 4567"
      customerName="Secretary Chan"
      customerCode={customerCode}
      senderName={senderName}
      customerType="personal"
      companyName=""
      {...emptyBusinessProps}
      onPhoneChange={noop}
      onNameChange={noop}
      onCustomerCodeChange={setCustomerCode}
      onSenderNameChange={setSenderName}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={selectCustomer}
      onStartNewCustomerUnderAccount={setCustomerCode}
      onCustomerAndRecipientSelect={selectCustomerAndRecipient}
      selectedCustomer={null}
    />
  );
}

function CustomerLookupHarness() {
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);

  return (
    <CustomerSection
      phone={phone}
      customerName={customerName}
      customerCode={customerCode}
      senderName=""
      customerType="personal"
      companyName=""
      {...emptyBusinessProps}
      customerEmail={customerEmail}
      onCustomerEmailChange={setCustomerEmail}
      onPhoneChange={(value) => {
        setPhone(value);
        const normalized = normalizePhoneNumber(value);
        setConfirmedPhone((current) => (
          current && current !== normalized ? null : current
        ));
      }}
      onNameChange={setCustomerName}
      onCustomerCodeChange={setCustomerCode}
      onSenderNameChange={noop}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={selectCustomer}
      onStartNewCustomerUnderAccount={setCustomerCode}
      onCustomerAndRecipientSelect={selectCustomerAndRecipient}
      selectedCustomer={null}
      confirmedNewCustomerPhone={confirmedPhone}
      onConfirmNewCustomer={setConfirmedPhone}
    />
  );
}

function ExistingCustomerWithoutCodeHarness() {
  const [customerCode, setCustomerCode] = useState("");

  return (
    <CustomerSection
      phone="67610707"
      customerName="Jay"
      customerCode={customerCode}
      senderName="Jay"
      customerType="personal"
      companyName=""
      {...emptyBusinessProps}
      onPhoneChange={noop}
      onNameChange={noop}
      onCustomerCodeChange={setCustomerCode}
      onSenderNameChange={noop}
      onCustomerTypeChange={noop}
      onCompanyNameChange={noop}
      onCustomerSelect={selectCustomer}
      onCustomerAndRecipientSelect={selectCustomerAndRecipient}
      selectedCustomer={{
        id: "odoo-42",
        odooPartnerId: 42,
        name: "Jay",
        phone: "67610707",
        history: [],
      }}
    />
  );
}

describe("CustomerSection gift sender", () => {
  beforeEach(() => {
    searchOdooCustomerAccount.mockReset();
    searchOdooCustomers.mockReset();
    searchOdooCustomerAccount.mockResolvedValue({
      customerCode: "",
      contactCount: 0,
      contacts: [],
      truncated: false,
    });
    searchOdooCustomers.mockResolvedValue([]);
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
        customerCode=""
        senderName=""
        customerType="personal"
        companyName=""
        {...emptyBusinessProps}
        onPhoneChange={noop}
        onNameChange={noop}
        onCustomerCodeChange={noop}
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
    const newCustomerCode = screen.getByLabelText(/新 Customer ID/);
    fireEvent.change(newCustomerCode, { target: { value: " NEW-001 " } });
    expect(newCustomerCode).toHaveValue(" NEW-001 ");
    expect(screen.getByText(/連同新客戶資料儲存到 Odoo/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/下單人／聯絡人/)).toHaveFocus();
    });
    expect(screen.queryByText(/系統未有此電話號碼的客戶/)).not.toBeInTheDocument();
  });

  it("lets an existing Odoo customer without a Customer ID receive one", () => {
    render(<ExistingCustomerWithoutCodeHarness />);

    const customerCodeInput = screen.getByLabelText(/補填 Customer ID/);
    fireEvent.change(customerCodeInput, { target: { value: " EXISTING-001 " } });

    expect(customerCodeInput).toHaveValue(" EXISTING-001 ");
    expect(screen.getByText(/加入呢位現有 Odoo 聯絡人/)).toBeInTheDocument();
  });

  it("shows required company billing fields and the email field", () => {
    render(
      <CustomerSection
        phone="91234567"
        customerName="Company Contact"
        customerCode=""
        senderName="Company Contact"
        customerType="company"
        companyName=""
        customerEmail="accounts@example.com"
        billingAddress=""
        onPhoneChange={noop}
        onNameChange={noop}
        onCustomerCodeChange={noop}
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

  it("searches Odoo customers by email and applies the matching customer", async () => {
    const customer = {
      id: "odoo-88",
      odooPartnerId: 88,
      name: "Accounts Contact",
      phone: "91234567",
      email: "accounts@gmail.com",
      history: [],
    };
    searchOdooCustomers.mockResolvedValue([customer]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/客戶電郵/), {
      target: { value: "accounts@gmail.com" },
    });

    expect(await screen.findByText("Accounts Contact")).toBeVisible();
    expect(searchOdooCustomers).toHaveBeenCalledWith(
      "accounts@gmail.com",
      expect.any(AbortSignal),
      "general",
    );

    fireEvent.click(screen.getByRole("button", { name: /Accounts Contact/ }));
    expect(selectCustomer).toHaveBeenCalledWith(customer);
  });

  it("closes customer suggestions when any non-dropdown form area is pressed", async () => {
    searchOdooCustomers.mockResolvedValue([{
      id: "odoo-89",
      odooPartnerId: 89,
      name: "Oh Contact",
      phone: "91234567",
      history: [],
    }]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/下單人／聯絡人/), {
      target: { value: "Oh" },
    });

    expect(await screen.findByText("Oh Contact")).toBeVisible();

    fireEvent.pointerDown(screen.getByText(/呢度用嚟搜尋客戶帳戶/));

    expect(screen.queryByText("Oh Contact")).not.toBeInTheDocument();
    expect(selectCustomer).not.toHaveBeenCalled();
  });

  it("does not offer new-customer confirmation when the Odoo search fails", async () => {
    searchOdooCustomers.mockRejectedValue(new Error("Odoo timeout"));
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/下單人電話/), {
      target: { value: "9123 4567" },
    });

    expect(await screen.findByText("Odoo timeout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認新增客戶" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "確認用此 Customer ID 新增客戶",
    })).not.toBeInTheDocument();
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

  it("rechecks Customer ID collisions after confirming a new phone customer", async () => {
    searchOdooCustomers.mockResolvedValue([]);
    searchOdooCustomerAccount.mockImplementation(async (customerCode: string) => (
      customerCode === "WONDER"
        ? {
          customerCode: "WONDER",
          contactCount: 1,
          contacts: [{
            id: "odoo-41",
            odooPartnerId: 41,
            customerCode: "WONDER",
            name: "Existing Contact",
            phone: "92345678",
            history: [],
          }],
          truncated: false,
        }
        : {
          customerCode: "NEW-001",
          contactCount: 0,
          contacts: [],
          truncated: false,
        }
    ));
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText(/下單人電話/), {
      target: { value: "9123 4567" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "確認新增客戶" }));

    const customerCodeInput = screen.getByLabelText(/新 Customer ID/);
    fireEvent.change(customerCodeInput, { target: { value: "NEW-001" } });
    await waitFor(() => {
      expect(searchOdooCustomerAccount).toHaveBeenCalledWith(
        "NEW-001",
        expect.any(AbortSignal),
      );
    });

    fireEvent.change(customerCodeInput, { target: { value: "WONDER" } });

    expect(await screen.findByText("WONDER 帳戶 · 1 位聯絡人")).toBeInTheDocument();
    expect(screen.getByText("Existing Contact")).toBeInTheDocument();
    expect(searchOdooCustomerAccount).toHaveBeenLastCalledWith(
      "WONDER",
      expect.any(AbortSignal),
    );
  });

  it("confirms a missing Customer ID, preserves it, and continues phone verification", async () => {
    searchOdooCustomerAccount.mockResolvedValue({
      customerCode: "NEW-001",
      contactCount: 0,
      contacts: [],
      truncated: false,
    });
    searchOdooCustomers.mockResolvedValue([]);
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "NEW-001" },
    });

    expect(await screen.findByText(/系統未有此 Customer ID/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "確認用此 Customer ID 新增客戶",
    }));

    expect(screen.getByLabelText(/新 Customer ID/)).toHaveValue("NEW-001");
    expect(screen.getByText(/請輸入電話並完成/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/下單人電話/)).toHaveFocus();
    });

    fireEvent.change(screen.getByLabelText(/下單人電話/), {
      target: { value: "9123 4567" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "確認新增客戶" }));

    expect(screen.getByLabelText(/新 Customer ID/)).toHaveValue("NEW-001");
    expect(screen.getByText("已確認新增此電話客戶")).toBeInTheDocument();
  });

  it("treats an exact Customer ID as an account and requires a contact selection", async () => {
    searchOdooCustomerAccount.mockResolvedValue({
      customerCode: "000A",
      contactCount: 2,
      truncated: false,
      contacts: [{
        id: "odoo-41",
        odooPartnerId: 41,
        customerCode: "000A",
        name: "Customer One",
        phone: "91234567",
        history: [],
      }, {
        id: "odoo-42",
        odooPartnerId: 42,
        customerCode: "000A",
        name: "Customer Two",
        phone: "92345678",
        history: [],
      }],
    });
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "000a" },
    });

    expect(await screen.findByText("Customer One")).toBeInTheDocument();
    expect(screen.getByText("Customer Two")).toBeInTheDocument();
    expect(screen.getByText("000A 帳戶 · 2 位聯絡人")).toBeInTheDocument();
    expect(screen.getByText(/系統唔會自動套用第一位聯絡人/)).toBeInTheDocument();
    expect(screen.getAllByText("客戶編號：000A")).toHaveLength(2);
    expect(searchOdooCustomerAccount).toHaveBeenCalledWith(
      "000a",
      expect.any(AbortSignal),
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

  it("offers Customer ID creation only after a successful zero-result search", async () => {
    searchOdooCustomerAccount.mockResolvedValue({
      customerCode: "missing-id",
      contactCount: 0,
      contacts: [],
      truncated: false,
    });
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "missing-id" },
    });

    expect(screen.queryByRole("button", {
      name: "確認用此 Customer ID 新增客戶",
    })).not.toBeInTheDocument();

    expect(await screen.findByText(/系統未有此 Customer ID/)).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "確認用此 Customer ID 新增客戶",
    })).toBeInTheDocument();
  });

  it("shows a Customer ID lookup error without also showing the no-result message", async () => {
    searchOdooCustomerAccount.mockRejectedValue(new Error("Odoo timeout"));
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "000A" },
    });

    expect(await screen.findByText("Odoo timeout")).toBeInTheDocument();
    expect(screen.queryByText("未找到此客戶編號")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認新增客戶" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "確認用此 Customer ID 新增客戶",
    })).not.toBeInTheDocument();
  });

  it("allows a new contact under an existing shared Customer ID account", async () => {
    searchOdooCustomerAccount.mockResolvedValue({
      customerCode: "WONDER",
      contactCount: 1435,
      contacts: [{
        id: "odoo-41",
        odooPartnerId: 41,
        customerCode: "WONDER",
        name: "Existing Contact",
        phone: "91234567",
        history: [],
      }],
      truncated: true,
    });
    render(<CustomerLookupHarness />);

    fireEvent.change(screen.getByLabelText("Customer ID／客戶編號"), {
      target: { value: "wonder" },
    });

    expect(await screen.findByText("WONDER 帳戶 · 1435 位聯絡人")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "在 WONDER 帳戶新增聯絡人",
    }));

    expect(screen.getByLabelText(/新 Customer ID/)).toHaveValue("WONDER");
    await waitFor(() => expect(screen.getByLabelText(/下單人電話/)).toHaveFocus());
  });
});
