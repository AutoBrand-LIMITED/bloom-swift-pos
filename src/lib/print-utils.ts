import type { DeliverySplit, Order, OrderItem } from "@/types/order";
import {
  normalizeDiscountPercent,
  orderItemTotal,
} from "@/lib/order-pricing";
import { renderSafeMarkdown } from "@/lib/safe-markdown";

const paymentLabel: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  deposit: "已付訂金",
};

const commonStyles = `
  @page { size: A4 landscape; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { background: #fff; }
  body {
    width: 281mm;
    min-height: 194mm;
    font-family: Arial, 'Helvetica Neue', 'Noto Sans TC', sans-serif;
    color: #000;
    background: #fff;
    font-size: 11pt;
    line-height: 1.4;
    letter-spacing: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-document { width: 281mm; min-height: 194mm; }
  .document-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 82mm;
    gap: 8mm;
    align-items: end;
    min-height: 28mm;
    padding-bottom: 5mm;
    border-bottom: 0.7mm solid #000;
  }
  .brand-name { font-size: 10pt; font-weight: 700; }
  .document-title h1 { margin-top: 1.5mm; font-size: 24pt; line-height: 1.1; font-weight: 700; }
  .english-title { margin-top: 1mm; font-size: 10pt; font-weight: 700; }
  .document-reference { border-left: 0.5mm solid #000; padding-left: 5mm; }
  .field-row {
    display: grid;
    grid-template-columns: 29mm minmax(0, 1fr);
    gap: 3mm;
    align-items: baseline;
    min-height: 6mm;
    padding: 0.8mm 0;
  }
  .field-label { font-size: 9.5pt; font-weight: 700; }
  .field-value { min-width: 0; overflow-wrap: anywhere; }
  .section-heading {
    margin: 6mm 0 2.5mm;
    padding-bottom: 1.5mm;
    border-bottom: 0.4mm solid #000;
    font-size: 13pt;
    line-height: 1.2;
    font-weight: 700;
    break-after: avoid;
    page-break-after: avoid;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 12mm;
    row-gap: 1mm;
    margin-top: 5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .meta-field {
    display: grid;
    grid-template-columns: 32mm minmax(0, 1fr);
    gap: 3mm;
    min-height: 7mm;
    padding: 1.2mm 0;
    border-bottom: 0.3mm solid #000;
  }
  .meta-field .label { font-size: 9.5pt; font-weight: 700; }
  .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 2mm; }
  .items-table thead { display: table-header-group; }
  .items-table tr { break-inside: avoid; page-break-inside: avoid; }
  .items-table th,
  .items-table td {
    padding: 2.4mm 3mm;
    border: 0.3mm solid #000;
    font-size: 10.5pt;
    line-height: 1.3;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .items-table th { font-weight: 700; }
  .items-table .quantity-column { width: 25mm; }
  .items-table .price-column { width: 34mm; }
  .items-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .items-table .total-row td { border-top: 0.7mm solid #000; font-size: 12pt; font-weight: 700; }
  .item-adjustment { margin-top: 0.8mm; font-size: 8.5pt; }
  .document-notes {
    min-height: 20mm;
    margin-top: 3mm;
    padding: 3mm 4mm;
    border: 0.4mm solid #000;
    font-size: 11pt;
    overflow-wrap: anywhere;
  }
  .payment-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8mm;
    align-items: center;
    margin-top: 4mm;
    padding: 3mm 4mm;
    border: 0.5mm solid #000;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .payment-status { font-size: 12pt; font-weight: 700; }
  .payment-detail { display: flex; gap: 8mm; font-variant-numeric: tabular-nums; }
  .signature-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18mm;
    margin-top: 16mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signature-line { padding-top: 2mm; border-top: 0.4mm solid #000; font-size: 10pt; font-weight: 700; }
  .footer { margin-top: 8mm; padding-top: 2mm; border-top: 0.3mm solid #000; font-size: 8.5pt; text-align: center; }
  @media print {
    html, body { width: 281mm; min-height: 194mm; }
    body { margin: 0; }
  }
`;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function orderReference(order: Order): string {
  return order.odooOrderName || order.id.slice(0, 8).toUpperCase();
}

