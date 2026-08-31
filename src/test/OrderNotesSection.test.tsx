import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderNotesSection from "@/components/pos/OrderNotesSection";
import type { DemoCustomer } from "@/data/demo-customers";
import type { PartnerNoteRecord } from "@/lib/odoo-api";

const senderCustomer: DemoCustomer = {
  id: "odoo-42",
  odooPartnerId: 42,
  name: "Chan Tai",
  phone: "9123 4567",
  history: [],
  commentText: "Prefers white flowers",
  tags: [
    { id: 1, name: "VIP", managed: true },
    { id: 2, name: "Wholesale", managed: false },
  ],
  writeDate: "2026-07-14 10:00:00",
};

const recipientContact: PartnerNoteRecord = {
  partnerId: 84,
  commentText: "Leave with concierge",
  tags: [],
  writeDate: "2026-07-14 10:01:00",
};

const callbacks = {
  onSenderNoteChange: vi.fn(),
  onDeliveryNoteChange: vi.fn(),
  onInternalNoteChange: vi.fn(),
  onSenderContactDraftChange: vi.fn(),
  onRecipientContactDraftChange: vi.fn(),
  onSaveSenderContact: vi.fn(),
  onSaveRecipientContact: vi.fn(),
  onSaveSenderNoteChange: vi.fn(),
  onSaveRecipientNoteChange: vi.fn(),
  onRefreshSender: vi.fn(),
  onRefreshRecipient: vi.fn(),
};

describe("OrderNotesSection", () => {
  it("keeps order notes separate and exposes an editable Odoo Contact note", () => {
    render(
      <OrderNotesSection
        senderNote="No baby's breath"
        deliveryNote="Call first"
        internalNote="Use stock from cooler B"
        senderCustomer={senderCustomer}
        hasSenderIdentity
        hasRecipientIdentity={false}
        recipientContact={null}
        senderContactDraft="Updated persistent note"
        recipientContactDraft=""
        saveSenderNote={false}
        saveRecipientNote={false}
        {...callbacks}
      />
    );

    expect(screen.getByLabelText("送花人備註")).toHaveValue("No baby's breath");
    expect(screen.getByLabelText("送貨備註")).toHaveValue("Call first");
    expect(screen.getByLabelText("內部備註")).toHaveValue("Use stock from cooler B");
    expect(screen.getByLabelText("客戶長期備註")).toHaveValue("Updated persistent note");
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.queryByText("Wholesale")).not.toBeInTheDocument();

    const saveButtons = screen.getAllByRole("button", { name: "儲存" });
    expect(saveButtons[0]).toBeEnabled();
    fireEvent.click(saveButtons[0]);
    expect(callbacks.onSaveSenderContact).toHaveBeenCalledOnce();
  });

  it("keeps both persistent-note fields editable for brand-new contacts", () => {
    const { rerender } = render(
      <OrderNotesSection
        senderNote="Sender note"
        deliveryNote="Delivery note"
        internalNote=""
        senderCustomer={senderCustomer}
        hasSenderIdentity
        hasRecipientIdentity
        recipientContact={null}
        senderContactDraft={senderCustomer.commentText || ""}
        recipientContactDraft=""
        saveSenderNote={false}
        saveRecipientNote={false}
        {...callbacks}
      />
    );

    expect(screen.getByRole("checkbox", { name: /同時將今次送貨備註複製到收花人長期備註/ })).toBeEnabled();
    expect(screen.getByText(/不勾選也會把送花人備註保存於本張訂單/)).toBeVisible();
    expect(screen.getByText(/不勾選也會把送貨備註保存於本張訂單/)).toBeVisible();
    expect(screen.getByLabelText("收花人長期備註")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("收花人長期備註"), {
      target: { value: "New recipient note" },
    });
    expect(callbacks.onRecipientContactDraftChange).toHaveBeenCalledWith("New recipient note");

    rerender(
      <OrderNotesSection
        senderNote="Sender note"
        deliveryNote="Delivery note"
        internalNote=""
        senderCustomer={senderCustomer}
        hasSenderIdentity
        hasRecipientIdentity
        recipientPartnerId={84}
        recipientContact={recipientContact}
        senderContactDraft={senderCustomer.commentText || ""}
        recipientContactDraft="Updated recipient note"
        saveSenderNote={false}
        saveRecipientNote={false}
        {...callbacks}
      />
    );

    expect(screen.getByRole("checkbox", { name: /同時將今次送貨備註複製到收花人長期備註/ })).toBeEnabled();
    expect(screen.getByLabelText("收花人長期備註")).toBeEnabled();
    expect(screen.getByLabelText("收花人長期備註")).toHaveValue("Updated recipient note");
  });

  it("shows a visible conflict message", () => {
    render(
      <OrderNotesSection
        senderNote=""
        deliveryNote=""
        internalNote=""
        senderCustomer={senderCustomer}
        hasSenderIdentity
        hasRecipientIdentity={false}
        recipientContact={null}
        senderContactDraft={senderCustomer.commentText || ""}
        recipientContactDraft=""
        saveSenderNote={false}
        saveRecipientNote={false}
        conflict={{ target: "sender", message: "Reload the latest Odoo value." }}
        {...callbacks}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Reload the latest Odoo value.");
    expect(screen.getByRole("button", { name: "重新載入客戶長期備註" })).toBeEnabled();
  });
});
