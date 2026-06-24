import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Flower2, ClipboardList, RotateCcw, BarChart3, AlertCircle, X, Truck, Crown, Gift, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CsvImportButton from "@/components/pos/CsvImportButton";
import { generateReceipt, generateDeliveryNote, generatePickingList, printDocument } from "@/lib/print-utils";
import CustomerSection from "@/components/pos/CustomerSection";
import OrderItemsSection from "@/components/pos/OrderItemsSection";
import DeliverySection from "@/components/pos/DeliverySection";
import GiftCardSection from "@/components/pos/GiftCardSection";
import PaymentSection from "@/components/pos/PaymentSection";
import AddOnsSection from "@/components/pos/AddOnsSection";
import OrderHistory from "@/components/pos/OrderHistory";
import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { Order, OrderItem, PaymentStatus, Delivery } from "@/types/order";
import { SALES_STAFF } from "@/types/order";
import SalesIdSection from "@/components/pos/SalesIdSection";
import { newDelivery } from "@/components/pos/DeliverySection";
import { DEMO_CUSTOMERS, type DemoCustomer } from "@/data/demo-customers";

import { loadOrders, saveOrders } from "@/lib/orders";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateCustomerPersistentNotes, updateCustomerFlags } from "@/lib/customer-utils";
import type { CustomerFlag } from "@/data/demo-customers";
import type { TranslationKey } from "@/lib/i18n";

const OCCASION_KEYS: TranslationKey[] = [
  "occasion_birthday", "occasion_mothers_day", "occasion_fathers_day",
  "occasion_valentines", "occasion_christmas", "occasion_anniversary",
  "occasion_graduation", "occasion_new_year", "occasion_other",
];