function createdAtLabel(order: Order): string {
  const date = new Date(order.createdAt);
  return Number.isNaN(date.getTime()) ? order.createdAt : date.toLocaleString("zh-HK");
}

function deliveryTimeLabel(order: Order): string {
  const snapshot = order.deliveryTime.trim();
  if (order.deliveryTimeMode !== "specified" || !snapshot) return snapshot;
  return snapshot.startsWith("指定時間：") ? snapshot : `指定時間：${snapshot}`;
}

function displayValue(value: unknown): string {
  const snapshot = String(value ?? "").trim();
  return snapshot ? escapeHtml(snapshot) : "未提供";
}

function fieldRows(rows: Array<[label: string, value: unknown]>): string {
  return rows
    .map(
      ([label, value]) => `
        <div class="field-row">
          <span class="field-label">${label}</span>
          <span class="field-value">${displayValue(value)}</span>
        </div>`
    )
    .join("");
}

function documentHeader(
  order: Order,
  chineseTitle: string,
  englishTitle: string
): string {
  return `
    <header class="document-header">
      <div class="document-title">
        <div class="brand-name">中西花店</div>
        <h1>${chineseTitle}</h1>
        <div class="english-title">${englishTitle}</div>
      </div>
      <div class="document-reference">
        ${fieldRows([
          ["訂單編號", orderReference(order)],
          ["開單日期", createdAtLabel(order)],
        ])}
      </div>
    </header>`;
}

function receiptMeta(order: Order): string {
  const senderName = order.senderName?.trim() || order.customerName?.trim() || "未提供";
  return `
    <section class="meta-grid receipt-meta" data-document-section="customer-details">
      <div class="meta-field"><span class="label">下單／付款人</span><span>${displayValue(order.customerName)}</span></div>
      <div class="meta-field"><span class="label">下單人電話</span><span>${displayValue(order.phone)}</span></div>
      <div class="meta-field"><span class="label">送花人</span><span>${displayValue(senderName)}</span></div>
    </section>
  `;
}

function privateDocumentMeta(order: Order): string {
  return `
    <div class="pick-reference">
      ${fieldRows([
        ["訂單編號", orderReference(order)],
        ["開單日期", createdAtLabel(order)],
      ])}
    </div>
  `;
}

function itemsTable(order: Order, showPrice: boolean): string {
  const rows = order.items
    .map((item) => {
      const discountPercent = normalizeDiscountPercent(item.discountPercent);
      const adjustment = showPrice && discountPercent > 0
        ? `<div class="item-adjustment">折扣 ${escapeHtml(discountPercent)}% / DISCOUNT</div>`
        : "";
      const unitPriceNote = discountPercent > 0
        ? '<div class="item-adjustment">折扣前 / BEFORE DISCOUNT</div>'
        : "";

      return `
    <tr>
      <td>${escapeHtml(item.name)}${adjustment}</td>
      <td class="num">${escapeHtml(item.quantity)}</td>
      ${showPrice ? `<td class="num">$${escapeHtml(item.price.toLocaleString())}${unitPriceNote}</td>` : ""}
      ${showPrice ? `<td class="num">$${escapeHtml(orderItemTotal(item).toLocaleString())}</td>` : ""}
    </tr>`;
    })
    .join("");

  const extras: string[] = [];
  if (showPrice && order.deliveryFee > 0) {
    extras.push(`<tr><td colspan="3">送貨費</td><td class="num">$${order.deliveryFee.toLocaleString()}</td></tr>`);
  }
  if (showPrice && order.urgentFee > 0) {
    extras.push(`<tr><td colspan="3">急單費</td><td class="num">$${order.urgentFee.toLocaleString()}</td></tr>`);
  }

  return `
    <table class="items-table ${showPrice ? "priced-items" : "unpriced-items"}" data-price-display="${showPrice ? "shown" : "hidden"}">
      <thead>
        <tr>
          <th>項目 / ITEM</th>
          <th class="num quantity-column">數量 / QTY</th>
          ${showPrice ? '<th class="num price-column">單價 / UNIT PRICE</th>' : ""}
          ${showPrice ? '<th class="num price-column">小計 / AMOUNT</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${extras.join("")}
        ${
          showPrice
            ? `<tr class="total-row">
                <td colspan="3">總計 / TOTAL</td>
                <td class="num">$${order.finalPrice.toLocaleString()}</td>
              </tr>`
            : ""
        }
      </tbody>
    </table>
  `;
}

