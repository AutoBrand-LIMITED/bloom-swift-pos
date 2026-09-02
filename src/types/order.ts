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
export type RecipientOccasionType = "birthday" | "anniversary" | "valentines_day" | "other";

export interface RecipientOccasion {
  id?: number;
  type: RecipientOccasionType;
  label?: string;
  date: string;
  /** POS-only provenance; removed by normalizeRecipientOccasions before API submission. */
  autoDateFromDelivery?: true;
}

export interface DeliverySplitItemAllocation {
  itemId: string;
  itemName: string;
  quantity: number;
}

/** An additional destination in a split-delivery order. */
export interface DeliverySplit {
  id: string;
  /** Each additional destination can be delivered or collected independently. */
  fulfillmentType?: FulfillmentType;
  deliveryDate: string;
  deliveryTimeMode?: DeliveryTimeMode;
  deliverySlotId?: number;
  deliveryTime: string;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
  deliveryAddress: string;
  deliveryGoogleAddress: string;
  deliveryBuilding: string;
  deliveryFloor: string;
  deliveryUnit: string;
  recipientType: RecipientType;
  recipientCompanyName: string;
  recipientName: string;
  recipientPhone: string;
  /** Recipient occasions snapshot. Absence means unknown; [] means explicitly empty. */
  recipientOccasions?: RecipientOccasion[] | null;
  /** Opaque optimistic-lock token for the bound recipient's occasion list. */
  recipientOccasionsVersion?: string | null;
  /** Legacy read/replay-only birthday field. */
  recipientBirthday?: string;
  /** Explicit Odoo shipping contact selected for this destination. */
  recipientPartnerId?: number;
  deliveryPerson: string;
  failedDeliveryAction: string;
  deliveryNote: string;
  giftCardEnabled?: boolean;
  giftCardMessage?: string;
  itemAllocations: DeliverySplitItemAllocation[];
}

export interface PartnerNoteMutation {
  commentText: string;
  targetPartnerId?: number;
  expectedWriteDate?: string;
}

export interface Order {
  id: string;
  /** Server-resolved responsible salesperson label retained for legacy/history display. */
  salesId: string;
  /** Authenticated operator audit identity. This is never controlled by the salesperson picker. */
  operatorEmployeeId?: number;
  /** Active Odoo employee selected as the responsible salesperson. */
  salespersonEmployeeId?: number;
  /** Optional native Odoo Sales Team. */
  salesTeamId?: number;
  /** Optional native Odoo Contact Tag used as this customer's group. */
  customerGroupId?: number;
  /** Odoo customer concurrency token captured when the Customer Group was selected. */
  customerGroupExpectedWriteDate?: string;
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
  /** Outstanding amount reported by Odoo Accounting. */
  balanceAmount?: number;
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
  /** Additional destinations; unallocated item quantities remain at the primary destination. */
  deliverySplits?: DeliverySplit[];
  recipientType?: RecipientType;
  recipientCompanyName?: string;
  recipientName: string;
  recipientPhone: string;
  /** Recipient occasions snapshot. Absence means unknown; [] means explicitly empty. */
  recipientOccasions?: RecipientOccasion[] | null;
  /** Opaque optimistic-lock token for the bound recipient's occasion list. */
  recipientOccasionsVersion?: string | null;
  /** Legacy read/replay-only birthday field. */
  recipientBirthday?: string;
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
  salesTeamId?: number;
  salesTeamName?: string;
}

export interface OdooNamedReference {
  id: number;
  name: string;
}
