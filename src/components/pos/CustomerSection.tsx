import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  Hash,
  LoaderCircle,
  Mail,
  MapPin,
  RefreshCw,
  User,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemoCustomer } from "@/data/demo-customers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerFlags from "@/components/pos/CustomerFlags";
import RegionalPhoneInput from "@/components/pos/RegionalPhoneInput";
import { customerIdentityKey, loadStoredCustomers, mergeCustomers } from "@/lib/customer-utils";
import {
  hasOdooBackend,
  searchOdooCustomerAccount,
  searchOdooCustomers,
  type CustomerAccountLookup,
} from "@/lib/odoo-api";
import {
  isValidPhoneNumber,
  normalizeCustomerIdentityName,
  normalizePhoneNumber,
} from "@/lib/checkout-validation";
import { phoneLocalDigits, phoneMatchesQuery, phoneSearchRank } from "@/lib/phone-utils";
import {
  customerResolutionIdentityKey,
  type CustomerResolutionState,
} from "@/lib/customer-profile";
import type { OdooNamedReference } from "@/types/order";

export type CustomerType = "personal" | "company";
type CustomerLookupSource = "phone" | "name" | "email" | "customerCode";
const CUSTOMER_CODE_PREFIX_MIN_LENGTH = 2;

interface CustomerSectionProps {
  phone: string;
  customerName: string;
  customerCode: string;
  senderName: string;
  customerType: CustomerType;
  companyName: string;
  customerEmail: string;
  billingAddress: string;
  customerGroup?: string;
  customerGroupId?: number;
  customerGroups?: OdooNamedReference[];
  customerGroupsLoading?: boolean;
  customerGroupsError?: string | null;
  customerGroupLocked?: boolean;
  onPhoneChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onCustomerCodeChange: (v: string) => void;
  onSenderNameChange: (v: string) => void;
  onCustomerTypeChange: (v: CustomerType) => void;
  onCompanyNameChange: (v: string) => void;
  onCustomerEmailChange: (v: string) => void;
  onBillingAddressChange: (v: string) => void;
  onCustomerGroupChange?: (label: string, groupId?: number) => void;
  onCustomerSelect: (c: DemoCustomer) => void;
  onStartNewCustomerUnderAccount?: (customerCode: string) => void;
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
  confirmedNewCustomerName?: string | null;
  confirmedNewCustomerPhone?: string | null;
  onConfirmNewCustomer?: (normalizedPhone: string, normalizedName: string) => void;
  onResolutionStateChange?: (state: CustomerResolutionState) => void;
  refreshKey?: number;
}