function pickingDeliveryInfo(order: Order): string {
  const recipientCompanyRow = order.recipientCompanyName?.trim()
    ? `<div><span class="label">收貨公司</span>${displayValue(order.recipientCompanyName)}</div>`
    : "";
  return `
    <div class="pick-delivery-grid" data-document-section="delivery-details">
      <div><span class="label">送貨日期</span>${displayValue(order.deliveryDate)}</div>
      <div><span class="label">送貨時間</span>${displayValue(deliveryTimeLabel(order))}</div>
      ${recipientCompanyRow}
      <div><span class="label">收貨人</span>${displayValue(order.recipientName)}</div>
      <div><span class="label">收貨人電話</span>${displayValue(order.recipientPhone)}</div>
      <div class="wide"><span class="label">地址</span>${displayValue(order.deliveryAddress)}</div>
      ${order.deliveryPerson ? `<div><span class="label">送貨人</span>${displayValue(order.deliveryPerson)}</div>` : ""}
    </div>
  `;
}

function pickingInstructions(order: Order): string {
  return order.deliveryNote
    ? `<div class="pick-instructions"><span class="label">送貨指示</span>${nl2br(order.deliveryNote)}</div>`
    : "";
}

/** 客人收據 */
export function generateReceipt(order: Order): string {
  const status = paymentLabel[order.paymentStatus] || order.paymentStatus;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>收據 - ${escapeHtml(orderReference(order))}</title>
    <style>${commonStyles}</style></head><body>
    <main class="print-document receipt-document" data-print-document="receipt">
      ${documentHeader(order, "收據", "RECEIPT")}
      ${receiptMeta(order)}
      <section data-document-section="items">
        <h2 class="section-heading">訂單明細 / ORDER DETAILS</h2>
        ${itemsTable(order, true)}
      </section>
      <section class="payment-summary" data-document-section="payment-summary">
        <div><span class="field-label">付款狀態 / PAYMENT STATUS：</span><span class="payment-status">${escapeHtml(status)}</span></div>
        ${
          order.paymentStatus === "deposit"
            ? `<div class="payment-detail"><span>訂金 $${order.depositAmount.toLocaleString()}</span><span>尚欠 $${(order.finalPrice - order.depositAmount).toLocaleString()}</span></div>`
            : ""
        }
      </section>
      <div class="footer">此收據由花店 POS 系統產生 | ${new Date().toLocaleDateString("zh-HK")}</div>
    </main>
  </body></html>`;
}

/** 客人送貨單 */
export function generateDeliveryNote(order: Order): string {
  const destinations = deliveryDestinations(order);
  const pages = destinations.map(({ order: destinationOrder, reference }, index) => `
    <main class="print-document delivery-document" data-print-document="delivery-note" data-delivery-destination="${index + 1}">
      <header class="delivery-heading">
        <div class="document-title">
          <div class="brand-name">中西花店</div>
          <h1>送貨單</h1>
          <div class="english-title">DELIVERY NOTE${destinations.length > 1 ? ` · ${index + 1}/${destinations.length}` : ""}</div>
        </div>
      </header>
      <div class="delivery-overview" data-document-section="delivery-overview">
        <section class="recipient-block" data-delivery-column="recipient">
          <h2 class="block-title">收貨資料 / RECIPIENT</h2>
          ${fieldRows([
            ...(destinationOrder.recipientCompanyName?.trim()
              ? [["收貨公司", destinationOrder.recipientCompanyName] as [string, unknown]]
              : []),
            ["收貨人", destinationOrder.recipientName],
            ["收貨人電話", destinationOrder.recipientPhone],
            ["送貨地址", destinationOrder.deliveryAddress],
          ])}
        </section>
        <section class="delivery-reference-block" data-delivery-column="reference">
          <h2 class="block-title">送貨資料 / REFERENCE</h2>
          ${fieldRows([
            ["訂單編號", reference],
            ["送貨日期", destinationOrder.deliveryDate],
            ["送貨時間", deliveryTimeLabel(destinationOrder)],
          ])}
        </section>
      </div>
      <section data-document-section="items">
        <h2 class="section-heading">送貨物品 / ITEMS</h2>
        ${itemsTable(destinationOrder, false)}
      </section>
      <section data-document-section="delivery-note">
        <h2 class="section-heading">送貨備註 / DELIVERY NOTE</h2>
        <div class="document-notes">${destinationOrder.deliveryNote ? nl2br(destinationOrder.deliveryNote) : "&nbsp;"}</div>
      </section>
      <div class="signature-grid" data-document-section="signatures">
        <div class="signature-line" data-signature="delivery">送貨人簽署 / DELIVERED BY</div>
        <div class="signature-line" data-signature="recipient">收貨人簽署 / RECEIVED BY</div>
      </div>
      <div class="footer">此送貨單由花店 POS 系統產生 | ${new Date().toLocaleDateString("zh-HK")}</div>
    </main>`).join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>送貨單 - ${escapeHtml(orderReference(order))}</title>
    <style>${commonStyles}
      .delivery-document + .delivery-document {
        break-before: page;
        page-break-before: always;
      }
      .delivery-heading {
        display: flex;
        justify-content: space-between;
        align-items: end;
        min-height: 28mm;
        padding-bottom: 5mm;
        border-bottom: 0.7mm solid #000;
      }
      .delivery-overview {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(72mm, 0.8fr);
        gap: 12mm;
        margin-top: 6mm;
      }
      .delivery-overview > section {
        min-height: 48mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .delivery-overview .block-title {
        padding-bottom: 1.5mm;
        border-bottom: 0.4mm solid #000;
        font-size: 12pt;
        font-weight: 700;
      }
      .delivery-overview .field-row { grid-template-columns: 31mm minmax(0, 1fr); padding: 1.5mm 0; }
      .recipient-address { white-space: normal; }
    </style></head><body>
    ${pages}
  </body></html>`;
}

