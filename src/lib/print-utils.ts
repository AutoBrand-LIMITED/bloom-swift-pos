import type { Order, Delivery } from "@/types/order";
import { SALES_STAFF } from "@/types/order";

const paymentLabel: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  deposit: "已付訂金",
};

const commonStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    padding: 28px 32px;
    font-size: 13px;
    line-height: 1.5;
    background: white;
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 2.5px solid #1a1a1a;
    margin-bottom: 20px;
  }
  .shop-name { font-size: 15px; font-weight: 700; letter-spacing: -0.2px; }
  .shop-sub { font-size: 10px; color: #999; margin-top: 3px; }
  .doc-type { text-align: right; }
  .doc-type-zh { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
  .doc-type-en { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-top: 3px; }
  .doc-ref { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 10px; color: #aaa; margin-top: 4px; }
  .section-heading {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #999;
    border-bottom: 1px solid #e8e8e8;
    padding-bottom: 5px;
    margin: 20px 0 10px;
  }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 12px; }
  .meta .lbl { font-size: 10px; color: #999; display: block; margin-bottom: 1px; letter-spacing: 0.03em; }
  .meta .val { font-weight: 500; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #999;
    background: #f5f5f5;
    border-bottom: 1.5px solid #e0e0e0;
  }
  td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 13px;
  }
  td.num, th.num { text-align: right; font-family: 'JetBrains Mono', 'Courier New', monospace; }
  .total-row td {
    border-top: 2px solid #1a1a1a;
    border-bottom: none;
    font-weight: 700;
    font-size: 16px;
    padding: 10px 10px;
    background: #fafafa;
  }
  .notes {
    background: #fafaf8;
    border-left: 3px solid #d0d0d0;
    padding: 8px 12px;
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.65;
    border-radius: 0 4px 4px 0;
  }
  .notes.highlight { border-left-color: #f59e0b; background: #fffbeb; }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }
  .badge-unpaid { background: #fee2e2; color: #dc2626; }
  .badge-paid { background: #dcfce7; color: #16a34a; }
  .badge-deposit { background: #fef3c7; color: #d97706; }
  .pick-item { display: flex; align-items: flex-start; gap: 10px; padding: 11px 0; border-bottom: 1px solid #f0f0f0; }
  .pick-cb { width: 20px; height: 20px; border: 2px solid #ccc; border-radius: 4px; flex-shrink: 0; margin-top: 4px; }
  .pick-qty { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 22px; font-weight: 700; min-width: 54px; line-height: 1; padding-top: 2px; }
  .pick-name { flex: 1; font-size: 15px; font-weight: 500; padding-top: 3px; line-height: 1.3; }
  .pick-price { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 12px; color: #888; white-space: nowrap; padding-top: 6px; }
  .tear-line { border: none; border-top: 2px dashed #ccc; margin: 28px 0; position: relative; }
  .tear-line::before { content: '✂'; position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: white; padding: 0 10px; color: #bbb; font-size: 14px; }
  .stub { background: #f5f5f5; border-radius: 8px; padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 12px; }
  .stub .lbl { font-size: 10px; color: #999; display: block; }
  .stub .val { font-weight: 600; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
  .sig-line { border-top: 1.5px solid #ccc; padding-top: 5px; font-size: 10px; color: #aaa; letter-spacing: 0.04em; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #bbb; border-top: 1px solid #eee; padding-top: 8px; }
  .recipient-card { border: 1.5px solid #e0e0e0; border-radius: 8px; padding: 16px 20px; margin-bottom: 4px; }
  .recipient-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; margin-bottom: 10px; }
  .recipient-name-lg { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
  .recipient-phone-lg { font-size: 18px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-weight: 600; color: #333; margin-top: 4px; }
  .recipient-addr { font-size: 13px; color: #444; margin-top: 10px; line-height: 1.55; border-top: 1px solid #f0f0f0; padding-top: 10px; }
  .date-block { display: flex; gap: 24px; align-items: baseline; margin-bottom: 16px; }
  .date-lg { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .time-md { font-size: 16px; font-weight: 600; color: #555; }
  @media print { body { padding: 14px 18px; } }
`;

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function orderRef(order: Order): string {
  // Permanent invoice number is the canonical reference shared across all docs;
  // fall back to the order id for legacy orders created before invoice numbers.
  return order.invoiceNumber || order.id.slice(0, 8).toUpperCase();
}

/** Per-recipient delivery-note number for split-delivery orders (INV-0012-1, INV-0012-2). */
function recipientRef(order: Order, index: number): string {
  return `${orderRef(order)}-${index + 1}`;
}

function staffName(salesId: string): string {
  return SALES_STAFF.find((s) => s.id === salesId)?.name || salesId;
}

function primaryDelivery(order: Order): Delivery | null {
  if (order.deliveries && order.deliveries.length > 0) return order.deliveries[0];
  if (order.deliveryDate || order.recipientName) {
    return {
      id: "legacy",
      deliveryDate: order.deliveryDate ?? "",
      deliveryTime: order.deliveryTime ?? "",
      deliveryRegion: "",
      deliveryDistrict: "",
      deliveryArea: "",
      deliveryDetail: order.deliveryAddress ?? "",
      recipientName: order.recipientName ?? "",
      recipientPhone: order.recipientPhone ?? "",
      deliveryPerson: order.deliveryPerson ?? "",
      failedDeliveryAction: "",
    };
  }
  return null;
}

function docHeader(zhTitle: string, enTitle: string, ref: string, date: string): string {
  return `
    <div class="doc-header">
      <div>
        <div class="shop-name">Anglo Chinese Florist</div>
        <div class="shop-sub">英華花店</div>
      </div>
      <div class="doc-type">
        <div class="doc-type-zh">${zhTitle}</div>
        <div class="doc-type-en">${enTitle}</div>
        <div class="doc-ref">${esc(ref)} · ${esc(date)}</div>
      </div>
    </div>
  `;
}

function itemsTable(order: Order, showPrice: boolean): string {
  const rows = order.items.map((item) => `
    <tr>
      <td>${esc(item.name)}</td>
      <td class="num">${item.quantity}</td>
      ${showPrice ? `<td class="num">$${item.price.toLocaleString()}</td>` : ""}
      ${showPrice ? `<td class="num">$${(item.price * item.quantity).toLocaleString()}</td>` : ""}
    </tr>`).join("");

  const extras: string[] = [];
  if (order.deliveryFee > 0)
    extras.push(`<tr><td colspan="${showPrice ? 3 : 1}">送貨費</td>${showPrice ? `<td class="num">$${order.deliveryFee.toLocaleString()}</td>` : ""}</tr>`);
  if (order.urgentFee > 0)
    extras.push(`<tr><td colspan="${showPrice ? 3 : 1}">急單費</td>${showPrice ? `<td class="num">$${order.urgentFee.toLocaleString()}</td>` : ""}</tr>`);

  return `
    <table>
      <thead>
        <tr>
          <th>項目</th>
          <th class="num">數量</th>
          ${showPrice ? '<th class="num">單價</th>' : ""}
          ${showPrice ? '<th class="num">小計</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${extras.join("")}
        ${showPrice ? `<tr class="total-row"><td colspan="3">總計</td><td class="num">$${order.finalPrice.toLocaleString()}</td></tr>` : ""}
      </tbody>
    </table>
  `;
}

function orderMeta(order: Order): string {
  const date = new Date(order.createdAt).toLocaleString("zh-HK");
  return `
    <div class="meta">
      <div><span class="lbl">訂單編號</span><span class="val">${esc(orderRef(order))}</span></div>
      <div><span class="lbl">開單日期</span><span class="val">${esc(date)}</span></div>
      <div><span class="lbl">客戶</span><span class="val">${esc(order.customerName) || "—"}</span></div>
      <div><span class="lbl">電話</span><span class="val">${esc(order.phone)}</span></div>
      ${order.salesId ? `<div><span class="lbl">員工</span><span class="val">${esc(staffName(order.salesId))}</span></div>` : ""}
    </div>
  `;
}

function deliveryBlock(d: Delivery | null, label?: string): string {
  if (!d) return "";
  const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(" ");
  return `
    <div class="meta" style="margin-top:12px">
      ${label ? `<div style="grid-column:1/-1;font-weight:600;font-size:12px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #eee">${esc(label)}</div>` : ""}
      ${d.deliveryDate ? `<div><span class="lbl">送貨日期</span><span class="val">${esc(d.deliveryDate)}</span></div>` : ""}
      ${d.deliveryTime ? `<div><span class="lbl">送貨時間</span><span class="val">${esc(d.deliveryTime)}</span></div>` : ""}
      ${d.recipientName ? `<div><span class="lbl">收貨人</span><span class="val" style="font-weight:700">${esc(d.recipientName)}</span></div>` : ""}
      ${d.recipientPhone ? `<div><span class="lbl">收貨人電話</span><span class="val">${esc(d.recipientPhone)}</span></div>` : ""}
      ${addr ? `<div style="grid-column:1/-1"><span class="lbl">地址</span><span class="val">${addr}</span></div>` : ""}
      ${d.deliveryPerson ? `<div><span class="lbl">司機</span><span class="val">${esc(d.deliveryPerson)}</span></div>` : ""}
    </div>
  `;
}

/** 客人收據 */
export function generateReceipt(order: Order): string {
  const ref = orderRef(order);
  const date = new Date(order.createdAt).toLocaleDateString("zh-HK");
  const d = primaryDelivery(order);
  const extraDeliveries = (order.deliveries ?? []).slice(1);

  const payStatus = order.paymentStatus;
  const payColor = payStatus === "paid" ? "#16a34a" : payStatus === "deposit" ? "#d97706" : "#dc2626";
  const payBg = payStatus === "paid" ? "#f0fdf4" : payStatus === "deposit" ? "#fffbeb" : "#fef2f2";
  const payText = payStatus === "paid" ? "已付款" : payStatus === "deposit" ? "已付訂金" : "未付款";

  const itemRows = order.items.map((item) => `
    <tr>
      <td class="r-item-name">${esc(item.name)}</td>
      <td class="r-item-qty">${item.quantity}</td>
      <td class="r-item-price">$${item.price.toLocaleString()}</td>
      <td class="r-item-sub">$${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`).join("");

  const feeRows = [
    order.deliveryFee > 0 ? `<tr class="r-fee-row"><td colspan="3">送貨費</td><td class="r-item-sub">$${order.deliveryFee.toLocaleString()}</td></tr>` : "",
    order.urgentFee > 0 ? `<tr class="r-fee-row"><td colspan="3">急單費</td><td class="r-item-sub">$${order.urgentFee.toLocaleString()}</td></tr>` : "",
  ].join("");

  function delivRow(label: string, rawVal: string) {
    return rawVal ? `<div class="r-meta-row"><span class="r-meta-lbl">${label}</span><span class="r-meta-val">${esc(rawVal)}</span></div>` : "";
  }

  const allDelivRows = [d, ...extraDeliveries].filter(Boolean).map((del, i) => {
    if (!del) return "";
    const addr = [del.deliveryRegion, del.deliveryDistrict, del.deliveryArea, del.deliveryDetail].filter(Boolean).map(esc).join(" ");
    const prefix = (order.deliveries?.length ?? 0) > 1 ? `[${i + 1}] ` : "";
    return `
      ${i > 0 ? `<div class="r-deliv-divider"></div>` : ""}
      ${delivRow("送貨日期", `${prefix}${del.deliveryDate || ""}`)}
      ${delivRow("送貨時間", del.deliveryTime || "")}
      ${delivRow("收貨人", del.recipientName || "")}
      ${delivRow("收貨電話", del.recipientPhone || "")}
      ${addr ? `<div class="r-meta-row"><span class="r-meta-lbl">地址</span><span class="r-meta-val">${addr}</span></div>` : ""}
    `;
  }).join("");

  const receiptStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #111;
      background: white;
      font-size: 12px;
      line-height: 1.5;
      padding: 28px 32px 24px;
      max-width: 640px;
    }
    /* Header */
    .r-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
    .r-brand { }
    .r-brand-name { font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
    .r-brand-sub { font-size: 10px; color: #888; margin-top: 2px; letter-spacing: 0.06em; }
    .r-doctype { text-align: right; }
    .r-doctype-zh { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; line-height: 1; }
    .r-ref { font-family: 'Courier New', monospace; font-size: 11px; color: #666; margin-top: 3px; }
    .r-date { font-size: 10px; color: #aaa; margin-top: 2px; }
    /* Customer meta grid */
    .r-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e8e8e8; }
    .r-meta-row { display: flex; gap: 6px; align-items: baseline; }
    .r-meta-lbl { font-size: 10px; color: #999; min-width: 52px; flex-shrink: 0; }
    .r-meta-val { font-size: 12px; font-weight: 600; }
    .r-meta-val.mono { font-family: 'Courier New', monospace; font-weight: 400; }
    /* Delivery block */
    .r-deliv { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e8e8e8; }
    .r-deliv-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #bbb; margin-bottom: 8px; }
    .r-deliv-divider { height: 1px; background: #f0f0f0; margin: 8px 0; }
    /* Items table */
    .r-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .r-table th { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; background: #f6f6f6; border-top: 1.5px solid #d0d0d0; border-bottom: 1.5px solid #d0d0d0; padding: 6px 8px; }
    .r-table th:not(:first-child) { text-align: right; }
    .r-table td { padding: 9px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; }
    .r-item-name { }
    .r-item-qty { text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #555; }
    .r-item-price { text-align: right; font-family: 'Courier New', monospace; font-size: 12px; color: #888; }
    .r-item-sub { text-align: right; font-family: 'Courier New', monospace; font-size: 12px; font-weight: 600; }
    .r-fee-row td { font-size: 11.5px; color: #666; padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
    .r-total-row { border-top: 2px solid #111; }
    .r-total-row td { padding: 10px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border: none; }
    .r-total-row td.r-total-amount { font-size: 22px; font-weight: 800; color: #111; font-family: 'Courier New', monospace; letter-spacing: -0.5px; text-align: right; }
    /* Payment status */
    .r-payment { display: flex; align-items: center; gap: 10px; margin: 16px 0; padding: 10px 14px; border-radius: 6px; }
    .r-payment-badge { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
    .r-payment-detail { font-size: 11px; color: #888; }
    /* Notes */
    .r-notes-block { margin-top: 14px; }
    .r-notes-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 4px; }
    .r-notes-body { font-size: 11.5px; line-height: 1.65; padding: 8px 12px; background: #fafaf8; border-left: 3px solid #d0d0d0; }
    .r-notes-body.highlight { border-left-color: #f59e0b; background: #fffbeb; }
    /* Footer */
    .r-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #eee; text-align: center; font-size: 9px; color: #bbb; letter-spacing: 0.05em; }
    @media print { body { padding: 14px 18px; } }
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>收據 ${esc(ref)}</title>
    <style>${receiptStyles}</style></head><body>

    <div class="r-header">
      <div class="r-brand">
        <div class="r-brand-name">Anglo Chinese Florist</div>
        <div class="r-brand-sub">英華花店</div>
      </div>
      <div class="r-doctype">
        <div class="r-doctype-zh">收據</div>
        <div class="r-ref">${esc(ref)}</div>
        <div class="r-date">${esc(date)}</div>
      </div>
    </div>

    <div class="r-meta">
      <div class="r-meta-row"><span class="r-meta-lbl">客戶</span><span class="r-meta-val">${esc(order.customerName || "—")}</span></div>
      <div class="r-meta-row"><span class="r-meta-lbl">電話</span><span class="r-meta-val mono">${esc(order.phone)}</span></div>
      ${order.contactPerson ? `<div class="r-meta-row"><span class="r-meta-lbl">聯絡人</span><span class="r-meta-val">${esc(order.contactPerson)}</span></div>` : ""}
      ${order.salesId ? `<div class="r-meta-row"><span class="r-meta-lbl">員工</span><span class="r-meta-val">${esc(staffName(order.salesId))}</span></div>` : ""}
    </div>

    ${d ? `<div class="r-deliv"><div class="r-deliv-label">送貨資料</div>${allDelivRows}</div>` : ""}

    <table class="r-table">
      <thead>
        <tr><th>項目</th><th>數量</th><th>單價</th><th>小計</th></tr>
      </thead>
      <tbody>
        ${itemRows}
        ${feeRows}
      </tbody>
      <tfoot>
        <tr class="r-total-row">
          <td colspan="3">總計</td>
          <td class="r-total-amount">$${order.finalPrice.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>

    <div class="r-payment" style="background:${payBg}">
      <span class="r-payment-badge" style="color:${payColor}">${payText}</span>
      ${order.paymentStatus === "deposit"
        ? `<span class="r-payment-detail">訂金 $${order.depositAmount.toLocaleString()} · 尚欠 $${(order.finalPrice - order.depositAmount).toLocaleString()}</span>`
        : ""}
    </div>

    ${order.senderNotes ? `<div class="r-notes-block"><div class="r-notes-label">製作備註</div><div class="r-notes-body">${esc(order.senderNotes)}</div></div>` : ""}
    ${order.deliveryNotes ? `<div class="r-notes-block"><div class="r-notes-label">送貨備註</div><div class="r-notes-body">${esc(order.deliveryNotes)}</div></div>` : ""}
    ${order.notes ? `<div class="r-notes-block"><div class="r-notes-label">備註</div><div class="r-notes-body">${esc(order.notes)}</div></div>` : ""}
    ${order.giftCardEnabled && order.giftCardMessage ? `<div class="r-notes-block"><div class="r-notes-label">卡片內容</div><div class="r-notes-body highlight">${esc(order.giftCardMessage).replace(/\n/g, "<br>")}</div></div>` : ""}

    <div class="r-footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 執貨單 — internal, hides sender, shows price, tear-off stub */
export function generatePickingList(order: Order): string {
  const ref = orderRef(order);
  const date = new Date(order.createdAt).toLocaleDateString("zh-HK");
  const allDeliveries = order.deliveries?.length
    ? order.deliveries
    : ([primaryDelivery(order)].filter(Boolean) as Delivery[]);
  const firstD = allDeliveries?.[0];
  const totalQty = order.items.reduce((s, i) => s + Number(i.quantity), 0);

  const pickStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #111;
      background: white;
      font-size: 13px;
      line-height: 1.4;
      padding: 24px 28px 20px;
      max-width: 680px;
    }
    .ps-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
    .ps-brand-name { font-size: 13px; font-weight: 700; }
    .ps-brand-sub { font-size: 10px; color: #999; margin-top: 1px; letter-spacing: 0.06em; }
    .ps-doctype { text-align: right; }
    .ps-doctype-zh { font-size: 22px; font-weight: 900; letter-spacing: -0.4px; line-height: 1; }
    .ps-confidential { font-size: 9px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 3px; }
    .ps-ref { font-family: 'Courier New', monospace; font-size: 12px; color: #555; margin-top: 2px; }
    .ps-date { font-size: 10px; color: #bbb; margin-top: 1px; }
    .ps-deliv-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px 20px; background: #f6f6f4; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; }
    .ps-deliv-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; display: block; }
    .ps-deliv-val { font-size: 12.5px; font-weight: 600; color: #111; }
    .ps-deliv-section-label { font-size: 10px; font-weight: 700; color: #888; letter-spacing: 0.06em; margin: 12px 0 6px; padding-top: 8px; border-top: 1px solid #eee; }
    .ps-section-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #aaa; margin-bottom: 8px; }
    .ps-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .ps-item:last-child { border-bottom: none; }
    .ps-cb { width: 20px; height: 20px; border: 2px solid #ccc; border-radius: 3px; flex-shrink: 0; }
    .ps-qty { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 800; color: #111; min-width: 42px; text-align: right; flex-shrink: 0; }
    .ps-name { font-size: 15px; font-weight: 500; flex: 1; }
    .ps-price { font-family: 'Courier New', monospace; font-size: 13px; color: #888; flex-shrink: 0; }
    .ps-fee-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #777; border-bottom: 1px solid #f0f0f0; }
    .ps-fee-val { font-family: 'Courier New', monospace; }
    .ps-total-block { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0 8px; border-top: 2.5px solid #111; margin-top: 2px; }
    .ps-total-label { font-size: 13px; font-weight: 700; }
    .ps-total-amount { font-family: 'Courier New', monospace; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
    .ps-notes-block { margin-top: 14px; }
    .ps-notes-label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #aaa; margin-bottom: 5px; }
    .ps-notes-body { font-size: 13px; line-height: 1.65; padding: 10px 14px; }
    .ps-notes-body.hi { background: #fffbeb; border-left: 3px solid #f59e0b; font-size: 15px; font-weight: 600; }
    .ps-notes-body.lo { background: #fafaf8; border-left: 3px solid #d0d0d0; }
    .ps-sigs { display: flex; gap: 40px; margin-top: 40px; }
    .ps-sig-line { border-top: 1.5px solid #bbb; width: 200px; padding-top: 5px; font-size: 9.5px; color: #aaa; letter-spacing: 0.05em; }
    .ps-tear { border-top: 1.5px dashed #bbb; margin: 24px 0 10px; }
    .ps-tear-label { text-align: center; font-size: 9px; color: #bbb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
    .ps-stub { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 20px; background: #f6f6f4; border-radius: 6px; padding: 12px 14px; }
    .ps-stub-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; display: block; }
    .ps-stub-val { font-size: 12px; font-weight: 600; }
    .ps-stub-val.big { font-size: 16px; font-family: 'Courier New', monospace; font-weight: 800; }
    .ps-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #eee; text-align: center; font-size: 9px; color: #bbb; letter-spacing: 0.05em; }
    @media print { body { padding: 12px 16px; } }
  `;

  const delivBars = (allDeliveries ?? []).map((d, i) => {
    if (!d) return "";
    const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(" ");
    const sectionLabel = (allDeliveries?.length ?? 0) > 1
      ? `<div class="ps-deliv-section-label">${esc(recipientRef(order, i))}</div>` : "";
    return `${sectionLabel}
      <div class="ps-deliv-bar">
        ${d.deliveryDate ? `<div><span class="ps-deliv-lbl">送貨日期</span><span class="ps-deliv-val">${esc(d.deliveryDate)}</span></div>` : ""}
        ${d.deliveryTime ? `<div><span class="ps-deliv-lbl">時間</span><span class="ps-deliv-val">${esc(d.deliveryTime)}</span></div>` : ""}
        ${d.recipientName ? `<div><span class="ps-deliv-lbl">收貨人</span><span class="ps-deliv-val">${esc(d.recipientName)}</span></div>` : ""}
        ${d.recipientPhone ? `<div><span class="ps-deliv-lbl">電話</span><span class="ps-deliv-val">${esc(d.recipientPhone)}</span></div>` : ""}
        ${d.deliveryPerson ? `<div><span class="ps-deliv-lbl">司機</span><span class="ps-deliv-val">${esc(d.deliveryPerson)}</span></div>` : ""}
        ${addr ? `<div style="grid-column:1/-1"><span class="ps-deliv-lbl">地址</span><span class="ps-deliv-val">${addr}</span></div>` : ""}
      </div>`;
  }).join("");

  const pickItems = order.items.map((item) => `
    <div class="ps-item">
      <div class="ps-cb"></div>
      <div class="ps-qty">×${Number(item.quantity)}</div>
      <div class="ps-name">${esc(item.name)}</div>
      <div class="ps-price">$${(item.price * item.quantity).toLocaleString()}</div>
    </div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>執貨單 ${esc(ref)}</title>
    <style>${pickStyles}</style></head><body>

    <div class="ps-header">
      <div>
        <div class="ps-brand-name">Anglo Chinese Florist</div>
        <div class="ps-brand-sub">英華花店</div>
      </div>
      <div class="ps-doctype">
        <div class="ps-doctype-zh">執貨單</div>
        <div class="ps-confidential">Confidential · Internal Only</div>
        <div class="ps-ref">${esc(ref)}</div>
        <div class="ps-date">${esc(date)}</div>
      </div>
    </div>

    ${delivBars}

    <div class="ps-section-label">執貨清單</div>
    ${pickItems}
    ${order.deliveryFee > 0 ? `<div class="ps-fee-row"><span>送貨費</span><span class="ps-fee-val">$${order.deliveryFee.toLocaleString()}</span></div>` : ""}
    ${order.urgentFee > 0 ? `<div class="ps-fee-row"><span>急單費</span><span class="ps-fee-val">$${order.urgentFee.toLocaleString()}</span></div>` : ""}
    <div class="ps-total-block">
      <span class="ps-total-label">總計</span>
      <span class="ps-total-amount">$${order.finalPrice.toLocaleString()}</span>
    </div>

    ${order.senderNotes ? `<div class="ps-notes-block"><div class="ps-notes-label">製作備註</div><div class="ps-notes-body hi">${esc(order.senderNotes)}</div></div>` : ""}
    ${order.deliveryNotes ? `<div class="ps-notes-block"><div class="ps-notes-label">送貨備註</div><div class="ps-notes-body lo">${esc(order.deliveryNotes)}</div></div>` : ""}
    ${order.notes ? `<div class="ps-notes-block"><div class="ps-notes-label">備註</div><div class="ps-notes-body lo">${esc(order.notes)}</div></div>` : ""}

    <div class="ps-sigs">
      <div><div class="ps-sig-line">執貨員簽署</div></div>
      <div><div class="ps-sig-line">覆核員簽署</div></div>
    </div>

    <div class="ps-tear"></div>
    <div class="ps-tear-label">隨貨交出 · Tear and attach to order</div>
    <div class="ps-stub">
      <div><span class="ps-stub-lbl">訂單編號</span><span class="ps-stub-val">${esc(ref)}</span></div>
      <div><span class="ps-stub-lbl">總計</span><span class="ps-stub-val big">$${order.finalPrice.toLocaleString()}</span></div>
      <div><span class="ps-stub-lbl">件數</span><span class="ps-stub-val big">${totalQty} 件</span></div>
      ${firstD?.deliveryDate ? `<div><span class="ps-stub-lbl">送貨日期</span><span class="ps-stub-val">${esc(firstD.deliveryDate)}</span></div>` : ""}
      ${firstD?.recipientName ? `<div><span class="ps-stub-lbl">收貨人</span><span class="ps-stub-val">${esc(firstD.recipientName)}</span></div>` : ""}
      ${firstD?.deliveryPerson ? `<div><span class="ps-stub-lbl">司機</span><span class="ps-stub-val">${esc(firstD.deliveryPerson)}</span></div>` : ""}
    </div>

    <div class="ps-footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 送貨單 — external, recipient info large, no price */
export function generateDeliveryNote(order: Order): string {
  const ref = orderRef(order);
  const allDeliveries = order.deliveries?.length
    ? order.deliveries
    : ([primaryDelivery(order)].filter(Boolean) as Delivery[]);

  const DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

  function fmtDate(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy} (週${DAY_ZH[d.getDay()]})`;
  }

  const dnStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #111;
      background: white;
      font-size: 12px;
      line-height: 1.5;
    }
    .dn-page {
      padding: 28px 32px 24px;
      max-width: 700px;
    }
    /* ── Header ── */
    .dn-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .dn-brand-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .dn-brand-sub {
      font-size: 10px;
      color: #888;
      letter-spacing: 0.06em;
      margin-top: 2px;
    }
    .dn-doctype {
      text-align: right;
    }
    .dn-doctype-zh {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.3px;
      line-height: 1;
    }
    .dn-ref {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #555;
      margin-top: 3px;
      letter-spacing: 0.04em;
    }
    /* ── Two-col info block ── */
    .dn-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 18px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 16px;
    }
    .dn-info-left {
      padding-right: 24px;
      border-right: 1px solid #e0e0e0;
    }
    .dn-info-right {
      padding-left: 24px;
    }
    .dn-field-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #999;
      display: block;
      margin-bottom: 1px;
    }
    .dn-addr-section-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #999;
      margin-bottom: 6px;
    }
    .dn-recipient-name {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 3px;
      line-height: 1.2;
    }
    .dn-recipient-addr {
      font-size: 11.5px;
      color: #333;
      line-height: 1.6;
      margin-bottom: 3px;
    }
    .dn-recipient-phone {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #555;
    }
    .dn-map-url {
      font-size: 8.5px;
      color: #999;
      margin-top: 3px;
      word-break: break-all;
    }
    .dn-map-url a { color: #2563eb; }
    .dn-sender-block {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #efefef;
    }
    .dn-meta-row {
      display: flex;
      gap: 0;
      margin-bottom: 5px;
      align-items: baseline;
    }
    .dn-meta-label {
      font-size: 10px;
      color: #999;
      min-width: 54px;
      flex-shrink: 0;
    }
    .dn-meta-value {
      font-size: 12px;
      font-weight: 600;
      color: #111;
    }
    .dn-meta-value.mono {
      font-family: 'Courier New', monospace;
      font-weight: 400;
    }
    .dn-meta-value.card {
      font-size: 11px;
      font-weight: 400;
      color: #555;
    }
    /* ── Items table ── */
    .dn-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
    }
    .dn-table th {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      background: #f6f6f6;
      border-top: 1.5px solid #d0d0d0;
      border-bottom: 1.5px solid #d0d0d0;
      padding: 6px 8px;
      text-align: left;
    }
    .dn-table th.r { text-align: right; }
    .dn-table td {
      padding: 9px 8px;
      border-bottom: 1px solid #efefef;
      font-size: 12px;
      vertical-align: top;
    }
    .dn-table td.code {
      font-family: 'Courier New', monospace;
      font-size: 10.5px;
      color: #888;
      white-space: nowrap;
    }
    .dn-table td.stock {
      text-align: right;
      color: #ccc;
      font-size: 11px;
    }
    .dn-table td.qty {
      text-align: right;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      font-weight: 700;
    }
    .dn-table tfoot td {
      border-bottom: none;
      border-top: 2px solid #111;
      padding-top: 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
    }
    .dn-table tfoot td.total-num {
      text-align: right;
      font-size: 16px;
      font-weight: 800;
      color: #111;
      font-family: 'Courier New', monospace;
      letter-spacing: 0;
    }
    /* ── Notes ── */
    .dn-notes {
      margin-top: 14px;
      padding: 10px 12px;
      background: #fafaf8;
      border-left: 3px solid #ccc;
      font-size: 11.5px;
      line-height: 1.7;
    }
    .dn-notes-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #999;
      display: block;
      margin-bottom: 4px;
    }
    /* ── Signature ── */
    .dn-sig {
      margin-top: 44px;
    }
    .dn-sig-label {
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 28px;
    }
    .dn-sig-line {
      border-top: 1.5px solid #bbb;
      width: 240px;
      padding-top: 5px;
      font-size: 9.5px;
      color: #aaa;
      letter-spacing: 0.05em;
    }
    /* ── Footer ── */
    .dn-footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 9px;
      color: #bbb;
      letter-spacing: 0.05em;
    }
    @media print {
      .dn-page { padding: 16px 20px 16px; }
    }
  `;

  const totalQty = order.items.reduce((s, i) => s + Number(i.quantity), 0);
  const allNotes = [order.senderNotes, order.deliveryNotes, order.notes].filter(Boolean).map(esc).join("<br>");

  const dnSections = (allDeliveries ?? []).map((d, i) => {
    if (!d) return "";
    const rawAddr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).join(", ");
    const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(", ");
    const mapUrl = rawAddr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawAddr + " 香港")}` : "";
    const isExtra = i > 0;
    const dnRef = (allDeliveries?.length ?? 0) > 1 ? `DN-${ref}-${i + 1}` : `DN-${ref}`;

    const itemRows = order.items.map((item) => `
      <tr>
        <td class="code">${esc(item.id?.slice(0, 8).toUpperCase() ?? "")}</td>
        <td>${esc(item.name)}</td>
        <td class="stock">—</td>
        <td class="qty">${Number(item.quantity)}</td>
      </tr>`).join("");

    return `
    <div class="dn-page"${isExtra ? ' style="page-break-before:always;"' : ""}>
      <div class="dn-header">
        <div>
          <div class="dn-brand-name">Anglo Chinese Florist</div>
          <div class="dn-brand-sub">英華花店</div>
        </div>
        <div class="dn-doctype">
          <div class="dn-doctype-zh">送貨單</div>
          <div class="dn-ref">${esc(dnRef)}</div>
        </div>
      </div>

      <div class="dn-info">
        <div class="dn-info-left">
          <div class="dn-addr-section-label">送貨地址</div>
          ${d.recipientName ? `<div class="dn-recipient-name">${esc(d.recipientName)}</div>` : ""}
          ${addr ? `<div class="dn-recipient-addr">${addr}</div>` : ""}
          ${d.recipientPhone ? `<div class="dn-recipient-phone">${esc(d.recipientPhone)}</div>` : ""}
          ${mapUrl ? `<div class="dn-map-url"><a href="${mapUrl}">${esc(mapUrl)}</a></div>` : ""}

          <div class="dn-sender-block">
            <div class="dn-meta-row"><span class="dn-meta-label">客戶</span><span class="dn-meta-value">${esc(order.customerName || order.phone)}</span></div>
            ${order.contactPerson ? `<div class="dn-meta-row"><span class="dn-meta-label">聯絡人</span><span class="dn-meta-value">${esc(order.contactPerson)}</span></div>` : ""}
            <div class="dn-meta-row"><span class="dn-meta-label">電話</span><span class="dn-meta-value mono">${esc(order.phone)}</span></div>
          </div>
        </div>

        <div class="dn-info-right">
          <div class="dn-meta-row"><span class="dn-meta-label">送貨日期</span><span class="dn-meta-value">${esc(fmtDate(d.deliveryDate || ""))}</span></div>
          <div class="dn-meta-row"><span class="dn-meta-label">送貨時間</span><span class="dn-meta-value">${esc(d.deliveryTime || "")}</span></div>
          <div class="dn-meta-row"><span class="dn-meta-label">員工</span><span class="dn-meta-value">${esc(staffName(order.salesId))}</span></div>
          ${d.deliveryPerson ? `<div class="dn-meta-row"><span class="dn-meta-label">司機</span><span class="dn-meta-value">${esc(d.deliveryPerson)}</span></div>` : ""}
          <div class="dn-meta-row"><span class="dn-meta-label">Card</span><span class="dn-meta-value card">${order.giftCardEnabled && order.giftCardMessage ? esc(order.giftCardMessage.slice(0, 50)) + (order.giftCardMessage.length > 50 ? "…" : "") : ""}</span></div>
        </div>
      </div>

      <table class="dn-table">
        <thead>
          <tr>
            <th style="width:72px;">產品編號</th>
            <th>描述</th>
            <th class="r" style="width:44px;">庫存</th>
            <th class="r" style="width:44px;">數量</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;">總數</td>
            <td class="total-num">${totalQty}</td>
          </tr>
        </tfoot>
      </table>

      ${allNotes ? `
      <div class="dn-notes">
        <span class="dn-notes-label">備註</span>
        ${allNotes}
      </div>` : ""}

      <div class="dn-sig">
        <div class="dn-sig-label">簽收</div>
        <div class="dn-sig-line">收貨人簽署</div>
      </div>

      <div class="dn-footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>送貨單 DN-${esc(ref)}</title>
    <style>${dnStyles}</style></head><body>${dnSections}</body></html>`;
}

/** 卡片 — gift message card only */
export function generateMessageCard(order: Order): string {
  const ref = orderRef(order);
  const d = primaryDelivery(order);
  const msg = order.giftCardMessage || "";

  const formattedMsg = esc(msg)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>卡片 ${esc(ref)}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'DM Sans', -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px; background: #faf8f4; }
      .card { border: 1.5px solid #e4d8c8; border-radius: 12px; padding: 36px 40px; max-width: 420px; margin: 0 auto; background: white; box-shadow: 0 2px 16px rgba(0,0,0,0.05); }
      .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b89a; margin-bottom: 24px; }
      .recipient { font-size: 12px; color: #aaa; margin-bottom: 16px; }
      .message { font-size: 15px; line-height: 1.85; color: #2a2a2a; min-height: 80px; }
      .divider { border: none; border-top: 1px solid #f0e8d8; margin: 24px 0; }
      .meta { font-size: 10px; color: #ccc; text-align: right; letter-spacing: 0.04em; }
      @media print { body { background: white; padding: 20px; } }
    </style></head><body>
    <div class="card">
      <div class="brand">Anglo Chinese Florist · 英華花店</div>
      ${d?.recipientName ? `<div class="recipient">致：${esc(d.recipientName)}</div>` : ""}
      <div class="message">${formattedMsg || "<em style='color:#ddd'>（無卡片內容）</em>"}</div>
      <hr class="divider" />
      <div class="meta">${esc(ref)}</div>
    </div>
  </body></html>`;
}

/** Open a print window with the given HTML */
export function printDocument(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=800,height=900");
  if (!win) { URL.revokeObjectURL(url); return; }
  setTimeout(() => {
    win.print();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }, 300);
}

/** Print multiple documents in a single window to avoid popup-blocker issues */
export function printBatch(htmlDocs: string[]) {
  if (htmlDocs.length === 0) return;
  if (htmlDocs.length === 1) { printDocument(htmlDocs[0]); return; }
  const combined = htmlDocs
    .map((html, i) => {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const body = bodyMatch ? bodyMatch[1] : html;
      return `<div style="page-break-after:${i < htmlDocs.length - 1 ? "always" : "avoid"}">${body}</div>`;
    })
    .join("\n");
  const stylesMatch = htmlDocs[0].match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = stylesMatch ? `<style>${stylesMatch[1]}</style>` : "";
  printDocument(`<!DOCTYPE html><html><head>${styles}</head><body>${combined}</body></html>`);
}
