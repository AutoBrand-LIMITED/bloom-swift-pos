# Bloom Swift POS — UI Audit & Build Checklist

Branch: `feat/ui-redesign`  
Client: Anglo Chinese Florist Limited  
Built by: AutoBrand Limited

---

## SOP Reference — Full Scope

### §2.1 Core POS & Sales

- [ ] Tablet-optimised interface with full touch support; mobile simplified layout
- [x] **Staff member is the FIRST field** — required before any other input
- [x] Phone number search (with or without spaces)
- [x] Auto-detect HK 852 / Macau 853 prefix
- [x] Auto-load customer history + past delivery addresses
- [x] One tap to apply a saved address
- [x] Product category selection (bouquets, baskets, wreaths, etc.) — category-specific options
- [ ] Item code quick-search for experienced staff
- [x] Message card templates (Happy Birthday, preset greetings) + voice input for custom text
- [x] One-tap batch printing — picking slip, delivery note, message card individually selectable (全部列印 dropdown)
- [x] Option to skip message card printing entirely (checkbox in dropdown; skipped by default if no card)
- [ ] Stripe payment integration: Apple Pay, Google Pay, WhatsApp Payment Link

### §2.2 Customer & Order Management

- [x] Full customer profiles: VIP flags, company name + address (required for listed companies)
- [x] Contact person field (e.g. secretary placing order on behalf of boss)
- [ ] Multiple delivery addresses per customer
- [x] Phone search: spaced and unspaced formats simultaneously
- [x] Area code auto-detection: HK 852 and Macau 853 without manual selection
- [x] Contact person stored separately from customer name — both visible on order record
- [x] Split-delivery orders: single invoice, multiple recipients, auto-numbered (INV-001-1, INV-001-2)
- [x] Delivery time slots: 9am–1pm, 1pm–6pm, specified time (before 10am, before 12pm, office hours)
- [ ] Peak season slots configurable in back-end settings
- [x] Specified time delivery flagged separately + additional charge flag
- [x] Google Maps integration for delivery address display and route planning
- [x] Optimised order entry flow: phone + staff first → customer enters recipient/delivery → staff adds items
- [ ] Bulk import + format conversion of legacy Excel customer data (including pre-2010 formats)

### §2.3 Delivery Management

- [ ] Driver dispatch: orders assigned by district
- [ ] Each driver sees only their own order list (identified by address, not order number)
- [x] Driver interface: minimal — name select → assigned orders → tap address → upload photos
- [x] No data entry required from driver
- [x] Delivery tracking: 2 photos required per order (product photo + signed receipt photo)
- [ ] Supports 6–7 concurrent drivers during peak season including casual/hired drivers
- [ ] Automated status updates: auto-advance at fixed time milestones
- [ ] Auto WhatsApp message to colleagues if no update after set period
- [x] Back-office dispatch view: orders by driver + district grouping ✅ full `/dispatch` screen
- [ ] Management can see how many vehicles to deploy from dispatch view
- [ ] Driver WhatsApp integration option: photo upload via WhatsApp → auto-sync to system

### §2.4 Payment & Invoice System

- [x] Two primary payment methods: in-store (physical terminal) and WhatsApp Payment Link _(UI only — no real integration)_
- [x] Payment screen is standalone — shows amount + reference ONLY (no order details, no sender info)
- [ ] Shoppage platform integration for payment link generation
- [x] Outstanding payment tracking: pre-delivery alert for unpaid orders
- [x] System prompts staff before dispatching an unpaid order
- [ ] Automatic Stripe webhook: payment confirmed → system updates in real time
- [x] Split payment support: deposit + balance flow _(no post-amendment top-up or timestamps yet)_
- [ ] Invoice numbers are permanent and non-cancellable
- [ ] All amendments retain full audit trail

### §2.5 Document Design

**Picking Slip (Internal)**
- [x] Shows: recipient details, full product description, price
- [x] Hides: sender details entirely (strict confidentiality)
- [x] Tear-off design: upper portion + stub strip below dashed line, both carry order ref
- [x] Both halves carry same order number for reconciliation
- [ ] Product description detailed enough for any staff member — requires real item names from inventory

