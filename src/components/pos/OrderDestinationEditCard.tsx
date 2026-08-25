import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
import type { DeliverySlot } from "@/lib/odoo-api";
import type { DeliverySplit } from "@/types/order";

interface OrderDestinationEditCardProps {
  index: number;
  split: DeliverySplit;
  deliverySlots: readonly DeliverySlot[];
  onChange: (split: DeliverySplit) => void;
}

const OrderDestinationEditCard = ({
  index,
  split,
  deliverySlots,
  onChange,
}: OrderDestinationEditCardProps) => {
  const title = `額外收貨點 ${index + 2}`;
  const fulfillmentType = split.fulfillmentType || "delivery";
  const selectableSlots = [...deliverySlots];
  if (
    split.deliverySlotId
    && split.deliveryTime
    && !selectableSlots.some((slot) => slot.id === split.deliverySlotId)
  ) {
    selectableSlots.unshift({
      id: split.deliverySlotId,
      displayLabel: split.deliveryTime,
      startTime: "",
      endTime: "",
    });
  }
  const setField = <K extends keyof DeliverySplit>(field: K, value: DeliverySplit[K]) => {
    onChange({ ...split, [field]: value });
  };
  const changeFulfillmentType = (value: "delivery" | "pickup") => {
    onChange({
      ...split,
      fulfillmentType: value,
      deliveryRegion: "",
      deliveryDistrict: "",
      deliveryArea: "",
      deliveryDetail: "",
      deliveryAddress: value === "pickup" ? PICKUP_LOCATION_ADDRESS : "",
      deliveryGoogleAddress: "",
      deliveryBuilding: "",
      deliveryFloor: "",
      deliveryUnit: "",
      recipientType: "personal",
      recipientCompanyName: "",
      recipientName: "",
      recipientPhone: "",
      deliveryPerson: "",
      failedDeliveryAction: "none",
      deliveryNote: "",
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/10 p-4" aria-label={title}>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">
          可更新這個收貨點的聯絡及履約資料；商品分配只讀。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{title} 收貨方式 *</Label>
          <Select
            value={fulfillmentType}
            onValueChange={changeFulfillmentType}
          >
            <SelectTrigger aria-label={`${title} 收貨方式 *`} className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="delivery">送貨</SelectItem>
              <SelectItem value="pickup">自取</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field
          label={`${title} ${fulfillmentType === "pickup" ? "取貨" : "送貨"}日期 *`}
          value={split.deliveryDate}
          type="date"
          onChange={(value) => setField("deliveryDate", value)}
        />
        <div className="space-y-1.5">
          <Label>{title} 時間模式 *</Label>
          <Select
            value={split.deliveryTimeMode || "specified"}
            onValueChange={(value: "slot" | "specified") => {
              if (value === "slot") {
                const selected = selectableSlots.find((slot) => slot.id === split.deliverySlotId)
                  || selectableSlots[0];
                if (!selected) return;
                onChange({
                  ...split,
                  deliveryTimeMode: "slot",
                  deliverySlotId: selected.id,
                  deliveryTime: selected.displayLabel,
                });
                return;
              }
              onChange({ ...split, deliveryTimeMode: "specified", deliverySlotId: undefined });
            }}
          >
            <SelectTrigger aria-label={`${title} 時間模式 *`} className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="slot" disabled={selectableSlots.length === 0}>標準時段</SelectItem>
              <SelectItem value="specified">指定時間</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {split.deliveryTimeMode === "slot" ? (
          <div className="space-y-1.5">
            <Label>{title} 標準時段 *</Label>
            <Select
              value={split.deliverySlotId ? String(split.deliverySlotId) : undefined}
              onValueChange={(value) => {
                const slot = selectableSlots.find((candidate) => candidate.id === Number(value));
                if (slot) onChange({ ...split, deliverySlotId: slot.id, deliveryTime: slot.displayLabel });
              }}
            >
              <SelectTrigger aria-label={`${title} 標準時段 *`} className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectableSlots.map((slot) => (
                  <SelectItem key={slot.id} value={String(slot.id)}>{slot.displayLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Field
            label={`${title} 指定時間 *`}
            value={split.deliveryTime}
            onChange={(value) => setField("deliveryTime", value)}
          />
        )}
      </div>

      <TextField
        label={`${title} ${fulfillmentType === "pickup" ? "自取地點" : "送貨地址 *"}`}
        value={split.deliveryAddress}
        onChange={(value) => setField("deliveryAddress", value)}
      />
      {fulfillmentType === "delivery" && (
        <details className="rounded-lg border p-3">
          <summary className="min-h-8 cursor-pointer text-xs font-semibold">地址結構資料</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={`${title} 地區`} value={split.deliveryRegion} onChange={(value) => setField("deliveryRegion", value)} />
            <Field label={`${title} 分區`} value={split.deliveryDistrict} onChange={(value) => setField("deliveryDistrict", value)} />
            <Field label={`${title} 地點`} value={split.deliveryArea} onChange={(value) => setField("deliveryArea", value)} />
            <Field label={`${title} Google 地址`} value={split.deliveryGoogleAddress} onChange={(value) => setField("deliveryGoogleAddress", value)} />
            <Field label={`${title} 大廈／座`} value={split.deliveryBuilding} onChange={(value) => setField("deliveryBuilding", value)} />
            <Field label={`${title} 樓層`} value={split.deliveryFloor} onChange={(value) => setField("deliveryFloor", value)} />
            <Field label={`${title} 室／單位`} value={split.deliveryUnit} onChange={(value) => setField("deliveryUnit", value)} />
          </div>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{title} 收貨人類型</Label>
          <Select
            value={split.recipientType}
            onValueChange={(value: "personal" | "company") => onChange({
              ...split,
              recipientType: value,
              recipientCompanyName: value === "personal" ? "" : split.recipientCompanyName,
            })}
          >
            <SelectTrigger aria-label={`${title} 收貨人類型`} className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">個人</SelectItem>
              <SelectItem value="company">公司</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {split.recipientType === "company" && (
          <Field label={`${title} 收貨公司名稱 *`} value={split.recipientCompanyName} onChange={(value) => setField("recipientCompanyName", value)} />
        )}
        <Field label={`${title} 收貨人／聯絡人`} value={split.recipientName} onChange={(value) => setField("recipientName", value)} />
        <Field label={`${title} 聯絡電話`} value={split.recipientPhone} onChange={(value) => setField("recipientPhone", value)} />
        <Field label={`${title} 負責送貨同事`} value={split.deliveryPerson} onChange={(value) => setField("deliveryPerson", value)} />
      </div>
      <TextField label={`${title} 送貨備註`} value={split.deliveryNote} onChange={(value) => setField("deliveryNote", value)} />

      <div className="rounded-lg border bg-background p-3">
        <p className="text-xs font-semibold">商品分配（只讀）</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {split.itemAllocations.map((allocation) => (
            <li key={`${allocation.itemId}-${allocation.itemName}`}>
              {allocation.itemName} × {allocation.quantity}
            </li>
          ))}
        </ul>
      </div>
    </section>
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

export default OrderDestinationEditCard;
