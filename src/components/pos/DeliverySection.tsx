import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deliverySlotSnapshot,
  findDeliverySlot,
  type FrozenDeliverySlotSelection,
} from "@/lib/delivery-slots";
import type { DeliverySlot } from "@/lib/odoo-api";
import { HK_DISTRICTS } from "@/lib/hk-address";
import type { DeliveryTimeMode } from "@/types/order";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { KeyboardEvent } from "react";
import {
  AlertCircle,
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
  recipientPhoneError?: string;
  legacyDeliveryTime: boolean;
  deliveryRegion: string;
  deliveryDistrict: string;
  deliveryArea: string;
  deliveryDetail: string;
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
  onRecipientNameChange: (v: string) => void;
  onRecipientPhoneChange: (v: string) => void;
  onDeliveryPersonChange: (v: string) => void;
  onFailedDeliveryActionChange: (v: string) => void;
}

const DeliverySection = ({
  deliveryDate, deliveryTime, deliveryTimeMode, deliverySlotId,
  frozenSlotSelection,
  deliverySlots, deliverySlotsLoading, deliverySlotsError, deliveryTimeError,
  deliveryDateError, deliveryAddressError, recipientNameError, recipientPhoneError,
  legacyDeliveryTime,
  deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail,
  recipientName, recipientPhone, deliveryPerson, failedDeliveryAction,
  onDateChange, onTimeChange, onSlotChange, onSpecifiedTimeSelect, onRetryDeliverySlots,
  onRegionChange, onDistrictChange, onAreaChange, onDetailChange,
  onRecipientNameChange, onRecipientPhoneChange, onDeliveryPersonChange,
  onFailedDeliveryActionChange,
}: DeliverySectionProps) => {
  const districts = deliveryRegion ? Object.keys(HK_DISTRICTS[deliveryRegion] || {}) : [];
  const areas = deliveryRegion && deliveryDistrict
    ? HK_DISTRICTS[deliveryRegion]?.[deliveryDistrict] || []
    : [];
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

  // Build full address string for display
  const fullAddress = [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail]
    .filter(Boolean)
    .join(" ");

  const mapQuery = encodeURIComponent(fullAddress + " 香港");

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
        <Input
          id="delivery-detail"
          placeholder="詳細地址（大廈名 / 樓層 / 室）"
          value={deliveryDetail}
          onChange={(e) => onDetailChange(e.target.value)}
          className={`text-sm ${deliveryAddressError ? "border-destructive ring-1 ring-destructive" : ""}`}
          maxLength={200}
          aria-invalid={Boolean(deliveryAddressError)}
          aria-describedby={deliveryAddressError ? "delivery-address-error" : undefined}
        />
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
        {fullAddress.length > 2 && (
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
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
        <div className="space-y-1">
          <Label htmlFor="recipient-name" className="text-xs flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> 收貨人姓名
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="recipient-name"
            placeholder="收貨人姓名"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            className={`text-sm ${recipientNameError ? "border-destructive ring-1 ring-destructive" : ""}`}
            maxLength={100}
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