interface ResolvedDeliveryAllocations {
  primaryItems: OrderItem[];
  splitItems: OrderItem[][];
}

const normalizedAllocationName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

function resolveDeliveryAllocations(order: Order): ResolvedDeliveryAllocations {
  const reference = orderReference(order);
  const itemsById = new Map(order.items.map((item) => [item.id, item]));
  const itemsByName = new Map<string, OrderItem[]>();
  for (const item of order.items) {
    const key = normalizedAllocationName(item.name);
    itemsByName.set(key, [...(itemsByName.get(key) || []), item]);
  }

  const allocated = new Map<string, number>();
  const splitItems = (order.deliverySplits || []).map((split, splitIndex) => (
    split.itemAllocations.map((allocation) => {
      const destinationReference = `${reference}-D${splitIndex + 2}`;
      let item = itemsById.get(allocation.itemId);
      if (!item) {
        const matches = itemsByName.get(normalizedAllocationName(allocation.itemName)) || [];
        if (matches.length > 1) {
          throw new Error(
            `${destinationReference} 商品分配「${allocation.itemName}」有多條同名 Odoo 訂單行，系統拒絕自動猜配。`,
          );
        }
        item = matches[0];
      }
      if (!item) {
        throw new Error(
          `${destinationReference} 商品分配「${allocation.itemName}」未能對應 Odoo 訂單行，請重新同步訂單。`,
        );
      }
      if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) {
        throw new Error(`${destinationReference} 商品分配「${allocation.itemName}」數量無效。`);
      }
      const nextAllocated = (allocated.get(item.id) || 0) + allocation.quantity;
      if (nextAllocated > item.quantity) {
        throw new Error(
          `${destinationReference} 商品分配「${allocation.itemName}」超出訂單數量，請核對拆單。`,
        );
      }
      allocated.set(item.id, nextAllocated);
      return { ...item, quantity: allocation.quantity };
    })
  ));

  return {
    primaryItems: order.items.flatMap((item) => {
      const quantity = item.quantity - (allocated.get(item.id) || 0);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }),
    splitItems,
  };
}

