import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Phone, ChevronDown, Building2, UserRoundCheck, Hash, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemoCustomer } from "@/data/demo-customers";
import CustomerFlags from "@/components/pos/CustomerFlags";
import { customerIdentityKey, loadStoredCustomers, mergeCustomers } from "@/lib/customer-utils";
import { hasOdooBackend, searchOdooCustomers } from "@/lib/odoo-api";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/checkout-validation";

export type CustomerType = "personal" | "company";
type CustomerLookupSource = "phone" | "name" | "customerCode";

interface CustomerSectionProps {
  phone: string;
  customerName: string;
  customerCode: string;
  senderName: string;
  customerType: CustomerType;
  companyName: string;
  customerEmail: string;
  billingAddress: string;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onCustomerCodeChange: (v: string) => void;
  onSenderNameChange: (v: string) => void;
  onCustomerTypeChange: (v: CustomerType) => void;
  onCompanyNameChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onBillingAddressChange: (v: string) => void;
  onCustomerSelect: (c: DemoCustomer) => void;
  onCustomerAndRecipientSelect: (
    customer: DemoCustomer,
    recipient: NonNullable<DemoCustomer["recipientMatch"]>,
  ) => void;
  phoneError?: string;
  customerNameError?: string;
  senderNameError?: string;
  companyNameError?: string;
  customerEmailError?: string;
  billingAddressError?: string;
  selectedCustomer: DemoCustomer | null;
  confirmedNewCustomerPhone?: string | null;
  onConfirmNewCustomer?: (normalizedPhone: string) => void;
  refreshKey?: number;
}

