import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RegionalPhoneInput from "@/components/pos/RegionalPhoneInput";
import RecipientOccasionEditor from "@/components/pos/RecipientOccasionEditor";
import QuarterHourTimeSelect from "@/components/pos/QuarterHourTimeSelect";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleAddressSuggestions } from "@/hooks/useGoogleAddressSuggestions";
import { publicGoogleAddressQuery } from "@/lib/google-address";
import {
  deliverySlotSnapshot,
  findDeliverySlot,
  type FrozenDeliverySlotSelection,
} from "@/lib/delivery-slots";
import {
  hasOdooBackend,
  searchOdooRecipients,
  type DeliverySlot,
  type RecipientSuggestion,
} from "@/lib/odoo-api";
import {
  HK_DISTRICTS,
  hierarchyFromGoogleSelection,
  parseDeliveryAddress,
  type AddressHierarchy,
  type GoogleAddressSelection,
} from "@/lib/hk-address";
import { cloneRecipientOccasions } from "@/lib/recipient-occasions";
import type { DeliveryTimeMode, FulfillmentType, RecipientOccasion, RecipientType } from "@/types/order";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CircleDollarSign,
  Clock,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Store,
  Truck,
  User,
  UserCheck,
} from "lucide-react";

interface RecipientDraft {
  type: RecipientType;
  companyName: string;
  name: string;
  phone: string;
  occasions?: RecipientOccasion[];
}

interface DeliverySectionProps {
  showFulfillmentSelector?: boolean;
  sectionTitle?: string;
  /** Split destinations cannot replace the order's selected customer. */
  allowLinkedCustomerSelection?: boolean;
  fulfillmentType: FulfillmentType;
  deliveryDate: string;
  deliveryTime: string;
  deliveryTimeMode?: DeliveryTimeMode;
  deliverySlotId?: number;
  frozenSlotSelection?: FrozenDeliverySlotSelection;
  deliverySlots: readonly DeliverySlot[];
  deliverySlotsLoading: boolean;
  deliverySlotsError: string | null;
  deliveryTimeError: string | null;
  deliveryDateError?: string;
  deliveryAddressError?: string;
  recipientNameError?: string;
  recipientCompanyNameError?: string;
  recipientPhoneError?: string;
  legacyDeliveryTime: boolean;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
  deliveryBuilding: string;
  deliveryFloor: string;
  deliveryUnit: string;
  recipientType: RecipientType;
  recipientCompanyName: string;
  recipientName: string;
  recipientPhone: string;
  recipientOccasions?: RecipientOccasion[];
  senderType?: RecipientType;
  senderCompanyName?: string;
  senderName?: string;
  senderPhone?: string;
  deliveryPerson: string;
  failedDeliveryAction: string;
  onDateChange: (v: string) => void;
  onFulfillmentTypeChange: (v: FulfillmentType) => void;
  onTimeChange: (v: string) => void;
  onSlotChange: (slot: DeliverySlot) => void;
  onSpecifiedTimeSelect: () => void;
  onRetryDeliverySlots: () => void;
  onRegionChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onAddressHierarchyChange?: (hierarchy: AddressHierarchy) => void;
  onDetailChange: (v: string) => void;
  onBuildingChange: (v: string) => void;
  onFloorChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  onGoogleAddressSelect: (selection: GoogleAddressSelection) => void;
  onRecipientTypeChange: (v: RecipientType) => void;
  onRecipientCompanyNameChange: (v: string) => void;
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onRecipientOccasionsChange?: (v: RecipientOccasion[] | undefined) => void;
  /** Applies all recipient identity fields in one state update when the parent stores them together. */
  onRecipientDetailsChange?: (recipient: RecipientDraft) => void;
  /** Applies sender identity while retaining a verified Odoo customer binding. */
  onUseSenderAsRecipient?: (recipient: RecipientDraft) => void;
  onRecipientSuggestionSelect: (suggestion: RecipientSuggestion) => void;
  onRecipientAndCustomerSuggestionSelect: (suggestion: RecipientSuggestion) => void;
  onConfirmNewRecipient?: () => void;
  onDeliveryPersonChange: (v: string) => void;
  onFailedDeliveryActionChange: (v: string) => void;
}

const RECIPIENT_SUGGESTION_CACHE_LIMIT = 100;
type RecipientLookupField = "company" | "name" | "phone";
type RecipientLookupPhase = "idle" | "debouncing" | "searching" | "matches" | "no_match" | "error" | "confirmed";

const normalizeRecipientLookupQuery = (field: RecipientLookupField, value: string) => (
  field === "phone"
    ? value.replace(/\D/g, "")
    : value.trim().toLocaleLowerCase()
);

