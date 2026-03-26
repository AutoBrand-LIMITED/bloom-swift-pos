import type { DemoCustomer, PurchaseRecord } from "@/data/demo-customers";
import type { Order } from "@/types/order";

const CUSTOMERS_STORAGE_KEY = "florist-pos-customers";

export function loadStoredCustomers(): DemoCustomer[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMERS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCustomers(customers: DemoCustomer[]) {
  localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
}

export function extractCustomersFromOrders(orders: Order[]): DemoCustomer[] {
  // Group by phone number (primary key for customers)
  const phoneMap = new Map<string, { name: string; records: PurchaseRecord[] }>();

  for (const order of orders) {
    const phone = order.phone?.trim();
    if (!phone) continue;

    const existing = phoneMap.get(phone) || { name: "", records: [] };

    // Use the most recent name
    if (order.customerName?.trim()) {
      existing.name = order.customerName.trim();
    }

    const itemNames = order.items.map((i) => `${i.name} × ${i.quantity}`).join("、");

    existing.records.push({
      date: order.createdAt ? order.createdAt.slice(0, 10) : "",
      items: itemNames || "訂單",
      total: order.finalPrice,
      status: order.paymentStatus === "unpaid" ? "unpaid" : "paid",
      deliveryAddress: order.deliveryAddress || "",
      recipientName: order.recipientName || "",
    });

    phoneMap.set(phone, existing);
  }

  const customers: DemoCustomer[] = [];
  for (const [phone, data] of phoneMap) {
    customers.push({
      id: `imported-${phone.replace(/\D/g, "")}`,
      name: data.name || phone,
      phone,
      history: data.records.sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  return customers;
}

export function mergeCustomers(
  existing: DemoCustomer[],
  newCustomers: DemoCustomer[]
): DemoCustomer[] {
  const phoneMap = new Map<string, DemoCustomer>();

  // Add existing first
  for (const c of existing) {
    const normalizedPhone = c.phone.replace(/\s/g, "");
    phoneMap.set(normalizedPhone, { ...c });
  }

  // Merge new customers
  for (const c of newCustomers) {
    const normalizedPhone = c.phone.replace(/\s/g, "");
    const existing = phoneMap.get(normalizedPhone);
    if (existing) {
      // Merge history, deduplicate by date+total
      const existingKeys = new Set(existing.history.map((h) => `${h.date}-${h.total}`));
      const newRecords = c.history.filter((h) => !existingKeys.has(`${h.date}-${h.total}`));
      existing.history = [...existing.history, ...newRecords].sort((a, b) => b.date.localeCompare(a.date));
      // Update name if empty
      if (!existing.name && c.name) existing.name = c.name;
    } else {
      phoneMap.set(normalizedPhone, { ...c });
    }
  }

  return Array.from(phoneMap.values());
}
