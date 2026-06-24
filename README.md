# Bloom Swift POS

Point-of-sale system for **Anglo Chinese Florist Limited**, built by AutoBrand Limited.

## Stack

| Layer | Tech |
|-------|------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v3 |
| Components | shadcn/ui |
| Routing | React Router |
| State | useState / useMemo (local) |
| Storage | localStorage (Supabase migration planned) |
| Icons | Lucide React |
| Testing | Vitest + Playwright |

## Getting Started

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Project Structure

```
src/
├── pages/
│   ├── Index.tsx          # Main POS screen
│   └── SalesReport.tsx    # Sales analytics (password: bloom2024)
├── components/pos/        # POS feature components
├── components/ui/         # shadcn/ui component library
├── data/
│   └── demo-customers.ts  # Customer seed data + types
├── types/
│   └── order.ts           # Order, OrderItem, PaymentStatus types
└── lib/
    ├── print-utils.ts     # Receipt, delivery note, picking list generators
    ├── customer-utils.ts  # localStorage customer helpers
    └── utils.ts           # shadcn cn() helper
```

## Order Entry Flow

1. **Staff selection** — required gate before any other input
2. **Customer details** — phone search with HK (+852) / Macau (+853) prefix, customer name, contact person
3. **Order items** — product presets, custom items, fees, 3-type notes
4. **Delivery** — date, time, HK cascading address, recipient, Google Maps
5. **Gift card** — templates + markdown editor + voice input
6. **Payment** — paid / unpaid / deposit with follow-up date
7. **Add-ons** — supplementary products grid

## Notes System

Three note types per order:

| Type | Purpose | Visible on |
|------|---------|------------|
| 客戶備註 (Sender notes) | Customer's specific requests | Receipt, picking slip |
| 送貨備註 (Delivery notes) | Delivery instructions | Picking slip |
| 內部備註 (Internal notes) | Staff-only comments | Internal only |

## Customer Flags

Visual dot indicators on customer records:

- 🟡 **VIP** — priority customer
- 🔴 **Warning** — late payer / difficult customer
- 🟣 **Internal** — internal tag / special handling

Persistent notes auto-surface when a customer record is loaded.

## Data Storage

All data in `localStorage`:
- `florist-pos-orders` → `Order[]`
- `florist-pos-customers` → imported customer records

## Print Documents

- **Receipt** — full order with sender info and price
- **Delivery Note** — recipient name and phone only (no price, no sender)
- **Picking List** — product detail for fulfilment staff

## SOP Key Rules

- Staff selection is step 1 — required before any input
- Sender details never appear on the delivery note
- Price never appears on the delivery note
- Invoice numbers are permanent — amendments create credit notes
- Persistent notes auto-surface on every new order for that customer
- Order history sorted by delivery date
