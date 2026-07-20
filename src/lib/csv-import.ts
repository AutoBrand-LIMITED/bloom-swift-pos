import type { Order, OrderItem, PaymentStatus } from "@/types/order";

interface CsvRow {
  itemCode: string;
  itemDesc: string;
  cusCode: string;
  cusName: string;
  invDate: string;
  invNo: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  senderName: string;
  senderPhone: string;
  terms: string;
  deliveryDate: string;
  email: string;
  paymentNotes: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  paymentTerms: string;
  currency: string;
  exchangeRate: string;
  invoiceTotal: string;
  extra1: string;
  department: string;
  salesPerson: string;
  extra2: string;
  customerType: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseRow(fields: string[]): CsvRow {
  return {
    itemCode: fields[0] || "",
    itemDesc: fields[1] || "",
    cusCode: fields[2] || "",
    cusName: fields[3] || "",
    invDate: fields[4] || "",
    invNo: fields[5] || "",
    unitPrice: parseFloat(fields[6]?.replace(/,/g, "") || "0") || 0,
    unit: fields[7] || "",
    quantity: parseFloat(fields[8] || "1") || 1,
    senderName: fields[9] || "",
    senderPhone: fields[10] || "",
    terms: fields[11] || "",
    deliveryDate: fields[12] || "",
    email: fields[13] || "",
    paymentNotes: fields[14] || "",
    deliveryAddress: fields[15] || "",
    recipientName: fields[16] || "",
    recipientPhone: fields[17] || "",
    paymentTerms: fields[18] || "",
    currency: fields[19] || "",
    exchangeRate: fields[20] || "",
    invoiceTotal: fields[21] || "",
    extra1: fields[22] || "",
    department: fields[23] || "",
    salesPerson: fields[24] || "",
    extra2: fields[25] || "",
    customerType: fields[26] || "",
  };
}

function parseDate(dateStr: string): string {
  // DD-MM-YYYY → YYYY-MM-DD
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

function determinePaymentStatus(paymentNotes: string): PaymentStatus {
  const lower = paymentNotes.toLowerCase();
  if (lower.includes("paid") || lower.includes("payme") || lower.includes("stripe") || lower.includes("bank")) {
    return "paid";
  }
  return "unpaid";
}

function determinePaymentMethod(paymentNotes: string): string {
  const lower = paymentNotes.toLowerCase();
  if (lower.includes("payme")) return "payme";
  if (lower.includes("stripe") || lower.includes("paylink")) return "stripe_paylink";
  if (lower.includes("fps") || lower.includes("bank")) return "bank_in_fps";
  if (lower.includes("amex")) return "amex";
  if (lower.includes("alipay") || lower.includes("wonder")) return "wonder_alipay";
  return "";
}

export function parseCsvToOrders(csvText: string): Order[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Skip header
  const dataLines = lines.slice(1);
  const rows = dataLines.map((line) => parseRow(parseCsvLine(line)));

  // Group by invoice number
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    if (!row.invNo) continue;
    const existing = grouped.get(row.invNo) || [];
    existing.push(row);
    grouped.set(row.invNo, existing);
  }

  const orders: Order[] = [];

  for (const [invNo, invoiceRows] of grouped) {
    const first = invoiceRows[0];

    const items: OrderItem[] = invoiceRows.map((row) => ({
      id: crypto.randomUUID(),
      name: `[${row.itemCode}] ${row.itemDesc}`.trim(),
      price: row.unitPrice,
      quantity: row.quantity,
    }));

    const totalStr = first.invoiceTotal.replace(/,/g, "");
    const finalPrice = parseFloat(totalStr) || 0;
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const phone = first.senderPhone || first.recipientPhone || "";
    const customerName = first.senderName || first.cusName || "";

    const invDateParsed = parseDate(first.invDate);
    const createdAt = invDateParsed
      ? new Date(invDateParsed + "T00:00:00").toISOString()
      : new Date().toISOString();

    const deliveryDateParsed = parseDate(first.deliveryDate);

    const paymentStatus = determinePaymentStatus(first.paymentNotes);

    const noteParts: string[] = [];
    if (first.cusCode) noteParts.push(`客戶編號: ${first.cusCode}`);
    if (first.customerType) noteParts.push(`類別: ${first.customerType}`);
    if (first.email) noteParts.push(`Email: ${first.email}`);
    if (first.salesPerson) noteParts.push(`銷售員: ${first.salesPerson}`);
    if (first.department) noteParts.push(`部門: ${first.department}`);
    if (first.paymentNotes) noteParts.push(`付款備註: ${first.paymentNotes}`);
    noteParts.push(`發票號碼: ${invNo}`);

    const order: Order = {
      id: crypto.randomUUID(),
      salesId: first.salesPerson || "",
      customerName,
      phone,
      items,
      deliveryFee: 0,
      urgentFee: 0,
      subtotal,
      finalPrice,
      priceOverridden: finalPrice !== subtotal,
      paymentStatus,
      depositAmount: 0,
      paymentMethod: determinePaymentMethod(first.paymentNotes),
      deliveryDate: deliveryDateParsed || "",
      deliveryTime: "",
      deliveryAddress: first.deliveryAddress,
      recipientName: first.recipientName,
      recipientPhone: first.recipientPhone,
      deliveryPerson: "",
      giftCardEnabled: false,
      giftCardMessage: "",
      senderNote: "",
      deliveryNote: "",
      internalNote: noteParts.join("\n"),
      createdAt,
    };

    orders.push(order);
  }

  return orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
