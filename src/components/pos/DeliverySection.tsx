import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar, Clock, User, UserCheck } from "lucide-react";

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
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onDetailChange: (v: string) => void;
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onDeliveryPersonChange: (v: string) => void;
}

const DeliverySection = ({
  deliveryDate, deliveryTime,
  deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail,
  recipientName, recipientPhone, deliveryPerson,
  onDateChange, onTimeChange,
  onRegionChange, onDistrictChange, onAreaChange, onDetailChange,
  onRecipientNameChange, onRecipientPhoneChange, onDeliveryPersonChange,
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

  // Build full address string for display
  const fullAddress = [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        送貨資料
      </h2>
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
          <Input
            type="time"
            value={deliveryTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Address: Region → District → Area */}
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
          <p className="text-xs text-muted-foreground">
            📍 {fullAddress}
          </p>
        )}
      </div>

      {/* Recipient info */}
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

      {/* Delivery person */}
      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5" /> 送貨人
        </Label>
        <Input
          placeholder="負責送貨嘅同事名"
          value={deliveryPerson}
          onChange={(e) => onDeliveryPersonChange(e.target.value)}
          className="text-sm"
          maxLength={100}
        />
      </div>
    </div>
  );
};

export default DeliverySection;
