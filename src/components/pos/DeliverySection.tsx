import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, User, UserCheck, AlertCircle, Plus, X } from "lucide-react";
import StepBadge from "@/components/pos/StepBadge";
import type { Delivery } from "@/types/order";
import { DRIVERS } from "@/types/order";

const HK_DISTRICTS: Record<string, Record<string, string[]>> = {
  "香港島": {
    "中西區": ["中環", "上環", "西營盤", "堅尼地城", "山頂", "半山"],
    "灣仔區": ["灣仔", "銅鑼灣", "跑馬地", "大坑", "天后"],
    "東區": ["北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣"],
    "南區": ["香港仔", "鴨脷洲", "黃竹坑", "淺水灣", "赤柱"],
  },
  "九龍": {
    "油尖旺區": ["尖沙咀", "佐敦", "油麻地", "旺角", "太子", "大角咀"],
    "深水埗區": ["深水埗", "長沙灣", "荔枝角", "石硤尾", "又一村"],
    "九龍城區": ["紅磡", "土瓜灣", "九龍城", "何文田", "九龍塘"],
    "黃大仙區": ["黃大仙", "鑽石山", "慈雲山", "彩虹", "新蒲崗"],
    "觀塘區": ["觀塘", "牛頭角", "九龍灣", "藍田", "秀茂坪", "油塘"],
  },
  "新界": {
    "荃灣區": ["荃灣", "深井", "青龍頭", "馬灣"],
    "葵青區": ["葵芳", "葵涌", "青衣"],
    "屯門區": ["屯門市中心", "屯門碼頭", "蝴蝶邨", "三聖"],
    "元朗區": ["元朗", "天水圍", "錦田", "流浮山"],
    "北區": ["上水", "粉嶺", "沙頭角", "古洞"],
    "大埔區": ["大埔", "大埔墟", "太和", "大美督"],
    "沙田區": ["沙田", "火炭", "大圍", "馬鞍山", "石門"],
    "西貢區": ["將軍澳", "坑口", "寶琳", "西貢市中心", "清水灣"],
  },
  "離島": {
    "離島區": ["東涌", "大嶼山", "長洲", "南丫島", "愉景灣", "機場"],
  },
};

const DELIVERY_SLOTS = [
  { value: "上午 (9–1pm)", label: "上午", sublabel: "9am – 1pm" },
  { value: "下午 (1–6pm)", label: "下午", sublabel: "1pm – 6pm" },
  { value: "指定時間", label: "指定時間", sublabel: "+ 附加費" },
];

export function newDelivery(): Delivery {
  return {
    id: crypto.randomUUID(),
    deliveryDate: "",
    deliveryTime: "",
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
  };
}

interface DeliverySectionProps {
  deliveries: Delivery[];
  onDeliveriesChange: (d: Delivery[]) => void;
  isComplete?: boolean;
}

