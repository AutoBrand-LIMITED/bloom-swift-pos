import { useState, useRef, useEffect, useMemo } from "react";
import StepBadge from "@/components/pos/StepBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, ChevronDown, Building2, Crown, AlertTriangle, Tag } from "lucide-react";
import { DEMO_CUSTOMERS, type DemoCustomer, type CustomerFlag } from "@/data/demo-customers";
import { loadStoredCustomers, mergeCustomers } from "@/lib/customer-utils";

export type CustomerType = "personal" | "company";

interface CustomerSectionProps {
  phone: string;
  phonePrefix: string;
  customerName: string;
  customerType: CustomerType;
  companyName: string;
  contactPerson: string;
  onPhoneChange: (v: string) => void;
  onPhonePrefixChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onCustomerTypeChange: (v: CustomerType) => void;
  onCompanyNameChange: (v: string) => void;
  onContactPersonChange: (v: string) => void;
  onCustomerSelect: (c: DemoCustomer) => void;
  phoneError: boolean;
  selectedCustomer: DemoCustomer | null;
  refreshKey?: number;
  isComplete?: boolean;
}

const FLAG_CONFIG: Record<CustomerFlag, { label: string; color: string; icon: React.ReactNode }> = {
  vip: {
    label: "VIP",
    color: "bg-yellow-400 text-yellow-900",
    icon: <Crown className="w-3 h-3" />,
  },
  warning: {
    label: "警告",
    color: "bg-red-500 text-white",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  internal: {
    label: "備注",
    color: "bg-purple-500 text-white",
    icon: <Tag className="w-3 h-3" />,
  },
};

function CustomerFlags({ flags }: { flags?: CustomerFlag[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flex items-center gap-1">
      {flags.map((f) => {
        const cfg = FLAG_CONFIG[f];
        return (
          <span
            key={f}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cfg.color}`}
          >
            {cfg.icon}
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

const PHONE_PREFIXES = [
  { code: "+852", label: "HK 852" },
  { code: "+853", label: "MO 853" },
];

function detectPrefix(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("853")) return "+853";
  if (digits.startsWith("852")) return "+852";
  return "+852";
}

const CustomerSection = ({
  phone, phonePrefix, customerName, customerType, companyName, contactPerson,
  onPhoneChange, onPhonePrefixChange, onNameChange, onCustomerTypeChange,
  onCompanyNameChange, onContactPersonChange,
  onCustomerSelect, phoneError, selectedCustomer, refreshKey, isComplete,
}: CustomerSectionProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allCustomers = useMemo(() => {
    const stored = loadStoredCustomers();
    return mergeCustomers(DEMO_CUSTOMERS, stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = allCustomers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const handleSelect = (c: DemoCustomer) => {
    onCustomerSelect(c);
    setDropdownOpen(false);
    setSearch("");
    // Auto-detect prefix from stored phone
    const detected = detectPrefix(c.phone);
    if (detected !== phonePrefix) onPhonePrefixChange(detected);
  };

  const handlePhoneInput = (v: string) => {
    onPhoneChange(v);
    // Only auto-detect when pasted international format (>= 10 digits includes country code)
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 10) {
      const detected = detectPrefix(v);
      onPhonePrefixChange(detected);
    }
  };

  return (
    <div className="rounded-xl bg-card p-4 space-y-3 border border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/70 flex items-center gap-2">
          <StepBadge n={2} done={!!isComplete} />
          <User className="w-4 h-4" />
          客戶資料
          {selectedCustomer?.flags?.length ? (
            <CustomerFlags flags={selectedCustomer.flags} />
          ) : null}
        </h2>
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => onCustomerTypeChange("personal")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              customerType === "personal"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            個人
          </button>
          <button
            onClick={() => onCustomerTypeChange("company")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              customerType === "company"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> 公司</span>
          </button>
        </div>
      </div>

      {customerType === "company" && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> 公司名稱
          </Label>
          <Input
            placeholder="輸入公司名稱"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            className="text-base"
            maxLength={100}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Phone with prefix */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-medium">
            電話號碼 <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-1.5">
            <Select value={phonePrefix} onValueChange={onPhonePrefixChange}>
              <SelectTrigger className="w-[100px] shrink-0 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHONE_PREFIXES.map((p) => (
                  <SelectItem key={p.code} value={p.code} className="font-mono text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="9123 4567"
                value={phone}
                onChange={(e) => handlePhoneInput(e.target.value)}
                className={`pl-9 font-mono text-base ${phoneError ? "border-destructive ring-1 ring-destructive" : ""}`}
                maxLength={20}
              />
            </div>
          </div>
          {phoneError && <p className="text-xs text-destructive">請輸入電話號碼</p>}
        </div>

        {/* Customer name dropdown */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <Label className="text-xs font-medium">客戶名稱</Label>
          <div
            className="flex items-center border border-input rounded-md bg-background cursor-pointer hover:border-ring transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Input
              placeholder="選擇或輸入客戶名稱"
              value={dropdownOpen ? search : customerName}
              onChange={(e) => {
                if (dropdownOpen) {
                  setSearch(e.target.value);
                } else {
                  onNameChange(e.target.value);
                }
              }}
              onFocus={() => setDropdownOpen(true)}
              className="border-0 text-base focus-visible:ring-0"
              maxLength={100}
            />
            <ChevronDown className="w-4 h-4 mr-3 text-muted-foreground shrink-0" />
          </div>

          {dropdownOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">未搵到客戶</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); handleSelect(c); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border last:border-0"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{c.name}</span>
                          <CustomerFlags flags={c.flags} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{c.history.length} 筆</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact person (secretary) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">聯絡人（如秘書代訂）</Label>
        <Input
          placeholder="例如：陳小姐（秘書）"
          value={contactPerson}
          onChange={(e) => onContactPersonChange(e.target.value)}
          className="text-sm"
          maxLength={100}
        />
      </div>
    </div>
  );
};

export default CustomerSection;
