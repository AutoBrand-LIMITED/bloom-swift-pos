import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar, Clock, User, UserCheck, AlertCircle } from "lucide-react";
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

interface DeliverySectionProps {
  deliveryDate: string;
  deliveryTime: string;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
  recipientName: string;
  recipientPhone: string;
  deliveryPerson: string;
  failedDeliveryAction: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onDetailChange: (v: string) => void;
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onDeliveryPersonChange: (v: string) => void;
  onFailedDeliveryActionChange: (v: string) => void;
  isComplete?: boolean;
}

const DeliverySection = ({
  deliveryDate, deliveryTime,
  deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail,
  recipientName, recipientPhone, deliveryPerson, failedDeliveryAction,
  onDateChange, onTimeChange,
  onRegionChange, onDistrictChange, onAreaChange, onDetailChange,
  onRecipientNameChange, onRecipientPhoneChange, onDeliveryPersonChange,
  onFailedDeliveryActionChange, isComplete,
}: DeliverySectionProps) => {
  const districts = deliveryRegion ? Object.keys(HK_DISTRICTS[deliveryRegion] || {}) : [];
  const areas = deliveryRegion && deliveryDistrict
    ? HK_DISTRICTS[deliveryRegion]?.[deliveryDistrict] || []
    : [];

  const handleRegionChange = (v: string) => {
    onRegionChange(v);
    onDistrictChange("");
    onAreaChange("");
  };

  const handleDistrictChange = (v: string) => {
    onDistrictChange(v);
    onAreaChange("");
  };

  const isSpecified = deliveryTime === "指定時間" || deliveryTime.startsWith("指定");
  const specifiedTime = isSpecified ? deliveryTime.replace("指定時間 ", "").replace("指定時間", "") : "";

  const handleSlotSelect = (slotValue: string) => {
    if (slotValue === "指定時間") {
      onTimeChange("指定時間");
    } else {
      onTimeChange(slotValue);
    }
  };

  const handleSpecifiedTime = (t: string) => {
    onTimeChange(t ? `指定時間 ${t}` : "指定時間");
  };

  const fullAddress = [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail]
    .filter(Boolean)
    .join(" ");
  const mapQuery = encodeURIComponent(fullAddress + " 香港");

  return (
    <div className={`rounded-xl bg-card p-4 space-y-3 transition-colors ${
      isComplete ? "border-t border-r border-b border-l-4 border-t-primary/30 border-r-primary/30 border-b-primary/30 border-l-primary" : "border border-border"
    }`}>
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <span className="text-primary font-bold text-base">④</span>
        <MapPin className="w-4 h-4" />
        送貨資料
      </h2>

      {/* Date + Time slot */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 送貨日期
          </Label>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> 送貨時間
          </Label>
          <div className="flex gap-1.5">
            {DELIVERY_SLOTS.map((slot) => {
              const active = deliveryTime === slot.value || (slot.value === "指定時間" && isSpecified);
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
                  <div className={`text-[9px] ${active ? "opacity-80" : "text-muted-foreground"}`}>{slot.sublabel}</div>
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
              placeholder="指定時間"
            />
          )}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label className="text-xs">送貨地址</Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={deliveryRegion} onValueChange={handleRegionChange}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="地區" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(HK_DISTRICTS).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deliveryDistrict} onValueChange={handleDistrictChange} disabled={!deliveryRegion}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="分區" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deliveryArea} onValueChange={onAreaChange} disabled={!deliveryDistrict}>
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
          value={deliveryDetail}
          onChange={(e) => onDetailChange(e.target.value)}
          className="text-sm"
          maxLength={200}
        />
        {fullAddress && (
          <p className="text-xs text-muted-foreground">📍 {fullAddress}</p>
        )}
        {fullAddress.length > 2 && (
          <div className="rounded-lg overflow-hidden border border-border mt-2">
            <iframe
              title="Google Map"
              width="100%"
              height="200"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            />
          </div>
        )}
      </div>

      {/* Recipient */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 收貨人姓名
          </Label>
          <Input
            placeholder="收貨人姓名"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            className="text-sm"
            maxLength={100}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">收貨人電話</Label>
          <Input
            placeholder="收貨人電話"
            value={recipientPhone}
            onChange={(e) => onRecipientPhoneChange(e.target.value)}
            className="text-sm font-mono"
            maxLength={20}
          />
        </div>
      </div>

      {/* Driver dropdown + failed delivery */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> 送貨司機
          </Label>
          <Select value={deliveryPerson} onValueChange={onDeliveryPersonChange}>
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
          <Select value={failedDeliveryAction} onValueChange={onFailedDeliveryActionChange}>
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
};

export default DeliverySection;
