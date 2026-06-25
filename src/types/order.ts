export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Delivery {
  id: string;
  deliveryDate: string;
  deliveryTime: string;
  deliverySlotId?: string;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
  recipientName: string;
  recipientPhone: string;
  recipientRelationship?: string;
  recipientBirthday?: string; // MM-DD
  deliveryPerson: string;
  failedDeliveryAction: string;
}

export type PaymentStatus = "unpaid" | "paid" | "deposit";

export type PaymentEntryType = "deposit" | "balance" | "full";

export interface PaymentRecord {
  type: PaymentEntryType;
  amount: number;
  method: string;
  at: string; // ISO timestamp
}

export type AuditAction = "created" | "amended" | "balance_settled" | "note_added";

export interface AuditEntry {
  action: AuditAction;
  at: string; // ISO timestamp
  staffId: string;
  detail?: string;
}

export interface Order {
  id: string;
  salesId: string;
  customerName: string;
  phone: string;
  contactPerson: string;
  items: OrderItem[];
  deliveryFee: number;
  urgentFee: number;
  subtotal: number;
  finalPrice: number;
  priceOverridden: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  depositAmount: number;
  customerType?: "personal" | "company";
  companyName?: string;
  followUpDate: string;
  reminderOption: string;
  deliveries?: Delivery[];
  // legacy flat fields kept for backward compat (derived from deliveries[0])
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryPerson: string;
  giftCardEnabled: boolean;
  giftCardMessage: string;
  notes: string;
  senderNotes: string;
  deliveryNotes: string;
  internalNotes: string;
  occasionTag?: string;
  payments?: PaymentRecord[];
  invoiceNumber?: string; // permanent, assigned once at creation
  auditLog?: AuditEntry[];
  createdAt: string;
  deliveryStatus?: "pending" | "delivered";
  deliveredAt?: string;
}

export const SALES_STAFF = [
  { id: "S001", name: "陳小明" },
  { id: "S002", name: "李美玲" },
  { id: "S003", name: "張大偉" },
  { id: "S004", name: "王曉華" },
  { id: "S005", name: "林志強" },
];

export const DRIVERS = [
  { id: "D001", name: "阿明" },
  { id: "D002", name: "阿強" },
  { id: "D003", name: "阿偉" },
  { id: "D004", name: "阿華" },
  { id: "D005", name: "臨時司機" },
];
