export type CustomerFlag = 'vip' | 'warning' | 'internal';

export interface SavedAddress {
  id: string;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
  recipientName?: string;
  recipientPhone?: string;
}

export interface DemoCustomer {
  id: string;
  name: string;
  phone: string;
  contactPerson?: string;
  flags?: CustomerFlag[];
  persistentNotes?: string;
  addresses?: SavedAddress[];
  history: PurchaseRecord[];
}

export interface PurchaseRecord {
  date: string;
  items: string;
  total: number;
  status: "paid" | "unpaid";
  deliveryAddress?: string;
  recipientName?: string;
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: "c1",
    name: "陳太太",
    phone: "9123 4567",
    history: [
      { date: "2026-03-10", items: "玫瑰花束 × 2", total: 1360, status: "paid" },
      { date: "2026-02-14", items: "繡球花束 × 1、送貨費", total: 880, status: "paid" },
      { date: "2026-01-20", items: "蘭花盆栽 × 1", total: 1200, status: "paid" },
    ],
  },
  {
    id: "c2",
    name: "李先生",
    phone: "6234 5678",
    flags: ['warning'],
    persistentNotes: "慣常遲付款，需跟進。勿先安排送貨。",
    history: [
      { date: "2026-03-18", items: "花藝佈置（婚禮）", total: 8800, status: "unpaid" },
      { date: "2026-02-28", items: "向日葵花束 × 3", total: 1440, status: "paid" },
    ],
  },
  {
    id: "c3",
    name: "王小姐",
    phone: "5345 6789",
    history: [
      { date: "2026-03-15", items: "百合花束 × 1", total: 580, status: "paid" },
      { date: "2026-03-01", items: "多肉植物 × 5", total: 1400, status: "paid" },
      { date: "2026-02-10", items: "鮮花籃 × 1", total: 880, status: "paid" },
      { date: "2026-01-05", items: "玫瑰花束 × 1、急單費", total: 780, status: "paid" },
    ],
  },
  {
    id: "c4",
    name: "張生",
    phone: "9456 7890",
    history: [
      { date: "2026-03-20", items: "園藝保養（月費）", total: 2000, status: "unpaid" },
      { date: "2026-02-20", items: "園藝保養（月費）", total: 2000, status: "paid" },
    ],
  },
  {
    id: "c5",
    name: "黃太",
    phone: "6567 8901",
    flags: ['vip'],
    persistentNotes: "VIP客戶，優先安排。喜愛粉紅色系，不喜歡白花。",
    contactPerson: "陳小姐（秘書）",
    history: [
      { date: "2026-03-12", items: "套票（100支花）", total: 8800, status: "paid" },
    ],
  },
];
