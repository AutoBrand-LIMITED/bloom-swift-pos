import { useState, useRef, useEffect, useMemo } from "react";
import StepBadge from "@/components/pos/StepBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, ChevronDown, Building2, Crown, AlertTriangle, Tag } from "lucide-react";
import { DEMO_CUSTOMERS, type DemoCustomer, type CustomerFlag } from "@/data/demo-customers";
import { loadStoredCustomers, mergeCustomers } from "@/lib/customer-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Order } from "@/types/order";

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
  orders?: Order[];
}

const FLAG_COLORS: Record<CustomerFlag, string> = {
  vip: "bg-yellow-400 text-yellow-900",
  warning: "bg-red-500 text-white",
  internal: "bg-purple-500 text-white",
};
const FLAG_ICONS: Record<CustomerFlag, React.ReactNode> = {
  vip: <Crown className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  internal: <Tag className="w-3 h-3" />,
};

function CustomerFlags({ flags, getLabel }: { flags?: CustomerFlag[]; getLabel: (f: CustomerFlag) => string }) {
  if (!flags?.length) return null;
  return (
    <div className="flex items-center gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${FLAG_COLORS[f]}`}
        >
          {FLAG_ICONS[f]}
          {getLabel(f)}
        </span>
      ))}
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
  onCustomerSelect, phoneError, selectedCustomer, refreshKey, isComplete, orders,
}: CustomerSectionProps) => {
  const { t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const getFlagLabel = (f: CustomerFlag) => f === "vip" ? "VIP" : f === "warning" ? t("flag_warning") : t("flag_internal");

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

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const byName = allCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(search)
    );
    // Also surface senders from orders where search matches a recipient phone
    if (orders?.length) {
      const matchedSenderPhones = new Set<string>();
      for (const order of orders) {
        for (const d of (order.deliveries ?? [])) {
          if (d.recipientPhone && d.recipientPhone.replace(/\s/g, "").includes(search.replace(/\s/g, ""))) {
            matchedSenderPhones.add(order.phone.replace(/\s/g, ""));
          }
        }
      }
      if (matchedSenderPhones.size > 0) {
        const extra = allCustomers.filter(
          (c) => matchedSenderPhones.has(c.phone.replace(/\s/g, "")) && !byName.some((b) => b.id === c.id)
        );
        return [...byName, ...extra];
      }
    }
    return byName;
  }, [search, allCustomers, orders]);

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
    <div className={`rounded-xl p-4 space-y-3 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
          <StepBadge n={2} done={!!isComplete} />
          <User className="w-4 h-4" />
          {t("section_customer")}
          {selectedCustomer?.flags?.length ? (
            <CustomerFlags flags={selectedCustomer.flags} getLabel={getFlagLabel} />
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
            {t("btn_personal")}
          </button>
          <button
            onClick={() => onCustomerTypeChange("company")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              customerType === "company"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {t("btn_company")}</span>
          </button>
        </div>
      </div>

      {customerType === "company" && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> {t("label_company_name")}
          </Label>
          <Input
            placeholder={t("placeholder_company_name")}
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
            {t("label_phone")} <span className="text-destructive">*</span>
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
          {phoneError && <p className="text-xs text-destructive">{t("error_phone_required")}</p>}
        </div>

        {/* Customer name dropdown */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <Label className="text-xs font-medium">{t("label_customer_name")}</Label>
          <div
            className="flex items-center border border-input rounded-md bg-background cursor-pointer hover:border-ring transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Input
              placeholder={t("placeholder_customer_name")}
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
                <p className="text-xs text-muted-foreground p-3">{t("msg_no_customer")}</p>
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
                          <CustomerFlags flags={c.flags} getLabel={getFlagLabel} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{c.phone}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{c.history.length} {t("unit_orders")}</span>
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
        <Label className="text-xs font-medium text-muted-foreground">{t("label_contact_person")}</Label>
        <Input
          placeholder={t("placeholder_contact_person")}
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