const CustomerSection = ({
  phone, customerName, customerCode, senderName, customerType, companyName, customerEmail, billingAddress,
  onPhoneChange, onNameChange, onCustomerCodeChange, onSenderNameChange, onCustomerTypeChange, onCompanyNameChange,
  onCustomerEmailChange, onBillingAddressChange,
  onCustomerSelect, onCustomerAndRecipientSelect,
  phoneError, customerNameError, senderNameError,
  companyNameError, customerEmailError, billingAddressError, selectedCustomer, refreshKey,
  confirmedNewCustomerPhone, onConfirmNewCustomer,
}: CustomerSectionProps) => {
  const [activeDropdown, setActiveDropdown] = useState<CustomerLookupSource | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [odooCustomers, setOdooCustomers] = useState<DemoCustomer[]>([]);
  const [odooLoading, setOdooLoading] = useState(false);
  const [odooError, setOdooError] = useState<string | null>(null);
  const [completedOdooSearch, setCompletedOdooSearch] = useState<{
    source: CustomerLookupSource;
    query: string;
  } | null>(null);
  const lookupRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const suppressNextNameDropdownRef = useRef(false);

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

  const normalizedSearchPhone = normalizePhoneNumber(search);
  const normalizedDebouncedPhone = normalizePhoneNumber(debouncedSearch);
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
        : activeDropdown === "customerCode"
          ? trimmed.length >= 1
          : trimmed.length >= 2;

    if (!activeDropdown || !hasOdooBackend || !canSearch) {
      setOdooCustomers([]);
      setOdooLoading(false);
      setOdooError(null);
      return;
    }

    const controller = new AbortController();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setOdooLoading(true);
    setOdooError(null);
    setCompletedOdooSearch(null);

    searchOdooCustomers(
      trimmed,
      controller.signal,
      activeDropdown === "customerCode" ? "customer_code" : "general",
    )
      .then((customers) => {
        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;
        setOdooCustomers(customers);
        setCompletedOdooSearch({
          source: activeDropdown,
          query: activeDropdown === "phone"
            ? normalizedDebouncedPhone
            : trimmed.toLocaleLowerCase(),
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;
        setOdooCustomers([]);
        setCompletedOdooSearch(null);
        setOdooError(err instanceof Error ? err.message : "未能連接 Odoo 客戶資料");
      })
      .finally(() => {
        if (!controller.signal.aborted && searchRequestRef.current === requestId) {
          setOdooLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeDropdown, debouncedSearch, normalizedDebouncedPhone]);

  const currentSearchKey = activeDropdown === "phone"
    ? normalizedSearchPhone
    : search.trim().toLocaleLowerCase();
  const completedCurrentSearch = completedOdooSearch?.source === activeDropdown
    && completedOdooSearch.query === currentSearchKey;
  const customerOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: DemoCustomer[] = [];
    const visibleOdooCustomers = completedCurrentSearch
      ? odooCustomers
      : [];
    const visibleLocalCustomers = activeDropdown === "customerCode" ? [] : filtered;

    for (const c of [...visibleOdooCustomers, ...visibleLocalCustomers]) {
      const key = customerIdentityKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(c);
    }

    return options;
  }, [activeDropdown, completedCurrentSearch, filtered, odooCustomers]);

  const searchHint =
    sourceRequiresMoreInput(activeDropdown, search)
      ? activeDropdown === "phone"
        ? "輸入至少 4 個電話數字搜尋 Odoo 客戶"
        : activeDropdown === "customerCode"
          ? "輸入客戶編號搜尋 Odoo 客戶"
          : "輸入至少 2 個字搜尋下單人或收件人"
      : completedCurrentSearch
        ? activeDropdown === "customerCode"
          ? "未找到此客戶編號"
          : "未搵到客戶"
        : "正在準備搜尋...";

  const orderingCustomerName = (
    customerType === "company" && companyName.trim()
      ? companyName
      : customerName
  ).trim();
  const normalizedCurrentPhone = normalizePhoneNumber(phone);
  const canConfirmNewCustomer = Boolean(
    hasOdooBackend
      && activeDropdown === "phone"
      && isValidPhoneNumber(phone)
      && normalizedSearchPhone === normalizedCurrentPhone
      && normalizedDebouncedPhone === normalizedCurrentPhone
      && completedOdooSearch?.source === "phone"
      && completedOdooSearch.query === normalizedCurrentPhone
      && !odooLoading
      && !odooError
      && customerOptions.length === 0,
  );
  const isNewCustomerConfirmed = Boolean(
    normalizedCurrentPhone
      && confirmedNewCustomerPhone === normalizedCurrentPhone,
  );

  const handleSelect = (c: DemoCustomer) => {
    const customer = { ...c };
    delete customer.recipientMatch;
    onCustomerSelect(customer);
    setActiveDropdown(null);
    setSearch("");
  };

  const handleSelectWithRecipient = (c: DemoCustomer) => {
    if (!c.recipientMatch) {
      handleSelect(c);
      return;
    }
    const customer = { ...c };
    const recipient = customer.recipientMatch;
    delete customer.recipientMatch;
    onCustomerAndRecipientSelect(customer, recipient);
    setActiveDropdown(null);
    setSearch("");
  };

  const customerOptionContent = (c: DemoCustomer, actionLabel?: string) => (
    <>
      <div className="min-w-0">
        {c.customerCode && (
          <p className="text-[10px] font-mono text-primary break-all">
            客戶編號：{c.customerCode}
          </p>
        )}
        <span className="text-sm font-medium">{c.name}</span>
        <span className="text-xs text-muted-foreground ml-2 font-mono break-all">
          {c.phone || "沒有電話"}
        </span>
        {c.recipientMatch && (
          <p className="mt-1 text-[11px] text-primary">
            配對收件人：
            {[c.recipientMatch.companyName, c.recipientMatch.name, c.recipientMatch.phone]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <CustomerFlags tags={c.tags} className="mt-1" />
        {c.commentText?.trim() && (
          <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
            長期備註：{c.commentText}
          </p>
        )}
        {actionLabel && (
          <p className="mt-1 text-[10px] font-medium text-primary">{actionLabel}</p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {c.odooPartnerId && c.historyCount == null
          ? "選擇後載入"
          : `${c.historyCount ?? c.history.length} 筆記錄`}
      </span>
    </>
  );

  const customerDropdown = (source: CustomerLookupSource) => activeDropdown === source && (
    <div className={`absolute z-50 top-full mt-1 sm:w-[calc(200%+0.75rem)] bg-card border border-border rounded-lg shadow-lg overflow-hidden ${
      source === "name"
        ? "left-0 right-0 sm:left-auto sm:right-0"
        : source === "customerCode"
          ? "left-0 right-0 sm:w-full"
          : "left-0 right-0"
    }`}>
      {odooLoading ? (
        <p className="text-xs text-muted-foreground p-3">正在搜尋 Odoo 客戶及收件人...</p>
      ) : customerOptions.length === 0 ? (
        <div className="p-3 space-y-2">
          {odooError ? (
            <p className="text-xs text-destructive">{odooError}</p>
          ) : canConfirmNewCustomer ? (
            <>
              <p className="text-xs leading-relaxed text-foreground">
                系統未有此電話號碼的客戶。請先檢查電話；如資料正確，確認新增客戶。
              </p>
              <Button
                type="button"
                size="sm"
                className="min-h-11 w-full touch-manipulation"
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirmNewCustomer?.(normalizedCurrentPhone);
                  setActiveDropdown(null);
                  setSearch("");
                  suppressNextNameDropdownRef.current = true;
                  window.requestAnimationFrame(() => nameInputRef.current?.focus());
                }}
              >
                確認新增客戶
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{searchHint}</p>
          )}
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {odooError && (
            <p className="px-3 py-2 text-[10px] text-destructive border-b border-border">
              Odoo 搜尋暫時不可用，以下顯示本機記錄
            </p>
          )}
          {customerOptions.map((c) => c.recipientMatch?.resolved ? (
            <div key={c.id} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelectWithRecipient(c);
                }}
                className="min-h-11 w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors touch-manipulation"
              >
                {customerOptionContent(c, "一鍵套用下單人＋收貨人")}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSelect(c);
                }}
                className="min-h-11 w-full border-t border-border/60 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/30 touch-manipulation"
              >
                只套用下單人
              </button>
            </div>
          ) : (
            <button
              key={c.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleSelect(c);
              }}
              className="min-h-11 w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border last:border-0 touch-manipulation"
            >
              {customerOptionContent(c)}
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

      {/* Company billing identity */}
      {customerType === "company" && (
        <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-200 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name" className="text-xs font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> 公司名稱 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company-name"
              placeholder="輸入公司名稱"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              className={`text-base ${companyNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={200}
              aria-invalid={Boolean(companyNameError)}
              aria-describedby={companyNameError ? "company-name-error" : undefined}
            />
            {companyNameError && (
              <p id="company-name-error" role="alert" className="text-xs text-destructive">{companyNameError}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing-address" className="text-xs font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> 帳單地址 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="billing-address"
              placeholder="輸入公司帳單地址"
              value={billingAddress}
              onChange={(event) => onBillingAddressChange(event.target.value)}
              className={`min-h-11 text-base ${billingAddressError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={2000}
              aria-invalid={Boolean(billingAddressError)}
              aria-describedby={billingAddressError ? "billing-address-error" : undefined}
            />
            {billingAddressError && (
              <p id="billing-address-error" role="alert" className="text-xs text-destructive">{billingAddressError}</p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-3" ref={lookupRef}>
        <div className="space-y-1.5 relative">
          <Label htmlFor="customer-code-search" className="text-xs font-medium">
            {isNewCustomerConfirmed
              ? "新 Customer ID／客戶編號（選填）"
              : "Customer ID／客戶編號"}
          </Label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="customer-code-search"
              placeholder={isNewCustomerConfirmed
                ? "輸入新 Customer ID，落單時儲存到 Odoo"
                : "輸入 Customer ID 搜尋客戶"}
              value={isNewCustomerConfirmed
                ? customerCode
                : activeDropdown === "customerCode"
                  ? search
                  : selectedCustomer?.customerCode || ""}
              onChange={(event) => {
                if (isNewCustomerConfirmed) {
                  onCustomerCodeChange(event.target.value);
                  return;
                }
                setSearch(event.target.value);
                setActiveDropdown("customerCode");
              }}
              onFocus={() => {
                if (isNewCustomerConfirmed) return;
                setSearch(selectedCustomer?.customerCode || "");
                setActiveDropdown("customerCode");
              }}
              className="pl-9 font-mono text-base"
              maxLength={100}
              autoComplete="off"
            />
          </div>
          {isNewCustomerConfirmed ? (
            <p className="text-[11px] text-muted-foreground">
              呢個 Customer ID 會連同新客戶資料儲存到 Odoo；如已被使用，系統會阻止落單。
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">
                呢度用嚟搜尋現有客戶；以電話確認新增客戶後，可在同一欄設定新 Customer ID。
              </p>
              {customerDropdown("customerCode")}
            </>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                maxLength={30}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "phone-error" : undefined}
              />
            </div>
            {customerDropdown("phone")}
            {phoneError && (
              <p id="phone-error" role="alert" className="text-xs text-destructive">{phoneError}</p>
            )}
            {isNewCustomerConfirmed && (
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
                已確認新增此電話客戶
              </p>
            )}
          </div>
          <div className="space-y-1.5 relative">
            <Label htmlFor="customer-name" className="text-xs font-medium">
              下單人／聯絡人 <span className="text-destructive">*</span>
            </Label>
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
                  if (suppressNextNameDropdownRef.current) {
                    suppressNextNameDropdownRef.current = false;
                    return;
                  }
                  setSearch(customerName);
                  setActiveDropdown("name");
                }}
                onClick={() => {
                  setActiveDropdown("name");
                }}
                className={`pr-10 text-base ${customerNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
                maxLength={100}
                aria-invalid={Boolean(customerNameError)}
                aria-describedby={customerNameError ? "customer-name-error" : undefined}
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
            {customerNameError && (
              <p id="customer-name-error" role="alert" className="text-xs text-destructive">
                {customerNameError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customer-email" className="text-xs font-medium flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          客戶電郵
        </Label>
        <Input
          id="customer-email"
          type="email"
          inputMode="email"
          placeholder="例如：accounts@example.com"
          value={customerEmail}
          onChange={(event) => onCustomerEmailChange(event.target.value)}
          className={`text-base ${customerEmailError ? "border-destructive ring-1 ring-destructive" : ""}`}
          maxLength={254}
          aria-invalid={Boolean(customerEmailError)}
          aria-describedby={customerEmailError ? "customer-email-error" : undefined}
        />
        {customerEmailError && (
          <p id="customer-email-error" role="alert" className="text-xs text-destructive">{customerEmailError}</p>
        )}
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
          aria-invalid={Boolean(senderNameError)}
          aria-describedby={senderNameError ? "sender-name-error" : undefined}
        />
        {senderNameError && (
          <p id="sender-name-error" role="alert" className="text-xs text-destructive">
            {senderNameError}
          </p>
        )}
      </div>
    </div>
  );
};

function sourceRequiresMoreInput(source: CustomerLookupSource | null, value: string) {
  if (!source) return false;
  const trimmed = value.trim();
  if (source === "phone") return trimmed.replace(/\D/g, "").length < 4;
  if (source === "customerCode") return trimmed.length < 1;
  return trimmed.length < 2;
}

export default CustomerSection;
