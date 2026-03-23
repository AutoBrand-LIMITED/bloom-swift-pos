import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Calendar, Clock, User, UserCheck } from "lucide-react";

interface DeliverySectionProps {
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryPerson: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onDeliveryPersonChange: (v: string) => void;
}

const DeliverySection = ({
  deliveryDate, deliveryTime, deliveryAddress,
  recipientName, recipientPhone, deliveryPerson,
  onDateChange, onTimeChange, onAddressChange,
  onRecipientNameChange, onRecipientPhoneChange, onDeliveryPersonChange,
}: DeliverySectionProps) => (
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
    <div className="space-y-1">
      <Label className="text-xs">送貨地址</Label>
      <Input
        placeholder="輸入送貨地址"
        value={deliveryAddress}
        onChange={(e) => onAddressChange(e.target.value)}
        className="text-sm"
        maxLength={200}
      />
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

export default DeliverySection;