const CustomerSection = ({
  phone, customerName, customerCode, senderName, customerType, companyName, customerEmail, billingAddress,
  customerGroup = "", customerGroupId, customerGroups = [], customerGroupsLoading = false,
  customerGroupsError, customerGroupLocked = false,
  onPhoneChange, onNameChange, onCustomerCodeChange, onSenderNameChange, onCustomerTypeChange, onCompanyNameChange,
  onCustomerEmailChange, onBillingAddressChange, onCustomerGroupChange,
  onCustomerSelect, onCustomerAndRecipientSelect, onStartNewCustomerUnderAccount,
  phoneError, customerNameError, senderNameError,
  companyNameError, customerEmailError, billingAddressError, selectedCustomer, refreshKey,
  confirmedNewCustomerName, confirmedNewCustomerPhone, onConfirmNewCustomer,
  onResolutionStateChange,
}: CustomerSectionProps) => {
  const [activeDropdown, setActiveDropdown] = useState<CustomerLookupSource | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [odooCustomers, setOdooCustomers] = useState<DemoCustomer[]>([]);
  const [customerAccount, setCustomerAccount] = useState<CustomerAccountLookup | null>(null);
  const [odooLoading, setOdooLoading] = useState(false);
  const [odooError, setOdooError] = useState<{
    source: CustomerLookupSource;
    query: string;
    message: string;
  } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [completedOdooSearch, setCompletedOdooSearch] = useState<{
    source: CustomerLookupSource;
    query: string;
  } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const selectedCustomerGroup = customerGroups.find((group) => group.id === customerGroupId);
  const customerGroupIsLegacySnapshot = customerGroupId === undefined && Boolean(customerGroup.trim());
  const customerGroupDisabled = customerGroupLocked
    || customerGroupsLoading
    || Boolean(customerGroupsError)
    || customerGroups.length === 0;

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element
        && target.closest("[data-customer-lookup-interactive]")
      ) {
        return;
      }
      setActiveDropdown(null);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, []);

  // Keep only real imported/local customers here. Odoo results are merged below.
  const allCustomers = useMemo(() => {
    const stored = loadStoredCustomers();
    return mergeCustomers([], stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const normalizedSearchPhone = phoneLocalDigits(search);
  const normalizedDebouncedPhone = phoneLocalDigits(debouncedSearch);
  const filtered = allCustomers.filter((c) => {
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(c.email?.toLowerCase().includes(search.toLowerCase())) ||
      c.phone.includes(search) ||
      Boolean(normalizedSearchPhone && phoneMatchesQuery(c.phone, search))
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
        : activeDropdown === "email"
          ? trimmed.includes("@") && trimmed.length >= 3
          : activeDropdown === "customerCode"
            ? trimmed.length >= CUSTOMER_CODE_PREFIX_MIN_LENGTH
            : trimmed.length >= 2;

    if (!activeDropdown || !hasOdooBackend || !canSearch) {
      setOdooLoading(false);
      if (activeDropdown && !canSearch) {
        setOdooCustomers([]);
        setCustomerAccount(null);
        setCompletedOdooSearch(null);
        setOdooError(null);
      }
      return;
    }

    const controller = new AbortController();
    const source = activeDropdown;
    const requestQuery = source === "phone"
      ? normalizedDebouncedPhone
      : trimmed.toLocaleLowerCase();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setOdooLoading(true);
    setOdooError(null);
    setCompletedOdooSearch(null);

    const searchPromise = activeDropdown === "customerCode"
      ? Promise.all([
          searchOdooCustomerAccount(trimmed, controller.signal),
          searchOdooCustomers(
            trimmed,
            controller.signal,
            "customer_code",
            "prefix",
          ),
        ]).then(([account, prefixCustomers]) => ({
          account,
          customers: account.contactCount > 0
            ? account.contacts
            : prefixCustomers,
        }))
      : searchOdooCustomers(trimmed, controller.signal, "general").then((customers) => ({
          account: null,
          customers,
        }));

    searchPromise
      .then(({ account, customers }) => {
        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;
        setCustomerAccount(account);
        setOdooCustomers(customers);
        setCompletedOdooSearch({
          source,
          query: requestQuery,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;
        setOdooCustomers([]);
        setCustomerAccount(null);
        setCompletedOdooSearch(null);
        setOdooError({
          source,
          query: requestQuery,
          message: err instanceof Error ? err.message : "未能連接 Odoo 客戶資料",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted && searchRequestRef.current === requestId) {
          setOdooLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeDropdown, debouncedSearch, normalizedDebouncedPhone, retryKey]);

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
    const visibleLocalCustomers = activeDropdown === "customerCode"
      || (activeDropdown === "email" && !search.trim())
      ? []
      : filtered;

    for (const c of [...visibleOdooCustomers, ...visibleLocalCustomers]) {
      const key = customerIdentityKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(c);
    }

    if (activeDropdown === "phone" && normalizedSearchPhone) {
      options.sort((left, right) => phoneSearchRank(left.phone, search) - phoneSearchRank(right.phone, search));
    }
    return options;
  }, [activeDropdown, completedCurrentSearch, filtered, normalizedSearchPhone, odooCustomers, search]);
  const customerCodeSuggestions = useMemo(() => {
    if (
      activeDropdown !== "customerCode"
      || !completedCurrentSearch
      || (customerAccount?.contactCount ?? 0) > 0
    ) {
      return [];
    }
    const normalizedPrefix = search.trim().toLocaleLowerCase();
    const suggestions = new Map<string, string>();
    for (const customer of odooCustomers) {
      const code = customer.customerCode?.trim();
      if (!code || !code.toLocaleLowerCase().startsWith(normalizedPrefix)) continue;
      suggestions.set(code.toLocaleLowerCase(), code);
    }
    return [...suggestions.values()].sort((left, right) => (
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    ));
  }, [activeDropdown, completedCurrentSearch, customerAccount, odooCustomers, search]);
  const hasCustomerCodeSuggestions = customerCodeSuggestions.length > 0;

  const searchHint =
    sourceRequiresMoreInput(activeDropdown, search)
      ? activeDropdown === "phone"
        ? "輸入至少 4 個電話數字搜尋 Odoo 客戶"
        : activeDropdown === "email"
          ? "輸入完整電郵地址搜尋 Odoo 客戶"
          : activeDropdown === "customerCode"
            ? "輸入至少 2 個 Customer ID 字元搜尋帳戶"
            : "輸入至少 2 個字搜尋下單人或收件人"
      : completedCurrentSearch
        ? activeDropdown === "customerCode"
          ? "未找到此客戶編號"
          : "未搵到客戶"
        : "正在準備搜尋...";

  // 「同客戶相同」係指實際下單人／聯絡人；公司名稱只屬於帳戶資料。
  const orderingCustomerName = customerName.trim() || selectedCustomer?.name.trim() || "";
  const normalizedCurrentPhone = normalizePhoneNumber(phone);
  const currentPhoneSearchKey = phoneLocalDigits(phone);
  const normalizedCurrentCustomerName = normalizeCustomerIdentityName(customerName);
  const canStartNewCustomerWithCode = Boolean(
    hasOdooBackend
      && activeDropdown === "customerCode"
      && search.trim()
      && completedCurrentSearch
      && !odooLoading
      && !odooError
      && customerAccount?.contactCount === 0
      && !hasCustomerCodeSuggestions,
  );
  const hasExistingCustomerAccount = Boolean(
    activeDropdown === "customerCode"
      && completedCurrentSearch
      && customerAccount
      && customerAccount.contactCount > 0,
  );
  const isNewCustomerConfirmed = Boolean(
    normalizedCurrentPhone
      && normalizedCurrentCustomerName
      && confirmedNewCustomerPhone === normalizedCurrentPhone
      && normalizeCustomerIdentityName(confirmedNewCustomerName || "") === normalizedCurrentCustomerName,
  );
  const selectedCustomerConfirmed = Boolean(
    selectedCustomer
      && normalizePhoneNumber(selectedCustomer.phone) === normalizedCurrentPhone
      && normalizeCustomerIdentityName(selectedCustomer.name) === normalizedCurrentCustomerName,
  );
  const currentIdentityKey = customerResolutionIdentityKey(phone, customerName);
  const queryForSource = (source: CustomerLookupSource) => {
    if (source === "phone") return currentPhoneSearchKey;
    if (source === "name") return normalizedCurrentCustomerName;
    if (source === "email") return customerEmail.trim().toLocaleLowerCase();
    return customerCode.trim().toLocaleLowerCase();
  };
  const completedSearchMatchesCurrentIdentity = Boolean(
    completedOdooSearch
      && completedOdooSearch.source !== "customerCode"
      && completedOdooSearch.query === queryForSource(completedOdooSearch.source),
  );
  const currentOdooError = odooError
    && odooError.query === queryForSource(odooError.source)
    ? odooError
    : null;
  const activeOdooError = odooError
    && odooError.source === activeDropdown
    && odooError.query === currentSearchKey
    ? odooError
    : null;
  const hasExactCustomerIdentity = completedSearchMatchesCurrentIdentity && odooCustomers.some((customer) => (
    normalizePhoneNumber(customer.phone) === normalizedCurrentPhone
      && normalizeCustomerIdentityName(customer.name) === normalizedCurrentCustomerName
  ));
  const activeLookupMatchesCurrentIdentity = Boolean(
    activeDropdown
      && activeDropdown !== "customerCode"
      && currentSearchKey === queryForSource(activeDropdown),
  );
  const activeDebouncedKey = activeDropdown === "phone"
    ? normalizedDebouncedPhone
    : debouncedSearch.trim().toLocaleLowerCase();
  let customerResolutionPhase: CustomerResolutionState["phase"] = "idle";
  if (!hasOdooBackend || selectedCustomerConfirmed || isNewCustomerConfirmed) {
    customerResolutionPhase = "confirmed";
  } else if (currentIdentityKey && isValidPhoneNumber(phone)) {
    if (activeLookupMatchesCurrentIdentity && activeDebouncedKey !== currentSearchKey) {
      customerResolutionPhase = "debouncing";
    } else if (activeLookupMatchesCurrentIdentity && odooLoading) {
      customerResolutionPhase = "searching";
    } else if (currentOdooError) {
      customerResolutionPhase = "error";
    } else if (completedSearchMatchesCurrentIdentity) {
      customerResolutionPhase = hasExactCustomerIdentity ? "matches" : "no_match";
    }
  }
  const canConfirmNewCustomer = Boolean(
    !selectedCustomer
      && customerResolutionPhase === "no_match",
  );

  useEffect(() => {
    onResolutionStateChange?.({
      phase: customerResolutionPhase,
      identityKey: currentIdentityKey,
    });
  }, [
    currentIdentityKey,
    customerResolutionPhase,
    onResolutionStateChange,
  ]);
  const isNewCustomerDraft = Boolean(
    isNewCustomerConfirmed
      || (!selectedCustomer && customerCode.trim()),
  );
  const canBackfillSelectedCustomerCode = Boolean(
    selectedCustomer?.odooPartnerId
      && !selectedCustomer.customerCode?.trim(),
  );
  const isCustomerCodeEntry = isNewCustomerDraft || canBackfillSelectedCustomerCode;

  const retryCurrentCustomerLookup = () => {
    const source = currentOdooError?.source || completedOdooSearch?.source || "phone";
    const value = source === "phone"
      ? phone
      : source === "name"
        ? customerName
        : source === "email"
          ? customerEmail
          : customerCode;
    setSearch(value);
    setActiveDropdown(source);
    setRetryKey((key) => key + 1);
  };

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
        {c.email && (
          <p className="mt-1 break-all text-[11px] text-muted-foreground">{c.email}</p>
        )}
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

  const confirmNewCustomerAction = canConfirmNewCustomer && (
    <div className="space-y-2 border-t border-border bg-muted/20 p-3">
      <p className="text-xs leading-relaxed text-foreground">
        搜尋結果唔係同一位聯絡人？可保留電話 {phone.trim()}，以「{customerName.trim()}」新增聯絡人。
      </p>
      <Button
        type="button"
        size="sm"
        className="min-h-11 w-full touch-manipulation"
        onClick={(event) => {
          event.stopPropagation();
          onConfirmNewCustomer?.(normalizedCurrentPhone, customerName.trim());
          setActiveDropdown(null);
          setSearch("");
        }}
      >
        確認新增聯絡人
      </Button>
    </div>
  );

  const customerDropdown = (source: CustomerLookupSource) => activeDropdown === source && (
    <div
      id={`customer-${source}-results`}
      data-customer-lookup-interactive
      className={`absolute z-50 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden ${
      source === "name"
        ? "left-0 right-0 sm:left-auto sm:right-0 sm:w-[calc(200%+0.75rem)]"
        : source === "customerCode" || source === "email"
          ? "left-0 right-0 sm:w-full"
          : "left-0 right-0 sm:w-[calc(200%+0.75rem)]"
      }`}
    >
      {odooLoading ? (
        <p className="text-xs text-muted-foreground p-3">正在搜尋 Odoo 客戶及收件人...</p>
      ) : customerOptions.length === 0 && !hasExistingCustomerAccount ? (
        <div className="p-3 space-y-2">
          {activeOdooError ? (
            <p className="text-xs text-destructive">{activeOdooError.message}</p>
          ) : source === "email" && selectedCustomer?.odooPartnerId ? (
            <p className="text-xs leading-relaxed text-foreground">
              未有其他客戶使用呢個電郵；提交訂單時會補填到已選客戶，不會新增另一位客戶。
            </p>
          ) : canConfirmNewCustomer ? (
            <p className="text-xs leading-relaxed text-foreground">
              系統未有符合此電話及聯絡人名稱嘅客戶。
            </p>
          ) : canStartNewCustomerWithCode ? (
            <>
              <p className="text-xs leading-relaxed text-foreground">
                系統未有此 Customer ID。請先確認編號；如資料正確，可用此編號開始新增客戶。
              </p>
              <Button
                type="button"
                size="sm"
                className="min-h-11 w-full touch-manipulation"
                onClick={(event) => {
                  event.stopPropagation();
                  onCustomerCodeChange(search.trim());
                  setActiveDropdown(null);
                  setSearch("");
                  window.requestAnimationFrame(() => phoneInputRef.current?.focus());
                }}
              >
                確認用此 Customer ID 新增客戶
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{searchHint}</p>
          )}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {hasExistingCustomerAccount && customerAccount && (
            <div className="sticky top-0 z-10 space-y-2 border-b border-border bg-card p-3">
              <p className="text-sm font-semibold">
                {customerAccount.customerCode} 帳戶 · {customerAccount.contactCount} 位聯絡人
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Customer ID 只代表帳戶。請揀實際下單人，系統唔會自動套用第一位聯絡人。
                {customerAccount.truncated ? " 以下只顯示部分聯絡人；可用電話、姓名或電郵搜尋指定人士。" : ""}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 w-full touch-manipulation"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartNewCustomerUnderAccount?.(customerAccount.customerCode);
                  setActiveDropdown(null);
                  setSearch("");
                  window.requestAnimationFrame(() => phoneInputRef.current?.focus());
                }}
              >
                在 {customerAccount.customerCode} 帳戶新增聯絡人
              </Button>
            </div>
          )}
          {activeOdooError && (
            <p className="px-3 py-2 text-[10px] text-destructive border-b border-border">
              Odoo 搜尋暫時不可用，以下顯示本機記錄
            </p>
          )}
          {hasCustomerCodeSuggestions ? (
            <div>
              <div className="border-b border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground">
                  符合「{search.trim()}」嘅 Customer ID
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  請先揀完整編號，再選擇實際下單聯絡人。
                </p>
              </div>
              {customerCodeSuggestions.map((code) => (
                <button
                  key={code.toLocaleLowerCase()}
                  type="button"
                  aria-label={`選擇 Customer ID ${code}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSearch(code);
                    setCustomerAccount(null);
                    setOdooCustomers([]);
                    setCompletedOdooSearch(null);
                  }}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-accent/50"
                >
                  <span className="break-all font-mono text-sm font-semibold text-primary">
                    {code}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">查看帳戶</span>
                </button>
              ))}
            </div>
          ) : customerOptions.map((c) => c.recipientMatch?.resolved ? (
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
      <div className="space-y-3">
        <div className="space-y-1.5 relative">
          <Label htmlFor="customer-code-search" className="text-xs font-medium">
            {canBackfillSelectedCustomerCode
              ? "補填 Customer ID／客戶編號（選填）"
              : isNewCustomerDraft
                ? "新 Customer ID／客戶編號（選填）"
                : "Customer ID／客戶編號"}
          </Label>
          <div className="relative" data-customer-lookup-interactive>
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="customer-code-search"
              placeholder={isCustomerCodeEntry
                ? "輸入 Customer ID，落單時儲存到 Odoo"
                : "輸入 Customer ID 搜尋客戶"}
              value={isCustomerCodeEntry
                ? customerCode
                : activeDropdown === "customerCode"
                  ? search
                  : selectedCustomer?.customerCode || ""}
              onChange={(event) => {
                if (isCustomerCodeEntry) {
                  const nextCustomerCode = event.target.value;
                  onCustomerCodeChange(nextCustomerCode);
                  setSearch(nextCustomerCode);
                  setActiveDropdown("customerCode");
                  return;
                }
                setSearch(event.target.value);
                setActiveDropdown("customerCode");
              }}
              onFocus={() => {
                setSearch(isCustomerCodeEntry
                  ? customerCode
                  : selectedCustomer?.customerCode || "");
                setActiveDropdown("customerCode");
              }}
              className="pl-9 font-mono text-base"
              maxLength={100}
              autoComplete="off"
            />
          </div>
          {isCustomerCodeEntry ? (
            <p className="text-[11px] text-muted-foreground">
              {canBackfillSelectedCustomerCode
                ? "呢個 Customer ID 會喺落單時加入呢位現有 Odoo 聯絡人；同一帳戶可有多位聯絡人。"
                : isNewCustomerConfirmed
                  ? "呢個聯絡人會用此 Customer ID 加入相同帳戶，並連同新客戶資料儲存到 Odoo。"
                  : "已保留呢個帳戶 Customer ID；請輸入電話及聯絡人名稱，再完成『確認新增聯絡人』。"}
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">
                輸入最少 2 個 Customer ID 字元搜尋帳戶；揀完整編號後仍要揀實際聯絡人。
              </p>
            </>
          )}
          {customerDropdown("customerCode")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 relative">
            <Label htmlFor="phone" className="text-xs font-medium">
              下單人電話 <span className="text-destructive">*</span>
            </Label>
            <div data-customer-lookup-interactive>
              <RegionalPhoneInput
                inputRef={phoneInputRef}
                id="phone"
                ariaLabel="下單人電話"
                value={phone}
                onChange={(nextPhone) => {
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
                invalid={Boolean(phoneError)}
              />
            </div>
            {customerDropdown("phone")}
            {phoneError && (
              <p id="phone-error" role="alert" className="text-xs text-destructive">{phoneError}</p>
            )}
            {isNewCustomerConfirmed && (
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
                已確認以此電話及名稱新增聯絡人
              </p>
            )}
          </div>
          <div className="space-y-1.5 relative">
            <Label htmlFor="customer-name" className="text-xs font-medium">
              下單人／聯絡人 <span className="text-destructive">*</span>
            </Label>
            <div className="relative" data-customer-lookup-interactive>
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

        {customerResolutionPhase !== "idle" && (
          <div
            data-testid="customer-resolution-panel"
            aria-live="polite"
            className="rounded-lg border border-border bg-muted/20 p-3"
          >
            {customerResolutionPhase === "debouncing" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                等待確認當前電話及聯絡人...
              </p>
            )}
            {customerResolutionPhase === "searching" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在 Odoo 確認當前電話及聯絡人...
              </p>
            )}
            {customerResolutionPhase === "matches" && (
              <div className="space-y-2">
                <p className="text-xs">找到符合資料的現有客戶，請選擇正確聯絡人完成確認。</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 w-full touch-manipulation"
                  onClick={retryCurrentCustomerLookup}
                >
                  顯示客戶結果
                </Button>
              </div>
            )}
            {customerResolutionPhase === "no_match" && confirmNewCustomerAction}
            {customerResolutionPhase === "error" && (
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  未能完成當前客戶確認。請重試；搜尋完成前不會將此聯絡人當作新客戶。
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 w-full gap-2 touch-manipulation"
                  onClick={retryCurrentCustomerLookup}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重試客戶搜尋
                </Button>
              </div>
            )}
            {customerResolutionPhase === "confirmed" && (
              <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                已確認當前電話及聯絡人，可以繼續下單。
              </p>
            )}
          </div>
        )}

      <div className="space-y-1.5 relative">
        <Label htmlFor="customer-email" className="text-xs font-medium flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          客戶電郵
        </Label>
        <Input
          data-customer-lookup-interactive
          id="customer-email"
          type="email"
          inputMode="email"
          placeholder="例如：accounts@example.com"
          value={customerEmail}
          onChange={(event) => {
            const nextEmail = event.target.value;
            onCustomerEmailChange(nextEmail);
            setSearch(nextEmail);
            setActiveDropdown("email");
          }}
          onFocus={() => {
            setSearch(customerEmail);
            setActiveDropdown("email");
          }}
          className={`text-base ${customerEmailError ? "border-destructive ring-1 ring-destructive" : ""}`}
          maxLength={254}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={activeDropdown === "email" ? "customer-email-results" : undefined}
          aria-expanded={activeDropdown === "email"}
          aria-invalid={Boolean(customerEmailError)}
          aria-describedby={customerEmailError ? "customer-email-error" : undefined}
        />
        {customerDropdown("email")}
        {customerEmailError && (
          <p id="customer-email-error" role="alert" className="text-xs text-destructive">{customerEmailError}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">客戶群組（選填）</Label>
        {customerGroupIsLegacySnapshot ? (
          <div
            className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium"
            aria-label="客戶群組（選填）"
          >
            {customerGroup}
          </div>
        ) : (
          <Select
            value={customerGroupId ? String(customerGroupId) : "none"}
            disabled={customerGroupDisabled}
            onValueChange={(value) => {
              if (value === "none") {
                onCustomerGroupChange?.("");
                return;
              }
              const selected = customerGroups.find((group) => group.id === Number(value));
              if (selected) onCustomerGroupChange?.(selected.name, selected.id);
            }}
          >
            <SelectTrigger className="min-h-11 touch-manipulation text-sm" aria-label="客戶群組（選填）">
              <SelectValue placeholder={customerGroupsLoading ? "正在載入 Odoo Contact Tags..." : "選擇 Odoo Contact Tag"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不指定</SelectItem>
              {customerGroupId && !selectedCustomerGroup && (
                <SelectItem value={String(customerGroupId)} disabled>
                  {customerGroup || `Contact Tag #${customerGroupId}`}
                </SelectItem>
              )}
              {customerGroups.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {customerGroupIsLegacySnapshot && (
          <p className="text-[10px] text-muted-foreground">舊訂單快照；不會當成新 Contact Tag 選項。</p>
        )}
        {customerGroupsError && (
          <p role="status" className="text-[10px] text-destructive">未能同步 Odoo Contact Tags；不會提供未驗證選項。</p>
        )}
        {!customerGroupsError && (
          <p className="text-[10px] text-muted-foreground">
            只可選擇 Odoo 現有 Contact Tag；{selectedCustomer?.odooPartnerId ? "更改會在下單時更新此客戶資料。" : "此處不會建立新分類。"}
          </p>
        )}
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
  if (source === "email") return !trimmed.includes("@") || trimmed.length < 3;
  if (source === "customerCode") return trimmed.length < CUSTOMER_CODE_PREFIX_MIN_LENGTH;
  return trimmed.length < 2;
}

export default CustomerSection;
