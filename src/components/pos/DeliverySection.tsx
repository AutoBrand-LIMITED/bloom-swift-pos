import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleAddressSuggestions } from "@/hooks/useGoogleAddressSuggestions";
import { publicGoogleAddressQuery } from "@/lib/google-address";
import {
  deliverySlotSnapshot,
  findDeliverySlot,
  type FrozenDeliverySlotSelection,
} from "@/lib/delivery-slots";
import type { DeliverySlot } from "@/lib/odoo-api";
import {
  HK_DISTRICTS,
  mergeAddressHierarchy,
  parseDeliveryAddress,
  type GoogleAddressSelection,
} from "@/lib/hk-address";
import type { DeliveryTimeMode, RecipientType } from "@/types/order";
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
  User,
  UserCheck,
} from "lucide-react";

interface DeliverySectionProps {
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
  recipientType: RecipientType;
  recipientCompanyName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryPerson: string;
  failedDeliveryAction: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onSlotChange: (slot: DeliverySlot) => void;
  onSpecifiedTimeSelect: () => void;
  onRetryDeliverySlots: () => void;
  onRegionChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onDetailChange: (v: string) => void;
  onGoogleAddressSelect: (selection: GoogleAddressSelection) => void;
  onRecipientTypeChange: (v: RecipientType) => void;
  onRecipientCompanyNameChange: (v: string) => void;
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onDeliveryPersonChange: (v: string) => void;
  onFailedDeliveryActionChange: (v: string) => void;
}

const DeliverySection = ({
  deliveryDate, deliveryTime, deliveryTimeMode, deliverySlotId,
  frozenSlotSelection,
  deliverySlots, deliverySlotsLoading, deliverySlotsError, deliveryTimeError,
  deliveryDateError, deliveryAddressError, recipientNameError, recipientCompanyNameError,
  recipientPhoneError,
  legacyDeliveryTime,
  deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail,
  recipientType, recipientCompanyName, recipientName, recipientPhone,
  deliveryPerson, failedDeliveryAction,
  onDateChange, onTimeChange, onSlotChange, onSpecifiedTimeSelect, onRetryDeliverySlots,
  onRegionChange, onDistrictChange, onAreaChange, onDetailChange,
  onGoogleAddressSelect,
  onRecipientTypeChange, onRecipientCompanyNameChange,
  onRecipientNameChange, onRecipientPhoneChange, onDeliveryPersonChange,
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
  const [activeAddressSuggestion, setActiveAddressSuggestion] = useState(-1);
  const [addressInputFocused, setAddressInputFocused] = useState(false);
  const [addressCompositionActive, setAddressCompositionActive] = useState(false);
  const [addressAutocompleteDirty, setAddressAutocompleteDirty] = useState(false);
  const [authorizedMapSignature, setAuthorizedMapSignature] = useState<string | null>(null);
  const lastManualAddressSignatureRef = useRef<string | null>(null);
  const authorizedAddressSignatureRef = useRef<string | null>(null);
  const previousAddressSignatureRef = useRef(currentAddressSignature);
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
      const hierarchy = mergeAddressHierarchy({
        region: selection.region || parsed.region,
        district: selection.district || parsed.district,
        area: selection.area || parsed.area,
      }, {
        region: deliveryRegion,
        district: deliveryDistrict,
        area: deliveryArea,
      });
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
    onRegionChange(v);
    onDistrictChange("");
    onAreaChange("");
  };

  const handleDistrictChange = (v: string) => {
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        送貨資料
      </h2>
      <div className="space-y-3">
        <div className="space-y-1 max-w-xs">
          <Label htmlFor="delivery-date" className="text-xs flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> 送貨日期
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
            <Clock className="w-3.5 h-3.5" /> 送貨時間
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
                  <Label htmlFor="specified-delivery-time" className="text-xs">
                    指定送貨時間
                  </Label>
                  <Input
                    id="specified-delivery-time"
                    aria-label="指定送貨時間"
                    aria-invalid={Boolean(deliveryTimeError)}
                    value={deliveryTime}
                    onChange={(event) => onTimeChange(event.target.value)}
                    placeholder="例如：上午 10 時前／辦公時間"
                    maxLength={120}
                    className="min-h-11 text-sm"
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
            placeholder="詳細地址（輸入即顯示 Google 建議）"
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
      <div className="space-y-3 border-t border-border pt-3">
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
          <div className="space-y-1">
            <Label htmlFor="recipient-company-name" className="flex items-center gap-1 text-xs">
              <Building2 className="h-3.5 w-3.5" /> 收貨公司名稱
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipient-company-name"
              placeholder="輸入收貨公司名稱"
              value={recipientCompanyName}
              onChange={(e) => onRecipientCompanyNameChange(e.target.value)}
              className={`text-sm ${recipientCompanyNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
              maxLength={200}
              required
              aria-invalid={Boolean(recipientCompanyNameError)}
              aria-describedby={recipientCompanyNameError ? "recipient-company-name-error" : undefined}
            />
            {recipientCompanyNameError && (
              <p id="recipient-company-name-error" role="alert" className="text-xs font-medium text-destructive">
                {recipientCompanyNameError}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
          <Label htmlFor="recipient-name" className="text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 收貨人姓名／聯絡人姓名
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="recipient-name"
            placeholder="收貨人姓名"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            className={`text-sm ${recipientNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={100}
            required
            aria-invalid={Boolean(recipientNameError)}
            aria-describedby={recipientNameError ? "recipient-name-error" : undefined}
          />
          {recipientNameError && (
            <p id="recipient-name-error" role="alert" className="text-xs font-medium text-destructive">
              {recipientNameError}
            </p>
          )}
          </div>
          <div className="space-y-1">
          <Label htmlFor="recipient-phone" className="text-xs">
            收貨人電話 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="recipient-phone"
            placeholder="收貨人電話"
            value={recipientPhone}
            onChange={(e) => onRecipientPhoneChange(e.target.value)}
            className={`text-sm font-mono ${recipientPhoneError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={30}
            required
            aria-invalid={Boolean(recipientPhoneError)}
            aria-describedby={recipientPhoneError ? "recipient-phone-error" : undefined}
          />
          {recipientPhoneError && (
            <p id="recipient-phone-error" role="alert" className="text-xs font-medium text-destructive">
              {recipientPhoneError}
            </p>
          )}
          </div>
        </div>
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
    </div>
  );
};

export default DeliverySection;
