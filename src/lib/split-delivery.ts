import { isValidDeliveryDate, isValidPhoneNumber } from "@/lib/checkout-validation";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
import { parseDeliveryAddress, type DeliveryAddressSelection } from "@/lib/hk-address";
import {
  normalizeRecipientOccasions,
  ownsRecipientOccasionsField,
  ownsRecipientOccasionsVersionField,
  recipientOccasionsAreUnchanged,
  recipientOccasionsStateFromSelection,
  recipientOccasionsVersionFromSelection,
  recipientOccasionValidationError,
} from "@/lib/recipient-occasions";
import type { DeliverySplit, OrderItem } from "@/types/order";

export const splitFulfillmentType = (split: DeliverySplit) => (
  split.fulfillmentType || "delivery"
);

export const applyPastAddressToSplit = (
  split: DeliverySplit,
  selection: DeliveryAddressSelection,
): DeliverySplit => {
  const address = selection.address.trim();
  const parsed = parseDeliveryAddress(address);
  const occasionState = recipientOccasionsStateFromSelection(selection);
  const occasionVersion = selection.shippingPartnerId
    ? recipientOccasionsVersionFromSelection(selection)
    : undefined;
  const next: DeliverySplit = {
    ...split,
    deliveryRegion: parsed.region,
    deliveryDistrict: parsed.district,
    deliveryArea: parsed.area,
    deliveryDetail: parsed.detail,
    deliveryAddress: address,
    deliveryGoogleAddress: address,
    deliveryBuilding: "",
    deliveryFloor: "",
    deliveryUnit: "",
    recipientType: selection.recipientType
      || (selection.recipientCompanyName?.trim() ? "company" : "personal"),
    recipientCompanyName: selection.recipientCompanyName || "",
    recipientName: selection.recipientName || "",
    recipientPhone: selection.recipientPhone || "",
    recipientPartnerId: selection.shippingPartnerId || undefined,
  };
  delete next.recipientBirthday;
  if (occasionState.known) next.recipientOccasions = occasionState.value;
  else delete next.recipientOccasions;
  if (occasionVersion !== undefined) next.recipientOccasionsVersion = occasionVersion;
  else delete next.recipientOccasionsVersion;
  return next;
};

interface NormalizeDeliverySplitsOptions {
  baselineSplits?: readonly DeliverySplit[];
}

type DestinationOwnedOptionalFields = Pick<
  DeliverySplit,
  | "giftCardEnabled"
  | "giftCardMessage"
  | "recipientOccasions"
  | "recipientOccasionsVersion"
  | "recipientBirthday"
>;

const hasOwn = (split: DeliverySplit, field: keyof DestinationOwnedOptionalFields) => (
  Object.prototype.hasOwnProperty.call(split, field)
);

const normalizedDestinationOwnedFields = (
  split: DeliverySplit,
  baseline?: DeliverySplit,
): DestinationOwnedOptionalFields => {
  const giftCardEnabled = split.giftCardEnabled ?? false;
  const giftCardMessage = giftCardEnabled ? (split.giftCardMessage ?? "").trim() : "";
  const occasionState = recipientOccasionsStateFromSelection(split);

  if (!baseline) {
    return {
      giftCardEnabled,
      giftCardMessage,
      ...(occasionState.known
        ? {
            recipientOccasions: normalizeRecipientOccasions(occasionState.value),
            ...(!occasionState.legacy && ownsRecipientOccasionsVersionField(split)
              ? { recipientOccasionsVersion: split.recipientOccasionsVersion }
              : {}),
          }
        : {}),
    };
  }

  return {
    ...(hasOwn(baseline, "giftCardEnabled") || giftCardEnabled
      ? { giftCardEnabled }
      : {}),
    ...(hasOwn(baseline, "giftCardMessage") || Boolean(giftCardMessage)
      ? { giftCardMessage }
      : {}),
    ...(JSON.stringify(occasionState.value)
      === JSON.stringify(recipientOccasionsStateFromSelection(baseline).value)
      && split.recipientOccasionsVersion === baseline.recipientOccasionsVersion
      && ownsRecipientOccasionsVersionField(split)
        === ownsRecipientOccasionsVersionField(baseline)
      ? {
          ...(ownsRecipientOccasionsField(baseline)
            ? { recipientOccasions: baseline.recipientOccasions }
            : {}),
          ...(ownsRecipientOccasionsVersionField(baseline)
            ? { recipientOccasionsVersion: baseline.recipientOccasionsVersion }
            : {}),
          ...(hasOwn(baseline, "recipientBirthday")
            ? { recipientBirthday: baseline.recipientBirthday }
            : {}),
        }
      : occasionState.known
        ? {
            recipientOccasions: normalizeRecipientOccasions(occasionState.value),
            ...(!occasionState.legacy && ownsRecipientOccasionsVersionField(split)
              ? { recipientOccasionsVersion: split.recipientOccasionsVersion }
              : {}),
          }
        : {}),
  };
};

