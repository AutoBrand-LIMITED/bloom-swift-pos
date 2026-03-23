export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type PaymentStatus = "unpaid" | "paid" | "deposit";

export interface Order {
  id: string;
  customerName: string;
  phone: string;
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
  createdAt: string;
}
