import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Calendar, Clock } from "lucide-react";

interface DeliverySectionProps {
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddress: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onAddressChange: (v: string) => void;
}

const DeliverySection = ({
  deliveryDate, deliveryTime, deliveryAddress,
  onDateChange, onTimeChange, onAddressChange,
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
  </div>
);

export default DeliverySection;