export const normalizeDeliverySplitsForSubmission = (
  splits: readonly DeliverySplit[],
  options: NormalizeDeliverySplitsOptions = {},
): DeliverySplit[] => splits.map((split, index) => {
  const candidateBaseline = options.baselineSplits?.[index];
  const baseline = candidateBaseline?.id === split.id ? candidateBaseline : undefined;
  const {
    giftCardEnabled: _giftCardEnabled,
    giftCardMessage: _giftCardMessage,
    recipientOccasions: _recipientOccasions,
    recipientOccasionsVersion: _recipientOccasionsVersion,
    recipientBirthday: _recipientBirthday,
    ...requiredFields
  } = split;
  const destinationOwnedFields = normalizedDestinationOwnedFields(split, baseline);
  if (splitFulfillmentType(split) === "delivery") {
    return { ...requiredFields, ...destinationOwnedFields, fulfillmentType: "delivery" };
  }
  return {
    ...requiredFields,
    ...destinationOwnedFields,
    fulfillmentType: "pickup",
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    deliveryAddress: PICKUP_LOCATION_ADDRESS,
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
  };
});

export const normalizeDeliverySplitsForOperationalUpdate = (
  splits: readonly DeliverySplit[],
  options: NormalizeDeliverySplitsOptions = {},
): DeliverySplit[] => splits.map((split, index) => {
  const candidateBaseline = options.baselineSplits?.[index];
  const baseline = candidateBaseline?.id === split.id ? candidateBaseline : undefined;
  const occasionState = recipientOccasionsStateFromSelection(split);
  const {
    recipientOccasions: _recipientOccasions,
    recipientOccasionsVersion: _recipientOccasionsVersion,
    recipientBirthday: _recipientBirthday,
    ...requiredFields
  } = split;
  return {
    ...requiredFields,
    giftCardEnabled: split.giftCardEnabled ?? false,
    giftCardMessage: split.giftCardEnabled ? (split.giftCardMessage ?? "").trim() : "",
    ...(baseline && recipientOccasionsAreUnchanged(occasionState.value, baseline)
      ? {}
      : occasionState.known
      ? {
          recipientOccasions: normalizeRecipientOccasions(occasionState.value),
          ...(!occasionState.legacy && ownsRecipientOccasionsVersionField(split)
            ? { recipientOccasionsVersion: split.recipientOccasionsVersion }
            : {}),
        }
      : {}),
    fulfillmentType: splitFulfillmentType(split),
    deliveryAddress: splitFulfillmentType(split) === "pickup"
      ? split.deliveryAddress.trim() || PICKUP_LOCATION_ADDRESS
      : split.deliveryAddress.trim(),
    itemAllocations: split.itemAllocations.map((allocation) => ({ ...allocation })),
  };
});

export const operationalSplitIdentityIsUnchanged = (
  original: readonly DeliverySplit[],
  edited: readonly DeliverySplit[],
): boolean => original.length === edited.length && original.every((split, index) => {
  const candidate = edited[index];
  if (!candidate || candidate.id !== split.id) return false;
  if (candidate.itemAllocations.length !== split.itemAllocations.length) return false;
  return split.itemAllocations.every((allocation, allocationIndex) => {
    const candidateAllocation = candidate.itemAllocations[allocationIndex];
    return Boolean(
      candidateAllocation
      && candidateAllocation.itemId === allocation.itemId
      && candidateAllocation.itemName === allocation.itemName
      && candidateAllocation.quantity === allocation.quantity,
    );
  });
});