function splitAsOrder(order: Order, split: DeliverySplit, items: OrderItem[]): Order {
  return {
    ...order,
    items,
    fulfillmentType: split.fulfillmentType || "delivery",
    deliveryDate: split.deliveryDate,
    deliveryTimeMode: split.deliveryTimeMode,
    deliverySlotId: split.deliverySlotId,
    deliveryTime: split.deliveryTime,
    deliveryAddress: split.deliveryAddress,
    deliveryGoogleAddress: split.deliveryGoogleAddress,
    deliveryBuilding: split.deliveryBuilding,
    deliveryFloor: split.deliveryFloor,
    deliveryUnit: split.deliveryUnit,
    recipientType: split.recipientType,
    recipientCompanyName: split.recipientCompanyName,
    recipientName: split.recipientName,
    recipientPhone: split.recipientPhone,
    recipientOccasions: split.recipientOccasions,
    recipientBirthday: split.recipientBirthday,
    deliveryPerson: split.deliveryPerson,
    deliveryNote: split.deliveryNote,
    giftCardEnabled: split.giftCardEnabled ?? false,
    giftCardMessage: split.giftCardMessage ?? "",
  };
}

function deliveryDestinations(order: Order): Array<{ order: Order; reference: string }> {
  const splits = order.deliverySplits || [];
  if (!splits.length) return [{ order, reference: orderReference(order) }];

  const reference = orderReference(order);
  const resolved = resolveDeliveryAllocations(order);
  return [
    {
      order: { ...order, items: resolved.primaryItems },
      reference: `${reference}-D1`,
    },
    ...splits.map((split, index) => ({
      order: splitAsOrder(order, split, resolved.splitItems[index]),
      reference: `${reference}-D${index + 2}`,
    })),
  ];
}

function messageCardDestinations(order: Order) {
  const reference = orderReference(order);
  const destinations = order.deliverySplits?.length
    ? [
        { order, reference: `${reference}-D1` },
        ...order.deliverySplits.map((split, index) => ({
          order: splitAsOrder(order, split, []),
          reference: `${reference}-D${index + 2}`,
        })),
      ]
    : [{ order, reference: `${reference}-D1` }];
  return destinations
    .map((destination, index) => ({ ...destination, destinationIndex: index + 1 }))
    .filter(({ order: destinationOrder }) => destinationOrder.giftCardEnabled);
}

export function hasEnabledMessageCards(order: Order): boolean {
  return Boolean(
    order.giftCardEnabled
    || order.deliverySplits?.some((split) => split.giftCardEnabled),
  );
}

