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

const Index = () => {
  const navigate = useNavigate();

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
    paymentStatus !== "unpaid" || finalPrice === 0,
  ].filter(Boolean).length, [salesId, phone, customerName, items, deliveries, giftCardEnabled, giftCardMessage, paymentStatus, finalPrice]);

  const blockingReason = !salesId ? "請先選擇員工" :
    !phone.trim() ? "請輸入客戶電話" :
    !customerName.trim() ? "請輸入客戶姓名" :
    items.length === 0 ? "請加入訂單項目" : null;

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
      toast.error("請先選擇負責員工");
      return;
    }

    if (!phone.trim()) {
      setPhoneError(true);
      toast.error("請輸入客戶電話號碼");
      return;
    }
    setPhoneError(false);

    if (items.length === 0) {
      toast.error("請至少加入一個項目");
      return;
    }

    if (finalPrice === 0) {
      toast.warning("價格為 $0，訂單仍會建立");
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
      toast.warning("訂單已建立 — 未付款，請跟進！", { duration: 5000 });
    } else if (paymentStatus === "deposit") {
      toast.info(`訂單已建立 — 已收訂金 $${depositAmount}，尚欠 $${finalPrice - depositAmount}`);
    } else {
      toast.success("訂單已建立 ✓");
    }

    toast("列印單據", {
      duration: 15000,
      description: "選擇要列印嘅單據：",
      action: {
        label: "收據",
        onClick: () => printDocument(generateReceipt(order)),
      },
      cancel: {
        label: "全部列印",
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
              <Truck className="w-3.5 h-3.5" /> 調度
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/report")} className="gap-1.5 text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> 報告
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
              <RotateCcw className="w-3.5 h-3.5" /> 清空
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1.5 text-xs relative"
            >
              <ClipboardList className="w-3.5 h-3.5" /> 訂單記錄
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
              toast.success("已套用過往送貨地址");
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
              請先選擇負責員工，再開始輸入訂單
            </div>
          )}

          {/* Persistent notes alert */}
          {showPersistentNote && (
            <div className="relative flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-xs uppercase tracking-wide mb-1">客戶持續備註</p>
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
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">總計</p>
              <p className="text-2xl font-bold font-mono tracking-tight">${finalPrice.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5,6].map((n) => (
                <div
                  key={n}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    n <= stepsDone ? "bg-primary" : "bg-muted-foreground/25"
                  }`}
                />
              ))}
              <span className="ml-1.5 text-xs text-muted-foreground">{stepsDone}/6</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {blockingReason && (
              <p className="text-[11px] text-destructive font-medium">{blockingReason}</p>
            )}
            <Button
              onClick={handleSubmit}
              size="lg"
              className="px-8 text-base font-semibold shadow-lg"
              disabled={!!blockingReason}
            >
              確認訂單
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
