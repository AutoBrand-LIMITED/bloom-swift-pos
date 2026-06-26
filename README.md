# Bloom Swift POS

Point-of-sale system for **Anglo Chinese Florist Limited**, built by AutoBrand Limited.

## Stack

| Layer | Tech |
|-------|------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v3 |
| Components | shadcn/ui |
| Routing | React Router v6 |
| State | useState / useMemo (local) |
| Storage | localStorage (Supabase migration planned) |
| Icons | Lucide React |
| i18n | Custom hook — `useLanguage()` with `zh`/`en` dicts |

## Getting Started

```bash
cp .env.local.example .env.local   # then set VITE_ADMIN_PASSWORD
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_ADMIN_PASSWORD` | Password for the Sales Report screen |

Copy `.env.local.example` → `.env.local` and fill in.

## Screens

| Route | Description |
|-------|-------------|
| `/` | Main POS order entry |
| `/driver` | Driver-facing screen (name select → orders → photo upload) |
| `/report` | Sales analytics (password-protected) |
| `/payment` | Customer-facing payment screen (`?amount=X&ref=Y`) |
| `/settings` | Delivery time slot configuration |

## Project Structure

```
src/
├── pages/
│   ├── Index.tsx          # Main POS screen (6-step order flow)
│   ├── DriverApp.tsx      # Driver interface (photo upload, delivery status)
│   ├── SalesReport.tsx    # Sales analytics (VITE_ADMIN_PASSWORD required)
│   ├── PaymentScreen.tsx  # Customer-facing payment display
│   └── Settings.tsx       # Delivery slot configuration
├── components/pos/        # POS section components (SalesId, Customer, OrderItems, Delivery, GiftCard, Payment, AddOns)
├── components/ui/         # shadcn/ui component library
├── contexts/
│   └── LanguageContext.tsx # useLanguage() hook — lang, setLang, t()
├── data/
│   └── demo-customers.ts  # Customer seed data
├── types/
│   └── order.ts           # Order, Delivery, OrderItem, PaymentStatus, SALES_STAFF, DRIVERS
└── lib/
    ├── print-utils.ts     # HTML generators — receipt, delivery note, picking slip, message card
    ├── orders.ts          # loadOrders / saveOrder / compressImage
    ├── customer-utils.ts  # localStorage customer helpers
    └── utils.ts           # shadcn cn() helper
```

## Order Entry Flow

1. **Staff selection** — required gate before any other input
2. **Customer details** — phone search with HK (+852) / Macau (+853) prefix, customer name, contact person
3. **Order items** — product presets, custom items, budget tracking, 3-type notes (sender / delivery / internal)
4. **Add-ons** — supplementary products grid
5. **Delivery** — date, preset time slots, HK cascading address, recipient, relationship, birthday, driver
6. **Gift card** — templates + markdown editor + voice input
7. **Payment** — paid / unpaid / deposit with split-payment ledger and follow-up date

## Notes System

Three note types per order:

| Type | Purpose | Visible on |
|------|---------|------------|
| 客戶備註 (Sender notes) | Customer's specific requests | Receipt, picking slip |
| 送貨備註 (Delivery notes) | Delivery instructions | Picking slip |
| 內部備註 (Internal notes) | Staff-only comments | Internal only |

Notes marked as persistent are saved to the customer record and auto-surface on every new order.

## Customer Flags

Visual dot indicators on customer records:

- 🟡 **VIP** — priority customer (auto-suggested at HKD 5,000+ lifetime spend)
- 🔴 **Warning** — late payer / difficult customer
- 🟣 **Internal** — internal tag / special handling

## Delivery Slot System

Slots configured at `/settings`. Built-in slots are locked; custom slots can be added per season. Slots with a `specified` flag open a time-picker modal (HH:MM AM/PM). Overflow slots (5+) collapse into a `⋯` dropdown; selecting one pins it to the inline row.

## Data Storage

All data in `localStorage`:

| Key | Contents |
|-----|----------|
| `florist-pos-orders` | `Order[]` |
| `florist-pos-customers` | Customer records |
| `florist-pos-photos-{orderId}` | Delivery photos (base64) |
| `florist-pos-lang` | `"zh"` \| `"en"` |
| `florist-pos-slots` | Delivery time slot config |
| `florist-pos-drivers` | Driver list |
| `florist-pos-invoice-seq` | Invoice number sequence |
| `florist-pos-occasion-reminders` | Dismissed occasion reminders |

## Print Documents

- **Receipt** — full order with sender info and price
- **Delivery Note** — recipient name and phone only (no price, no sender)
- **Picking List** — product detail for fulfilment staff
- **Message Card** — gift card content only

## SOP Key Rules

- Staff selection is step 1 — required before any input
- Sender details never appear on the delivery note
- Price never appears on the delivery note
- Invoice numbers are permanent — amendments create credit notes
- Persistent notes auto-surface on every new order for that customer
- Order history sorted by delivery date
