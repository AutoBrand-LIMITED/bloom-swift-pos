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
      <div><span class="lbl">訂單編號</span><span class="val">${orderRef(order)}</span></div>
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
  const badgeClass = `badge badge-${order.paymentStatus}`;
  const d = primaryDelivery(order);
  const date = new Date(order.createdAt).toLocaleDateString("zh-HK");
  const ref = orderRef(order);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>收據 ${ref}</title>
    <style>${commonStyles}</style></head><body>

    ${docHeader("收據", "RECEIPT", ref, date)}

    <div class="section-heading">客戶資料</div>
    ${orderMeta(order)}

    <div class="section-heading">訂單明細</div>
    ${itemsTable(order, true)}

    <div style="margin-top:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">付款狀態</span>
      <span class="${badgeClass}">${paymentLabel[order.paymentStatus]}</span>
      ${order.paymentStatus === "deposit"
        ? `<span style="font-size:12px;color:#888">訂金 $${order.depositAmount.toLocaleString()} · 尚欠 $${(order.finalPrice - order.depositAmount).toLocaleString()}</span>`
        : ""}
    </div>

    ${d ? `<div class="section-heading">送貨資料</div>${deliveryBlock(d)}` : ""}
    ${order.senderNotes ? `<div class="section-heading">製作備註</div><div class="notes">${esc(order.senderNotes)}</div>` : ""}
    ${order.deliveryNotes ? `<div class="section-heading">送貨備註</div><div class="notes">${esc(order.deliveryNotes)}</div>` : ""}
    ${order.notes ? `<div class="section-heading">備註</div><div class="notes">${esc(order.notes)}</div>` : ""}
    ${order.giftCardEnabled && order.giftCardMessage ? `<div class="section-heading">卡片內容</div><div class="notes">${esc(order.giftCardMessage).replace(/\n/g, "<br>")}</div>` : ""}

    <div class="footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 執貨單 — internal, hides sender, shows price, tear-off stub */