function DeliveryCard({
  delivery,
  index,
  total,
  onChange,
  onRemove,
}: {
  delivery: Delivery;
  index: number;
  total: number;
  onChange: (updated: Delivery) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof Delivery>(key: K, val: Delivery[K]) =>
    onChange({ ...delivery, [key]: val });

  const districts = delivery.deliveryRegion
    ? Object.keys(HK_DISTRICTS[delivery.deliveryRegion] || {})
    : [];
  const areas =
    delivery.deliveryRegion && delivery.deliveryDistrict
      ? HK_DISTRICTS[delivery.deliveryRegion]?.[delivery.deliveryDistrict] || []
      : [];

  const handleRegionChange = (v: string) =>
    onChange({ ...delivery, deliveryRegion: v, deliveryDistrict: "", deliveryArea: "" });

  const handleDistrictChange = (v: string) =>
    onChange({ ...delivery, deliveryDistrict: v, deliveryArea: "" });

  const isSpecified =
    delivery.deliveryTime === "指定時間" || delivery.deliveryTime.startsWith("指定");
  const specifiedTime = isSpecified
    ? delivery.deliveryTime.replace("指定時間 ", "").replace("指定時間", "")
    : "";

  const handleSlotSelect = (slotValue: string) => set("deliveryTime", slotValue);

  const handleSpecifiedTime = (t: string) =>
    set("deliveryTime", t ? `指定時間 ${t}` : "指定時間");

  const fullAddress = [
    delivery.deliveryRegion,
    delivery.deliveryDistrict,
    delivery.deliveryArea,
    delivery.deliveryDetail,
  ]
    .filter(Boolean)
    .join(" ");
  const mapQuery = encodeURIComponent(fullAddress + " 香港");

  return (
    <div className="space-y-3">
      {/* Recipient header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
          收件人 {index + 1}
          {total > 1 && (
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
              ({String(index + 1).padStart(2, "0")})
            </span>
          )}
        </p>
        {total > 1 && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="移除收件人"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Date + Time slot */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 送貨日期
          </Label>
          <Input
            type="date"
            value={delivery.deliveryDate}
            onChange={(e) => set("deliveryDate", e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 送貨時間
          </Label>
          <div className="flex gap-1.5">
            {DELIVERY_SLOTS.map((slot) => {
              const active =
                delivery.deliveryTime === slot.value ||
                (slot.value === "指定時間" && isSpecified);
              return (
                <button
                  key={slot.value}
                  onClick={() => handleSlotSelect(slot.value)}
                  className={`flex-1 rounded-lg py-1.5 px-1 text-center text-xs font-medium border transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                  }`}
                >
                  <div>{slot.label}</div>
                  <div className={`text-[9px] ${active ? "opacity-80" : "text-muted-foreground"}`}>
                    {slot.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
          {isSpecified && (
            <Input
              type="time"
              value={specifiedTime}
              onChange={(e) => handleSpecifiedTime(e.target.value)}
              className="text-sm mt-1"
            />
          )}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-xs">送貨地址</Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={delivery.deliveryRegion} onValueChange={handleRegionChange}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="地區" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(HK_DISTRICTS).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={delivery.deliveryDistrict}
            onValueChange={handleDistrictChange}
            disabled={!delivery.deliveryRegion}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="分區" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={delivery.deliveryArea}
            onValueChange={(v) => set("deliveryArea", v)}
            disabled={!delivery.deliveryDistrict}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="地點" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="詳細地址（大廈名 / 樓層 / 室）"
          value={delivery.deliveryDetail}
          onChange={(e) => set("deliveryDetail", e.target.value)}
          className="text-sm"
          maxLength={200}
        />
        {fullAddress && (
          <p className="text-xs text-muted-foreground">📍 {fullAddress}</p>
        )}
        {fullAddress.length > 2 && (
          <div className="rounded-lg overflow-hidden border border-border mt-2">
            <iframe
              title={`Google Map ${index + 1}`}
              width="100%"
              height="160"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            />
          </div>
        )}
      </div>

      {/* Recipient + Driver */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 收貨人姓名
          </Label>
          <Input
            placeholder="收貨人姓名"
            value={delivery.recipientName}
            onChange={(e) => set("recipientName", e.target.value)}
            className="text-sm"
            maxLength={100}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">收貨人電話</Label>
          <Input
            placeholder="收貨人電話"
            value={delivery.recipientPhone}
            onChange={(e) => set("recipientPhone", e.target.value)}
            className="text-sm font-mono"
            maxLength={20}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> 送貨司機
          </Label>
          <Select value={delivery.deliveryPerson} onValueChange={(v) => set("deliveryPerson", v)}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="選擇司機" />
            </SelectTrigger>
            <SelectContent>
              {DRIVERS.map((d) => (
                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> 無法聯繫收件人
          </Label>
          <Select
            value={delivery.failedDeliveryAction}
            onValueChange={(v) => set("failedDeliveryAction", v)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="選擇處理方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不適用</SelectItem>
              <SelectItem value="leave_door">放門口</SelectItem>
              <SelectItem value="leave_security">交管理處 / 保安</SelectItem>
              <SelectItem value="leave_neighbor">交鄰居</SelectItem>
              <SelectItem value="return">帶回公司</SelectItem>
              <SelectItem value="reschedule">改期再送</SelectItem>
              <SelectItem value="call_sender">聯繫寄件人</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

const DeliverySection = ({ deliveries, onDeliveriesChange, isComplete }: DeliverySectionProps) => {
  const update = (index: number, updated: Delivery) => {
    const next = deliveries.map((d, i) => (i === index ? updated : d));
    onDeliveriesChange(next);
  };

  const addRecipient = () => onDeliveriesChange([...deliveries, newDelivery()]);

  const removeRecipient = (index: number) =>
    onDeliveriesChange(deliveries.filter((_, i) => i !== index));

  return (
    <div className="rounded-xl bg-card p-4 space-y-4 border border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/70 flex items-center gap-2">
          <StepBadge n={4} done={!!isComplete} />
          <MapPin className="w-4 h-4" />
          送貨資料
          {deliveries.length > 1 && (
            <span className="ml-1 text-[11px] font-normal normal-case text-muted-foreground">
              {deliveries.length} 個收件人
            </span>
          )}
        </h2>
      </div>

      {deliveries.map((d, i) => (
        <div key={d.id}>
          {i > 0 && <div className="border-t border-dashed border-border pt-4" />}
          <DeliveryCard
            delivery={d}
            index={i}
            total={deliveries.length}
            onChange={(updated) => update(i, updated)}
            onRemove={() => removeRecipient(i)}
          />
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs border-dashed"
        onClick={addRecipient}
      >
        <Plus className="w-3.5 h-3.5" />
        新增收件人（分單送貨）
      </Button>
    </div>
  );
};

export default DeliverySection;
