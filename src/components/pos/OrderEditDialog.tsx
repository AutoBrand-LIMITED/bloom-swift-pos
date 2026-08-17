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
import { isValidPhoneNumber } from "@/lib/checkout-validation";
import {
  getAccountingPaymentOptions,
  getDeliverySlots,
  recordOdooOrderPayment,
  updateOdooOrderOperationalDetails,
  type AccountingPaymentOption,
  type DeliverySlot,
  type OrderOperationalUpdate,
} from "@/lib/odoo-api";
import type { OrderRecordView } from "@/lib/order-records";

interface OrderEditDialogProps {
  order: OrderRecordView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const formFromOrder = (order: OrderRecordView): OrderOperationalUpdate => ({
  customerName: order.customerName || "",
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
  recipientType: order.recipientType || "personal",
  recipientCompanyName: order.recipientCompanyName || "",
  recipientName: order.recipientName || "",
  recipientPhone: order.recipientPhone || "",
  deliveryPerson: order.deliveryPerson || "",
  giftCardMessage: order.giftCardMessage || "",
  senderNote: order.senderNote || "",
  deliveryNote: order.deliveryNote || "",
  internalNote: order.internalNote || "",
  expectedWriteDate: order.writeDate || "",
});

const OrderEditDialog = ({ order, open, onOpenChange, onSaved }: OrderEditDialogProps) => {
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
    setPaymentReference("");
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;
    setPaymentReceivedAt(new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16));
    setPaymentKey(crypto.randomUUID());
  }, [open, order]);

  useEffect(() => {
    if (!open || !order) return;
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
  }, [open, order]);

  useEffect(() => {
    if (!open || !order || order.paymentStatus === "paid") return;
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
  }, [open, order]);

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

  const handleSave = async () => {
    if (!order?.odooOrderId || !form || !form.expectedWriteDate) {
      setError("呢張訂單未有完整 Odoo 編輯資料，請重新整理後再試。");
      return;
    }
    if (!form.customerName.trim() || !form.senderName.trim()) {
      setError("客戶名稱及送花人名稱不能留空。");
      return;
    }
    if (!isValidPhoneNumber(form.phone)) {
      setError("請輸入有效嘅下單人電話。");
      return;
    }
    if (!form.deliveryDate || !form.deliveryTime.trim()) {
      setError("日期及時間不能留空。");
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

    setSaving(true);
    setError(null);
    try {
      await updateOdooOrderOperationalDetails(order.odooOrderId, form);
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

    setRecordingPayment(true);
    setError(null);
    try {
      const result = await recordOdooOrderPayment(order.odooOrderId, {
        amount,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        paymentReceivedAt: new Date(paymentReceivedAt).toISOString(),
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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && !recordingPayment && onOpenChange(nextOpen)}>
      <DialogContent className="h-[92dvh] max-h-[92dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>編輯訂單 {order?.odooOrderName || ""}</DialogTitle>
          <DialogDescription>
            更新客戶、收貨及送貨資料；未付及訂金訂單亦可在下方補記付款。產品及價錢請使用 Odoo 更正流程。
          </DialogDescription>
        </DialogHeader>

        {form && (
          <ScrollArea className="h-full min-h-0" data-testid="order-edit-scroll-area">
            <div className="space-y-5 p-5">
              {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <section className="space-y-3" aria-label="客戶資料">
                <h3 className="text-sm font-semibold">客戶資料</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="下單人／客戶名稱 *" value={form.customerName} onChange={(value) => setField("customerName", value)} />
                  <Field label="下單人電話 *" value={form.phone} onChange={(value) => setField("phone", value)} />
                  <Field label="送花人名稱 *" value={form.senderName} onChange={(value) => setField("senderName", value)} />
                  <Field label="客戶電郵" value={form.customerEmail} onChange={(value) => setField("customerEmail", value)} type="email" />
                </div>
                <TextField label="帳單地址" value={form.billingAddress} onChange={(value) => setField("billingAddress", value)} />
              </section>

              <section className="space-y-3 border-t pt-5" aria-label="送貨資料">
                <h3 className="text-sm font-semibold">送貨及收貨人資料</h3>
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
                    <Field
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
                    <Field label="收貨公司名稱 *" value={form.recipientCompanyName} onChange={(value) => setField("recipientCompanyName", value)} />
                  )}
                  <Field label="收貨人／聯絡人姓名 *" value={form.recipientName} onChange={(value) => setField("recipientName", value)} />
                  <Field label="收貨人電話 *" value={form.recipientPhone} onChange={(value) => setField("recipientPhone", value)} />
                </div>
                </>}
              </section>

              <details className="rounded-lg border p-3">
                <summary className="min-h-8 cursor-pointer text-sm font-semibold">其他業務資料</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="客戶群組" value={form.customerGroup} onChange={(value) => setField("customerGroup", value)} />
                  <Field label="部門" value={form.department} onChange={(value) => setField("department", value)} />
                </div>
              </details>

              {order && order.paymentStatus !== "paid" && (
                <section className="space-y-3 border-t pt-5" aria-label="補記付款">
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRecordPayment}
                    disabled={recordingPayment || saving || paymentOptionsLoading}
                    className="min-h-11 gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    {recordingPayment ? "入帳中..." : "記錄付款到 Odoo"}
                  </Button>
                </section>
              )}

              <section className="space-y-3 border-t pt-5" aria-label="備註資料">
                <h3 className="text-sm font-semibold">備註及心意卡</h3>
                <TextField label="心意卡內容" value={form.giftCardMessage} onChange={(value) => setField("giftCardMessage", value)} />
                <TextField label="送花人備註" value={form.senderNote} onChange={(value) => setField("senderNote", value)} />
                <TextField label="送貨備註" value={form.deliveryNote} onChange={(value) => setField("deliveryNote", value)} />
                <TextField label="內部備註" value={form.internalNote} onChange={(value) => setField("internalNote", value)} />
              </section>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || recordingPayment}>
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || recordingPayment || !form} className="min-h-11 gap-2">
            <Save className="h-4 w-4" /> {saving ? "儲存中..." : "儲存到 Odoo"}
          </Button>
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
