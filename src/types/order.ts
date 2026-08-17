export interface OrderItem {
  id: string;
  name: string;
  /** Order-specific unit price before any percentage discount. */
  price: number;
  quantity: number;
  /** Odoo list price captured when the product was added to the order. */
  catalogPrice?: number;
  discountPercent?: number;
  priceOverrideReason?: string;
  productId?: number;
  productCode?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  packing?: string;
  remarks?: string;
}

export type PaymentStatus = "unpaid" | "paid" | "deposit";
export type DeliveryTimeMode = "slot" | "specified";
export type RecipientType = "personal" | "company";
export type FulfillmentType = "delivery" | "pickup";

export interface PartnerNoteMutation {
  commentText: string;
  targetPartnerId?: number;
  expectedWriteDate?: string;
}

export interface Order {
  id: string;
  salesId: string;
  operatorEmployeeId?: number;
  customerName: string;
  /** Customer ID stored in Odoo as res.partner/sale.order x_customer_code. */
  customerCode?: string;
  customerType?: "personal" | "company";
  companyName?: string;
  customerEmail?: string;
  billingAddress?: string;
  customerGroup?: string;
  senderDoNumber?: string;
  recipientDoNumber?: string;
  sourceReference?: string;
  department?: string;
  terms?: string;
  /** Gift sender shown on the florist order; may differ from the ordering customer. */
  senderName?: string;
  phone: string;
  items: OrderItem[];
  deliveryFee: number;
  urgentFee: number;
  subtotal: number;
  finalPrice: number;
  priceOverridden: boolean;
  paymentStatus: PaymentStatus;
  depositAmount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentReceivedAt?: string;
  paymentIdempotencyKey?: string;
  fulfillmentType?: FulfillmentType;
  deliveryDate: string;
  deliveryTimeMode?: DeliveryTimeMode;
  deliverySlotId?: number;
  /** Human-readable snapshot retained even if the configured slot changes later. */
  deliveryTime: string;
  deliveryAddress: string;
  /** Google-selected base address. Unit details are stored separately. */
  deliveryGoogleAddress?: string;
  deliveryBuilding?: string;
  deliveryFloor?: string;
  deliveryUnit?: string;
  recipientType?: RecipientType;
  recipientCompanyName?: string;
  recipientName: string;
  recipientPhone: string;
  deliveryPerson: string;
  giftCardEnabled: boolean;
  giftCardMessage: string;
  senderNote: string;
  deliveryNote: string;
  internalNote: string;
  customerNoteMutation?: PartnerNoteMutation;
  recipientNoteMutation?: PartnerNoteMutation;
  recipientPartnerId?: number;
  /** Legacy local/imported orders used one internal notes field. */
  notes?: string;
  createdAt: string;
  odooOrderId?: number;
  odooOrderName?: string;
  odooInvoiceId?: number;
  odooInvoiceName?: string;
  odooPaymentId?: number;
  odooPaymentName?: string;
  /** Odoo concurrency token used when editing an existing order. */
  writeDate?: string;
}

export interface SalesStaff {
  id: string;
  name: string;
  code?: string | null;
  jobTitle?: string | null;
  odooEmployeeId?: number;
}

export const SALES_STAFF: SalesStaff[] = [
  { id: "S001", name: "陳小明" },
  { id: "S002", name: "李美玲" },
  { id: "S003", name: "張大偉" },
  { id: "S004", name: "王曉華" },
  { id: "S005", name: "林志強" },
];