**Delivery Note (External)**
- [x] Shows: recipient name and phone number only
- [x] Hides: price, sender name, sender contact details
- [x] Same layout as picking slip with all sensitive fields removed
- [x] Batch printing: picking slip + delivery note + message card in one action (全部列印 dropdown)
- [x] Individual document selection also supported (per-document buttons + checkboxes)

### §2.6 Notes & Customer Flags

**Three note types:**
- [x] Sender notes: customer's specific requests for this order (e.g. 'make it bigger', 'no white flowers')
- [x] Delivery notes: specific delivery instructions (e.g. 'signed receipt required', 'customer providing own vase')
- [x] Internal notes: staff-only, not visible to customers (e.g. 'this customer always pays late')

**Persistent notes:**
- [x] Staff can designate notes as persistent — Bookmark toggle on each note type; saved to customer on order submit ✅
- [x] Persistent notes surface automatically when a new order is opened for that customer
- [x] No manual searching required — new and part-time staff are always informed
- [ ] Notes can be added retrospectively after an order is placed

**Customer flags:**
- [x] Internal tagging with visual indicators (e.g. red dot, purple dot) — not visible to customers
- [x] Flags for: late-paying customers, difficult customers, VIP clients, special handling
- [x] Flag appears immediately when customer record is pulled up, before order is opened

### §2.7 VIP & Seasonal Management

- [ ] VIP customer classification and tagging
- [ ] VIP status: manual application OR triggered by purchase threshold
- [ ] Birthday tracking by **recipient** (not sender) — system records who flowers were sent to + when
- [ ] System reminds sender ahead of recipient's next birthday
- [ ] Relationship field on recipient record (optional): mother, wife, colleague, etc.
- [ ] Holiday tagging at order level: Mother's Day, Valentine's Day, etc.
- [ ] Occasion and product tracked independently (customer may buy during Mother's Day but not a Mother's Day product)
- [ ] Purchase date recorded separately from holiday tag
- [ ] System reminds same sender at same time the following year
- [ ] Automated WhatsApp reminders ahead of recurring occasions
- [ ] Reminder timing configurable per customer or occasion type

### §2.8 Search, Filters & Reporting

- [ ] Phone search covers sender AND recipient records simultaneously
- [ ] Single search returns all orders where that number appears in any role
- [x] Order history displayed by **delivery date** (sorted within driver group)
- [ ] History view shows: delivery date, recipient name, delivery count for recipient, order summary
- [ ] Filters: date range (e.g. last 10 days), specific staff member, upcoming delivery date range, occasion/holiday tag
- [x] Order list sorted by delivery person — groups all orders for same driver together

---

