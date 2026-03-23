import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Flower2, ClipboardList, RotateCcw, Printer } from "lucide-react";
import { generateReceipt, generateDeliveryNote, generatePickingList, printDocument } from "@/lib/print-utils";
import CustomerSection from "@/components/pos/CustomerSection";
import OrderItemsSection from "@/components/pos/OrderItemsSection";
import DeliverySection from "@/components/pos/DeliverySection";
import GiftCardSection from "@/components/pos/GiftCardSection";
import PaymentSection from "@/components/pos/PaymentSection";
import AddOnsSection from "@/components/pos/AddOnsSection";
import OrderHistory from "@/components/pos/OrderHistory";
import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { Order, OrderItem, PaymentStatus } from "@/types/order";
import { DEMO_CUSTOMERS, type DemoCustomer } from "@/data/demo-customers";

const STORAGE_KEY = "florist-pos-orders";

function loadOrders(): Order[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

const Index = () => {
  // Customer
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState<"personal" | "company">("personal");
  const [companyName, setCompanyName] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DemoCustomer | null>(null);

  // Items
  const [budget, setBudget] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [urgentFee, setUrgentFee] = useState(0);
  const [notes, setNotes] = useState("");

  // Delivery
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryDetail, setDeliveryDetail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [failedDeliveryAction, setFailedDeliveryAction] = useState("none");

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

  const resetForm = useCallback(() => {
    setPhone("");
    setCustomerName("");
    setCustomerType("personal");
    setCompanyName("");
    setPhoneError(false);
    setSelectedCustomer(null);
    setItems([]);
    setBudget(0);
    setDeliveryFee(0);
    setUrgentFee(0);
    setNotes("");
    setDeliveryDate("");
    setDeliveryTime("");
    setDeliveryRegion("");
    setDeliveryDistrict("");
    setDeliveryArea("");
    setDeliveryDetail("");
    setRecipientName("");
    setRecipientPhone("");
    setDeliveryPerson("");
    setFailedDeliveryAction("none");
    setGiftCardEnabled(false);
    setGiftCardMessage("");
    setPaymentStatus("unpaid");
    setDepositAmount(0);
    setPaymentMethod("");
    setFollowUpDate(undefined);
    setReminderOption("none");
    setPriceOverridden(false);
    setManualPrice(null);
  }, []);

  const handleSubmit = () => {
    // Validation
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
      id: crypto.randomUUID(),
      customerName: customerName.trim(),
      phone: phone.trim(),
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
      deliveryDate,
      deliveryTime,
      deliveryAddress: [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail.trim()].filter(Boolean).join(" "),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      deliveryPerson: deliveryPerson.trim(),
      giftCardEnabled,
      giftCardMessage: giftCardEnabled ? giftCardMessage.trim() : "",
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...orders, order];
    setOrders(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (paymentStatus === "unpaid") {
      toast.warning("訂單已建立 — 未付款，請跟進！", { duration: 5000 });
    } else if (paymentStatus === "deposit") {
      toast.info(`訂單已建立 — 已收訂金 $${depositAmount}，尚欠 $${finalPrice - depositAmount}`);
    } else {
      toast.success("訂單已建立 ✓");
    }

    // Show print dialog
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flower2 className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">花店 POS</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm} className="gap-1.5 text-xs">
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
          />
        )}

        {/* Main form */}
        <main className="flex-1 max-w-3xl mx-auto px-4 py-5 space-y-4 pb-28">
        <CustomerSection
          phone={phone}
          customerName={customerName}
          onPhoneChange={(v) => { setPhone(v); if (v.trim()) setPhoneError(false); }}
          onNameChange={setCustomerName}
          onCustomerSelect={(c) => {
            setSelectedCustomer(c);
            setCustomerName(c.name);
            setPhone(c.phone);
            setPhoneError(false);
          }}
          phoneError={phoneError}
          selectedCustomer={selectedCustomer}
        />

        <OrderItemsSection
          items={items}
          onItemsChange={setItems}
          deliveryFee={deliveryFee}
          urgentFee={urgentFee}
          onDeliveryFeeChange={setDeliveryFee}
          onUrgentFeeChange={setUrgentFee}
          notes={notes}
          onNotesChange={setNotes}
          budget={budget}
          onBudgetChange={setBudget}
          subtotal={subtotal}
        />

        <DeliverySection
          deliveryDate={deliveryDate}
          deliveryTime={deliveryTime}
          deliveryRegion={deliveryRegion}
          deliveryDistrict={deliveryDistrict}
          deliveryArea={deliveryArea}
          deliveryDetail={deliveryDetail}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          deliveryPerson={deliveryPerson}
          onDateChange={setDeliveryDate}
          onTimeChange={setDeliveryTime}
          onRegionChange={setDeliveryRegion}
          onDistrictChange={setDeliveryDistrict}
          onAreaChange={setDeliveryArea}
          onDetailChange={setDeliveryDetail}
          onRecipientNameChange={setRecipientName}
          onRecipientPhoneChange={setRecipientPhone}
          onDeliveryPersonChange={setDeliveryPerson}
        />

        <GiftCardSection
          enabled={giftCardEnabled}
          message={giftCardMessage}
          onEnabledChange={setGiftCardEnabled}
          onMessageChange={setGiftCardMessage}
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
          <div className="text-right">
            <p className="text-xs text-muted-foreground">總計</p>
            <p className="text-2xl font-bold font-mono tracking-tight">${finalPrice.toLocaleString()}</p>
          </div>
          <Button
            onClick={handleSubmit}
            size="lg"
            className="px-8 text-base font-semibold shadow-lg"
          >
            確認訂單
          </Button>
        </div>
      </div>

      {/* Order history drawer */}
      <OrderHistory orders={orders} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
};

export default Index;
