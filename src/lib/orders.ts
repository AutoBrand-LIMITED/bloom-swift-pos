import type { Order } from "@/types/order";

export const ORDERS_KEY = "florist-pos-orders";
export const PHOTOS_KEY = "florist-pos-photos";
export const INVOICE_SEQ_KEY = "florist-pos-invoice-seq";

/**
 * Permanent, non-cancellable invoice number. A monotonic counter in
 * localStorage guarantees each call returns a unique INV-XXXX value that is
 * never reused, even after an order is deleted.
 *
 * Note: the counter advances before the order is written. localStorage has no
 * transactions, so if a subsequent save throws (e.g. quota), a number may be
 * skipped. Gaps are acceptable — uniqueness/non-reuse is the invariant, not
 * contiguity. (A backend with a sequence will enforce this properly — P7.)
 */
export function nextInvoiceNumber(): string {
  let seq = 0;
  try {
    seq = parseInt(localStorage.getItem(INVOICE_SEQ_KEY) || "0", 10) || 0;
  } catch {
    seq = 0;
  }
  const next = seq + 1;
  try {
    localStorage.setItem(INVOICE_SEQ_KEY, String(next));
  } catch {
    throw new Error("儲存失敗：儲存空間已滿");
  }
  return `INV-${String(next).padStart(4, "0")}`;
}

export function loadOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveOrders(orders: Order[]): void {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    throw new Error("儲存失敗：儲存空間已滿");
  }
}

export function updateOrder(id: string, patch: Partial<Order>): void {
  const orders = loadOrders();
  saveOrders(orders.map((o) => (o.id === id ? { ...o, ...patch } : o)));
}

export type OrderPhotos = {
  productPhoto?: string;
  receiptPhoto?: string;
};

export function loadPhotos(): Record<string, OrderPhotos> {
  try {
    return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function savePhoto(orderId: string, key: keyof OrderPhotos, dataUrl: string): void {
  const all = loadPhotos();
  all[orderId] = { ...all[orderId], [key]: dataUrl };
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(all));
}

export function deletePhoto(orderId: string, key: keyof OrderPhotos): void {
  const all = loadPhotos();
  if (!all[orderId]) return;
  const { [key]: _removed, ...rest } = all[orderId];
  if (Object.keys(rest).length === 0) {
    const { [orderId]: _entry, ...remaining } = all;
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(remaining));
  } else {
    all[orderId] = rest;
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(all));
  }
}

export async function compressImage(file: File, maxWidth = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}
