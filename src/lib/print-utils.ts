import type { Order, Delivery } from "@/types/order";

const paymentLabel: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  deposit: "已付訂金",
};

const commonStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', -apple-system, 'Helvetica Neue', sans-serif; color: #1a1a1a; padding: 24px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
  .header .subtitle { font-size: 11px; color: #888; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 12px; font-size: 12px; }
  .meta .label { color: #888; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
  th { font-weight: 600; background: #f5f5f5; border-bottom: 2px solid #ddd; }
  td.num { text-align: right; font-family: 'JetBrains Mono', monospace; }
  th.num { text-align: right; }
  .total-row td { border-top: 2px solid #333; font-weight: 700; font-size: 14px; }
  .notes { background: #f9f9f5; border: 1px solid #eee; border-radius: 6px; padding: 8px 12px; margin-top: 8px; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-unpaid { background: #fee2e2; color: #dc2626; }
  .badge-paid { background: #dcfce7; color: #16a34a; }
  .badge-deposit { background: #fef3c7; color: #d97706; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
  .checkbox { display: inline-block; width: 14px; height: 14px; border: 2px solid #999; border-radius: 3px; margin-right: 8px; vertical-align: middle; }
  .pick-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 0; border-bottom: 1px solid #eee; }
  .pick-item .qty { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; min-width: 48px; padding-top: 1px; }
  .pick-item .price { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #555; margin-left: auto; padding-top: 1px; white-space: nowrap; }
  .tear-line { border: none; border-top: 2px dashed #bbb; margin: 28px 0; position: relative; }
  .tear-line::before { content: '✂'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: white; padding: 0 10px; color: #aaa; font-size: 14px; }
  .stub { background: #f5f5f5; border-radius: 6px; padding: 10px 14px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
  .stub .label { color: #888; }
  @media print { body { padding: 12px; } }
`;

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function orderRef(order: Order): string {
  return order.id.slice(0, 8).toUpperCase();
}

function primaryDelivery(order: Order): Delivery | null {
  if (order.deliveries && order.deliveries.length > 0) return order.deliveries[0];
  // legacy flat fields fallback
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

function deliveryBlock(d: Delivery | null, label?: string): string {
  if (!d) return "";
  const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(" ");
  return `
    <div class="meta" style="margin-top:12px">
      ${label ? `<div style="grid-column:1/-1;font-weight:600;font-size:13px;margin-bottom:4px">${esc(label)}</div>` : ""}
      ${d.deliveryDate ? `<div><span class="label">送貨日期：</span>${esc(d.deliveryDate)}</div>` : ""}
      ${d.deliveryTime ? `<div><span class="label">送貨時間：</span>${esc(d.deliveryTime)}</div>` : ""}
      ${d.recipientName ? `<div><span class="label">收貨人：</span><strong>${esc(d.recipientName)}</strong></div>` : ""}
      ${d.recipientPhone ? `<div><span class="label">收貨人電話：</span>${esc(d.recipientPhone)}</div>` : ""}
      ${addr ? `<div style="grid-column:1/-1"><span class="label">地址：</span>${addr}</div>` : ""}
      ${d.deliveryPerson ? `<div><span class="label">司機：</span>${esc(d.deliveryPerson)}</div>` : ""}
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
      <div><span class="label">訂單編號：</span>${orderRef(order)}</div>
      <div><span class="label">開單日期：</span>${esc(date)}</div>
      <div><span class="label">客戶：</span>${esc(order.customerName) || "—"}</div>
      <div><span class="label">電話：</span>${esc(order.phone)}</div>
    </div>
  `;
}

/** 客人收據 — shows all details including sender */
export function generateReceipt(order: Order): string {
  const badgeClass = `badge badge-${order.paymentStatus}`;
  const d = primaryDelivery(order);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>收據 ${orderRef(order)}</title>
    <style>${commonStyles}</style></head><body>
    <div class="header"><h1>🌸 收據</h1><div class="subtitle">Anglo Chinese Florist · 感謝惠顧</div></div>
    ${orderMeta(order)}
    <h2>🛒 訂單明細</h2>
    ${itemsTable(order, true)}
    <div style="margin-top:8px">
      <span class="label">付款狀態：</span>
      <span class="${badgeClass}">${paymentLabel[order.paymentStatus]}</span>
      ${order.paymentStatus === "deposit" ? `<span style="margin-left:8px;font-size:12px">（訂金 $${order.depositAmount.toLocaleString()}，尚欠 $${(order.finalPrice - order.depositAmount).toLocaleString()}）</span>` : ""}
    </div>
    ${d ? `<h2>📦 送貨資料</h2>${deliveryBlock(d)}` : ""}
    ${order.notes ? `<h2>📝 備註</h2><div class="notes">${esc(order.notes)}</div>` : ""}
    ${order.giftCardEnabled && order.giftCardMessage ? `<h2>💌 卡片內容</h2><div class="notes">${esc(order.giftCardMessage).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="footer">此收據由花店 POS 系統產生 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 執貨單 (Picking Slip) — internal, hides sender, shows price, tear-off design */
export function generatePickingList(order: Order): string {
  const ref = orderRef(order);
  const allDeliveries = order.deliveries?.length ? order.deliveries : [primaryDelivery(order)].filter(Boolean) as typeof order.deliveries;

  const pickItems = order.items.map((item) => `
    <div class="pick-item">
      <span class="checkbox"></span>
      <span class="qty">× ${item.quantity}</span>
      <span style="flex:1">${item.name}</span>
      <span class="price">$${(item.price * item.quantity).toLocaleString()}</span>
    </div>`).join("");

  const deliverySections = (allDeliveries ?? []).map((d, i) =>
    d ? deliveryBlock(d, allDeliveries!.length > 1 ? `收件人 ${i + 1}` : undefined) : ""
  ).join("");

  // Stub: lower tear-off portion for reconciliation
  const firstD = allDeliveries?.[0];
  const stub = `
    <div class="stub">
      <div><span class="label">訂單編號：</span><strong>${ref}</strong></div>
      <div><span class="label">總計：</span><strong>$${order.finalPrice.toLocaleString()}</strong></div>
      ${firstD?.deliveryDate ? `<div><span class="label">送貨日期：</span>${esc(firstD.deliveryDate)}</div>` : ""}
      ${firstD?.recipientName ? `<div><span class="label">收貨人：</span>${esc(firstD.recipientName)}</div>` : ""}
      ${firstD?.deliveryPerson ? `<div><span class="label">司機：</span>${esc(firstD.deliveryPerson)}</div>` : ""}
      <div><span class="label">件數：</span>${order.items.reduce((s, i) => s + i.quantity, 0)} 件</div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>執貨單 ${ref}</title>
    <style>${commonStyles}</style></head><body>
    <div class="header">
      <h1>📋 執貨單</h1>
      <div class="subtitle">PICKING SLIP · 訂單 ${ref} · 保密文件</div>
    </div>

    <h2>📦 送貨資料</h2>
    ${deliverySections}

    <h2>執貨清單</h2>
    ${pickItems}
    ${order.deliveryFee > 0 ? `<div style="padding:8px 0;font-size:12px;color:#555">送貨費：$${order.deliveryFee.toLocaleString()}</div>` : ""}
    ${order.urgentFee > 0 ? `<div style="padding:4px 0;font-size:12px;color:#555">急單費：$${order.urgentFee.toLocaleString()}</div>` : ""}
    <div style="margin-top:8px;padding:8px 0;border-top:2px solid #333;font-weight:700;font-size:15px;display:flex;justify-content:space-between">
      <span>總計</span><span>$${order.finalPrice.toLocaleString()}</span>
    </div>

    ${order.senderNotes ? `<h2>📝 製作備註（重要）</h2><div class="notes" style="font-size:14px;font-weight:500">${esc(order.senderNotes)}</div>` : ""}
    ${order.deliveryNotes ? `<h2>🚚 送貨備註</h2><div class="notes">${esc(order.deliveryNotes)}</div>` : ""}

    <div style="margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#888">執貨員簽署</div>
      <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#888">覆核員簽署</div>
    </div>

    <hr class="tear-line" />
    <div style="font-size:11px;color:#aaa;margin-bottom:8px;text-align:center">撕開此線 — 下半部隨貨交出</div>
    ${stub}
    <div class="footer">此執貨單由花店 POS 系統產生 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 送貨單 (Delivery Note) — external, recipient + phone only, hides price and sender */
export function generateDeliveryNote(order: Order): string {
  const ref = orderRef(order);
  const allDeliveries = order.deliveries?.length ? order.deliveries : [primaryDelivery(order)].filter(Boolean) as typeof order.deliveries;

  const deliverySections = (allDeliveries ?? []).map((d, i) => {
    if (!d) return "";
    const addr = [d.deliveryRegion, d.deliveryDistrict, d.deliveryArea, d.deliveryDetail].filter(Boolean).map(esc).join(" ");
    return `
      <div style="${i > 0 ? "margin-top:20px;padding-top:16px;border-top:1px solid #ddd;" : ""}">
        ${allDeliveries!.length > 1 ? `<div style="font-weight:600;font-size:13px;margin-bottom:8px">收件人 ${i + 1}</div>` : ""}
        <div class="meta">
          ${d.deliveryDate ? `<div><span class="label">送貨日期：</span><strong>${esc(d.deliveryDate)}</strong></div>` : ""}
          ${d.deliveryTime ? `<div><span class="label">送貨時間：</span>${esc(d.deliveryTime)}</div>` : ""}
          ${d.recipientName ? `<div><span class="label">收貨人：</span><strong style="font-size:15px">${esc(d.recipientName)}</strong></div>` : ""}
          ${d.recipientPhone ? `<div><span class="label">收貨人電話：</span><strong>${esc(d.recipientPhone)}</strong></div>` : ""}
          ${addr ? `<div style="grid-column:1/-1"><span class="label">地址：</span>${addr}</div>` : ""}
        </div>
      </div>`;
  }).join("");

  const itemRows = order.items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td class="num">${item.quantity}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>送貨單 ${ref}</title>
    <style>${commonStyles}</style></head><body>
    <div class="header">
      <h1>🚚 送貨單</h1>
      <div class="subtitle">DELIVERY NOTE · ${ref}</div>
    </div>

    <h2>📦 收件資料</h2>
    ${deliverySections}

    <h2>🌸 送貨物品</h2>
    <table>
      <thead><tr><th>項目</th><th class="num">數量</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    ${order.giftCardEnabled && order.giftCardMessage ? `<h2>💌 卡片內容</h2><div class="notes">${esc(order.giftCardMessage).replace(/\n/g, "<br>")}</div>` : ""}
    ${order.deliveryNotes ? `<div class="notes" style="margin-top:12px">📋 ${esc(order.deliveryNotes)}</div>` : ""}

    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#888">送貨人簽署</div>
      <div style="border-top:1px solid #999;padding-top:4px;font-size:11px;color:#888">收貨人簽署</div>
    </div>
    <div class="footer">Anglo Chinese Florist · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 卡片 (Message Card) — standalone gift card content only */
export function generateMessageCard(order: Order): string {
  const ref = orderRef(order);
  const d = primaryDelivery(order);
  const msg = order.giftCardMessage || "";

  const formattedMsg = msg
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>卡片 ${ref}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'DM Sans', -apple-system, 'Helvetica Neue', sans-serif; color: #1a1a1a; padding: 40px; background: #fffdf9; }
      .card { border: 1.5px solid #e8d8c0; border-radius: 12px; padding: 32px 36px; max-width: 400px; margin: 0 auto; background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
      .flower { text-align: center; font-size: 28px; margin-bottom: 20px; }
      .message { font-size: 15px; line-height: 1.8; color: #2a2a2a; min-height: 80px; }
      .divider { border: none; border-top: 1px solid #f0e8d8; margin: 20px 0; }
      .meta { font-size: 11px; color: #aaa; text-align: right; }
      .recipient { font-size: 12px; color: #888; margin-bottom: 16px; }
      @media print { body { background: white; padding: 20px; } }
    </style></head><body>
    <div class="card">
      <div class="flower">🌸</div>
      ${d?.recipientName ? `<div class="recipient">致：${esc(d.recipientName)}</div>` : ""}
      <div class="message">${formattedMsg || "<em style='color:#ccc'>（無卡片內容）</em>"}</div>
      <hr class="divider" />
      <div class="meta">${ref} · Anglo Chinese Florist</div>
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
