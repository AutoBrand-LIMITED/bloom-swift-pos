import { describe, expect, it } from "vitest";
import {
  generateAllDocuments,
  generateDeliveryNote,
  generatePickingList,
  generateReceipt,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";

const orderFixture = (overrides: Partial<Order> = {}): Order => ({
  id: "43e81d2e-ccfb-415b-8799-12a2e7a528d4",
  odooOrderName: "S17738",
  salesId: "ACCOUNT / AC02 - Elma",
  customerName: "ORDERING SECRETARY",
  senderName: "BOSS GIFT SENDER",
  phone: "9123 4567",
  items: [{ id: "line-1", name: "Rose bouquet", price: 680, quantity: 1 }],
  deliveryFee: 0,
  urgentFee: 0,
  subtotal: 680,
  finalPrice: 680,
  priceOverridden: false,
  paymentStatus: "paid",
  depositAmount: 0,
  paymentMethod: "Cash",
  deliveryDate: "2026-07-16",
  deliveryTime: "14:00",
  deliveryAddress: "Central",
  recipientName: "RECIPIENT NAME",
  recipientPhone: "6000 0000",
  deliveryPerson: "Driver A",
  giftCardEnabled: true,
  giftCardMessage: "PRIVATE CARD MESSAGE",
  senderNote: "PRIVATE SENDER NOTE",
  deliveryNote: "Call recipient before arrival",
  internalNote: "PRIVATE INTERNAL NOTE",
  createdAt: "2026-07-15T10:00:00.000Z",
  ...overrides,
});

const documentGenerators = [
  ["receipt", generateReceipt],
  ["delivery note", generateDeliveryNote],
  ["picking list", generatePickingList],
] as const;

describe("print layout contract", () => {
  it("bundles all three document types into one print job with page breaks", () => {
    const html = generateAllDocuments(orderFixture());

    expect(html.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(html.match(/data-batch-print-document=/g)).toHaveLength(3);
    expect(html).toContain('data-batch-print-document="receipt"');
    expect(html).toContain('data-batch-print-document="delivery-note"');
    expect(html).toContain('data-batch-print-document="picking-list"');
    expect(html).toContain(".batch-print-document + .batch-print-document");
    expect(html).toContain("page-break-before: always");
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(2);
  });

  it.each(documentGenerators)("prints the %s as monochrome A4 landscape without emoji", (_, generator) => {
    const html = generator(orderFixture());

    expect(html).toContain("@page { size: A4 landscape; margin: 8mm; }");
    expect(html).toContain("width: 281mm");
    expect(html).toContain("min-height: 194mm");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).not.toContain("border-radius");
  });

  it("uses recipient details on the left and reference details on the right of the delivery note", () => {
    const html = generateDeliveryNote(orderFixture());
    const recipientColumn = html.indexOf('data-delivery-column="recipient"');
    const referenceColumn = html.indexOf('data-delivery-column="reference"');

    expect(html).toContain('data-print-document="delivery-note"');
    expect(recipientColumn).toBeGreaterThan(-1);
    expect(referenceColumn).toBeGreaterThan(recipientColumn);
    expect(html).toContain("RECIPIENT NAME");
    expect(html).toContain("Central");
    expect(html).toContain("S17738");
    expect(html).toContain("2026-07-16");
    expect(html).toContain("14:00");
    expect(html).not.toContain("Driver A");
  });

  it("prints company and contact separately without blank company labels", () => {
    const companyDelivery = generateDeliveryNote(orderFixture({
      recipientType: "company",
      recipientCompanyName: "RECIPIENT LIMITED",
      recipientName: "CONTACT PERSON",
    }));
    const companyPicking = generatePickingList(orderFixture({
      recipientType: "company",
      recipientCompanyName: "RECIPIENT LIMITED",
      recipientName: "CONTACT PERSON",
    }));
    const personalDelivery = generateDeliveryNote(orderFixture());

    expect(companyDelivery).toContain("收貨公司");
    expect(companyDelivery).toContain("RECIPIENT LIMITED");
    expect(companyDelivery).toContain("CONTACT PERSON");
    expect(companyPicking).toContain("RECIPIENT LIMITED");
    expect(personalDelivery).not.toContain("收貨公司");
  });

  it("renders the complete delivery-note document hierarchy", () => {
    const html = generateDeliveryNote(orderFixture());

    expect(html).toContain('data-document-section="items"');
    expect(html).toContain('data-price-display="hidden"');
    expect(html).toContain('data-document-section="delivery-note"');
    expect(html).toContain("Call recipient before arrival");
    expect(html).toContain('data-document-section="signatures"');
    expect(html).toContain('data-signature="delivery"');
    expect(html).toContain('data-signature="recipient"');
  });

  it("keeps the receipt as a formal priced customer and payment document", () => {
    const html = generateReceipt(orderFixture());

    expect(html).toContain('data-print-document="receipt"');
    expect(html).toContain('data-document-section="customer-details"');
    expect(html).toContain('data-price-display="shown"');
    expect(html).toContain("$680");
    expect(html).toContain('data-document-section="payment-summary"');
    expect(html).toContain("已付款");
    expect(html).toContain("PRIVATE CARD MESSAGE");
  });

  it("renders warehouse and dispatch picking copies as separate full A4 pages", () => {
    const html = generatePickingList(orderFixture());

    expect(html).toContain('data-print-document="picking-list"');
    expect(html).toContain("min-height: 194mm");
    expect(html).not.toContain("overflow: hidden");
    expect(html).toContain('<main class="print-document picking-document picking-document--full-page"');
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(2);
    expect(html).not.toContain('class="tear-line"');
  });

  it("uses separate full pages when two discounted items and fee rows need more space", () => {
    const html = generatePickingList(orderFixture({
      items: [
        { id: "line-1", name: "Rose bouquet", price: 680, quantity: 1, discountPercent: 5 },
        { id: "line-2", name: "Glass vase", price: 250, quantity: 1, discountPercent: 5 },
      ],
      deliveryFee: 80,
      urgentFee: 100,
      subtotal: 883.5,
      finalPrice: 1_063.5,
    }));

    expect(html).toContain('<main class="print-document picking-document picking-document--full-page picking-document--dense"');
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(2);
    expect(html).not.toContain('class="tear-line"');
  });
});

describe("print document privacy", () => {
  it.each([
    ["delivery note", generateDeliveryNote],
    ["picking list", generatePickingList],
  ])("does not expose sender data in the %s", (_, generator) => {
    const html = generator(orderFixture());

    expect(html).not.toContain("ORDERING SECRETARY");
    expect(html).not.toContain("BOSS GIFT SENDER");
    expect(html).not.toContain("9123 4567");
    expect(html).not.toContain("PRIVATE SENDER NOTE");
    expect(html).not.toContain("PRIVATE INTERNAL NOTE");
    expect(html).not.toContain("PRIVATE CARD MESSAGE");
    expect(html).toContain("RECIPIENT NAME");
    expect(html).toContain("6000 0000");
  });

  it("shows the ordering customer and gift sender separately on the receipt", () => {
    const html = generateReceipt(orderFixture());

    expect(html).toContain("下單／付款人");
    expect(html).toContain("ORDERING SECRETARY");
    expect(html).toContain("送花人");
    expect(html).toContain("BOSS GIFT SENDER");
  });

  it("never prints legacy or internal order notes on the customer receipt", () => {
    const html = generateReceipt(orderFixture({
      notes: "LEGACY PRIVATE NOTES",
      internalNote: "CURRENT PRIVATE NOTES",
    }));

    expect(html).not.toContain("LEGACY PRIVATE NOTES");
    expect(html).not.toContain("CURRENT PRIVATE NOTES");
  });

  it("removes prices from delivery notes but keeps them on internal picking lists", () => {
    const order = orderFixture();

    expect(generateDeliveryNote(order)).not.toContain("$680");
    expect(generatePickingList(order)).toContain("$680");
  });

  it("prints a discounted effective unit price that reconciles with the line subtotal", () => {
    const order = orderFixture({
      items: [{
        id: "line-1",
        name: "Rose bouquet",
        price: 600,
        quantity: 2,
        catalogPrice: 680,
        discountPercent: 10,
        priceOverrideReason: "VIP",
      }],
      subtotal: 1080,
      finalPrice: 1080,
    });

    const html = generatePickingList(order);

    expect(html).toContain("$600");
    expect(html).toContain("$1,080");
    expect(html).toContain("折扣 10% / DISCOUNT");
    expect(html).toContain("折扣前 / BEFORE DISCOUNT");
    expect(html).not.toContain("$1,200");
  });

  it("keeps non-divisible discounts explicit without inventing a rounded effective unit price", () => {
    const html = generatePickingList(orderFixture({
      items: [{
        id: "line-1",
        name: "Rounding case",
        price: 19.99,
        quantity: 3,
        discountPercent: 17,
      }],
      subtotal: 49.78,
      finalPrice: 49.78,
    }));

    expect(html).toContain("$19.99");
    expect(html).toContain("$49.78");
    expect(html).toContain("折扣 17% / DISCOUNT");
    expect(html).not.toContain("$16.59");
  });

  it("keeps every item in a long picking list and allows the document to paginate", () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `line-${index + 1}`,
      name: `Long picking item ${index + 1}`,
      price: 100 + index,
      quantity: 1,
    }));
    const html = generatePickingList(orderFixture({ items }));

    for (const item of items) expect(html).toContain(item.name);
    expect(html).toContain('<main class="print-document picking-document picking-document--full-page picking-document--dense"');
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(2);
    expect(html).not.toContain('class="tear-line"');
    expect(html).not.toContain("overflow: hidden");
  });

  it("renders two explicit full-page picking copies with the order reference", () => {
    const html = generatePickingList(orderFixture());

    expect(html).toContain('data-picking-copy="warehouse"');
    expect(html).toContain('data-picking-copy="dispatch"');
    expect(html.split("S17738")).toHaveLength(4);
  });

  it("prints delivery details when recipient phone is the only populated field", () => {
    const html = generateDeliveryNote(orderFixture({
      deliveryDate: "",
      deliveryTime: "",
      deliveryAddress: "",
      recipientName: "",
      recipientPhone: "6000 0000",
      deliveryPerson: "",
    }));

    expect(html).toContain("收貨人電話");
    expect(html).toContain("6000 0000");
  });

  it("prints a standard slot snapshot without changing its label", () => {
    const html = generateDeliveryNote(orderFixture({
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      deliveryTime: "上午 09:00-13:00",
    }));

    expect(html).toContain("上午 09:00-13:00");
    expect(html).not.toContain("指定時間：上午 09:00-13:00");
  });

  it("flags specified delivery time and escapes its snapshot", () => {
    const html = generateDeliveryNote(orderFixture({
      deliveryTimeMode: "specified",
      deliveryTime: "上午 10 時前 <script>",
    }));

    expect(html).toContain("指定時間：上午 10 時前 &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it.each([generateReceipt, generateDeliveryNote, generatePickingList])(
    "escapes user-entered text before printing",
    (generator) => {
      const html = generator(orderFixture({
        recipientName: "<script>alert('recipient')</script>",
        deliveryAddress: "<img src=x onerror=alert('address')>",
        deliveryNote: "<script>alert('note')</script>",
        items: [{ id: "line-1", name: "<script>alert('item')</script>", price: 10, quantity: 1 }],
        giftCardMessage: "<script>alert('card')</script>",
      }));

      expect(html).not.toContain("<script>alert(");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;script&gt;");
    }
  );
});
