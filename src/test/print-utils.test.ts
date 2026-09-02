import { describe, expect, it } from "vitest";
import {
  generateAllDocuments,
  generateDeliveryNote,
  generateMessageCards,
  generatePickingList,
  generateReceipt,
} from "@/lib/print-utils";
import type { DeliverySplit, Order } from "@/types/order";

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

const splitFixture = (overrides: Partial<DeliverySplit> = {}): DeliverySplit => ({
  id: "split-1",
  fulfillmentType: "delivery",
  deliveryDate: "2026-07-17",
  deliveryTimeMode: "slot",
  deliveryTime: "下午 13:00-18:00",
  deliveryRegion: "九龍",
  deliveryDistrict: "觀塘區",
  deliveryArea: "觀塘",
  deliveryDetail: "第二地址",
  deliveryAddress: "九龍觀塘第二地址",
  deliveryGoogleAddress: "九龍觀塘第二地址",
  deliveryBuilding: "",
  deliveryFloor: "",
  deliveryUnit: "",
  recipientType: "personal",
  recipientCompanyName: "",
  recipientName: "SECOND RECIPIENT",
  recipientPhone: "6111 1111",
  deliveryPerson: "Driver B",
  failedDeliveryAction: "",
  deliveryNote: "Second address note",
  giftCardEnabled: false,
  giftCardMessage: "",
  itemAllocations: [{ itemId: "line-1", itemName: "Rose bouquet", quantity: 1 }],
  ...overrides,
});

const documentGenerators = [
  ["receipt", generateReceipt],
  ["delivery note", generateDeliveryNote],
  ["picking list", generatePickingList],
  ["message card", generateMessageCards],
] as const;

