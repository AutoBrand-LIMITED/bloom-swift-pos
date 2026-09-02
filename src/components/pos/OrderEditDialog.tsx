import { useEffect, useState } from "react";
import { AlertCircle, CreditCard, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import OrderDestinationEditCard from "@/components/pos/OrderDestinationEditCard";
import QuarterHourTimeSelect from "@/components/pos/QuarterHourTimeSelect";
import RecipientOccasionEditor from "@/components/pos/RecipientOccasionEditor";
import {
  isValidDeliveryDate,
  isValidEmailAddress,
  isValidPhoneNumber,
} from "@/lib/checkout-validation";
import {
  normalizeDeliverySplitsForOperationalUpdate,
  operationalSplitIdentityIsUnchanged,
  validateOperationalDeliverySplits,
} from "@/lib/split-delivery";
import {
  cloneRecipientOccasions,
  normalizeRecipientOccasions,
  ownsRecipientOccasionsField,
  ownsRecipientOccasionsVersionField,
  recipientOccasionsAreUnchanged,
  recipientOccasionsStateFromSelection,
  recipientOccasionValidationError,
} from "@/lib/recipient-occasions";
import {
  getAccountingPaymentOptions,
  getDeliverySlots,
  recordOdooOrderPayment,
  updateOdooOrderSection,
  type AccountingPaymentOption,
  type DeliverySlot,
  type OrderOperationalUpdate,
  type OrderSectionUpdate,
} from "@/lib/odoo-api";
import type { OrderRecordView } from "@/lib/order-records";

export type OrderEditSection = "customer" | "delivery" | "notes" | "payment";

interface OrderEditDialogProps {
  order: OrderRecordView | null;
  section: OrderEditSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const sectionCopy: Record<OrderEditSection, { title: string; description: string }> = {
  customer: {
    title: "修改客戶與送花人",
    description: "只會顯示及修改客戶、聯絡及送花人資料。其他訂單內容不會在此畫面更改。",
  },
  delivery: {
    title: "修改收貨點與商品分配",
    description: "只可更新現有收貨點的履約及聯絡資料；收貨點數量、順序及商品分配保持唯讀。",
  },
  notes: {
    title: "修改備註及心意卡",
    description: "只會修改心意卡、送花人備註、送貨備註及內部備註。",
  },
  payment: {
    title: "補記付款",
    description: "付款會直接記錄到 Odoo Accounting，並保留收款及操作記錄。",
  },
};

const formFromOrder = (order: OrderRecordView): OrderOperationalUpdate => ({
  salesId: order.salesId || "",
  customerName: order.customerName || "",
  customerType: order.customerType || "personal",
  companyName: order.companyName || "",
  senderName: order.senderName || order.customerName || "",
  phone: order.phone || "",
  customerEmail: order.customerEmail || "",
  billingAddress: order.billingAddress || "",
  customerGroup: order.customerGroup || "",
  senderDoNumber: order.senderDoNumber || "",
  recipientDoNumber: order.recipientDoNumber || "",
  sourceReference: order.sourceReference || "",
  department: order.department || "",
  terms: order.terms || "",
  fulfillmentType: order.fulfillmentType || "delivery",
  deliveryDate: order.deliveryDate || "",
  deliveryTimeMode: order.deliveryTimeMode || "specified",
  ...(order.deliveryTimeMode === "slot" && order.deliverySlotId
    ? { deliverySlotId: order.deliverySlotId }
    : {}),
  deliveryTime: order.deliveryTime || "",
  deliveryAddress: order.deliveryAddress || "",
  deliveryGoogleAddress: order.deliveryGoogleAddress || order.deliveryAddress || "",
  deliveryBuilding: order.deliveryBuilding || "",
  deliveryFloor: order.deliveryFloor || "",
  deliveryUnit: order.deliveryUnit || "",
  deliverySplits: (order.deliverySplits || []).map((split) => ({
    ...split,
    ...(Array.isArray(split.recipientOccasions)
      ? { recipientOccasions: cloneRecipientOccasions(split.recipientOccasions) }
      : {}),
    itemAllocations: split.itemAllocations.map((allocation) => ({ ...allocation })),
  })),
  recipientType: order.recipientType || "personal",
  recipientCompanyName: order.recipientCompanyName || "",
  recipientName: order.recipientName || "",
  recipientPhone: order.recipientPhone || "",
  recipientPartnerId: order.recipientPartnerId,
  ...(ownsRecipientOccasionsField(order)
    ? {
        recipientOccasions: Array.isArray(order.recipientOccasions)
          ? cloneRecipientOccasions(order.recipientOccasions)
          : order.recipientOccasions,
      }
    : {}),
  ...(ownsRecipientOccasionsVersionField(order)
    ? { recipientOccasionsVersion: order.recipientOccasionsVersion }
    : {}),
  ...(Object.prototype.hasOwnProperty.call(order, "recipientBirthday")
    && order.recipientBirthday !== undefined
    ? { recipientBirthday: order.recipientBirthday }
    : {}),
  deliveryPerson: order.deliveryPerson || "",
  giftCardMessage: order.giftCardMessage || "",
  senderNote: order.senderNote || "",
  deliveryNote: order.deliveryNote || "",
  internalNote: order.internalNote || "",
  expectedWriteDate: order.writeDate || "",
});

const OrderEditDialog = ({
  order,
  section,
  open,
  onOpenChange,
  onSaved,
}: OrderEditDialogProps) => {
  const [form, setForm] = useState<OrderOperationalUpdate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(false);
  const [deliverySlotsError, setDeliverySlotsError] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<AccountingPaymentOption[]>([]);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReceivedAt, setPaymentReceivedAt] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    setForm(formFromOrder(order));
    setError(null);
    const outstanding = order.balanceAmount ?? Math.max(0, order.finalPrice - order.depositAmount);
    setPaymentAmount(outstanding > 0 ? outstanding.toFixed(2) : "");
    setPaymentMethod("");
    setPaymentReference("");
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    setPaymentReceivedAt(new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16));
    setPaymentKey(crypto.randomUUID());
  }, [open, order, section]);

  useEffect(() => {
    if (!open || !order || section !== "delivery") return;
    const controller = new AbortController();
    setDeliverySlotsLoading(true);
    setDeliverySlotsError(null);
    getDeliverySlots(controller.signal)
      .then((slots) => {
        if (!controller.signal.aborted) setDeliverySlots(slots);
      })
      .catch((slotError: unknown) => {
        if (controller.signal.aborted) return;
        setDeliverySlotsError(
          slotError instanceof Error ? slotError.message : "未能載入標準送貨時段",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDeliverySlotsLoading(false);
      });
    return () => controller.abort();
  }, [open, order, section]);

  useEffect(() => {
    if (!open || !order || section !== "payment" || order.paymentStatus === "paid") return;
    const controller = new AbortController();
    setPaymentOptionsLoading(true);
    getAccountingPaymentOptions(controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return;
        setPaymentOptions(options);
        setPaymentMethod((current) => current || options[0]?.code || "");
      })
      .catch((paymentError: unknown) => {
        if (!controller.signal.aborted) {
          setError(paymentError instanceof Error ? paymentError.message : "未能載入付款方式");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentOptionsLoading(false);
      });
    return () => controller.abort();
  }, [open, order, section]);

  const selectableDeliverySlots = [...deliverySlots];
  if (
    order?.deliverySlotId
    && order.deliveryTime
    && !selectableDeliverySlots.some((slot) => slot.id === order.deliverySlotId)
  ) {
    selectableDeliverySlots.unshift({
      id: order.deliverySlotId,
      displayLabel: order.deliveryTime,
      startTime: "",
      endTime: "",
    });
  }
  const setField = <K extends keyof OrderOperationalUpdate>(
    field: K,
    value: OrderOperationalUpdate[K],
  ) => {
    setForm((current) => current ? { ...current, [field]: value } : current);
  };
  const setRecipientIdentityField = <K extends keyof OrderOperationalUpdate>(
    field: K,
    value: OrderOperationalUpdate[K],
  ) => {
    setForm((current) => current ? {
      ...current,
      [field]: value,
      recipientPartnerId: undefined,
      recipientOccasionsVersion: undefined,
    } : current);
  };

  const handleSave = async () => {
    if (!order?.odooOrderId || !form || !form.expectedWriteDate) {
      setError("呢張訂單未有完整 Odoo 編輯資料，請重新整理後再試。");
      return;
    }
    if (section === "customer") {
      if (!form.customerName.trim() || !form.senderName.trim()) {
        setError("客戶名稱及送花人名稱不能留空。");
        return;
      }
      if (!isValidPhoneNumber(form.phone)) {
        setError("請輸入有效嘅下單人電話。");
        return;
      }
      if (!isValidEmailAddress(form.customerEmail)) {
        setError("請輸入有效嘅客戶電郵。");
        return;
      }
      if (form.customerType === "company" && !form.companyName.trim()) {
        setError("公司客戶必須填寫公司名稱。");
        return;
      }
    }
    if (section === "delivery") {
      if (!isValidDeliveryDate(form.deliveryDate) || !form.deliveryTime.trim()) {
        setError("請輸入有效嘅日期及時間。");
        return;
      }
      if (form.fulfillmentType === "delivery") {
        if (!form.deliveryAddress.trim() || !form.recipientName.trim()) {
          setError("送貨地址及收貨人姓名不能留空。");
          return;
        }
        if (!isValidPhoneNumber(form.recipientPhone)) {
          setError("請輸入有效嘅收貨人電話。");
          return;
        }
        if (form.recipientType === "company" && !form.recipientCompanyName.trim()) {
          setError("公司收貨人必須填寫公司名稱。");
          return;
        }
      }
    }
    if (section === "notes") {
      const noteLengthError = [
        [form.giftCardMessage, 2000, "心意卡內容"],
        [form.senderNote, 1000, "送花人備註"],
        [form.deliveryNote, 1000, "送貨備註"],
        [form.internalNote, 3000, "內部備註"],
      ].find(([value, limit]) => String(value).length > Number(limit));
      if (noteLengthError) {
        setError(`${noteLengthError[2]}不可多於 ${noteLengthError[1]} 個字。`);
        return;
      }
    }
    const primaryOccasionState = recipientOccasionsStateFromSelection(form);
    const primaryOccasionsChanged = !recipientOccasionsAreUnchanged(
      primaryOccasionState.value,
      order,
    );
    if (section === "delivery" && primaryOccasionsChanged) {
      const occasionError = recipientOccasionValidationError(
        primaryOccasionState.value,
        "主要收貨點收花人",
      );
      if (occasionError) {
        setError(occasionError);
        return;
      }
    }
    const hasCurrentOccasionsVersion = (value: string | null | undefined) => (
      typeof value === "string" && value.trim().length > 0
    );
    if (
      section === "delivery"
      && primaryOccasionsChanged
      && !hasCurrentOccasionsVersion(form.recipientOccasionsVersion)
    ) {
      setError("主要收貨點收花人重要日子已修改，但未有最新版本。請重新整理訂單，或重新選擇收花人後再試。");
      return;
    }
    for (let index = 0; section === "delivery" && index < (form.deliverySplits || []).length; index += 1) {
      const split = form.deliverySplits?.[index];
      const baseline = order.deliverySplits?.[index];
      if (!split || !baseline || split.id !== baseline.id) continue;
      const splitOccasions = recipientOccasionsStateFromSelection(split).value;
      if (
        !recipientOccasionsAreUnchanged(splitOccasions, baseline)
        && split.recipientPartnerId
        && !hasCurrentOccasionsVersion(split.recipientOccasionsVersion)
      ) {
        setError(`額外收貨點 ${index + 2} 收花人重要日子已修改，但未有最新版本。請重新整理訂單，或重新選擇收花人後再試。`);
        return;
      }
    }
    const deliverySplits = section === "delivery"
      ? normalizeDeliverySplitsForOperationalUpdate(
          form.deliverySplits || [],
          { baselineSplits: order.deliverySplits || [] },
        )
      : [];
    if (section === "delivery") {
      const splitValidationError = validateOperationalDeliverySplits(deliverySplits);
      if (splitValidationError) {
        setError(splitValidationError);
        return;
      }
      if (!operationalSplitIdentityIsUnchanged(order.deliverySplits || [], deliverySplits)) {
        setError("額外收貨點識別或商品分配已改變，請重新整理訂單後再試。");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      let update: OrderSectionUpdate;
      if (section === "customer") {
        update = {
          section,
          data: {
            customerName: form.customerName,
            customerType: form.customerType,
            companyName: form.companyName,
            senderName: form.senderName,
            phone: form.phone,
            customerEmail: form.customerEmail,
            billingAddress: form.billingAddress,
            expectedWriteDate: form.expectedWriteDate,
          },
        };
      } else if (section === "notes") {
        update = {
          section,
          data: {
            giftCardMessage: form.giftCardMessage,
            senderNote: form.senderNote,
            deliveryNote: form.deliveryNote,
            internalNote: form.internalNote,
            expectedWriteDate: form.expectedWriteDate,
          },
        };
      } else if (section === "delivery") {
        update = {
          section: "delivery",
          data: {
            fulfillmentType: form.fulfillmentType,
            deliveryDate: form.deliveryDate,
            deliveryTimeMode: form.deliveryTimeMode,
            deliverySlotId: form.deliverySlotId,
            deliveryTime: form.deliveryTime,
            deliveryAddress: form.deliveryAddress,
            deliveryGoogleAddress: form.deliveryGoogleAddress,
            deliveryBuilding: form.deliveryBuilding,
            deliveryFloor: form.deliveryFloor,
            deliveryUnit: form.deliveryUnit,
            deliverySplits,
            recipientType: form.recipientType,
            recipientCompanyName: form.recipientCompanyName,
            recipientName: form.recipientName,
            recipientPhone: form.recipientPhone,
            ...(form.recipientPartnerId !== undefined
              ? { recipientPartnerId: form.recipientPartnerId }
              : {}),
            ...(primaryOccasionsChanged
              ? {
                  recipientOccasions: normalizeRecipientOccasions(primaryOccasionState.value),
                  ...(hasCurrentOccasionsVersion(form.recipientOccasionsVersion)
                    ? { recipientOccasionsVersion: form.recipientOccasionsVersion }
                    : {}),
                }
              : {}),
            deliveryPerson: form.deliveryPerson,
            expectedWriteDate: form.expectedWriteDate,
          },
        };
      } else {
        throw new Error("付款資料必須使用獨立收款流程。");
      }
      await updateOdooOrderSection(order.odooOrderId, update);
      toast.success("訂單資料已更新到 Odoo");
      onOpenChange(false);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "未能更新 Odoo 訂單");
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!order?.odooOrderId) {
      setError("呢張訂單未有 Odoo 訂單編號，未能記錄付款。");
      return;
    }
    const amount = Number(paymentAmount);
    const outstanding = order.balanceAmount ?? Math.max(0, order.finalPrice - order.depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("請輸入大於零嘅收款金額。");
      return;
    }
    if (amount > outstanding + 0.005) {
      setError(`收款金額不可高於尚欠金額 HK$${outstanding.toFixed(2)}。`);
      return;
    }
    if (!paymentMethod || !paymentReference.trim() || !paymentReceivedAt) {
      setError("請選擇付款方式，並填寫付款參考編號及收款時間。");
      return;
    }
    if (paymentReference.trim().length > 120) {
      setError("付款參考編號不可多於 120 個字。");
      return;
    }
    const parsedPaymentReceivedAt = new Date(paymentReceivedAt);
    if (!Number.isFinite(parsedPaymentReceivedAt.getTime())) {
      setError("請輸入有效嘅收款日期及時間。");
      return;
    }

    setRecordingPayment(true);
    setError(null);
    try {
      const result = await recordOdooOrderPayment(order.odooOrderId, {
        amount,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        paymentReceivedAt: parsedPaymentReceivedAt.toISOString(),
        paymentIdempotencyKey: paymentKey || crypto.randomUUID(),
      });
      toast.success(
        result.paymentStatus === "paid"
          ? `已完成收款：${result.payment.name}`
          : `已記錄部分付款：${result.payment.name}`,
      );
      onOpenChange(false);
      onSaved();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "未能記錄 Odoo 付款");
    } finally {
      setRecordingPayment(false);
    }
  };

  const splitIdentityUnchanged = Boolean(
    order
    && form
    && operationalSplitIdentityIsUnchanged(order.deliverySplits || [], form.deliverySplits || []),
  );
  const activeSectionCopy = sectionCopy[section];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && !recordingPayment && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[92dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>{activeSectionCopy.title} {order?.odooOrderName || ""}</DialogTitle>
          <DialogDescription>{activeSectionCopy.description}</DialogDescription>
        </DialogHeader>

        {form && (
          <ScrollArea className="max-h-[calc(92dvh-11rem)] min-h-0" data-testid="order-edit-scroll-area">
            <div className="space-y-5 p-5">
              {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {section === "customer" && (
              <section className="space-y-3" aria-label="客戶資料">
                <h3 className="text-sm font-semibold">客戶資料</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="下單人／客戶名稱 *" value={form.customerName} onChange={(value) => setField("customerName", value)} />
                  <Field label="下單人電話 *" value={form.phone} onChange={(value) => setField("phone", value)} />
                  <Field label="送花人名稱 *" value={form.senderName} onChange={(value) => setField("senderName", value)} />
                  <Field label="客戶電郵" value={form.customerEmail} onChange={(value) => setField("customerEmail", value)} type="email" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>客戶類型 *</Label>
                    <Select
                      value={form.customerType}
                      onValueChange={(value: "personal" | "company") => {
                        setForm((current) => current ? {
                          ...current,
                          customerType: value,
                          companyName: value === "personal" ? "" : current.companyName,
                        } : current);
                      }}
                    >
                      <SelectTrigger aria-label="客戶類型 *" className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">個人</SelectItem>
                        <SelectItem value="company">公司</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.customerType === "company" && (
                    <Field label="公司名稱 *" value={form.companyName} onChange={(value) => setField("companyName", value)} />
                  )}
                </div>
                <TextField label="帳單地址" value={form.billingAddress} onChange={(value) => setField("billingAddress", value)} />
              </section>
              )}

              {section === "delivery" && (<>
              <section className="space-y-3" aria-label="收貨點 1">
                <h3 className="text-sm font-semibold">收貨點 1（主要收貨點）</h3>
                <div className="space-y-1.5">
                  <Label>收貨方式 *</Label>
                  <Select
                    value={form.fulfillmentType}
                    onValueChange={(value: "delivery" | "pickup") => setField("fulfillmentType", value)}
                  >
                    <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery">送貨</SelectItem>
                      <SelectItem value="pickup">自取</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="送貨日期 *" value={form.deliveryDate} onChange={(value) => setField("deliveryDate", value)} type="date" />
                  <div className="space-y-1.5">
                    <Label>送貨時間模式 *</Label>
                    <Select
                      value={form.deliveryTimeMode}
                      onValueChange={(value: "slot" | "specified") => {
                        if (value === "slot") {
                          const selectedSlot = selectableDeliverySlots.find(
                            (slot) => slot.id === form.deliverySlotId,
                          ) || selectableDeliverySlots[0];
                          if (!selectedSlot) return;
                          setForm((current) => current ? {
                            ...current,
                            deliveryTimeMode: "slot",
                            deliverySlotId: selectedSlot.id,
                            deliveryTime: selectedSlot.displayLabel,
                          } : current);
                          return;
                        }
                        setForm((current) => current ? {
                          ...current,
                          deliveryTimeMode: "specified",
                          deliverySlotId: undefined,
                        } : current);
                      }}
                    >
                      <SelectTrigger aria-label="送貨時間模式 *" className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slot" disabled={selectableDeliverySlots.length === 0}>標準時段</SelectItem>
                        <SelectItem value="specified">指定時間</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.deliveryTimeMode === "slot" ? (
                    <div className="space-y-1.5">
                      <Label>標準送貨時段 *</Label>
                      <Select
                        value={form.deliverySlotId ? String(form.deliverySlotId) : undefined}
                        onValueChange={(value) => {
                          const selectedSlot = selectableDeliverySlots.find(
                            (slot) => slot.id === Number(value),
                          );
                          if (!selectedSlot) return;
                          setForm((current) => current ? {
                            ...current,
                            deliverySlotId: selectedSlot.id,
                            deliveryTime: selectedSlot.displayLabel,
                          } : current);
                        }}
                      >
                        <SelectTrigger aria-label="標準送貨時段 *" className="min-h-11">
                          <SelectValue placeholder={deliverySlotsLoading ? "載入時段中..." : "選擇送貨時段"} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableDeliverySlots.map((slot) => (
                            <SelectItem key={slot.id} value={String(slot.id)}>
                              {slot.displayLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {deliverySlotsError && (
                        <p role="status" className="text-xs text-destructive">
                          未能更新時段清單；仍可保留原有時段或改用指定時間。
                        </p>
                      )}
                    </div>
                  ) : (
                    <QuarterHourTimeSelect
                      id="order-edit-specified-delivery-time"
                      label="指定送貨時間 *"
                      value={form.deliveryTime}
                      onChange={(value) => setField("deliveryTime", value)}
                    />
                  )}
                  {form.fulfillmentType === "delivery" && (
                    <Field label="負責送貨同事" value={form.deliveryPerson} onChange={(value) => setField("deliveryPerson", value)} />
                  )}
                </div>
                {form.fulfillmentType === "delivery" && <>
                <TextField label="送貨地址 *" value={form.deliveryAddress} onChange={(value) => setField("deliveryAddress", value)} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="大廈／座" value={form.deliveryBuilding} onChange={(value) => setField("deliveryBuilding", value)} />
                  <Field label="樓層" value={form.deliveryFloor} onChange={(value) => setField("deliveryFloor", value)} />
                  <Field label="室／單位" value={form.deliveryUnit} onChange={(value) => setField("deliveryUnit", value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>收貨人類型 *</Label>
                    <Select
                      value={form.recipientType}
                      onValueChange={(value: "personal" | "company") => {
                        setForm((current) => current ? {
                          ...current,
                          recipientType: value,
                          recipientCompanyName: value === "personal" ? "" : current.recipientCompanyName,
                          recipientPartnerId: undefined,
                          recipientOccasionsVersion: undefined,
                        } : current);
                      }}
                    >
                      <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">個人</SelectItem>
                        <SelectItem value="company">公司</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.recipientType === "company" && (
                    <Field label="收貨公司名稱 *" value={form.recipientCompanyName} onChange={(value) => setRecipientIdentityField("recipientCompanyName", value)} />
                  )}
                  <Field label="收貨人／聯絡人姓名 *" value={form.recipientName} onChange={(value) => setRecipientIdentityField("recipientName", value)} />
                  <Field label="收貨人電話 *" value={form.recipientPhone} onChange={(value) => setRecipientIdentityField("recipientPhone", value)} />
                </div>
                <RecipientOccasionEditor
                  label="主要收貨點收花人重要日子"
                  occasions={recipientOccasionsStateFromSelection(form).value}
                  deliveryDate={form.deliveryDate}
                  onChange={(recipientOccasions) => {
                    setForm((current) => {
                      if (!current) return current;
                      const next = { ...current, recipientOccasions };
                      delete next.recipientBirthday;
                      return next;
                    });
                  }}
                />
                </>}
              </section>

              {form.deliverySplits && form.deliverySplits.length > 0 && (
                <section className="space-y-3 border-t pt-5" aria-label="額外收貨點">
                  <div>
                    <h3 className="text-sm font-semibold">其餘收貨點</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      只可更新現有收貨點的履約及聯絡資料；數量、順序及商品分配不會改變。
                    </p>
                  </div>
                  {form.deliverySplits.map((split, index) => (
                    <OrderDestinationEditCard
                      key={split.id}
                      index={index}
                      split={split}
                      deliverySlots={deliverySlots}
                      onChange={(updated) => {
                        setForm((current) => current ? {
                          ...current,
                          deliverySplits: (current.deliverySplits || []).map((entry, entryIndex) => (
                            entryIndex === index ? updated : entry
                          )),
                        } : current);
                      }}
                    />
                  ))}
                  {!splitIdentityUnchanged && (
                    <p role="alert" className="text-xs text-destructive">
                      收貨點識別或商品分配已改變，儲存已停用。
                    </p>
                  )}
                </section>
              )}
              </>)}

              {section === "payment" && order && order.paymentStatus !== "paid" && (
                <section className="space-y-3" aria-label="補記付款">
                  <div>
                    <h3 className="text-sm font-semibold">補記付款</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      尚欠 HK${(order.balanceAmount ?? Math.max(0, order.finalPrice - order.depositAmount)).toFixed(2)}。付款會直接入 Odoo Accounting，並保留收款紀錄。
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="本次收款金額 *" value={paymentAmount} onChange={setPaymentAmount} type="number" />
                    <div className="space-y-1.5">
                      <Label>付款方式 *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={paymentOptionsLoading}>
                        <SelectTrigger aria-label="付款方式 *" className="min-h-11">
                          <SelectValue placeholder={paymentOptionsLoading ? "載入中..." : "選擇付款方式"} />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentOptions.map((option) => (
                            <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Field label="付款參考編號 *" value={paymentReference} onChange={setPaymentReference} />
                    <Field label="收款日期及時間 *" value={paymentReceivedAt} onChange={setPaymentReceivedAt} type="datetime-local" />
                  </div>
                </section>
              )}

              {section === "payment" && order?.paymentStatus === "paid" && (
                <p className="text-sm text-muted-foreground">呢張訂單已完成付款，毋須再補記付款。</p>
              )}

              {section === "notes" && (
              <section className="space-y-3" aria-label="備註資料">
                <h3 className="text-sm font-semibold">備註及心意卡</h3>
                <TextField label="心意卡內容" value={form.giftCardMessage} onChange={(value) => setField("giftCardMessage", value)} />
                <TextField label="送花人備註" value={form.senderNote} onChange={(value) => setField("senderNote", value)} />
                <TextField label="送貨備註" value={form.deliveryNote} onChange={(value) => setField("deliveryNote", value)} />
                <TextField label="內部備註" value={form.internalNote} onChange={(value) => setField("internalNote", value)} />
              </section>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || recordingPayment}>
            取消
          </Button>
          {section === "payment" ? (
            order?.paymentStatus !== "paid" && (
              <Button
                type="button"
                onClick={handleRecordPayment}
                disabled={recordingPayment || saving || paymentOptionsLoading}
                className="min-h-11 gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {recordingPayment ? "入帳中..." : "記錄付款到 Odoo"}
              </Button>
            )
          ) : (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || recordingPayment || !form || (section === "delivery" && !splitIdentityUnchanged)}
              className="min-h-11 gap-2"
            >
              <Save className="h-4 w-4" /> {saving ? "儲存中..." : "儲存到 Odoo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input
      aria-label={label}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11"
    />
  </div>
);

const TextField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Textarea
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-20"
    />
  </div>
);

export default OrderEditDialog;
