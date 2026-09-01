import { PackageOpen, Plus, Trash2 } from "lucide-react";

import DeliverySection from "@/components/pos/DeliverySection";
import GiftCardSection from "@/components/pos/GiftCardSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deliverySlotSnapshot } from "@/lib/delivery-slots";
import {
  recipientOccasionsStateFromSelection,
  recipientOccasionsVersionFromSelection,
} from "@/lib/recipient-occasions";
import { resolveRecipientSuggestionForCustomer } from "@/lib/recipient-binding";
import {
  hierarchyFromGoogleSelection,
  parseDeliveryAddress,
  type GoogleAddressSelection,
} from "@/lib/hk-address";
import type { DeliverySlot, RecipientSuggestion } from "@/lib/odoo-api";
import type { DeliverySplit, OrderItem } from "@/types/order";

interface SplitDeliverySectionProps {
  items: OrderItem[];
  splits: DeliverySplit[];
  onChange: (splits: DeliverySplit[]) => void;
  defaultDeliveryDate: string;
  defaultDeliveryTime: string;
  defaultDeliveryTimeMode?: "slot" | "specified";
  defaultDeliverySlotId?: number;
  deliverySlots: readonly DeliverySlot[];
  deliverySlotsLoading: boolean;
  deliverySlotsError: string | null;
  onRetryDeliverySlots: () => void;
  senderType: "personal" | "company";
  senderCompanyName: string;
  senderName: string;
  senderPhone: string;
  orderingCustomerId?: number;
  senderPartnerId?: number;
  activeHistoryAddressSplitId?: string;
  onHistoryAddressTargetChange?: (splitId?: string) => void;
}

const addressSnapshot = (split: DeliverySplit) => {
  const googleAddress = [
    split.deliveryRegion,
    split.deliveryDistrict,
    split.deliveryArea,
    split.deliveryDetail.trim(),
  ].filter(Boolean).join(" ");
  const deliveryAddress = [
    googleAddress,
    split.deliveryBuilding.trim(),
    split.deliveryFloor.trim() ? `${split.deliveryFloor.trim()}樓` : "",
    split.deliveryUnit.trim() ? `${split.deliveryUnit.trim()}室` : "",
  ].filter(Boolean).join("，");
  return { ...split, deliveryGoogleAddress: googleAddress, deliveryAddress };
};

const newSplit = (props: SplitDeliverySectionProps): DeliverySplit => ({
  id: crypto.randomUUID(),
  fulfillmentType: "delivery",
  deliveryDate: props.defaultDeliveryDate,
  deliveryTimeMode: props.defaultDeliveryTimeMode,
  deliverySlotId: props.defaultDeliverySlotId,
  deliveryTime: props.defaultDeliveryTime,
  deliveryRegion: "",
  deliveryDistrict: "",
  deliveryArea: "",
  deliveryDetail: "",
  deliveryAddress: "",
  deliveryGoogleAddress: "",
  deliveryBuilding: "",
  deliveryFloor: "",
  deliveryUnit: "",
  recipientType: "personal",
  recipientCompanyName: "",
  recipientName: "",
  recipientPhone: "",
  recipientOccasions: [],
  deliveryPerson: "",
  failedDeliveryAction: "none",
  deliveryNote: "",
  giftCardEnabled: false,
  giftCardMessage: "",
  itemAllocations: [],
});

const recipientOccasionsForEditor = (split: DeliverySplit) => {
  const state = recipientOccasionsStateFromSelection(split);
  return state.known ? state.value : undefined;
};

