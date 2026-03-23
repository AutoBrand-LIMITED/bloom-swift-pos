import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone } from "lucide-react";

interface CustomerSectionProps {
  phone: string;
  customerName: string;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  phoneError: boolean;
}

const CustomerSection = ({ phone, customerName, onPhoneChange, onNameChange, phoneError }: CustomerSectionProps) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
      <User className="w-4 h-4" />
      客戶資料
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-xs font-medium">
          電話號碼 <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="phone"
            placeholder="例如：9123 4567"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={`pl-9 font-mono text-base ${phoneError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={20}
          />
        </div>
        {phoneError && <p className="text-xs text-destructive">請輸入電話號碼</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-medium">客戶名稱</Label>
        <Input
          id="name"
          placeholder="選填"
          value={customerName}
          onChange={(e) => onNameChange(e.target.value)}
          className="text-base"
          maxLength={100}
        />
      </div>
    </div>
  </div>
);

export default CustomerSection;