## Current Status — What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Sales staff selection | ✅ Exists | First field; gates all other input |
| Phone search + customer lookup | ✅ Exists | 852/853 auto-detect ✅; recipient phone search ✅ |
| Personal / company toggle | ✅ Exists | — |
| Order items + presets + voice input | ✅ Exists | Category filter: 全部/花束/花籃/盆栽/花圈/其他 ✅; no item code search |
| Budget tracker with progress bar | ✅ Exists | — |
| HK cascading address (region→district→area) | ✅ Exists | — |
| Google Maps embed | ✅ Exists | — |
| Delivery date / time input | ✅ Exists | Preset slots: 上午/下午/指定時間 |
| Recipient fields + failed delivery action | ✅ Exists | — |
| Gift card + templates + markdown + voice | ✅ Exists | — |
| Payment status (paid/unpaid/deposit) | ✅ Exists | Methods UI done (terminal/Apple Pay/Stripe/WhatsApp/cash); no real integration |
| Follow-up date + reminder option | ✅ Exists | — |
| Add-ons section | ✅ Exists | — |
| Order history drawer | ✅ Exists | Grouped by driver; sorted by delivery date within group |
| Sales report page | ✅ Exists | — |
| CSV import | ✅ Exists | — |
| Customer flags (VIP dot / warning) | ✅ Exists | VIP / warning / internal tag with colour badges |
| 3 note types | ✅ Exists | Sender / delivery / internal, all with voice input |
| Persistent notes | ✅ Exists | Auto-surfaces on customer load; dismissible per order; pin toggle on notes ✅ |
| Contact person (secretary) field | ✅ Exists | — |
| Split-delivery (multiple recipients) | ✅ Exists | Multi-recipient cards; add/remove; shown in history |
| Delivery time preset slots | ✅ Exists | 上午 9–1pm / 下午 1–6pm / 指定時間 + surcharge flag |
| Driver list (not free text) | ✅ Exists | DRIVERS dropdown (阿明/阿強/阿偉/阿華/臨時司機) |
| Driver interface screen | ✅ Exists | `/driver` — name select → orders → 2-photo upload → mark delivered |
| Dispatch view (back-office) | ✅ Exists | `/dispatch` — driver groups, date filter, status + payment badges |
| Standalone payment screen | ✅ Exists | /payment?amount=X&ref=Y — customer-facing, amount only |
| Stripe / Apple Pay / Google Pay / WhatsApp link | ⚠️ UI only | Methods selectable; no real payment integration yet |
| Picking slip per SOP (hide sender, tear-off) | ✅ Exists | Hides sender; shows price + items; tear-off stub with order ref |
| Delivery note per SOP (recipient only) | ✅ Exists | Recipient + phone only; hides price/sender; multi-recipient |
| Message card standalone print | ✅ Exists | Styled card layout; card-only content |
| Batch print with document toggles | ✅ Exists | 全部列印 dropdown; per-doc checkboxes; 列印所選 |
| English / Cantonese language toggle | ✅ Exists | 廣/EN pill in header; persisted in localStorage; full app coverage |
| Relationship field on recipient | ✅ Exists | Per-recipient dropdown in DeliverySection |
| Birthday field on recipient | ✅ Exists | MM-DD field per recipient in DeliverySection |
| Occasion / holiday tag on order | ✅ Exists | Pill picker UI ✅; saved to order ✅ |
| VIP classification + purchase threshold | ✅ Exists | Auto-suggest banner at ≥ HKD 5000 spend; one-tap mark VIP ✅ |
| Birthday tracking + sender reminder | ✅ Exists | Alert shows upcoming recipient birthdays (within 30 days) on customer select ✅ |
| WhatsApp reminders | ❌ Missing | Needs backend |
| Phone search across sender + recipient | ✅ Exists | CustomerSection searches recipient phones across orders ✅ |
| Order history filters (date/staff/occasion) | ✅ Exists | Search text + staff filter + period (today/7/30/all) ✅ |
| Supabase (shared DB) | ❌ Missing | All localStorage |

---

## Build Priority Checklist

### P1 — Order Flow (core POS correctness)

- [x] Move staff selection to top — gate step before any other input
- [x] Split notes into 3 types: sender notes / delivery notes / internal notes
- [x] Add contact person (secretary) field
- [x] Add customer flags: VIP / warning / internal tag with visual dot indicator
- [x] Persistent notes: auto-surface when customer record loaded
- [x] HK 852 / Macau 853 phone prefix auto-detect

### P2 — Payment Section

- [x] Replace payment methods: add Stripe, Apple Pay, Google Pay, WhatsApp Payment Link, in-store
- [x] Build standalone customer-facing payment screen (amount + reference only) — `/payment?amount=X&ref=Y`
- [x] Pre-delivery unpaid order alert / dispatch block — shown in OrderHistory drawer
- [ ] Shoppage payment link integration — needs API keys
- [ ] Stripe webhook handler (real-time status update) — needs backend
- [ ] Split payment: deposit + balance + top-up with individual timestamps

### P3 — Delivery

- [x] Replace time input with preset slots (9am–1pm, 1pm–6pm, specified time + surcharge flag)
- [ ] Peak season slot configuration in settings
- [x] Driver list dropdown (not free text input)
- [x] Split-delivery UI: add multiple recipients per order; shown in history grouped by driver
- [x] Order list sorted by delivery person in history/dispatch views

### P4 — Print Templates ✅ DONE (2026-06-24)

<!-- Receipt also updated to show senderNotes + deliveryNotes (new note fields). -->

- [x] Picking slip: show price + product detail, hide sender, tear-off design with order number on both halves
- [x] Delivery note: show recipient name + phone only, hide price + sender
- [x] Message card: standalone print with card content only
- [x] Batch print: picking slip + delivery note + message card in one action with individual toggles

