import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, ChevronDown, Building2, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemoCustomer } from "@/data/demo-customers";
import CustomerFlags from "@/components/pos/CustomerFlags";
import { customerIdentityKey, loadStoredCustomers, mergeCustomers } from "@/lib/customer-utils";
import { hasOdooBackend, searchOdooCustomers } from "@/lib/odoo-api";

export type CustomerType = "personal" | "company";

interface CustomerSectionProps {
  phone: string;
  customerName: string;
  senderName: string;
  customerType: CustomerType;
  companyName: string;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onSenderNameChange: (v: string) => void;
  onCustomerTypeChange: (v: CustomerType) => void;
  onCompanyNameChange: (v: string) => void;
  onCustomerSelect: (c: DemoCustomer) => void;
  phoneError: boolean;
  senderNameError: boolean;
  selectedCustomer: DemoCustomer | null;
  refreshKey?: number;
}

const CustomerSection = ({
  phone, customerName, senderName, customerType, companyName,
  onPhoneChange, onNameChange, onSenderNameChange, onCustomerTypeChange, onCompanyNameChange,
  onCustomerSelect, phoneError, senderNameError, selectedCustomer, refreshKey,
}: CustomerSectionProps) => {
  const [activeDropdown, setActiveDropdown] = useState<"phone" | "name" | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [odooCustomers, setOdooCustomers] = useState<DemoCustomer[]>([]);
  const [odooLoading, setOdooLoading] = useState(false);
  const [odooError, setOdooError] = useState<string | null>(null);
  const lookupRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (lookupRef.current && !lookupRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keep only real imported/local customers here. Odoo results are merged below.
  const allCustomers = useMemo(() => {
    const stored = loadStoredCustomers();
    return mergeCustomers([], stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const normalizedSearchPhone = search.replace(/\D/g, "");
  const normalizedDebouncedPhone = debouncedSearch.replace(/\D/g, "");
  const filtered = allCustomers.filter((c) => {
    const normalizedCustomerPhone = c.phone.replace(/\D/g, "");
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      Boolean(normalizedSearchPhone && normalizedCustomerPhone.includes(normalizedSearchPhone))
    );
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    const canSearch =
      activeDropdown === "phone"
        ? normalizedDebouncedPhone.length >= 4
        : trimmed.length >= 2;

    if (!activeDropdown || !hasOdooBackend || !canSearch) {
      setOdooCustomers([]);
      setOdooLoading(false);
      setOdooError(null);
      return;
    }

    const controller = new AbortController();
    setOdooLoading(true);
    setOdooError(null);

    searchOdooCustomers(trimmed, controller.signal)
      .then(setOdooCustomers)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setOdooCustomers([]);
        setOdooError(err instanceof Error ? err.message : "未能連接 Odoo 客戶資料");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOdooLoading(false);
      });

    return () => controller.abort();
  }, [activeDropdown, debouncedSearch, normalizedDebouncedPhone]);

  const customerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: DemoCustomer[] = [];

    for (const c of [...odooCustomers, ...filtered]) {
      const key = customerIdentityKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(c);
    }

    return options;
  }, [filtered, odooCustomers]);

  const searchHint =
    sourceRequiresMoreInput(activeDropdown, search)
      ? activeDropdown === "phone"
        ? "輸入至少 4 個電話數字搜尋 Odoo 客戶"
        : "輸入至少 2 個字搜尋 Odoo 客戶"
      : "未搵到客戶";

  const orderingCustomerName = (
    customerType === "company" && companyName.trim()
      ? companyName
      : customerName
  ).trim();

  const handleSelect = (c: DemoCustomer) => {
    onCustomerSelect(c);
    setActiveDropdown(null);
    setSearch("");
  };

  const customerDropdown = (source: "phone" | "name") => activeDropdown === source && (
    <div className={`absolute z-50 top-full mt-1 sm:w-[calc(200%+0.75rem)] bg-card border border-border rounded-lg shadow-lg overflow-hidden ${
      source === "name" ? "left-0 right-0 sm:left-auto sm:right-0" : "left-0 right-0"
    }`}>
      {odooLoading ? (
        <p className="text-xs text-muted-foreground p-3">正在搜尋 Odoo 客戶...</p>
      ) : customerOptions.length === 0 ? (
        <div className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{searchHint}</p>
          {odooError && <p className="text-[10px] text-destructive">{odooError}</p>}
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {odooError && (
            <p className="px-3 py-2 text-[10px] text-destructive border-b border-border">
              Odoo 搜尋暫時不可用，以下顯示本機記錄
            </p>
          )}
          {customerOptions.map((c) => (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); handleSelect(c); }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground ml-2 font-mono break-all">{c.phone}</span>
                <CustomerFlags tags={c.tags} className="mt-1" />
                {c.commentText?.trim() && (
                  <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                    長期備註：{c.commentText}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {c.odooPartnerId && c.historyCount == null
                  ? "選擇後載入"
                  : `${c.historyCount ?? c.history.length} 筆記錄`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <User className="w-4 h-4" />
          客戶資料
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

      {/* Company name */}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" ref={lookupRef}>
        <div className="space-y-1.5 relative">
          <Label htmlFor="phone" className="text-xs font-medium">
            下單人電話 <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              placeholder="例如：9123 4567"
              value={phone}
              onChange={(e) => {
                const nextPhone = e.target.value;
                onPhoneChange(nextPhone);
                setSearch(nextPhone);
                setActiveDropdown("phone");
              }}
              onFocus={() => {
                if (phone.trim()) {
                  setSearch(phone);
                  setActiveDropdown("phone");
                }
              }}
              className={`pl-9 font-mono text-base ${phoneError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={20}
            />
          </div>
          {customerDropdown("phone")}
          {phoneError && <p className="text-xs text-destructive">請輸入電話號碼</p>}
        </div>
        <div className="space-y-1.5 relative">
          <Label htmlFor="customer-name" className="text-xs font-medium">下單人／聯絡人</Label>
          <div className="relative">
            <Input
              ref={nameInputRef}
              id="customer-name"
              placeholder="選擇或輸入客戶名稱"
              value={activeDropdown === "name" ? search : customerName}
              onChange={(e) => {
                setSearch(e.target.value);
                onNameChange(e.target.value);
                setActiveDropdown("name");
              }}
              onFocus={() => {
                setSearch(customerName);
                setActiveDropdown("name");
              }}
              onClick={() => {
                setActiveDropdown("name");
              }}
              className="pr-10 text-base"
              maxLength={100}
            />
            <button
              type="button"
              aria-label="開啟客戶選單"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                nameInputRef.current?.focus();
                setSearch(customerName);
                setActiveDropdown("name");
              }}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {customerDropdown("name")}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sender-name" className="text-xs font-medium flex items-center gap-1.5">
            <UserRoundCheck className="h-3.5 w-3.5" />
            送花人名稱 <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={!orderingCustomerName}
            onClick={() => onSenderNameChange(orderingCustomerName)}
          >
            同客戶相同
          </Button>
        </div>
        <Input
          id="sender-name"
          placeholder="輸入真正送花者姓名或公司"
          value={senderName}
          onChange={(event) => onSenderNameChange(event.target.value)}
          className={`text-base ${senderNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
          maxLength={200}
          aria-invalid={senderNameError}
        />
        {senderNameError && <p className="text-xs text-destructive">請輸入送花人名稱</p>}
      </div>
    </div>
  );
};

function sourceRequiresMoreInput(source: "phone" | "name" | null, value: string) {
  if (!source) return false;
  const trimmed = value.trim();
  if (source === "phone") return trimmed.replace(/\D/g, "").length < 4;
  return trimmed.length < 2;
}

export default CustomerSection;