export const validateOperationalDeliverySplits = (
  splits: readonly DeliverySplit[],
): string | null => {
  if (splits.length > 10) return "每張訂單最多可編輯 10 個額外收貨點。";
  for (let index = 0; index < splits.length; index += 1) {
    const split = splits[index];
    const label = `額外收貨點 ${index + 2}`;
    if (!split.id.trim()) return `${label}識別資料無效。`;
    if (!isValidDeliveryDate(split.deliveryDate)) return `${label}請選擇有效日期。`;
    if (!split.deliveryTimeMode || !split.deliveryTime.trim()) return `${label}請選擇時間。`;
    if (split.deliveryTimeMode === "slot" && !split.deliverySlotId) {
      return `${label}請重新選擇標準時段。`;
    }
    if (split.deliveryTimeMode === "specified" && split.deliverySlotId) {
      return `${label}指定時間不可保留標準時段。`;
    }
    if (splitFulfillmentType(split) === "delivery") {
      if (!split.deliveryAddress.trim()) return `${label}請輸入送貨地址。`;
      if (!split.recipientName.trim()) return `${label}請輸入收貨人名稱。`;
      if (!isValidPhoneNumber(split.recipientPhone)) return `${label}請輸入有效收貨人電話。`;
      if (split.recipientType === "company" && !split.recipientCompanyName.trim()) {
        return `${label}請輸入收貨公司名稱。`;
      }
    } else if (split.recipientPhone.trim() && !isValidPhoneNumber(split.recipientPhone)) {
      return `${label}請輸入有效聯絡電話。`;
    }
    const occasionError = recipientOccasionValidationError(
      recipientOccasionsStateFromSelection(split).value,
      label,
    );
    if (occasionError) return occasionError;
    if (split.itemAllocations.length === 0 || split.itemAllocations.some(
      (allocation) => !allocation.itemId || !allocation.itemName || !Number.isInteger(allocation.quantity) || allocation.quantity <= 0,
    )) {
      return `${label}商品分配資料無效。`;
    }
  }
  return null;
};

export const validateDeliverySplits = (
  splits: readonly DeliverySplit[],
  items: readonly OrderItem[],
): string | null => {
  if (splits.length > 10) return "每張訂單最多可加 10 個額外收貨點。";
  const itemQuantities = new Map(items.map((item) => [item.id, item.quantity]));
  const allocated = new Map<string, number>();

  for (let index = 0; index < splits.length; index += 1) {
    const split = splits[index];
    const label = `拆單收貨點 ${index + 2}`;
    if (!isValidDeliveryDate(split.deliveryDate)) return `${label}請選擇有效送貨日期。`;
    if (!split.deliveryTimeMode || !split.deliveryTime.trim()) return `${label}請選擇送貨時間。`;
    if (split.deliveryTimeMode === "slot" && !split.deliverySlotId) return `${label}請重新選擇標準時段。`;
    if (splitFulfillmentType(split) === "delivery") {
      if (!split.deliveryAddress.trim()) return `${label}請輸入送貨地址。`;
      if (!split.recipientName.trim()) return `${label}請輸入收貨人名稱。`;
      if (!isValidPhoneNumber(split.recipientPhone)) return `${label}請輸入有效收貨人電話。`;
      if (split.recipientType === "company" && !split.recipientCompanyName.trim()) {
        return `${label}請輸入收貨公司名稱。`;
      }
    }
    const occasionError = recipientOccasionValidationError(
      recipientOccasionsStateFromSelection(split).value,
      label,
    );
    if (occasionError) return occasionError;
    const positiveAllocations = split.itemAllocations.filter((entry) => entry.quantity > 0);
    if (positiveAllocations.length === 0) return `${label}請至少分配一件商品。`;
    for (const entry of positiveAllocations) {
      const available = itemQuantities.get(entry.itemId);
      if (available === undefined || !Number.isInteger(entry.quantity)) {
        return `${label}商品分配資料無效。`;
      }
      const next = (allocated.get(entry.itemId) || 0) + entry.quantity;
      if (next > available) return "拆單商品數量超過原訂單數量。";
      allocated.set(entry.itemId, next);
    }
  }
  return null;
};
