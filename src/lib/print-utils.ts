import type { Order } from "@/types/order";

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
  .pick-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
  .pick-item .qty { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; min-width: 50px; }
  @media print { body { padding: 12px; } }
`;

function orderMeta(order: Order) {
  const date = new Date(order.createdAt).toLocaleString("zh-HK");
  return `
    <div class="meta">
      <div><span class="label">訂單編號：</span>${order.id.slice(0, 8).toUpperCase()}</div>
      <div><span class="label">開單日期：</span>${date}</div>
      <div><span class="label">客戶：</span>${order.customerName || "—"}</div>
      <div><span class="label">電話：</span>${order.phone}</div>
    </div>
  `;
}

function itemsTable(order: Order, showPrice: boolean) {
  const rows = order.items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td class="num">${item.quantity}</td>
      ${showPrice ? `<td class="num">$${item.price.toLocaleString()}</td>` : ""}
      ${showPrice ? `<td class="num">$${(item.price * item.quantity).toLocaleString()}</td>` : ""}
    </tr>`
    )
    .join("");

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
        ${
          showPrice
            ? `<tr class="total-row">
                <td colspan="3">總計</td>
                <td class="num">$${order.finalPrice.toLocaleString()}</td>
              </tr>`
            : ""
        }
      </tbody>
    </table>
  `;
}

function deliveryInfo(order: Order) {
  if (!order.deliveryDate && !order.deliveryAddress && !order.recipientName) return "";
  return `
    <h2>📦 送貨資料</h2>
    <div class="meta">
      ${order.deliveryDate ? `<div><span class="label">送貨日期：</span>${order.deliveryDate}</div>` : ""}
      ${order.deliveryTime ? `<div><span class="label">送貨時間：</span>${order.deliveryTime}</div>` : ""}
      ${order.recipientName ? `<div><span class="label">收貨人：</span>${order.recipientName}</div>` : ""}
      ${order.recipientPhone ? `<div><span class="label">收貨人電話：</span>${order.recipientPhone}</div>` : ""}
      ${order.deliveryAddress ? `<div style="grid-column:1/-1"><span class="label">地址：</span>${order.deliveryAddress}</div>` : ""}
      ${order.deliveryPerson ? `<div><span class="label">送貨人：</span>${order.deliveryPerson}</div>` : ""}
    </div>
  `;
}

/** 客人收據 */
export function generateReceipt(order: Order): string {
  const badgeClass = `badge badge-${order.paymentStatus}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>收據 - ${order.id.slice(0, 8)}</title>
    <style>${commonStyles}</style></head><body>
    <div class="header">
      <h1>🌸 收據</h1>
      <div class="subtitle">感謝惠顧</div>
    </div>
    ${orderMeta(order)}
    <h2>🛒 訂單明細</h2>
    ${itemsTable(order, true)}
    <div style="margin-top:8px">
      <span class="label">付款狀態：</span>
      <span class="${badgeClass}">${paymentLabel[order.paymentStatus]}</span>
      ${order.paymentStatus === "deposit" ? `<span style="margin-left:8px;font-size:12px">（訂金 $${order.depositAmount.toLocaleString()}，尚欠 $${(order.finalPrice - order.depositAmount).toLocaleString()}）</span>` : ""}
    </div>
    ${order.notes ? `<h2>📝 備註</h2><div class="notes">${order.notes}</div>` : ""}
    ${order.giftCardEnabled && order.giftCardMessage ? `<h2>💌 卡片內容</h2><div class="notes">${order.giftCardMessage.replace(/\n/g, "<br>")}</div>` : ""}
    <div class="footer">此收據由花店 POS 系統產生 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 客人送貨單 */
export function generateDeliveryNote(order: Order): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>送貨單 - ${order.id.slice(0, 8)}</title>
    <style>${commonStyles}</style></head><body>
    <div class="header">
      <h1>🚚 送貨單</h1>
      <div class="subtitle">DELIVERY NOTE</div>
    </div>
    ${orderMeta(order)}
    ${deliveryInfo(order)}
    <h2>🛒 送貨物品</h2>
    ${itemsTable(order, false)}
    ${order.notes ? `<h2>📝 備註</h2><div class="notes">${order.notes}</div>` : ""}
    ${order.giftCardEnabled && order.giftCardMessage ? `<h2>💌 卡片內容</h2><div class="notes">${order.giftCardMessage.replace(/\n/g, "<br>")}</div>` : ""}
    <div style="margin-top:32px; display:grid; grid-template-columns:1fr 1fr; gap:24px;">
      <div style="border-top:1px solid #999; padding-top:4px; font-size:11px; color:#888;">送貨人簽署</div>
      <div style="border-top:1px solid #999; padding-top:4px; font-size:11px; color:#888;">收貨人簽署</div>
    </div>
    <div class="footer">此送貨單由花店 POS 系統產生 · ${new Date().toLocaleDateString("zh-HK")}</div>
  </body></html>`;
}

/** 倉庫執貨單 */
export function generatePickingList(order: Order): string {
  const pickItems = order.items
    .map(
      (item) => `
    <div class="pick-item">
      <span class="checkbox"></span>
      <span class="qty">× ${item.quantity}</span>
      <span style="flex:1">${item.name}</span>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>執貨單 - ${order.id.slice(0, 8)}</title>
    <style>${commonStyles}
      .pick-item { font-size: 15px; }
    </style></head><body>
    <div class="header">
      <h1>📋 執貨單</h1>
      <div class="subtitle">PICKING LIST</div>
    </div>
    ${orderMeta(order)}
    ${order.deliveryDate ? `<div style="font-size:13px;margin-bottom:12px"><strong>⏰ 需要日期：</strong>${order.deliveryDate} ${order.deliveryTime || ""}</div>` : ""}
    <h2>執貨清單</h2>
    ${pickItems}
    ${order.notes ? `<h2>📝 備註（重要）</h2><div class="notes" style="font-size:14px;font-weight:500">${order.notes}</div>` : ""}
    <div style="margin-top:32px; border-top:1px solid #999; padding-top:4px; font-size:11px; color:#888; width:200px;">執貨員簽署</div>
    <div class="footer">此執貨單由花店 POS 系統產生 · ${new Date().toLocaleDateString("zh-HK")}</div>
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
