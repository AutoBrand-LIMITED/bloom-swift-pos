import type { Order } from "@/types/order";

export const ORDERS_KEY = "florist-pos-orders";
export const PHOTOS_KEY = "florist-pos-photos";

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