const DeliverySection = ({
  showFulfillmentSelector = true,
  sectionTitle = "收貨方式",
  allowLinkedCustomerSelection = true,
  fulfillmentType,
  deliveryDate, deliveryTime, deliveryTimeMode, deliverySlotId,
  frozenSlotSelection,
  deliverySlots, deliverySlotsLoading, deliverySlotsError, deliveryTimeError,
  deliveryDateError, deliveryAddressError, recipientNameError, recipientCompanyNameError,
  recipientPhoneError,
  legacyDeliveryTime,
  deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail,
  deliveryBuilding, deliveryFloor, deliveryUnit,
  recipientType, recipientCompanyName, recipientName, recipientPhone, recipientOccasions,
  senderType = "personal", senderCompanyName = "", senderName = "", senderPhone = "",
  deliveryPerson, failedDeliveryAction,
  onDateChange, onFulfillmentTypeChange, onTimeChange, onSlotChange, onSpecifiedTimeSelect, onRetryDeliverySlots,
  onRegionChange, onDistrictChange, onAreaChange, onAddressHierarchyChange, onDetailChange,
  onBuildingChange, onFloorChange, onUnitChange,
  onGoogleAddressSelect,
  onRecipientTypeChange, onRecipientCompanyNameChange,
  onRecipientNameChange, onRecipientPhoneChange, onRecipientOccasionsChange = () => {},
  onRecipientDetailsChange, onUseSenderAsRecipient, onRecipientSuggestionSelect,
  onRecipientAndCustomerSuggestionSelect,
  onConfirmNewRecipient,
  onDeliveryPersonChange,
  onFailedDeliveryActionChange,
}: DeliverySectionProps) => {
  const districts = deliveryRegion ? Object.keys(HK_DISTRICTS[deliveryRegion] || {}) : [];
  const areas = deliveryRegion && deliveryDistrict
    ? HK_DISTRICTS[deliveryRegion]?.[deliveryDistrict] || []
    : [];
  const currentAddressSignature = JSON.stringify([
    deliveryRegion,
    deliveryDistrict,
    deliveryArea,
    deliveryDetail,
  ]);
  const addressListboxId = useId();
  const recipientListboxId = useId();
  const [activeAddressSuggestion, setActiveAddressSuggestion] = useState(-1);
  const [addressInputFocused, setAddressInputFocused] = useState(false);
  const [addressCompositionActive, setAddressCompositionActive] = useState(false);
  const [addressAutocompleteDirty, setAddressAutocompleteDirty] = useState(false);
  const [authorizedMapSignature, setAuthorizedMapSignature] = useState<string | null>(null);
  const [recipientLookupField, setRecipientLookupField] = useState<RecipientLookupField | null>(null);
  const [debouncedRecipientQuery, setDebouncedRecipientQuery] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<RecipientSuggestion[]>([]);
  const [recipientSuggestionsLoading, setRecipientSuggestionsLoading] = useState(false);
  const [recipientSuggestionsError, setRecipientSuggestionsError] = useState<{
    field: RecipientLookupField;
    query: string;
    message: string;
  } | null>(null);
  const [recipientRetryKey, setRecipientRetryKey] = useState(0);
  const [completedRecipientSearch, setCompletedRecipientSearch] = useState<{
    field: RecipientLookupField;
    query: string;
  } | null>(null);
  const [confirmedNewRecipientSignature, setConfirmedNewRecipientSignature] = useState<string | null>(null);
  const lastManualAddressSignatureRef = useRef<string | null>(null);
  const authorizedAddressSignatureRef = useRef<string | null>(null);
  const previousAddressSignatureRef = useRef(currentAddressSignature);
  const recipientLookupRef = useRef<HTMLDivElement>(null);
  const recipientSearchRequestRef = useRef(0);
  const recipientSuggestionCacheRef = useRef(new Map<string, RecipientSuggestion[]>());
  const recipientBeforeSenderCopyRef = useRef<RecipientDraft | null>(null);
  const {
    suggestions: addressSuggestions,
    status: addressSuggestionStatus,
    clearSuggestions: clearAddressSuggestions,
    refreshSuggestions: refreshAddressSuggestions,
    selectSuggestion: selectAddressSuggestion,
  } = useGoogleAddressSuggestions({
    value: deliveryDetail,
    region: deliveryRegion,
    district: deliveryDistrict,
    area: deliveryArea,
    enabled: addressInputFocused && addressAutocompleteDirty && !addressCompositionActive,
    onAddressSelect: (selection) => {
      const parsed = parseDeliveryAddress(selection.address);
      const hierarchy = hierarchyFromGoogleSelection(selection);
      const address = parsed.region ? parsed.detail : selection.address;
      authorizedAddressSignatureRef.current = JSON.stringify([
        hierarchy.region,
        hierarchy.district,
        hierarchy.area,
        address,
      ]);
      setAddressAutocompleteDirty(false);
      setAuthorizedMapSignature(authorizedAddressSignatureRef.current);
      onGoogleAddressSelect({
        address,
        ...hierarchy,
      });
    },
  });
  const selectedSlot = findDeliverySlot(deliverySlots, deliverySlotId);
  const frozenSelectedSnapshot = frozenSlotSelection
    && frozenSlotSelection.slotId === deliverySlotId
    ? frozenSlotSelection.snapshot
    : undefined;
  const selectedUnavailableSlot = deliveryTimeMode === "slot"
    && deliverySlotId !== undefined
    && !selectedSlot
    && Boolean((frozenSelectedSnapshot || deliveryTime).trim());
  const selectedTimeValue = deliveryTimeMode === "slot" && deliverySlotId !== undefined
    ? `slot:${deliverySlotId}`
    : deliveryTimeMode === "specified"
      ? "specified"
      : "";
  const activeRecipientQuery = (
    recipientLookupField === "company"
      ? recipientCompanyName
      : recipientLookupField === "name"
        ? recipientName
        : recipientLookupField === "phone"
          ? recipientPhone
          : ""
  ).trim();
  const activeRecipientQueryKey = recipientLookupField
    ? normalizeRecipientLookupQuery(recipientLookupField, activeRecipientQuery)
    : "";
  const completedCurrentRecipientSearch = completedRecipientSearch?.field === recipientLookupField
    && completedRecipientSearch.query === activeRecipientQueryKey;
  const visibleRecipientSuggestions = completedCurrentRecipientSearch
    ? recipientSuggestions
    : [];
  const recipientIdentitySignature = JSON.stringify([
    recipientType,
    recipientCompanyName.trim(),
    recipientName.trim(),
    recipientPhone.trim(),
    recipientOccasions,
  ]);
  const newRecipientConfirmed = confirmedNewRecipientSignature === recipientIdentitySignature;
  const canUseSenderAsRecipient = Boolean(senderName.trim() && senderPhone.trim());
  const recipientMatchesSender = canUseSenderAsRecipient
    && recipientType === senderType
    && recipientCompanyName.trim() === (senderType === "company" ? senderCompanyName.trim() : "")
    && recipientName.trim() === senderName.trim()
    && recipientPhone.trim() === senderPhone.trim()
    && (recipientOccasions?.length || 0) === 0;

  const applyRecipientDraft = (recipient: RecipientDraft) => {
    if (onRecipientDetailsChange) {
      onRecipientDetailsChange(recipient);
      return;
    }
    onRecipientTypeChange(recipient.type);
    onRecipientCompanyNameChange(recipient.companyName);
    onRecipientNameChange(recipient.name);
    onRecipientPhoneChange(recipient.phone);
    onRecipientOccasionsChange(recipient.occasions);
  };

  const handleUseSenderAsRecipient = () => {
    recipientBeforeSenderCopyRef.current = {
      type: recipientType,
      companyName: recipientCompanyName,
      name: recipientName,
      phone: recipientPhone,
      ...(recipientOccasions
        ? { occasions: cloneRecipientOccasions(recipientOccasions) }
        : {}),
    };
    const senderRecipient = {
      type: senderType,
      companyName: senderType === "company" ? senderCompanyName.trim() : "",
      name: senderName.trim(),
      phone: senderPhone.trim(),
      occasions: [],
    };
    if (onUseSenderAsRecipient) {
      onUseSenderAsRecipient(senderRecipient);
    } else {
      applyRecipientDraft(senderRecipient);
    }
    setRecipientLookupField(null);
    setRecipientSuggestions([]);
    setCompletedRecipientSearch(null);
  };

  const handleStopUsingSenderAsRecipient = () => {
    const previousRecipient = recipientBeforeSenderCopyRef.current;
    applyRecipientDraft({
      type: previousRecipient?.type ?? "personal",
      companyName: previousRecipient?.companyName ?? "",
      name: previousRecipient?.name ?? "",
      phone: previousRecipient?.phone ?? "",
      ...(previousRecipient?.occasions
        ? { occasions: cloneRecipientOccasions(previousRecipient.occasions) }
        : {}),
    });
    recipientBeforeSenderCopyRef.current = null;
    setRecipientLookupField(null);
    setRecipientSuggestions([]);
    setCompletedRecipientSearch(null);
  };

  const handleConfirmNewRecipient = () => {
    onConfirmNewRecipient?.();
    setConfirmedNewRecipientSignature(recipientIdentitySignature);
    setRecipientLookupField(null);
    setRecipientSuggestions([]);
    setCompletedRecipientSearch(null);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        recipientLookupRef.current
        && !recipientLookupRef.current.contains(event.target as Node)
      ) {
        setRecipientLookupField(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedRecipientQuery(activeRecipientQuery),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [activeRecipientQuery]);

  useEffect(() => {
    const field = recipientLookupField;
    const query = debouncedRecipientQuery.trim();
    if (!field || !query || !hasOdooBackend) {
      setRecipientSuggestionsLoading(false);
      if (field && !query) {
        setRecipientSuggestions([]);
        setRecipientSuggestionsError(null);
        setCompletedRecipientSearch(null);
      }
      return;
    }

    const queryKey = normalizeRecipientLookupQuery(field, query);
    const cacheKey = `${field}:${queryKey}`;
    const cached = recipientSuggestionCacheRef.current.get(cacheKey);
    if (cached) {
      setRecipientSuggestions(cached);
      setRecipientSuggestionsLoading(false);
      setRecipientSuggestionsError(null);
      setCompletedRecipientSearch({ field, query: queryKey });
      return;
    }

    const controller = new AbortController();
    const requestId = recipientSearchRequestRef.current + 1;
    recipientSearchRequestRef.current = requestId;
    setRecipientSuggestionsLoading(true);
    setRecipientSuggestionsError(null);
    setCompletedRecipientSearch(null);

    searchOdooRecipients(query, controller.signal)
      .then((suggestions) => {
        if (controller.signal.aborted || recipientSearchRequestRef.current !== requestId) return;
        if (recipientSuggestionCacheRef.current.size >= RECIPIENT_SUGGESTION_CACHE_LIMIT) {
          const oldestKey = recipientSuggestionCacheRef.current.keys().next().value;
          if (oldestKey) recipientSuggestionCacheRef.current.delete(oldestKey);
        }
        recipientSuggestionCacheRef.current.set(cacheKey, suggestions);
        setRecipientSuggestions(suggestions);
        setCompletedRecipientSearch({ field, query: queryKey });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || recipientSearchRequestRef.current !== requestId) return;
        setRecipientSuggestions([]);
        setCompletedRecipientSearch(null);
        setRecipientSuggestionsError({
          field,
          query: queryKey,
          message: error instanceof Error ? error.message : "未能搜尋過往收貨人",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted && recipientSearchRequestRef.current === requestId) {
          setRecipientSuggestionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedRecipientQuery, recipientLookupField, recipientRetryKey]);

  const recipientQueryForField = (field: RecipientLookupField) => normalizeRecipientLookupQuery(
    field,
    field === "company"
      ? recipientCompanyName
      : field === "name"
        ? recipientName
        : recipientPhone,
  );
  const completedRecipientSearchMatchesIdentity = Boolean(
    completedRecipientSearch
      && completedRecipientSearch.query === recipientQueryForField(completedRecipientSearch.field),
  );
  const currentRecipientError = recipientSuggestionsError
    && recipientSuggestionsError.query === recipientQueryForField(recipientSuggestionsError.field)
    ? recipientSuggestionsError
    : null;
  const debouncedRecipientQueryKey = recipientLookupField
    ? normalizeRecipientLookupQuery(recipientLookupField, debouncedRecipientQuery)
    : "";
  let recipientLookupPhase: RecipientLookupPhase = "idle";
  if (newRecipientConfirmed) {
    recipientLookupPhase = "confirmed";
  } else if (recipientLookupField && activeRecipientQueryKey) {
    if (debouncedRecipientQueryKey !== activeRecipientQueryKey) {
      recipientLookupPhase = "debouncing";
    } else if (recipientSuggestionsLoading) {
      recipientLookupPhase = "searching";
    } else if (currentRecipientError) {
      recipientLookupPhase = "error";
    } else if (completedRecipientSearchMatchesIdentity) {
      recipientLookupPhase = recipientSuggestions.length > 0 ? "matches" : "no_match";
    }
  } else if (currentRecipientError) {
    recipientLookupPhase = "error";
  } else if (completedRecipientSearchMatchesIdentity) {
    recipientLookupPhase = recipientSuggestions.length > 0 ? "matches" : "no_match";
  }

  const retryCurrentRecipientLookup = () => {
    const field = currentRecipientError?.field || completedRecipientSearch?.field || "phone";
    setRecipientLookupField(field);
    setDebouncedRecipientQuery(
      field === "company"
        ? recipientCompanyName
        : field === "name"
          ? recipientName
          : recipientPhone,
    );
    setRecipientRetryKey((key) => key + 1);
  };

  const handleTimeSelectionChange = (value: string) => {
    if (value === "specified") {
      onSpecifiedTimeSelect();
      return;
    }
    if (!value.startsWith("slot:")) return;
    const slot = findDeliverySlot(deliverySlots, Number(value.slice("slot:".length)));
    if (slot) onSlotChange(slot);
  };

  const handleTimeSelectionKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    const focusedRadio = event.currentTarget.querySelector<HTMLElement>('[role="radio"]:focus');
    const focusedValue = focusedRadio?.getAttribute("value");
    if (focusedValue) handleTimeSelectionChange(focusedValue);
  };

  const handleRegionChange = (v: string) => {
    if (onAddressHierarchyChange) {
      onAddressHierarchyChange({ region: v, district: "", area: "" });
      return;
    }
    onRegionChange(v);
    onDistrictChange("");
    onAreaChange("");
  };

  const handleDistrictChange = (v: string) => {
    if (onAddressHierarchyChange) {
      onAddressHierarchyChange({ region: deliveryRegion, district: v, area: "" });
      return;
    }
    onDistrictChange(v);
    onAreaChange("");
  };

  useEffect(() => {
    setActiveAddressSuggestion(-1);
  }, [addressSuggestions]);

  useEffect(() => {
    const signature = currentAddressSignature;
    if (previousAddressSignatureRef.current === signature) return;
    previousAddressSignatureRef.current = signature;

    if (lastManualAddressSignatureRef.current === signature) {
      lastManualAddressSignatureRef.current = null;
      return;
    }

    if (authorizedAddressSignatureRef.current === signature) {
      authorizedAddressSignatureRef.current = null;
      setAddressAutocompleteDirty(false);
      return;
    }

    authorizedAddressSignatureRef.current = null;
    setAddressAutocompleteDirty(false);
    setAuthorizedMapSignature(null);
    clearAddressSuggestions(true);
  }, [clearAddressSuggestions, currentAddressSignature]);

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && addressSuggestions.length > 0) {
      event.preventDefault();
      setActiveAddressSuggestion((current) => (
        current < addressSuggestions.length - 1 ? current + 1 : 0
      ));
      return;
    }
    if (event.key === "ArrowUp" && addressSuggestions.length > 0) {
      event.preventDefault();
      setActiveAddressSuggestion((current) => (
        current > 0 ? current - 1 : addressSuggestions.length - 1
      ));
      return;
    }
    if (
      event.key === "Enter"
      && activeAddressSuggestion >= 0
      && addressSuggestions[activeAddressSuggestion]
    ) {
      event.preventDefault();
      void selectAddressSuggestion(addressSuggestions[activeAddressSuggestion]);
      return;
    }
    if (event.key === "Escape") {
      clearAddressSuggestions(true);
      setActiveAddressSuggestion(-1);
      return;
    }
    if (event.key === "Tab") {
      clearAddressSuggestions(true);
      setActiveAddressSuggestion(-1);
    }
  };

  // Build full address string for display
  const fullAddress = [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail]
    .filter(Boolean)
    .join(" ");

  const publicMapAddress = publicGoogleAddressQuery(fullAddress);
  const mapQuery = encodeURIComponent(publicMapAddress + " 香港");
  const recipientSuggestionContent = (
    suggestion: RecipientSuggestion,
    actionLabel?: string,
  ) => (
    <>
      <span className="block text-sm font-medium">
        {[suggestion.recipientCompanyName, suggestion.recipientName]
          .filter(Boolean)
          .join(" · ") || "未有姓名"}
      </span>
      <span className="block text-xs font-mono text-muted-foreground">
        {suggestion.recipientPhone || "未有電話"}
      </span>
      {suggestion.deliveryAddress && (
        <span className="mt-1 block text-xs text-muted-foreground">
          {suggestion.deliveryAddress}
        </span>
      )}
      {suggestion.orderingCustomerName && (
        <span className="mt-1 block text-[11px] font-medium text-primary">
          下單人：{suggestion.orderingCustomerName}
          {suggestion.orderingCustomerPhone ? ` · ${suggestion.orderingCustomerPhone}` : ""}
        </span>
      )}
      {actionLabel && (
        <span className="mt-1 block text-[10px] font-medium text-primary">{actionLabel}</span>
      )}
    </>
  );
  const recipientDropdown = (field: RecipientLookupField) => {
    if (recipientLookupField !== field) return null;
    return (
      <div
        id={recipientListboxId}
        role="listbox"
        aria-label="過往收貨人搜尋結果"
        className={`absolute z-50 top-full mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg ${
          field === "company"
            ? "left-0 right-0 sm:w-full"
            : field === "phone"
              ? "left-0 right-0 sm:left-auto sm:right-0 sm:w-[calc(200%+0.75rem)]"
              : "left-0 right-0 sm:w-[calc(200%+0.75rem)]"
        }`}
      >
        {recipientSuggestionsLoading ? (
          <p className="p-3 text-xs text-muted-foreground">正在搜尋過往收貨人...</p>
        ) : currentRecipientError ? (
          <p className="p-3 text-xs text-destructive">{currentRecipientError.message}</p>
        ) : !activeRecipientQuery ? (
          <p className="p-3 text-xs text-muted-foreground">輸入公司、姓名或電話搜尋過往收貨人</p>
        ) : visibleRecipientSuggestions.length === 0 ? (
          completedCurrentRecipientSearch ? (
            <div className="space-y-2 p-3">
              <p className="text-xs text-muted-foreground">未找到過往收貨人</p>
              <p className="text-[11px] text-muted-foreground">
                可在下方確認新增；當前資料有效時亦可繼續下單。
              </p>
            </div>
          ) : (
            <p className="p-3 text-xs text-muted-foreground">正在準備搜尋...</p>
          )
        ) : (
          visibleRecipientSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="border-b border-border last:border-0">
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="min-h-11 w-full px-3 py-2.5 text-left hover:bg-accent/50 touch-manipulation"
                onClick={() => {
                  if (suggestion.orderingCustomerId && allowLinkedCustomerSelection) {
                    onRecipientAndCustomerSuggestionSelect(suggestion);
                  } else {
                    onRecipientSuggestionSelect(suggestion);
                  }
                  setConfirmedNewRecipientSignature(null);
                  setRecipientLookupField(null);
                  setRecipientSuggestions([]);
                  setCompletedRecipientSearch(null);
                }}
              >
                {recipientSuggestionContent(
                  suggestion,
                  suggestion.orderingCustomerId && allowLinkedCustomerSelection
                    ? "一鍵套用收貨人＋下單人"
                    : suggestion.orderingCustomerId
                      ? "只複製收貨人資料；不會更改下單人"
                      : undefined,
                )}
              </button>
              {suggestion.orderingCustomerId && allowLinkedCustomerSelection && (
                <button
                  type="button"
                  className="min-h-11 w-full border-t border-border/60 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/30 touch-manipulation"
                  onClick={() => {
                    onRecipientSuggestionSelect(suggestion);
                    setConfirmedNewRecipientSignature(null);
                    setRecipientLookupField(null);
                    setRecipientSuggestions([]);
                    setCompletedRecipientSearch(null);
                  }}
                >
                  只套用收貨人
                </button>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        {sectionTitle}
      </h2>
      {showFulfillmentSelector && (
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="收貨方式">
        <Button
          type="button"
          variant="outline"
          aria-pressed={fulfillmentType === "delivery"}
          className={`min-h-11 ${fulfillmentType === "delivery" ? "border-primary bg-primary/10 text-primary" : ""}`}
          onClick={() => onFulfillmentTypeChange("delivery")}
        >
          <Truck className="mr-1.5 h-4 w-4" />送貨
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={fulfillmentType === "pickup"}
          className={`min-h-11 ${fulfillmentType === "pickup" ? "border-primary bg-primary/10 text-primary" : ""}`}
          onClick={() => onFulfillmentTypeChange("pickup")}
        >
          <Store className="mr-1.5 h-4 w-4" />自取
        </Button>
      </div>
      )}
      {fulfillmentType === "pickup" && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          自取訂單只需選擇日期及時間，毋須填寫地址或收貨人資料。
        </p>
      )}
      <div className="space-y-3">
        <div className="space-y-1 max-w-xs">
          <Label htmlFor="delivery-date" className="text-xs flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> {fulfillmentType === "pickup" ? "取貨日期" : "送貨日期"}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="delivery-date"
            aria-label="送貨日期"
            aria-invalid={Boolean(deliveryDateError)}
            aria-describedby={deliveryDateError ? "delivery-date-error" : undefined}
            type="date"
            value={deliveryDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={`text-sm ${deliveryDateError ? "border-destructive ring-1 ring-destructive" : ""}`}
          />
          {deliveryDateError && (
            <p id="delivery-date-error" role="alert" className="text-xs font-medium text-destructive">
              {deliveryDateError}
            </p>
          )}
        </div>

        <fieldset
          className="space-y-2"
          aria-invalid={Boolean(deliveryTimeError)}
          aria-describedby={deliveryTimeError ? "delivery-time-error" : undefined}
        >
          <legend className="text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {fulfillmentType === "pickup" ? "取貨時間" : "送貨時間"}
            <span className="text-destructive">*</span>
          </legend>

          {legacyDeliveryTime && (
            <div role="alert" className="space-y-1 border border-destructive/40 bg-destructive/5 p-3">
              <Label htmlFor="legacy-delivery-time" className="text-xs text-muted-foreground">
                舊格式時間（請重新選擇）
              </Label>
              <Input
                id="legacy-delivery-time"
                aria-label="舊格式送貨時間"
                value={deliveryTime}
                readOnly
                className="min-h-11 bg-muted text-sm font-mono"
              />
            </div>
          )}
          <>
            <RadioGroup
                aria-label="送貨時間選擇"
                value={selectedTimeValue}
                onValueChange={handleTimeSelectionChange}
                onKeyUp={handleTimeSelectionKeyUp}
                className="grid gap-2 sm:grid-cols-2"
              >
                {deliverySlotsLoading && (
                  <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    正在載入標準時段...
                  </div>
                )}

                {!deliverySlotsLoading && deliverySlotsError && (
                  <div role="alert" className="flex min-h-11 flex-wrap items-center justify-between gap-2 border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm sm:col-span-2">
                    <span>{deliverySlotsError}</span>
                    <Button type="button" variant="outline" size="sm" onClick={onRetryDeliverySlots} className="min-h-11 gap-2">
                      <RefreshCw className="h-4 w-4" />
                      重試
                    </Button>
                  </div>
                )}

                {!deliverySlotsLoading && !deliverySlotsError && deliverySlots.length === 0 && (
                  <p className="flex min-h-11 items-center text-sm text-muted-foreground sm:col-span-2">
                    目前沒有標準時段
                  </p>
                )}

                {!deliverySlotsLoading && !deliverySlotsError && deliverySlots.map((slot) => {
                  const selected = deliveryTimeMode === "slot" && deliverySlotId === slot.id;
                  const snapshot = selected && frozenSelectedSnapshot?.trim()
                    ? frozenSelectedSnapshot
                    : deliverySlotSnapshot(slot);
                  const value = `slot:${slot.id}`;
                  return (
                    <RadioGroupPrimitive.Item
                      key={slot.id}
                      id={`delivery-slot-${slot.id}`}
                      value={value}
                      aria-label={snapshot}
                      className={`min-h-11 border px-3 py-2 text-left text-sm font-medium transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {snapshot}
                    </RadioGroupPrimitive.Item>
                  );
                })}

                {selectedUnavailableSlot && (
                  <RadioGroupPrimitive.Item
                    id="delivery-slot-unavailable"
                    value={`slot:${deliverySlotId}`}
                    aria-label={frozenSelectedSnapshot || deliveryTime}
                    className="min-h-11 border border-primary bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground opacity-80"
                    disabled
                  >
                    {frozenSelectedSnapshot || deliveryTime}
                  </RadioGroupPrimitive.Item>
                )}

                <RadioGroupPrimitive.Item
                  id="delivery-time-specified"
                  value="specified"
                  aria-label="指定時間"
                  className={`min-h-11 border px-3 py-2 text-left text-sm font-medium transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    deliveryTimeMode === "specified"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  指定時間
                </RadioGroupPrimitive.Item>
              </RadioGroup>

            {deliveryTimeMode === "specified" && (
              <div className="space-y-1 pt-1">
                  <QuarterHourTimeSelect
                    id="specified-delivery-time"
                    label="指定送貨時間"
                    value={deliveryTime}
                    onChange={onTimeChange}
                    ariaInvalid={Boolean(deliveryTimeError)}
                    ariaDescribedBy={deliveryTimeError ? "delivery-time-error" : undefined}
                    className="min-h-11 max-w-xs text-sm"
                  />
                  <p className="flex items-start gap-1 text-xs text-muted-foreground">
                    <CircleDollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    指定時間可能另收附加費
                  </p>
              </div>
            )}
          </>

          {deliveryTimeError && (
            <p id="delivery-time-error" role="alert" className="text-xs font-medium text-destructive">
              {deliveryTimeError}
            </p>
          )}
        </fieldset>
      </div>

      {fulfillmentType === "delivery" && <>
      {/* Address: Region → District → Area */}
      <div className="space-y-2">
        <Label htmlFor="delivery-detail" className="text-xs">
          送貨地址 <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          <Select value={deliveryRegion} onValueChange={handleRegionChange}>
            <SelectTrigger className="text-sm" aria-label="送貨地區">
              <SelectValue placeholder="地區" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(HK_DISTRICTS).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deliveryDistrict} onValueChange={handleDistrictChange} disabled={!deliveryRegion}>
            <SelectTrigger className="text-sm" aria-label="送貨分區">
              <SelectValue placeholder="分區" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deliveryArea} onValueChange={onAreaChange} disabled={!deliveryDistrict}>
            <SelectTrigger className="text-sm" aria-label="送貨地點">
              <SelectValue placeholder="地點" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Input
            id="delivery-detail"
            placeholder="搜尋並選擇 Google 地址"
            value={deliveryDetail}
            onChange={(event) => {
              lastManualAddressSignatureRef.current = JSON.stringify([
                deliveryRegion,
                deliveryDistrict,
                deliveryArea,
                event.target.value,
              ]);
              setAddressAutocompleteDirty(true);
              setAuthorizedMapSignature(lastManualAddressSignatureRef.current);
              onDetailChange(event.target.value);
            }}
            onKeyDown={handleAddressKeyDown}
            onFocus={() => {
              setAddressInputFocused(true);
              refreshAddressSuggestions();
            }}
            onBlur={() => {
              setAddressInputFocused(false);
              clearAddressSuggestions(true);
            }}
            onCompositionStart={() => {
              setAddressCompositionActive(true);
              clearAddressSuggestions();
            }}
            onCompositionEnd={() => setAddressCompositionActive(false)}
            className={`min-h-11 text-sm ${deliveryAddressError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={200}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={addressSuggestions.length > 0}
            aria-controls={addressListboxId}
            aria-activedescendant={
              activeAddressSuggestion >= 0
                ? `${addressListboxId}-option-${activeAddressSuggestion}`
                : undefined
            }
            aria-invalid={Boolean(deliveryAddressError)}
            aria-describedby={deliveryAddressError ? "delivery-address-error" : undefined}
          />
          {addressSuggestions.length > 0 && (
            <div
              id={addressListboxId}
              role="listbox"
              aria-label="Google 地址建議"
              className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {addressSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${index}`}
                  id={`${addressListboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeAddressSuggestion === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveAddressSuggestion(index)}
                  onClick={() => void selectAddressSuggestion(suggestion)}
                  className={`flex min-h-11 w-full touch-manipulation flex-col items-start px-3 py-2 text-left text-sm ${
                    activeAddressSuggestion === index
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60"
                  }`}
                >
                  <span className="font-medium">{suggestion.mainText}</span>
                  {suggestion.secondaryText && (
                    <span className="text-xs text-muted-foreground">
                      {suggestion.secondaryText}
                    </span>
                  )}
                </button>
              ))}
              <div className="flex justify-end border-t border-border px-3 py-1.5">
                <img
                  src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                  alt="Google"
                  className="h-4 w-auto"
                />
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Google 地址只記錄街道及大廈位置；樓層、座數及單位請填在下方，唔會影響 Google 配對。
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input
            aria-label="大廈或座數"
            placeholder="大廈／座（選填）"
            value={deliveryBuilding}
            onChange={(event) => onBuildingChange(event.target.value)}
            maxLength={120}
          />
          <Input
            aria-label="樓層"
            placeholder="樓層（選填）"
            value={deliveryFloor}
            onChange={(event) => onFloorChange(event.target.value)}
            maxLength={40}
          />
          <Input
            aria-label="室或單位"
            placeholder="室／單位（選填）"
            value={deliveryUnit}
            onChange={(event) => onUnitChange(event.target.value)}
            maxLength={60}
          />
        </div>
        {addressSuggestionStatus === "loading" && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            正在搜尋 Google 地址...
          </p>
        )}
        {addressSuggestionStatus === "empty" && (
          <p role="status" className="text-xs text-muted-foreground">
            搵唔到 Google 地址；你可以繼續手動輸入。
          </p>
        )}
        {addressSuggestionStatus === "unavailable" && (
          <p role="status" className="text-xs text-muted-foreground">
            Google 地址建議暫時不可用；你可以繼續手動輸入。
          </p>
        )}
        {deliveryAddressError && (
          <p id="delivery-address-error" role="alert" className="text-xs font-medium text-destructive">
            {deliveryAddressError}
          </p>
        )}
        {fullAddress && (
          <p className="text-xs text-muted-foreground">
            📍 {fullAddress}
          </p>
        )}
        {publicMapAddress.length > 2 && authorizedMapSignature !== currentAddressSignature && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2"
            onClick={() => setAuthorizedMapSignature(currentAddressSignature)}
          >
            <MapPin className="h-4 w-4" />
            顯示 Google 地圖
          </Button>
        )}
        {publicMapAddress.length > 2 && authorizedMapSignature === currentAddressSignature && (
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

      {/* Recipient info */}
      <div ref={recipientLookupRef} className="space-y-3 border-t border-border pt-3">
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div>
            <Label htmlFor={`${recipientListboxId}-same-as-sender`} className="text-sm font-medium">
              收貨人同送花人相同
            </Label>
            <p className="text-xs text-muted-foreground">一鍵套用送花人姓名、電話及公司資料。</p>
          </div>
          <Checkbox
            id={`${recipientListboxId}-same-as-sender`}
            aria-label="收貨人同送花人相同"
            checked={recipientMatchesSender}
            disabled={!canUseSenderAsRecipient}
            onCheckedChange={(checked) => {
              if (checked) {
                handleUseSenderAsRecipient();
              } else {
                handleStopUsingSenderAsRecipient();
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">收貨人類型</Label>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="收貨人類型">
            <Button
              type="button"
              variant="outline"
              aria-pressed={recipientType === "personal"}
              className={`min-h-11 touch-manipulation ${
                recipientType === "personal" ? "border-primary bg-primary/10 text-primary" : ""
              }`}
              onClick={() => onRecipientTypeChange("personal")}
            >
              <User className="mr-1.5 h-4 w-4" /> 個人
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={recipientType === "company"}
              className={`min-h-11 touch-manipulation ${
                recipientType === "company" ? "border-primary bg-primary/10 text-primary" : ""
              }`}
              onClick={() => onRecipientTypeChange("company")}
            >
              <Building2 className="mr-1.5 h-4 w-4" /> 公司
            </Button>
          </div>
        </div>

        {recipientType === "company" && (
          <div className="relative space-y-1">
            <Label htmlFor="recipient-company-name" className="flex items-center gap-1 text-xs">
              <Building2 className="h-3.5 w-3.5" /> 收貨公司名稱
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipient-company-name"
              placeholder="輸入收貨公司名稱"
              value={recipientCompanyName}
              onChange={(e) => {
                onRecipientCompanyNameChange(e.target.value);
                setRecipientLookupField("company");
              }}
              onFocus={() => setRecipientLookupField("company")}
              className={`text-sm ${recipientCompanyNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={200}
              required
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={recipientLookupField === "company" ? recipientListboxId : undefined}
              aria-expanded={recipientLookupField === "company"}
              aria-invalid={Boolean(recipientCompanyNameError)}
              aria-describedby={recipientCompanyNameError ? "recipient-company-name-error" : undefined}
            />
            {recipientDropdown("company")}
            {recipientCompanyNameError && (
              <p id="recipient-company-name-error" role="alert" className="text-xs font-medium text-destructive">
                {recipientCompanyNameError}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative space-y-1">
          <Label htmlFor="recipient-name" className="text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 收貨人姓名／聯絡人姓名
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="recipient-name"
            placeholder="收貨人姓名"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            onFocus={() => setRecipientLookupField("name")}
            className={`text-sm ${recipientNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={100}
            required
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={recipientLookupField === "name" ? recipientListboxId : undefined}
            aria-expanded={recipientLookupField === "name"}
            aria-invalid={Boolean(recipientNameError)}
            aria-describedby={recipientNameError ? "recipient-name-error" : undefined}
          />
          {recipientNameError && (
            <p id="recipient-name-error" role="alert" className="text-xs font-medium text-destructive">
              {recipientNameError}
            </p>
          )}
          {recipientDropdown("name")}
          </div>
          <div className="relative space-y-1">
          <Label htmlFor="recipient-phone" className="text-xs">
            收貨人電話 <span className="text-destructive">*</span>
          </Label>
          <RegionalPhoneInput
            id="recipient-phone"
            ariaLabel="收貨人電話"
            value={recipientPhone}
            onChange={onRecipientPhoneChange}
            onFocus={() => setRecipientLookupField("phone")}
            invalid={Boolean(recipientPhoneError)}
            compact
          />
          {recipientPhoneError && (
            <p id="recipient-phone-error" role="alert" className="text-xs font-medium text-destructive">
              {recipientPhoneError}
            </p>
          )}
          {recipientDropdown("phone")}
          </div>
        </div>
        <RecipientOccasionEditor
          label={`${sectionTitle} 收花人重要日子`}
          occasions={recipientOccasions || []}
          onChange={onRecipientOccasionsChange}
        />
        {recipientLookupPhase !== "idle" && (
          <div
            data-testid="recipient-resolution-panel"
            aria-live="polite"
            className="rounded-lg border border-border bg-muted/20 p-3"
          >
            {recipientLookupPhase === "debouncing" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                等待搜尋當前收貨人資料...
              </p>
            )}
            {recipientLookupPhase === "searching" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在 Odoo 搜尋當前收貨人...
              </p>
            )}
            {recipientLookupPhase === "matches" && (
              <div className="space-y-2">
                <p className="text-xs">找到過往收貨人；可從結果套用資料，亦可保留當前有效資料繼續。</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 w-full"
                  onClick={retryCurrentRecipientLookup}
                >
                  顯示收貨人結果
                </Button>
              </div>
            )}
            {recipientLookupPhase === "no_match" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  未找到過往收貨人。當前資料有效時仍可繼續下單；亦可先確認新增。
                </p>
                <Button type="button" size="sm" className="min-h-11 w-full" onClick={handleConfirmNewRecipient}>
                  確認新增收貨人
                </Button>
              </div>
            )}
            {recipientLookupPhase === "error" && (
              <div className="space-y-2">
                <p className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  收貨人搜尋暫時失敗。可重試；當前有效收貨資料不會因此被阻擋。
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 w-full gap-2"
                  onClick={retryCurrentRecipientLookup}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> 重試收貨人搜尋
                </Button>
              </div>
            )}
            {recipientLookupPhase === "confirmed" && (
              <p className="text-xs font-medium text-primary">
                已確認當前收貨人；提交訂單時會儲存到 Odoo 訂單。
              </p>
            )}
          </div>
        )}
      </div>

      {/* Delivery person */}
      <div className="grid grid-cols-2 gap-3">
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
      </>}
    </div>
  );
};

export default DeliverySection;