export function generatePickingList(order: Order): string {
  const ref = orderRef(order);
  const date = new Date(order.createdAt).toLocaleDateString("zh-HK");
  const allDeliveries = order.deliveries?.length
    ? order.deliveries
    : ([primaryDelivery(order)].filter(Boolean) as Delivery[]);

  const pickItems = order.items.map((item) => `
    <div class="pick-item">
      <div class="pick-cb"></div>
      <div class="pick-qty">×${item.quantity}</div>
      <div class="pick-name">${esc(item.name)}</div>
      <div class="pick-price">$${(item.price * item.quantity).toLocaleString()}</div>
    </div>`).join("");

  const deliverySections = (allDeliveries ?? []).map((d, i) =>
    d ? deliveryBlock(d, (allDeliveries?.length ?? 0) > 1 ? `收件人 ${i + 1} · ${recipientRef(order, i)}` : undefined) : ""
  ).join("");

  const firstD = allDeliveries?.[0];
  const stub = `
    <div class="stub">
      <div><span class="lbl">訂單編號</span><span class="val">${ref}</span></div>
      <div><span class="lbl">總計</span><span class="val">$${order.finalPrice.toLocaleString()}</span></div>
      ${firstD?.deliveryDate ? `<div><span class="lbl">送貨日期</span><span class="val">${esc(firstD.deliveryDate)}</span></div>` : ""}
      ${firstD?.recipientName ? `<div><span class="lbl">收貨人</span><span class="val">${esc(firstD.recipientName)}</span></div>` : ""}
      ${firstD?.deliveryPerson ? `<div><span class="lbl">司機</span><span class="val">${esc(firstD.deliveryPerson)}</span></div>` : ""}
      <div><span class="lbl">件數</span><span class="val">${order.items.reduce((s, i) => s + i.quantity, 0)} 件</span></div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>執貨單 ${ref}</title>
    <style>${commonStyles}</style></head><body>

    ${docHeader("執貨單", "PICKING SLIP · CONFIDENTIAL", ref, date)}

    <div class="section-heading">送貨資料</div>
    ${deliverySections}

    <div class="section-heading">執貨清單</div>
    ${pickItems}
    ${order.deliveryFee > 0 ? `<div style="padding:8px 0 4px;font-size:12px;color:#777;border-bottom:1px solid #f0f0f0">送貨費 <span style="float:right;font-family:monospace">$${order.deliveryFee.toLocaleString()}</span></div>` : ""}
    ${order.urgentFee > 0 ? `<div style="padding:8px 0 4px;font-size:12px;color:#777;border-bottom:1px solid #f0f0f0">急單費 <span style="float:right;font-family:monospace">$${order.urgentFee.toLocaleString()}</span></div>` : ""}
    <div style="margin-top:10px;padding:10px 0;border-top:2.5px solid #1a1a1a;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-weight:700;font-size:13px">總計</span>
      <span style="font-family:'JetBrains Mono','Courier New',monospace;font-weight:800;font-size:20px">$${order.finalPrice.toLocaleString()}</span>
    </div>

    ${order.senderNotes ? `<div class="section-heading">製作備註</div><div class="notes highlight" style="font-size:14px;font-weight:500">${esc(order.senderNotes)}</div>` : ""}
    ${order.deliveryNotes ? `<div class="section-heading">送貨備註</div><div class="notes">${esc(order.deliveryNotes)}</div>` : ""}

    <div class="signatures">
      <div class="sig-line">執貨員簽署</div>
      <div class="sig-line">覆核員簽署</div>
    </div>

    <hr class="tear-line" />
    <div style="font-size:10px;color:#bbb;text-align:center;margin-bottom:10px;letter-spacing:0.08em;text-transform:uppercase">隨貨交出 · Tear and attach to order</div>
    ${stub}

    <div class="footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 送貨單 — external, recipient info large, no price */
export function generateDeliveryNote(order: Order): string {
  const ref = orderRef(order);
  const date = new Date(order.createdAt).toLocaleDateString("zh-HK");
  const allDeliveries = order.deliveries?.length
    ? order.deliveries
    : ([primaryDelivery(order)].filter(Boolean) as Delivery[]);

  const deliverySections = (allDeliveries ?? []).map((d, i) => {
    if (!d) return "";
    const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(" ");
    const isExtra = i > 0;
    return `
      <div style="${isExtra ? "margin-top:20px;padding-top:16px;border-top:1.5px dashed #e0e0e0;" : ""}">
        ${(allDeliveries?.length ?? 0) > 1 ? `<div class="recipient-label">收件人 ${i + 1} · ${esc(recipientRef(order, i))}</div>` : ""}
        ${(d.deliveryDate || d.deliveryTime) ? `
        <div class="date-block">
          ${d.deliveryDate ? `<span class="date-lg">${esc(d.deliveryDate)}</span>` : ""}
          ${d.deliveryTime ? `<span class="time-md">${esc(d.deliveryTime)}</span>` : ""}
        </div>` : ""}
        <div class="recipient-card">
          ${d.recipientName ? `<div class="recipient-name-lg">${esc(d.recipientName)}</div>` : ""}
          ${d.recipientPhone ? `<div class="recipient-phone-lg">${esc(d.recipientPhone)}</div>` : ""}
          ${addr ? `<div class="recipient-addr">${addr}</div>` : ""}
        </div>
        ${d.deliveryPerson ? `<div style="margin-top:8px;font-size:11px;color:#aaa">司機：${esc(d.deliveryPerson)}</div>` : ""}
      </div>`;
  }).join("");

  const itemRows = order.items.map((item) => `
    <tr>
      <td>${esc(item.name)}</td>
      <td class="num">${Number(item.quantity)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>送貨單 ${ref}</title>
    <style>${commonStyles}</style></head><body>

    ${docHeader("送貨單", "DELIVERY NOTE", ref, date)}

    <div class="section-heading">收件資料</div>
    ${deliverySections}

    <div class="section-heading">送貨物品</div>
    <table>
      <thead><tr><th>項目</th><th class="num">數量</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    ${order.giftCardEnabled && order.giftCardMessage ? `<div class="section-heading">卡片內容</div><div class="notes">${esc(order.giftCardMessage).replace(/\n/g, "<br>")}</div>` : ""}
    ${order.deliveryNotes ? `<div class="section-heading">送貨備註</div><div class="notes highlight">${esc(order.deliveryNotes)}</div>` : ""}

    <div class="signatures">
      <div class="sig-line">送貨人簽署</div>
      <div class="sig-line">收貨人簽署</div>
    </div>

    <div class="footer">Anglo Chinese Florist · 英華花店 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>卡片 ${ref}</title>
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
      <div class="meta">${ref}</div>
    </div>
  </body></html>`;
}

/** Open a print window with the given HTML */
export function printDocument(html: string) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 300);
}

/** Print multiple documents in sequence */
export function printBatch(htmlDocs: string[], delayMs = 600) {
  htmlDocs.forEach((html, i) => setTimeout(() => printDocument(html), i * delayMs));
}
