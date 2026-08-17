import { PackageOpen, Plus, Trash2 } from "lucide-react";

import DeliverySection from "@/components/pos/DeliverySection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deliverySlotSnapshot } from "@/lib/delivery-slots";
import { parseDeliveryAddress, type GoogleAddressSelection } from "@/lib/hk-address";
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
  deliveryPerson: "",
  failedDeliveryAction: "none",
  deliveryNote: "",
  itemAllocations: [],
});

const SplitDeliverySection = (props: SplitDeliverySectionProps) => {
  const update = (id: string, changes: Partial<DeliverySplit>, refreshAddress = false) => {
    props.onChange(props.splits.map((split) => {
      if (split.id !== id) return split;
      const next = { ...split, ...changes };
      return refreshAddress ? addressSnapshot(next) : next;
    }));
  };

  const remove = (id: string) => props.onChange(props.splits.filter((split) => split.id !== id));

  const applyRecipient = (split: DeliverySplit, suggestion: RecipientSuggestion) => {
    const changes: Partial<DeliverySplit> = {
      recipientType: suggestion.recipientType || "personal",
      recipientCompanyName: suggestion.recipientCompanyName || "",
      recipientName: suggestion.recipientName || "",
      recipientPhone: suggestion.recipientPhone || "",
    };
    if (suggestion.deliveryAddress) {
      const parsed = parseDeliveryAddress(suggestion.deliveryAddress);
      Object.assign(changes, {
        deliveryRegion: parsed.region,
        deliveryDistrict: parsed.district,
        deliveryArea: parsed.area,
        deliveryDetail: parsed.detail,
      });
    }
    update(split.id, changes, true);
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
            <PackageOpen className="h-4 w-4" />主送貨點保留商品
          </p>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {props.items.map((item) => (
              <span key={item.id}>{item.name}：{primaryRemainder(item)} 件</span>
            ))}
          </div>
        </div>
      )}

      {props.splits.map((split, index) => (
        <div key={split.id} className="space-y-3 rounded-xl border-2 border-dashed border-primary/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">拆單送貨點 {index + 2}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => remove(split.id)}>
              <Trash2 className="mr-1.5 h-4 w-4" />移除
            </Button>
          </div>

          <DeliverySection
            showFulfillmentSelector={false}
            sectionTitle={`額外送貨資料 ${index + 2}`}
            fulfillmentType="delivery"
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
            deliveryPerson={split.deliveryPerson}
            failedDeliveryAction={split.failedDeliveryAction}
            onFulfillmentTypeChange={() => undefined}
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
            onDetailChange={(deliveryDetail) => update(split.id, { deliveryDetail }, true)}
            onBuildingChange={(deliveryBuilding) => update(split.id, { deliveryBuilding }, true)}
            onFloorChange={(deliveryFloor) => update(split.id, { deliveryFloor }, true)}
            onUnitChange={(deliveryUnit) => update(split.id, { deliveryUnit }, true)}
            onGoogleAddressSelect={(selection: GoogleAddressSelection) => update(split.id, {
              deliveryRegion: selection.region,
              deliveryDistrict: selection.district,
              deliveryArea: selection.area,
              deliveryDetail: parseDeliveryAddress(selection.address).detail,
            }, true)}
            onRecipientTypeChange={(recipientType) => update(split.id, {
              recipientType,
              recipientCompanyName: recipientType === "personal" ? "" : split.recipientCompanyName,
            })}
            onRecipientCompanyNameChange={(recipientCompanyName) => update(split.id, { recipientCompanyName })}
            onRecipientNameChange={(recipientName) => update(split.id, { recipientName })}
            onRecipientPhoneChange={(recipientPhone) => update(split.id, { recipientPhone })}
            onRecipientSuggestionSelect={(suggestion) => applyRecipient(split, suggestion)}
            onRecipientAndCustomerSuggestionSelect={(suggestion) => applyRecipient(split, suggestion)}
            onDeliveryPersonChange={(deliveryPerson) => update(split.id, { deliveryPerson })}
            onFailedDeliveryActionChange={(failedDeliveryAction) => update(split.id, { failedDeliveryAction })}
          />

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">分配到此地址嘅商品數量</p>
            <p className="mt-1 text-xs text-muted-foreground">未分配數量會保留喺主送貨地址，系統唔會重複計算。</p>
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
        onClick={() => props.onChange([...props.splits, newSplit(props)])}
      >
        <Plus className="mr-2 h-4 w-4" />新增另一個送貨地址
      </Button>
    </div>
  );
};

export default SplitDeliverySection;
