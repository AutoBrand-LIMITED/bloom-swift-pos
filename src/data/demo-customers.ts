import type { RecipientOccasion } from "@/types/order";

export interface DemoCustomer {
  id: string;
  name: string;
  phone: string;
  history: PurchaseRecord[];
  historyCount?: number;
  totalSpent?: number;
  odooPartnerId?: number;
  customerCode?: string;
  email?: string;
  customerType?: "personal" | "company";
  companyName?: string;
  billingAddress?: string;
  paymentTermId?: number;
  paymentTerm?: string;
  customerGroupId?: number;
  customerGroup?: string;
  commentText?: string;
  tags?: CustomerTag[];
  writeDate?: string;
  recipientMatch?: RecipientSearchMatch;
}

export interface RecipientSearchMatch {
  name?: string;
  phone?: string;
  resolved?: boolean;
  recipientType?: "personal" | "company";
  companyName?: string;
  recipientOccasions?: RecipientOccasion[] | null;
  recipientOccasionsVersion?: string | null;
  recipientBirthday?: string | null;
  deliveryAddress?: string;
  shippingPartnerId?: number;
}

export interface CustomerTag {
  id: number;
  name: string;
  color?: number | null;
  managed?: boolean;
}

export interface PurchaseRecord {
  id?: number;
  date: string;
  dateTime?: string;
  invoiceNumber?: string;
  items: string;
  total: number;
  status: "paid" | "deposit" | "unpaid";
  deliveryDate?: string;
  deliveryAddress?: string;
  recipientType?: "personal" | "company";
  recipientCompanyName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientOccasions?: RecipientOccasion[] | null;
  recipientBirthday?: string;
  customerName?: string;
  senderName?: string;
  salesperson?: string;
  deliveryPerson?: string;
  senderDoNumber?: string;
  recipientDoNumber?: string;
  customerEmail?: string;
  billingAddress?: string;
  customerGroup?: string;
  sourceReference?: string;
  department?: string;
  terms?: string;
  dataStatus?: string;
  deliveryDetailsMissing?: boolean;
  shippingPartnerId?: number;
  recipientContactNote?: string;
  senderNote?: string;
  deliveryNote?: string;
  internalNote?: string;
  lines?: PurchaseRecordLine[];
}

export interface PurchaseRecordLine {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemCode?: string | null;
  packing?: string | null;
  remarks?: string | null;
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [];
