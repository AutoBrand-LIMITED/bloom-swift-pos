import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Flower2, ClipboardList, RotateCcw, BarChart3, AlertCircle, X, Truck } from "lucide-react";
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

  const stepsDone = useMemo(() => [
    !!salesId,
    !!phone.trim() && !!customerName.trim(),
    items.length > 0,
    deliveries.every(d => d.deliveryDate && d.deliveryTime && d.recipientName && d.deliveryTime !== "指定時間"),
    !giftCardEnabled || !!giftCardMessage.trim(),
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
      createdAt: new Date().toISOString(),
    };

    const updated = [...orders, order];
    setOrders(updated);
    saveOrders(updated);

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
          />

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
                <span className="text-[11px] text-muted-foreground font-medium">{stepsDone}/6</span>
                {stepsDone === 6 && (
                  <span className="text-[11px] text-primary font-semibold">✓ Ready</span>
                )}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden w-28">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(stepsDone / 6) * 100}%` }}
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
              className={`px-8 text-base font-semibold shadow-lg transition-all duration-200 ${stepsDone === 6 ? "shadow-primary/25 shadow-lg" : ""}`}
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