const Index = () => {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();

  // Pre-generated order ID so it can be shown on the payment screen before submission
  const [currentOrderId, setCurrentOrderId] = useState(() => crypto.randomUUID());

  // Staff (gate — must be first)
  const [salesId, setSalesId] = useState("");

  // Customer
  const [phone, setPhone] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+852");
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState<"personal" | "company">("personal");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DemoCustomer | null>(null);
  const [customerRefreshKey, setCustomerRefreshKey] = useState(0);
  const [persistentNoteDismissed, setPersistentNoteDismissed] = useState(false);

  // Items
  const [budget, setBudget] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [urgentFee, setUrgentFee] = useState(0);
  const [senderNotes, setSenderNotes] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Delivery
  const [deliveries, setDeliveries] = useState<Delivery[]>([newDelivery()]);

  // Occasion
  const [occasionTag, setOccasionTag] = useState("");

  // Pin notes to customer
  const [senderNotesPinned, setSenderNotesPinned] = useState(false);
  const [deliveryNotesPinned, setDeliveryNotesPinned] = useState(false);
  const [internalNotesPinned, setInternalNotesPinned] = useState(false);

  // Gift card
  const [giftCardEnabled, setGiftCardEnabled] = useState(false);
  const [giftCardMessage, setGiftCardMessage] = useState("");

  // Payment
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [reminderOption, setReminderOption] = useState("none");
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // History
  const [orders, setOrders] = useState<Order[]>(loadOrders);
  const [historyOpen, setHistoryOpen] = useState(false);

  const subtotal = useMemo(() => {
    const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return itemsTotal + deliveryFee + urgentFee;
  }, [items, deliveryFee, urgentFee]);

  const finalPrice = priceOverridden && manualPrice !== null ? manualPrice : subtotal;

  const handleFinalPriceChange = (v: number) => {
    setManualPrice(v);
    setPriceOverridden(true);
  };

  const resetPrice = () => {
    setPriceOverridden(false);
    setManualPrice(null);
  };

  const unpaidCount = useMemo(() => orders.filter((o) => o.paymentStatus === "unpaid").length, [orders]);

  const VIP_THRESHOLD = 5000;

  const vipSuggestion = useMemo(() => {
    if (!selectedCustomer || selectedCustomer.flags?.includes("vip")) return false;
    const normalizedPhone = selectedCustomer.phone.replace(/\s/g, "");
    const totalSpend = orders
      .filter(o => o.phone.replace(/\s/g, "") === normalizedPhone)
      .reduce((sum, o) => sum + o.finalPrice, 0);
    return totalSpend >= VIP_THRESHOLD;
  }, [selectedCustomer, orders]);

  const upcomingBirthdays = useMemo(() => {
    if (!selectedCustomer) return [] as { name: string; birthday: string; daysUntil: number }[];
    const normalizedPhone = selectedCustomer.phone.replace(/\s/g, "");
    const today = new Date();
    const seen = new Set<string>();
    const results: { name: string; birthday: string; daysUntil: number }[] = [];

    for (const order of orders) {
      if (order.phone.replace(/\s/g, "") !== normalizedPhone) continue;
      for (const d of (order.deliveries ?? [])) {
        if (!d.recipientBirthday || !d.recipientName) continue;
        const key = `${d.recipientName}-${d.recipientBirthday}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const parts = d.recipientBirthday.split("-");
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        if (isNaN(month) || isNaN(day)) continue;

        const nextBirthday = new Date(today.getFullYear(), month - 1, day);
        if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 30) {
          results.push({ name: d.recipientName, birthday: d.recipientBirthday, daysUntil });
        }
      }
    }

    return results.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [selectedCustomer, orders]);

  const totalSteps = giftCardEnabled ? 6 : 5;
  const stepsDone = useMemo(() => [
    !!salesId,
    !!phone.trim() && !!customerName.trim(),
    items.length > 0,
    deliveries.every(d => d.deliveryDate && d.deliveryTime && d.recipientName && d.deliveryTime !== "指定時間"),
    ...(giftCardEnabled ? [!!giftCardMessage.trim()] : []),
    items.length > 0 && paymentStatus !== "unpaid",
  ].filter(Boolean).length, [salesId, phone, customerName, items, deliveries, giftCardEnabled, giftCardMessage, paymentStatus]);

  const blockingReason = !salesId ? t("blocking_no_staff") :
    !phone.trim() ? t("blocking_no_phone") :
    !customerName.trim() ? t("blocking_no_name") :
    items.length === 0 ? t("blocking_no_items") : null;

  const resetForm = useCallback(() => {
    setSalesId("");
    setPhone("");
    setPhonePrefix("+852");
    setCustomerName("");
    setCustomerType("personal");
    setCompanyName("");
    setContactPerson("");
    setPhoneError(false);
    setSelectedCustomer(null);
    setPersistentNoteDismissed(false);
    setItems([]);
    setBudget(0);
    setDeliveryFee(0);
    setUrgentFee(0);
    setSenderNotes("");
    setDeliveryNotes("");
    setInternalNotes("");
    setDeliveries([newDelivery()]);
    setGiftCardEnabled(false);
    setGiftCardMessage("");
    setPaymentStatus("unpaid");
    setDepositAmount(0);
    setPaymentMethod("");
    setFollowUpDate(undefined);
    setReminderOption("none");
    setPriceOverridden(false);
    setManualPrice(null);
    setOccasionTag("");
    setSenderNotesPinned(false);
    setDeliveryNotesPinned(false);
    setInternalNotesPinned(false);
    setCurrentOrderId(crypto.randomUUID());
  }, []);

  const handleCustomerSelect = (c: DemoCustomer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setPhone(c.phone);
    setPhoneError(false);
    setContactPerson(c.contactPerson ?? "");
    setPersistentNoteDismissed(false);
  };

  const handleMarkVip = () => {
    if (!selectedCustomer) return;
    const newFlags: CustomerFlag[] = [...(selectedCustomer.flags ?? []).filter(f => f !== "vip"), "vip"];
    updateCustomerFlags(selectedCustomer.phone, newFlags);
    setSelectedCustomer({ ...selectedCustomer, flags: newFlags });
    setCustomerRefreshKey(k => k + 1);
    toast.success(t("btn_mark_vip"));
  };

  const handleSubmit = () => {
    if (!salesId) {
      toast.error(t("toast_error_no_staff"));
      return;
    }

    if (!phone.trim()) {
      setPhoneError(true);
      toast.error(t("toast_error_no_phone"));
      return;
    }
    setPhoneError(false);

    if (items.length === 0) {
      toast.error(t("toast_error_no_items"));
      return;
    }

    if (finalPrice === 0) {
      toast.warning(t("toast_warn_zero_price"));
    }

    const order: Order = {
      id: currentOrderId,
      salesId,
      customerName: customerName.trim(),
      phone: `${phonePrefix} ${phone.trim()}`,
      contactPerson: contactPerson.trim(),
      items,
      deliveryFee,
      urgentFee,
      subtotal,
      finalPrice,
      priceOverridden,
      paymentStatus,
      depositAmount: paymentStatus === "deposit" ? depositAmount : 0,
      followUpDate: followUpDate ? followUpDate.toISOString() : "",
      reminderOption,
      deliveries,
      deliveryDate: deliveries[0]?.deliveryDate ?? "",
      deliveryTime: deliveries[0]?.deliveryTime ?? "",
      deliveryAddress: [deliveries[0]?.deliveryRegion, deliveries[0]?.deliveryDistrict, deliveries[0]?.deliveryArea, deliveries[0]?.deliveryDetail?.trim()].filter(Boolean).join(" "),
      recipientName: deliveries[0]?.recipientName?.trim() ?? "",
      recipientPhone: deliveries[0]?.recipientPhone?.trim() ?? "",
      deliveryPerson: deliveries[0]?.deliveryPerson ?? "",
      giftCardEnabled,
      giftCardMessage: giftCardEnabled ? giftCardMessage.trim() : "",
      notes: senderNotes.trim(),
      senderNotes: senderNotes.trim(),
      deliveryNotes: deliveryNotes.trim(),
      internalNotes: internalNotes.trim(),
      occasionTag: occasionTag || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...orders, order];
    setOrders(updated);
    saveOrders(updated);

    // Save pinned notes to customer persistent record (append to existing)
    const newPinned = [
      senderNotesPinned && senderNotes.trim() ? senderNotes.trim() : null,
      deliveryNotesPinned && deliveryNotes.trim() ? deliveryNotes.trim() : null,
      internalNotesPinned && internalNotes.trim() ? internalNotes.trim() : null,
    ].filter(Boolean).join("\n");
    if (newPinned && phone.trim()) {
      const existing = selectedCustomer?.persistentNotes;
      const combined = existing ? `${existing}\n${newPinned}` : newPinned;
      updateCustomerPersistentNotes(`${phonePrefix} ${phone.trim()}`, combined);
      setCustomerRefreshKey(k => k + 1);
    }

    if (paymentStatus === "unpaid") {
      toast.warning(t("toast_order_unpaid"), { duration: 5000 });
    } else if (paymentStatus === "deposit") {
      toast.info(`${t("toast_order_deposit")} $${depositAmount} · ${t("label_remaining_due")} $${finalPrice - depositAmount}`);
    } else {
      toast.success(t("toast_order_success"));
    }

    toast(t("toast_print_prompt"), {
      duration: 15000,
      description: t("toast_print_desc"),
      action: {
        label: t("btn_receipt"),
        onClick: () => printDocument(generateReceipt(order)),
      },
      cancel: {
        label: t("btn_print_all"),
        onClick: () => {
          printDocument(generateReceipt(order));
          setTimeout(() => printDocument(generateDeliveryNote(order)), 500);
          setTimeout(() => printDocument(generatePickingList(order)), 1000);
        },
      },
    });

    resetForm();
  };

  const showPersistentNote =
    selectedCustomer?.persistentNotes && !persistentNoteDismissed;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flower2 className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">Anglo Chinese Florist</h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                {new Date().toLocaleDateString("zh-HK", { weekday: "short", month: "long", day: "numeric" })}
                {salesId && (() => {
                  const staff = (SALES_STAFF ?? []).find(s => s.id === salesId);
                  return staff ? ` · ${staff.name}` : "";
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CsvImportButton onCustomersUpdated={() => setCustomerRefreshKey((k) => k + 1)} />
            <Button variant="ghost" size="sm" onClick={() => navigate("/dispatch")} className="gap-1.5 text-xs">
              <Truck className="w-3.5 h-3.5" /> {t("nav_dispatch")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/report")} className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> {t("nav_report")}
            </Button>
            {/* Language toggle */}
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                onClick={() => setLang("zh")}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === "zh" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
              >
                廣
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}
              >
                EN
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
              <RotateCcw className="w-3.5 h-3.5" /> {t("nav_clear")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1.5 text-xs relative"
            >
              <ClipboardList className="w-3.5 h-3.5" /> {t("nav_order_history")}
              {unpaidCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unpaidCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Body: left panel + main */}
      <div className="flex flex-1">
        {/* Left: Customer history panel */}
        {selectedCustomer && (
          <CustomerHistoryPanel
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onUseAddress={(address, recipientNameVal) => {
              setDeliveries(prev => {
                const next = [...prev];
                next[0] = { ...next[0], deliveryDetail: address, ...(recipientNameVal ? { recipientName: recipientNameVal } : {}) };
                return next;
              });
              toast.success(t("toast_address_applied"));
            }}
          />
        )}

        {/* Main form */}
        <main className="flex-1 max-w-3xl mx-auto px-4 py-5 space-y-5 pb-28">

          {/* STEP 1: Staff — required gate */}
          <SalesIdSection salesId={salesId} onSalesIdChange={setSalesId} isComplete={!!salesId} />

          {/* No-staff warning */}
          {!salesId && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {t("warning_no_staff")}
            </div>
          )}

          {/* Persistent notes alert */}
          {showPersistentNote && (
            <div className="relative flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-xs uppercase tracking-wide mb-1">{t("label_persistent_notes")}</p>
                <p className="text-xs leading-relaxed">{selectedCustomer!.persistentNotes}</p>
              </div>
              <button
                onClick={() => setPersistentNoteDismissed(true)}
                className="shrink-0 text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <CustomerSection
            phone={phone}
            phonePrefix={phonePrefix}
            customerName={customerName}
            customerType={customerType}
            companyName={companyName}
            contactPerson={contactPerson}
            onPhoneChange={(v) => { setPhone(v); if (v.trim()) setPhoneError(false); }}
            onPhonePrefixChange={setPhonePrefix}
            onNameChange={setCustomerName}
            onCustomerTypeChange={setCustomerType}
            onCompanyNameChange={setCompanyName}
            onContactPersonChange={setContactPerson}
            onCustomerSelect={handleCustomerSelect}
            phoneError={phoneError}
            selectedCustomer={selectedCustomer}
            refreshKey={customerRefreshKey}
            isComplete={!!phone.trim() && !!customerName.trim()}
            orders={orders}
          />

          {/* VIP threshold suggestion */}
          {vipSuggestion && (
            <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-600 shrink-0" />
                <span>{t("alert_vip_threshold")}</span>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-xs border-yellow-300 text-yellow-800 hover:bg-yellow-100" onClick={handleMarkVip}>
                {t("btn_mark_vip")}
              </Button>
            </div>
          )}

          {/* Birthday reminders */}
          {upcomingBirthdays.length > 0 && (
            <div className="rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-xs text-pink-800 space-y-1 dark:border-pink-800 dark:bg-pink-950/30 dark:text-pink-300">
              <div className="flex items-center gap-2 font-semibold">
                <Gift className="w-3.5 h-3.5 shrink-0" />
                {t("alert_birthday_upcoming")}
              </div>
              {upcomingBirthdays.map(({ name, birthday, daysUntil }) => (
                <p key={`${name}-${birthday}`}>
                  {name} · {birthday} · {daysUntil === 0 ? lang === "zh" ? "今日！" : "Today!" : lang === "zh" ? `${daysUntil}日後` : `in ${daysUntil} days`}
                </p>
              ))}
            </div>
          )}

          <OrderItemsSection
            items={items}
            onItemsChange={setItems}
            deliveryFee={deliveryFee}
            urgentFee={urgentFee}
            onDeliveryFeeChange={setDeliveryFee}
            onUrgentFeeChange={setUrgentFee}
            senderNotes={senderNotes}
            deliveryNotes={deliveryNotes}
            internalNotes={internalNotes}
            onSenderNotesChange={setSenderNotes}
            onDeliveryNotesChange={setDeliveryNotes}
            onInternalNotesChange={setInternalNotes}
            budget={budget}
            onBudgetChange={setBudget}
            subtotal={subtotal}
            isComplete={items.length > 0}
            senderNotesPinned={senderNotesPinned}
            deliveryNotesPinned={deliveryNotesPinned}
            internalNotesPinned={internalNotesPinned}
            onSenderNotesPinnedChange={setSenderNotesPinned}
            onDeliveryNotesPinnedChange={setDeliveryNotesPinned}
            onInternalNotesPinnedChange={setInternalNotesPinned}
          />

          <DeliverySection
            deliveries={deliveries}
            onDeliveriesChange={setDeliveries}
            isComplete={deliveries.every(d => d.deliveryDate && d.deliveryTime && d.recipientName && d.deliveryTime !== "指定時間")}
          />

          <GiftCardSection
            enabled={giftCardEnabled}
            message={giftCardMessage}
            onEnabledChange={setGiftCardEnabled}
            onMessageChange={setGiftCardMessage}
            isComplete={!giftCardEnabled || !!giftCardMessage.trim()}
          />

          {/* Occasion tag */}
          <div className={`rounded-xl p-4 space-y-3 border transition-colors ${occasionTag ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
            <h2 className="text-[13px] font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              {t("label_occasion")}
              {occasionTag && <span className="text-[11px] font-normal normal-case tracking-normal text-primary">{t(occasionTag as TranslationKey)}</span>}
            </h2>
            <div className="flex flex-wrap gap-2">
              {OCCASION_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => setOccasionTag(occasionTag === key ? "" : key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    occasionTag === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          <PaymentSection
            subtotal={subtotal}
            finalPrice={finalPrice}
            priceOverridden={priceOverridden}
            onFinalPriceChange={handleFinalPriceChange}
            onResetPrice={resetPrice}
            paymentStatus={paymentStatus}
            onPaymentStatusChange={setPaymentStatus}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            depositAmount={depositAmount}
            onDepositAmountChange={setDepositAmount}
            followUpDate={followUpDate}
            onFollowUpDateChange={setFollowUpDate}
            reminderOption={reminderOption}
            onReminderOptionChange={setReminderOption}
            priceWarning={finalPrice === 0 && items.length > 0}
            orderId={currentOrderId}
            isComplete={paymentStatus !== "unpaid" || finalPrice === 0}
          />

          <AddOnsSection
            items={items}
            onItemsChange={setItems}
          />
        </main>
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t("nav_total")}</p>
              <p className="text-2xl font-bold font-mono tracking-tight">${finalPrice.toLocaleString()}</p>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[100px]">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground font-medium">{stepsDone}/{totalSteps}</span>
                {stepsDone === totalSteps && (
                  <span className="text-[11px] text-primary font-semibold">✓ Ready</span>
                )}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden w-28">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(stepsDone / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {blockingReason && (
              <p className="text-[11px] text-destructive font-medium">{blockingReason}</p>
            )}
            <Button
              onClick={handleSubmit}
              size="lg"
              className={`px-8 text-base font-semibold shadow-lg transition-all duration-200 ${stepsDone === totalSteps ? "shadow-primary/25 shadow-lg" : ""}`}
              disabled={!!blockingReason}
            >
              {t("nav_confirm_order")}
            </Button>
          </div>
        </div>
      </div>

      {/* Order history drawer */}
      <OrderHistory orders={orders} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
};

export default Index;