describe("print layout contract", () => {
  it("bundles all enabled document types into one print job with page breaks", () => {
    const html = generateAllDocuments(orderFixture());

    expect(html.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(html.match(/data-batch-print-document=/g)).toHaveLength(4);
    expect(html).toContain('data-batch-print-document="receipt"');
    expect(html).toContain('data-batch-print-document="delivery-note"');
    expect(html).toContain('data-batch-print-document="picking-list"');
    expect(html).toContain('data-batch-print-document="message-card"');
    expect(html).toContain("PRIVATE CARD MESSAGE");
    expect(html).toContain(".batch-print-document + .batch-print-document");
    expect(html).toContain("page-break-before: always");
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(2);
  });

  it("omits message cards from all-documents when no destination card is enabled", () => {
    const html = generateAllDocuments(orderFixture({
      giftCardEnabled: false,
      giftCardMessage: "PRIMARY DISABLED CARD",
      deliverySplits: [splitFixture({ giftCardMessage: "SPLIT DISABLED CARD" })],
    }));

    expect(html.match(/data-batch-print-document=/g)).toHaveLength(3);
    expect(html).not.toContain('data-batch-print-document="message-card"');
    expect(html).not.toContain("PRIMARY DISABLED CARD");
    expect(html).not.toContain("SPLIT DISABLED CARD");
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

  it("prints every split-delivery destination on its own page with allocated items", () => {
    const html = generateDeliveryNote(orderFixture({
      items: [
        { id: "line-1", name: "Rose bouquet", price: 680, quantity: 3 },
        { id: "line-2", name: "Glass vase", price: 250, quantity: 1 },
      ],
      deliverySplits: [{
        id: "split-1",
        deliveryDate: "2026-07-17",
        deliveryTimeMode: "slot",
        deliveryTime: "下午 13:00-18:00",
        deliveryRegion: "九龍",
        deliveryDistrict: "觀塘區",
        deliveryArea: "觀塘",
        deliveryDetail: "第二地址",
        deliveryAddress: "九龍觀塘第二地址",
        deliveryGoogleAddress: "九龍觀塘第二地址",
        deliveryBuilding: "",
        deliveryFloor: "",
        deliveryUnit: "",
        recipientType: "personal",
        recipientCompanyName: "",
        recipientName: "SECOND RECIPIENT",
        recipientPhone: "6111 1111",
        deliveryPerson: "Driver B",
        failedDeliveryAction: "",
        deliveryNote: "Second address note",
        itemAllocations: [{ itemId: "line-1", itemName: "Rose bouquet", quantity: 1 }],
      }],
    }));

    expect(html.match(/data-print-document="delivery-note"/g)).toHaveLength(2);
    expect(html).toContain("S17738-D1");
    expect(html).toContain("S17738-D2");
    expect(html).toContain("SECOND RECIPIENT");
    expect(html).toContain("九龍觀塘第二地址");
    expect(html).toContain("Second address note");
    expect(html).toContain("DELIVERY NOTE · 1/2");
    expect(html).toContain("DELIVERY NOTE · 2/2");
    expect(html).toContain("page-break-before: always");
  });

  it("reconciles legacy POS allocation IDs after Odoo replaces order-line IDs", () => {
    const html = generateDeliveryNote(orderFixture({
      odooOrderName: "S17816",
      items: [
        {
          id: "odoo-line-301",
          name: "CNY REMOVAL FOR KOWLOON AREA",
          price: 100,
          quantity: 1,
        },
        {
          id: "odoo-line-302",
          name: "Container - baskets",
          price: 200,
          quantity: 1,
        },
      ],
      deliverySplits: [splitFixture({
        itemAllocations: [{
          itemId: "legacy-pos-container",
          itemName: "Container - baskets",
          quantity: 1,
        }],
      })],
    }));
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const pages = [...parsed.querySelectorAll('[data-print-document="delivery-note"]')];

    expect(pages).toHaveLength(2);
    expect(pages[0].textContent).toContain("CNY REMOVAL FOR KOWLOON AREA");
    expect(pages[0].textContent).not.toContain("Container - baskets");
    expect(pages[1].textContent).toContain("Container - baskets");
    expect(pages[1].textContent).not.toContain("CNY REMOVAL FOR KOWLOON AREA");
  });

  it("refuses to guess a legacy allocation when duplicate item names exist", () => {
    const order = orderFixture({
      odooOrderName: "S17816",
      items: [
        { id: "odoo-line-301", name: "Rose bouquet", price: 100, quantity: 1 },
        { id: "odoo-line-302", name: "Rose bouquet", price: 200, quantity: 1 },
      ],
      deliverySplits: [splitFixture({
        itemAllocations: [{
          itemId: "legacy-pos-rose",
          itemName: "Rose bouquet",
          quantity: 1,
        }],
      })],
    });

    expect(() => generateDeliveryNote(order)).toThrow(
      "S17816-D2 商品分配「Rose bouquet」有多條同名 Odoo 訂單行，系統拒絕自動猜配。",
    );
  });

  it("keeps the receipt as a formal priced customer and payment document", () => {
    const html = generateReceipt(orderFixture());

    expect(html).toContain('data-print-document="receipt"');
    expect(html).toContain('data-document-section="customer-details"');
    expect(html).toContain('data-price-display="shown"');
    expect(html).toContain("$680");
    expect(html).toContain('data-document-section="payment-summary"');
    expect(html).toContain("已付款");
    expect(html).not.toContain("PRIVATE CARD MESSAGE");
  });

  it("prints one private card page per enabled destination with its own reference and message", () => {
    const html = generateMessageCards(orderFixture({
      deliverySplits: [
        splitFixture({
          giftCardEnabled: false,
          giftCardMessage: "DISABLED SPLIT MESSAGE",
        }),
        splitFixture({
          id: "split-2",
          giftCardEnabled: true,
          giftCardMessage: "THIRD DESTINATION MESSAGE",
        }),
      ],
    }));
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const pages = [...parsed.querySelectorAll('[data-print-document="message-card"]')];

    expect(pages).toHaveLength(2);
    expect(pages[0].getAttribute("data-message-card-reference")).toBe("S17738-D1");
    expect(pages[0].textContent).toContain("PRIVATE CARD MESSAGE");
    expect(pages[0].textContent).not.toContain("THIRD DESTINATION MESSAGE");
    expect(pages[1].getAttribute("data-message-card-reference")).toBe("S17738-D3");
    expect(pages[1].textContent).toContain("THIRD DESTINATION MESSAGE");
    expect(pages[1].textContent).not.toContain("PRIVATE CARD MESSAGE");
    expect(html).not.toContain("DISABLED SPLIT MESSAGE");
    expect(html).not.toContain("RECIPIENT NAME");
    expect(html).not.toContain("SECOND RECIPIENT");
  });

  it("uses the D1 destination reference for an unsplit primary message card", () => {
    const html = generateMessageCards(orderFixture({ deliverySplits: undefined }));

    expect(html).toContain('data-message-card-reference="S17738-D1"');
    expect(html).toContain("DESTINATION：S17738-D1");
  });

  it("prints safe Markdown emphasis while escaping message-card HTML", () => {
    const html = generateMessageCards(orderFixture({
      giftCardMessage: '**Bold <script>alert("x")</script>** and *italic & safe*',
    }));

    expect(html).toContain('<strong>Bold &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</strong>');
    expect(html).toContain("<em>italic &amp; safe</em>");
    expect(html).not.toContain("<script>alert");
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

  it("prints an independent picking-list pair for every split destination", () => {
    const html = generatePickingList(orderFixture({
      odooOrderName: "S17816",
      items: [
        { id: "line-1", name: "Rose bouquet", price: 680, quantity: 3 },
        { id: "line-2", name: "Glass vase", price: 250, quantity: 1 },
      ],
      deliverySplits: [splitFixture({
        itemAllocations: [{ itemId: "line-1", itemName: "Rose bouquet", quantity: 1 }],
      })],
    }));
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const copies = [...parsed.querySelectorAll("[data-picking-copy]")];
    const destinationOne = copies.filter((copy) => copy.getAttribute("data-picking-destination") === "1");
    const destinationTwo = copies.filter((copy) => copy.getAttribute("data-picking-destination") === "2");

    expect(copies).toHaveLength(4);
    expect(destinationOne).toHaveLength(2);
    expect(destinationTwo).toHaveLength(2);
    expect(destinationOne.every((copy) => copy.getAttribute("data-picking-reference") === "S17816-1")).toBe(true);
    expect(destinationTwo.every((copy) => copy.getAttribute("data-picking-reference") === "S17816-2")).toBe(true);
    expect(destinationOne.every((copy) => copy.textContent?.includes("Glass vase"))).toBe(true);
    expect(destinationOne.every((copy) => copy.textContent?.includes("Rose bouquet"))).toBe(true);
    expect(destinationTwo.every((copy) => copy.textContent?.includes("Rose bouquet"))).toBe(true);
    expect(destinationTwo.every((copy) => !copy.textContent?.includes("Glass vase"))).toBe(true);
    expect(html.match(/data-page-format="landscape-full-page"/g)).toHaveLength(4);
  });

  it("assigns an order-level price adjustment to the first split picking list only", () => {
    const html = generatePickingList(orderFixture({
      odooOrderName: "S17816",
      items: [
        { id: "line-1", name: "Rose bouquet", price: 100, quantity: 3 },
        { id: "line-2", name: "Glass vase", price: 50, quantity: 1 },
      ],
      deliveryFee: 20,
      subtotal: 350,
      finalPrice: 300,
      priceOverridden: true,
      deliverySplits: [splitFixture({
        itemAllocations: [{ itemId: "line-1", itemName: "Rose bouquet", quantity: 1 }],
      })],
    }));
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const destinationOne = parsed.querySelector('[data-picking-reference="S17816-1"]');
    const destinationTwo = parsed.querySelector('[data-picking-reference="S17816-2"]');

    expect(destinationOne?.textContent).toContain("訂單金額調整");
    expect(destinationOne?.querySelector(".total-row .num")?.textContent).toBe("$200");
    expect(destinationTwo?.textContent).not.toContain("訂單金額調整");
    expect(destinationTwo?.querySelector(".total-row .num")?.textContent).toBe("$100");
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
    ["receipt", generateReceipt],
    ["delivery note", generateDeliveryNote],
    ["picking list", generatePickingList],
  ])("does not expose any destination card message in the %s", (_, generator) => {
    const html = generator(orderFixture({
      deliverySplits: [splitFixture({
        giftCardEnabled: true,
        giftCardMessage: "PRIVATE SPLIT CARD MESSAGE",
      })],
    }));

    expect(html).not.toContain("PRIVATE CARD MESSAGE");
    expect(html).not.toContain("PRIVATE SPLIT CARD MESSAGE");
  });

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
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const copies = [...parsed.querySelectorAll("[data-picking-copy]")];

    expect(html).toContain('data-picking-copy="warehouse"');
    expect(html).toContain('data-picking-copy="dispatch"');
    expect(copies).toHaveLength(2);
    expect(copies.every((copy) => copy.getAttribute("data-picking-reference") === "S17738")).toBe(true);
    expect(copies.every((copy) => copy.textContent?.includes("S17738"))).toBe(true);
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

  it.each([generateReceipt, generateDeliveryNote, generatePickingList, generateMessageCards])(
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
