export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type PaymentStatus = "unpaid" | "paid" | "deposit";

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
  depositAmount: number;
  followUpDate: string;
  reminderOption: string;
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
  createdAt: string;
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