const SplitDeliverySection = (props: SplitDeliverySectionProps) => {
  const update = (id: string, changes: Partial<DeliverySplit>, refreshAddress = false) => {
    props.onChange(props.splits.map((split) => {
      if (split.id !== id) return split;
      const next = { ...split, ...changes };
      return refreshAddress ? addressSnapshot(next) : next;
    }));
  };

  const updateRecipientIdentity = (id: string, changes: Partial<DeliverySplit>) => {
    update(id, {
      ...changes,
      recipientPartnerId: undefined,
      recipientOccasionsVersion: undefined,
    });
  };

  const remove = (id: string) => {
    props.onChange(props.splits.filter((split) => split.id !== id));
    if (props.activeHistoryAddressSplitId === id) {
      props.onHistoryAddressTargetChange?.();
    }
  };

  const applyRecipient = (split: DeliverySplit, suggestion: RecipientSuggestion) => {
    const { selection } = resolveRecipientSuggestionForCustomer(
      suggestion,
      props.orderingCustomerId,
    );
    const occasionState = recipientOccasionsStateFromSelection(selection);
    const occasionVersion = selection.shippingPartnerId
      ? recipientOccasionsVersionFromSelection(selection)
      : undefined;
    const changes: Partial<DeliverySplit> = {
      recipientType: selection.recipientType || "personal",
      recipientCompanyName: selection.recipientCompanyName || "",
      recipientName: selection.recipientName || "",
      recipientPhone: selection.recipientPhone || "",
      recipientPartnerId: selection.shippingPartnerId ?? undefined,
    };
    if (occasionState.known) changes.recipientOccasions = occasionState.value;
    if (occasionVersion !== undefined) {
      changes.recipientOccasionsVersion = occasionVersion;
    }
    if (selection.deliveryAddress) {
      const parsed = parseDeliveryAddress(selection.deliveryAddress);
      Object.assign(changes, {
        deliveryRegion: parsed.region,
        deliveryDistrict: parsed.district,
        deliveryArea: parsed.area,
        deliveryDetail: parsed.detail,
      });
    }
    const next = { ...split, ...changes };
    delete next.recipientBirthday;
    if (!occasionState.known) delete next.recipientOccasions;
    if (occasionVersion === undefined) delete next.recipientOccasionsVersion;
    props.onChange(props.splits.map((candidate) => (
      candidate.id === split.id ? addressSnapshot(next) : candidate
    )));
  };

  const allocationFor = (split: DeliverySplit, itemId: string) => (
    split.itemAllocations.find((entry) => entry.itemId === itemId)?.quantity || 0
  );

  const allocatedOutside = (splitId: string, itemId: string) => props.splits.reduce(
    (total, split) => total + (split.id === splitId ? 0 : allocationFor(split, itemId)),
    0,
  );

  const setAllocation = (split: DeliverySplit, item: OrderItem, rawValue: string) => {
    const max = Math.max(0, item.quantity - allocatedOutside(split.id, item.id));
    const quantity = Math.min(max, Math.max(0, Math.trunc(Number(rawValue) || 0)));
    const itemAllocations = split.itemAllocations.filter((entry) => entry.itemId !== item.id);
    if (quantity > 0) itemAllocations.push({ itemId: item.id, itemName: item.name, quantity });
    update(split.id, { itemAllocations });
  };

  const primaryRemainder = (item: OrderItem) => Math.max(
    0,
    item.quantity - props.splits.reduce((total, split) => total + allocationFor(split, item.id), 0),
  );

  return (
    <div className="space-y-3">
      {props.splits.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <PackageOpen className="h-4 w-4" />主要收貨點保留商品
          </p>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {props.items.map((item) => (
              <span key={item.id}>{item.name}：{primaryRemainder(item)} 件</span>
            ))}
          </div>
        </div>
      )}

      {props.splits.map((split, index) => (
        <div
          key={split.id}
          role="group"
          aria-label={`拆單收貨點 ${index + 2}`}
          onFocusCapture={() => props.onHistoryAddressTargetChange?.(split.id)}
          onMouseEnter={() => props.onHistoryAddressTargetChange?.(split.id)}
          onPointerDownCapture={() => props.onHistoryAddressTargetChange?.(split.id)}
          className={`space-y-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
            props.activeHistoryAddressSplitId === split.id
              ? "border-primary bg-primary/[0.03]"
              : "border-primary/30"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">拆單收貨點 {index + 2}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => remove(split.id)}>
              <Trash2 className="mr-1.5 h-4 w-4" />移除
            </Button>
          </div>

          <DeliverySection
            showFulfillmentSelector
            sectionTitle={`額外收貨資料 ${index + 2}`}
            historyAddressTarget={props.activeHistoryAddressSplitId === split.id}
            allowLinkedCustomerSelection={false}
            fulfillmentType={split.fulfillmentType || "delivery"}
            deliveryDate={split.deliveryDate}
            deliveryTime={split.deliveryTime}
            deliveryTimeMode={split.deliveryTimeMode}
            deliverySlotId={split.deliverySlotId}
            deliverySlots={props.deliverySlots}
            deliverySlotsLoading={props.deliverySlotsLoading}
            deliverySlotsError={props.deliverySlotsError}
            deliveryTimeError={null}
            legacyDeliveryTime={false}
            deliveryRegion={split.deliveryRegion}
            deliveryDistrict={split.deliveryDistrict}
            deliveryArea={split.deliveryArea}
            deliveryDetail={split.deliveryDetail}
            deliveryBuilding={split.deliveryBuilding}
            deliveryFloor={split.deliveryFloor}
            deliveryUnit={split.deliveryUnit}
            recipientType={split.recipientType}
            recipientCompanyName={split.recipientCompanyName}
            recipientName={split.recipientName}
            recipientPhone={split.recipientPhone}
            recipientOccasions={recipientOccasionsForEditor(split)}
            senderType={props.senderType}
            senderCompanyName={props.senderCompanyName}
            senderName={props.senderName}
            senderPhone={props.senderPhone}
            deliveryPerson={split.deliveryPerson}
            failedDeliveryAction={split.failedDeliveryAction}
            onFulfillmentTypeChange={(fulfillmentType) => updateRecipientIdentity(split.id, { fulfillmentType })}
            onDateChange={(deliveryDate) => update(split.id, { deliveryDate })}
            onTimeChange={(deliveryTime) => update(split.id, { deliveryTime })}
            onSlotChange={(slot) => update(split.id, {
              deliveryTimeMode: "slot",
              deliverySlotId: slot.id,
              deliveryTime: deliverySlotSnapshot(slot),
            })}
            onSpecifiedTimeSelect={() => update(split.id, {
              deliveryTimeMode: "specified",
              deliverySlotId: undefined,
              deliveryTime: "",
            })}
            onRetryDeliverySlots={props.onRetryDeliverySlots}
            onRegionChange={(deliveryRegion) => update(split.id, {
              deliveryRegion,
              deliveryDistrict: "",
              deliveryArea: "",
            }, true)}
            onDistrictChange={(deliveryDistrict) => update(split.id, {
              deliveryDistrict,
              deliveryArea: "",
            }, true)}
            onAreaChange={(deliveryArea) => update(split.id, { deliveryArea }, true)}
            onAddressHierarchyChange={(hierarchy) => update(split.id, {
              deliveryRegion: hierarchy.region,
              deliveryDistrict: hierarchy.district,
              deliveryArea: hierarchy.area,
            }, true)}
            onDetailChange={(deliveryDetail) => update(split.id, { deliveryDetail }, true)}
            onBuildingChange={(deliveryBuilding) => update(split.id, { deliveryBuilding }, true)}
            onFloorChange={(deliveryFloor) => update(split.id, { deliveryFloor }, true)}
            onUnitChange={(deliveryUnit) => update(split.id, { deliveryUnit }, true)}
            onGoogleAddressSelect={(selection: GoogleAddressSelection) => {
              const hierarchy = hierarchyFromGoogleSelection(selection);
              update(split.id, {
                deliveryRegion: hierarchy.region,
                deliveryDistrict: hierarchy.district,
                deliveryArea: hierarchy.area,
                deliveryDetail: parseDeliveryAddress(selection.address).detail,
              }, true);
            }}
            onRecipientTypeChange={(recipientType) => updateRecipientIdentity(split.id, {
              recipientType,
              recipientCompanyName: recipientType === "personal" ? "" : split.recipientCompanyName,
            })}
            onRecipientCompanyNameChange={(recipientCompanyName) => updateRecipientIdentity(split.id, { recipientCompanyName })}
            onRecipientNameChange={(recipientName) => updateRecipientIdentity(split.id, { recipientName })}
            onRecipientPhoneChange={(recipientPhone) => updateRecipientIdentity(split.id, { recipientPhone })}
            onRecipientOccasionsChange={(recipientOccasions) => update(split.id, {
              recipientOccasions,
              recipientBirthday: undefined,
            })}
            onRecipientDetailsChange={(recipient) => updateRecipientIdentity(split.id, {
              recipientType: recipient.type,
              recipientCompanyName: recipient.companyName,
              recipientName: recipient.name,
              recipientPhone: recipient.phone,
              recipientOccasions: recipient.occasions,
              recipientBirthday: undefined,
            })}
            onUseSenderAsRecipient={(recipient) => {
              const next = {
                ...split,
                recipientType: recipient.type,
                recipientCompanyName: recipient.companyName,
                recipientName: recipient.name,
                recipientPhone: recipient.phone,
                recipientPartnerId: props.senderPartnerId,
              };
              if (!props.senderPartnerId) delete next.recipientPartnerId;
              delete next.recipientBirthday;
              delete next.recipientOccasions;
              delete next.recipientOccasionsVersion;
              props.onChange(props.splits.map((candidate) => (
                candidate.id === split.id ? next : candidate
              )));
            }}
            onRecipientSuggestionSelect={(suggestion) => applyRecipient(split, suggestion)}
            onRecipientAndCustomerSuggestionSelect={(suggestion) => applyRecipient(split, suggestion)}
            onDeliveryPersonChange={(deliveryPerson) => update(split.id, { deliveryPerson })}
            onFailedDeliveryActionChange={(failedDeliveryAction) => update(split.id, { failedDeliveryAction })}
          />

          <GiftCardSection
            title={`拆單收貨點 ${index + 2} 心意卡`}
            enabled={split.giftCardEnabled ?? false}
            message={split.giftCardMessage ?? ""}
            onEnabledChange={(giftCardEnabled) => update(split.id, { giftCardEnabled })}
            onMessageChange={(giftCardMessage) => update(split.id, { giftCardMessage })}
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">分配到此收貨點嘅商品數量</p>
            <p className="mt-1 text-xs text-muted-foreground">未分配數量會保留喺主要收貨點，系統不會重複計算。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {props.items.map((item) => {
                const max = Math.max(0, item.quantity - allocatedOutside(split.id, item.id));
                return (
                  <div key={item.id} className="space-y-1">
                    <Label className="text-xs">{item.name}（最多 {max}）</Label>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      step={1}
                      value={allocationFor(split, item.id) || ""}
                      placeholder="0"
                      onChange={(event) => setAllocation(split, item, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full border-dashed"
        disabled={props.splits.length >= 10 || props.items.length === 0}
        onClick={() => {
          const split = newSplit(props);
          props.onChange([...props.splits, split]);
          props.onHistoryAddressTargetChange?.(split.id);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />新增另一個收貨點
      </Button>
    </div>
  );
};

export default SplitDeliverySection;