/** 每個已啟用收貨點各自一頁的心意卡 */
export function generateMessageCards(order: Order): string {
  const destinations = messageCardDestinations(order);
  const pages = destinations.map(({ order: destinationOrder, reference, destinationIndex }) => `
    <main
      class="print-document message-card-document"
      data-print-document="message-card"
      data-message-card-destination="${destinationIndex}"
      data-message-card-reference="${escapeHtml(reference)}"
    >
      <header class="message-card-header">
        <div class="brand-name">中西花店</div>
        <h1>心意卡</h1>
        <div class="english-title">MESSAGE CARD</div>
      </header>
      <section class="message-card-content" data-document-section="message-card-content">
        ${destinationOrder.giftCardMessage
          ? renderSafeMarkdown(destinationOrder.giftCardMessage)
          : "&nbsp;"}
      </section>
      <div class="message-card-reference">收貨點編號 / DESTINATION：${escapeHtml(reference)}</div>
    </main>`).join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>心意卡 - ${escapeHtml(orderReference(order))}</title>
    <style>${commonStyles}
      .message-card-document {
        display: flex;
        min-height: 194mm;
        flex-direction: column;
        padding: 12mm;
      }
      .message-card-document + .message-card-document {
        break-before: page;
        page-break-before: always;
      }
      .message-card-header { text-align: center; }
      .message-card-header h1 { margin-top: 3mm; font-size: 28pt; line-height: 1.1; }
      .message-card-content {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        padding: 16mm;
        font-size: 20pt;
        line-height: 1.7;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .message-card-reference {
        padding-top: 3mm;
        border-top: 0.3mm solid #000;
        font-size: 9pt;
        text-align: right;
      }
    </style></head><body>
    ${pages}
  </body></html>`;
}

/** 倉庫執貨單 */
export function generatePickingList(order: Order): string {
  const estimatedItemLines = order.items.reduce(
    (total, item) => total + Math.max(1, Math.ceil(item.name.length / 70)),
    0,
  );
  const estimatedDetailLines = Math.ceil(order.deliveryAddress.length / 100)
    + Math.ceil(order.deliveryNote.length / 100)
    + Math.ceil(deliveryTimeLabel(order).length / 40)
    + Math.ceil((order.recipientCompanyName?.length || 0) / 50)
    + Math.ceil(order.recipientName.length / 50);
  const hasDiscountRows = order.items.some(
    (item) => normalizeDiscountPercent(item.discountPercent) > 0,
  );
  const feeRowCount = Number(order.deliveryFee > 0) + Number(order.urgentFee > 0);
  const usesDenseLayout = order.items.length >= 4
    || hasDiscountRows
    || feeRowCount > 1
    || estimatedItemLines + estimatedDetailLines > 8;
  const copy = (kind: "warehouse" | "dispatch", subtitle: string) => `
    <section class="pick-copy" data-picking-copy="${kind}" data-page-format="landscape-full-page">
      <header class="pick-header">
        <div>
          <div class="brand-name">中西花店</div>
          <h1>執貨單</h1>
          <div class="english-title">${subtitle}</div>
        </div>
        ${privateDocumentMeta(order)}
      </header>
      ${pickingDeliveryInfo(order)}
      <div class="pick-table-wrap">${itemsTable(order, true)}</div>
      ${pickingInstructions(order)}
      <div class="pick-signature">執貨員核對及簽署 / CHECKED BY</div>
    </section>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>執貨單 - ${escapeHtml(orderReference(order))}</title>
    <style>${commonStyles}
      .picking-sheet { width: 281mm; min-height: 194mm; }
      .picking-document {
        width: 281mm;
        min-height: 194mm;
      }
      .pick-copy {
        min-height: 194mm;
        padding: 2mm 0;
        break-after: page;
        page-break-after: always;
      }
      .pick-copy:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .pick-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 76mm;
        gap: 6mm;
        align-items: end;
        min-height: 28mm;
        padding-bottom: 4mm;
        border-bottom: 0.7mm solid #000;
      }
      .pick-header h1 { margin-top: 1.5mm; font-size: 24pt; line-height: 1.1; }
      .pick-header .brand-name,
      .pick-header .english-title { font-size: 10pt; }
      .pick-reference .field-row {
        grid-template-columns: 24mm minmax(0, 1fr);
        min-height: 6mm;
        padding: 0.8mm 0;
        font-size: 10.5pt;
      }
      .pick-reference .field-label { font-size: 9.5pt; }
      .pick-delivery-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.5mm 6mm;
        margin-top: 4mm;
        font-size: 11pt;
      }
      .pick-delivery-grid > div { min-width: 0; overflow-wrap: anywhere; }
      .pick-delivery-grid .wide { grid-column: span 3; }
      .pick-delivery-grid .label,
      .pick-instructions .label { margin-right: 2mm; font-size: 10pt; font-weight: 700; }
      .pick-table-wrap { margin-top: 4mm; }
      .pick-table-wrap .items-table { margin: 0; }
      .pick-table-wrap .items-table th,
      .pick-table-wrap .items-table td { padding: 2.2mm 2.5mm; font-size: 11pt; line-height: 1.25; }
      .pick-table-wrap .items-table .quantity-column { width: 20mm; }
      .pick-table-wrap .items-table .price-column { width: 28mm; }
      .pick-table-wrap .items-table .total-row td { font-size: 12pt; }
      .pick-instructions { margin-top: 3mm; font-size: 11pt; overflow-wrap: anywhere; }
      .pick-signature { width: 80mm; margin-top: 16mm; padding-top: 2mm; border-top: 0.4mm solid #000; font-size: 10pt; font-weight: 700; }
      .picking-document--dense .pick-header {
        min-height: 20mm;
        padding-bottom: 2mm;
        border-bottom-width: 0.5mm;
      }
      .picking-document--dense .pick-header h1 { margin-top: 0.5mm; font-size: 18pt; line-height: 1; }
      .picking-document--dense .pick-header .brand-name,
      .picking-document--dense .pick-header .english-title { font-size: 8.5pt; }
      .picking-document--dense .pick-reference .field-row {
        min-height: 4.5mm;
        padding: 0;
        font-size: 9pt;
      }
      .picking-document--dense .pick-reference .field-label { font-size: 8.5pt; }
      .picking-document--dense .pick-delivery-grid {
        gap: 0.5mm 5mm;
        margin-top: 1.5mm;
        font-size: 9pt;
      }
      .picking-document--dense .pick-delivery-grid .label,
      .picking-document--dense .pick-instructions .label { font-size: 8.5pt; }
      .picking-document--dense .pick-table-wrap { margin-top: 1.5mm; }
      .picking-document--dense .pick-table-wrap .items-table th,
      .picking-document--dense .pick-table-wrap .items-table td {
        padding: 1mm 1.8mm;
        font-size: 9.5pt;
        line-height: 1.15;
      }
      .picking-document--dense .pick-table-wrap .items-table .total-row td { font-size: 10pt; }
      .picking-document--dense .pick-instructions { margin-top: 1.5mm; font-size: 9pt; }
      .picking-document--dense .pick-signature {
        width: 72mm;
        margin-top: 5mm;
        padding-top: 1mm;
        border-top-width: 0.3mm;
        font-size: 8.5pt;
      }
    </style></head><body class="picking-sheet">
    <main class="print-document picking-document picking-document--full-page${usesDenseLayout ? " picking-document--dense" : ""}" data-print-document="picking-list">
      ${copy("warehouse", "PICKING LIST · 倉庫聯")}
      ${copy("dispatch", "PICKING LIST · 出貨聯")}
    </main>
  </body></html>`;
}

interface PrintableDocumentParts {
  body: string;
  styles: string;
}

function printableDocumentParts(html: string): PrintableDocumentParts {
  const styles = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/)?.[1];

  if (!styles || !body) {
    throw new Error("Unable to prepare the printable document bundle.");
  }

  return { body, styles };
}

/** 客人收據、送貨單、執貨單及已啟用心意卡，以一次列印操作輸出 */
export function generateAllDocuments(order: Order): string {
  const documents: Array<readonly [string, string]> = [
    ["receipt", generateReceipt(order)],
    ["delivery-note", generateDeliveryNote(order)],
    ["picking-list", generatePickingList(order)],
  ];
  if (hasEnabledMessageCards(order)) {
    documents.push(["message-card", generateMessageCards(order)]);
  }
  const parts = documents.map(([kind, html]) => ({
    kind,
    ...printableDocumentParts(html),
  }));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>全部文件 - ${escapeHtml(orderReference(order))}</title>
    <style>
      ${parts.map(({ styles }) => styles).join("\n")}
      .batch-print-document {
        width: 281mm;
        min-height: 194mm;
      }
      .batch-print-document + .batch-print-document {
        break-before: page;
        page-break-before: always;
      }
    </style></head><body class="batch-print">
      ${parts
        .map(
          ({ kind, body }) => `<section class="batch-print-document" data-batch-print-document="${kind}">
            ${body}
          </section>`,
        )
        .join("\n")}
    </body></html>`;
}

/** Open a print window with the given HTML */
export function printDocument(html: string) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // Small delay to let styles load
  setTimeout(() => {
    win.print();
  }, 300);
}
