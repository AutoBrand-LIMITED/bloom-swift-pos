# Bloom Swift POS — CLAUDE.md

Point-of-sale system for Anglo Chinese Florist Limited. React 18 + TypeScript, Vite 5, Tailwind CSS v3, shadcn/ui, React Router v6. All persistence via `localStorage` (no backend).

## Key Patterns

### i18n
Custom system — do not use any external i18n library.

- Strings live in `src/lib/i18n.ts`: `zh` dict is the source of truth, `en` mirrors every key.
- `TranslationKey = keyof typeof zh` — TypeScript enforces both dicts stay in sync.
- Hook: `const { lang, setLang, t } = useLanguage()` from `@/contexts/LanguageContext`.
- Adding a new string: add to `zh` first, TypeScript will error on `en` until it's added there too.

### Section components (`src/components/pos/`)
Each section (SalesId, Customer, OrderItems, Delivery, GiftCard, Payment) follows this pattern:

```tsx
<div className={`rounded-xl p-4 space-y-X border transition-colors ${
  isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"
}`}>
  <h2 className="text-sm sm:text-[13px] font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
    <StepBadge n={N} done={!!isComplete} />
    <LucideIcon className="w-4 h-4" />
    {t("section_key")}
  </h2>
  {/* content */}
</div>
```

- `isComplete` prop drives the green tint — always pass it.
- Section headers use Lucide icons, never emoji.
- `StepBadge` shows number or checkmark.

### Design tokens (src/index.css)
- Background: warm off-white `hsl(40 20% 97%)`
- Primary: forest green `hsl(152 45% 38%)`
- Radius: `0.75rem`
- Fonts: DM Sans (sans), JetBrains Mono (mono)

### stepsDone / progress bar (Index.tsx)
```tsx
const totalSteps = giftCardEnabled ? 6 : 5;  // gift card is N/A when disabled
const stepsDone = useMemo(() => [
  !!salesId,
  !!phone.trim() && !!customerName.trim(),
  items.length > 0,
  deliveries.every(d => d.deliveryDate && d.deliveryTime && d.recipientName && d.deliveryTime !== "指定時間"),
  ...(giftCardEnabled ? [!!giftCardMessage.trim()] : []),
  items.length > 0 && paymentStatus !== "unpaid",
].filter(Boolean).length, [...deps]);
```

### Types
```
src/types/order.ts
  Order         — full order record
  Delivery      — per-recipient (recipientRelationship?, recipientBirthday? MM-DD)
  OrderItem     — { id, name, price, quantity }
  PaymentStatus — "unpaid" | "paid" | "deposit"
  SALES_STAFF   — static array
  DRIVERS       — static array
```

### Print HTML (`src/lib/print-utils.ts`)
- `generateReceipt()`, `generatePickingSlip()`, `generateDeliveryNote()`, `generateMessageCard()`
- **All user strings MUST pass through `esc()`** before interpolation into HTML — prevents XSS via crafted product names or customer data.

### localStorage keys
- `florist-pos-orders` → `Order[]`
- `florist-pos-customers` → imported customer records
- `florist-pos-photos-{orderId}` → delivery photos (base64)
- `florist-pos-lang` → `"zh"` | `"en"`

## Dev Commands

```bash
npm run dev      # start dev server on :5174
npm run build    # production build
npx tsc --noEmit # type check
```

## Design Rules

- No border highlight accents (no `border-t-4 border-emerald-400` style patterns)
- Section completion tint (`bg-primary/[0.04]`) is fine — it's subtle
- Back buttons: always top-left in sticky header, before icon + title
- No emoji in section headers — use Lucide icons
- Driver cards: initial avatar (`bg-primary/10 text-primary`) not color borders

### Responsive Typography
- Small label text uses `text-xs sm:text-[10px]` — 12px on mobile, 10px on desktop
- Helper/subtitle text uses `text-xs sm:text-[11px]` — 12px on mobile, 11px on desktop
- Section headers use `text-sm sm:text-[13px]` — 14px on mobile, 13px on desktop
- Exception: text inside fixed-size badge/pill containers stays at hardcoded sizes (bounded by the container)

### Responsive Layout
- Header nav: `hidden sm:flex` (desktop) + `flex sm:hidden` (mobile) with lang toggle + history icon + `⋯` DropdownMenu
- CustomerHistoryPanel: `fixed top-[49px] bottom-0 left-0 z-50 sm:static` on mobile (overlay), sidebar on desktop
- Mobile overlay backdrop: `fixed inset-0 z-30 bg-foreground/40 sm:hidden`
- Footer progress bar: `hidden sm:flex`; compact `x/y` step counter shown on mobile instead

## Security Notes

- `VITE_ADMIN_PASSWORD` must be in `.env.local` (gitignored), never hardcoded
- All HTML-injected user strings escape through `esc()` in print-utils
- Photo uploads: validate `file.type.startsWith("image/")` and `file.size < 20MB` before processing