### P5 — New Screens

- [x] Driver app screen: name select → assigned orders (today/tomorrow/all) → 2-photo upload → mark delivered (`/driver`)
- [x] Dispatch view: back-office orders grouped by driver, date filter, status + payment badges, blocked unpaid orders highlighted (`/dispatch`)
- [ ] Auto WhatsApp notification if delivery not updated after set period

### P6 — VIP & Seasonal ✅ DONE (2026-06-24)

- [x] Relationship field on recipient record (dropdown per recipient card)
- [x] Birthday field on recipient (MM-DD per recipient card)
- [x] Occasion / holiday tag on order — pill picker UI wired; saved to order ✅
- [x] VIP flag: auto-suggest banner when total spend ≥ HKD 5000; one-tap mark VIP ✅
- [x] Birthday reminder: alert shows upcoming recipient birthdays within 30 days on customer select ✅
- [x] Mark note as persistent: Bookmark toggle per note type → saves to customer on submit ✅
- [ ] WhatsApp reminder scheduling — needs backend; skip until P7
- [x] Order history sorted by delivery date ✅ already done in P3
- [x] History filters: text search + staff member + date period (today/last7/last30/all) ✅
- [x] Phone search across sender + recipient simultaneously ✅

### P7 — Infrastructure

- [ ] Migrate from localStorage to Supabase (Supabase Pro: 8GB DB + 100GB Storage)
- [ ] Product category structure in DB (bouquets, baskets, wreaths, etc.)
- [ ] Item code search
- [ ] Legacy Excel import (including pre-2010 formats)
- [ ] Invoice numbers: permanent, non-cancellable, full audit trail on amendments
- [ ] Stripe webhook integration

---

## Data Flow Reference (§3)

| Data Point | How It Flows |
|------------|-------------|
| Order / Invoice Number | One permanent number at creation — shared across POS, invoice, picking slip, delivery note, payment |
| Delivery Note Number | Derived from invoice (INV-0012-1, INV-0012-2) per recipient in split-delivery |
| Picking Slip Number | Same as invoice number with internal marker |
| Customer Record | Linked via phone number — all orders, addresses, notes, payment history attach automatically |
| Payment Status | Real-time via Stripe webhook — invoice status, pre-delivery alert, back-office view all sync |
| Delivery Status | Updated by driver photo upload — visible to office in real time, linked to delivery note + invoice |
| Sender & Recipient Data | Same order record, different views — picking slip shows price (internal), delivery note hides it (external) |
| Persistent Notes | Flagged at customer profile level — auto-surfaced on every new order |

---

## Deliverables Reference (§4)

| # | Deliverable | Target |
|---|-------------|--------|
| 1 | Complete POS system (frontend + backend + database) | Mid-June 2025 |
| 2 | Customer & order management module | Mid-June 2025 |
| 3 | Delivery management & driver tracking interface | Mid-June 2025 |
| 4 | Payment & invoice system (Stripe integration) | Mid-June 2025 |
| 5 | Picking slip / delivery note / message card print module | Mid-June 2025 |
| 6 | VIP customer & seasonal auto-reminder module | Mid-June 2025 |
| 7 | Legacy Excel data import tool | Mid-June 2025 |
| 8 | System testing report & go-live support | Mid-June 2025 |

---

## Infrastructure Reference (§5)

**Supabase Pro**
- Database: 8GB — estimated usage < 1GB (30,000 customers + 12,000 orders/year)
- Storage: 100GB — 4–8 years of delivery photos at 35 orders/day × 2 photos

---

## Odoo Integration (Appendix)

Odoo handles natively (no custom build needed):
- Invoice management + audit trail
- Payment tracking + outstanding reminders
- Customer database + notes
- Reporting + multi-dimensional filters

Custom build still required (Odoo cannot replace):
- [ ] Tablet POS interface
- [ ] Driver delivery tracking + photo upload
- [ ] WhatsApp auto-reminders
- [ ] Picking slip / delivery note printing

Integration: AutoBrand handles Odoo ↔ POS via **n8n middleware**

Licensing (client pays directly):
- Community: Free
- Enterprise: USD $20–40 / user / month
