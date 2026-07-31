import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calculator, ClipboardList, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CsvImportButton from "@/components/pos/CsvImportButton";
import { generateAllDocuments, generateReceipt, printDocument } from "@/lib/print-utils";
import CustomerSection from "@/components/pos/CustomerSection";
import BusinessDetailsSection from "@/components/pos/BusinessDetailsSection";
import OrderItemsSection from "@/components/pos/OrderItemsSection";
import DeliverySection from "@/components/pos/DeliverySection";
import GiftCardSection from "@/components/pos/GiftCardSection";
import PaymentSection from "@/components/pos/PaymentSection";
import OrderHistory from "@/components/pos/OrderHistory";
import CustomerHistoryDock from "@/components/pos/CustomerHistoryDock";
import OrderNotesSection, { type NotesConflictTarget } from "@/components/pos/OrderNotesSection";
import type { DeliveryTimeMode, Order, OrderItem, PaymentStatus } from "@/types/order";
import SalesIdSection from "@/components/pos/SalesIdSection";
import type { DemoCustomer } from "@/data/demo-customers";
import { buildPartnerNoteMutation } from "@/lib/customer-notes";
import {
  companyFieldsForCustomerType,
  detachedCustomerProfile,
} from "@/lib/customer-profile";
import {
  deliveryContractFieldsForSubmission,
  firstAddedLegacyBusinessField,
  isDeterministicSubmissionFailure,
  loadPendingSubmission,
  pendingOptionBindingsMatch,
  submissionPayloadMatches,
  submitPersistedOrder,
  upgradeLegacyPendingDeliverySelection,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";
import {
  getDeliverySlots,
  getOdooPartnerNotes,
  getOdooOrderRecords,
  getAccountingPaymentOptions,
  allowLocalOnlyOrders,
  hasOdooBackend,
  OdooConflictError,
  submitOdooOrder,
  updateOdooPartnerNotes,
  type AccountingPaymentOption,
  type DeliverySlot,
  type PartnerNoteRecord,
} from "@/lib/odoo-api";
import {
  DEMO_DELIVERY_SLOTS,
  deliverySlotSnapshot,
} from "@/lib/delivery-slots";
import {
  validateCheckout,
  validatePositiveOrderTotal,
  normalizePhoneNumber,
  type CheckoutErrors,
  type CheckoutField,
} from "@/lib/checkout-validation";
import { orderItemsTotal, orderLineAdjustmentNeedsReason } from "@/lib/order-pricing";
import { parseDeliveryAddress } from "@/lib/hk-address";
import {
  hongKongBusinessDate,
  loadUnsyncedOrders,
  mergeOrderRecords,
  removeSyncedLocalOrders,
  saveUnsyncedOrders,
} from "@/lib/order-records";

const Index = () => {
  const navigate = useNavigate();
  const [pendingSubmission, setPendingSubmission] = useState<PendingOrderSubmission | null>(
    loadPendingSubmission,
  );
  const restoredPendingSubmission = useRef(pendingSubmission).current;
  // Customer
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [customerType, setCustomerType] = useState<"personal" | "company">("personal");
  const [companyName, setCompanyName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [customerGroup, setCustomerGroup] = useState("");
  const [senderDoNumber, setSenderDoNumber] = useState("");
  const [recipientDoNumber, setRecipientDoNumber] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [department, setDepartment] = useState("");
  const [terms, setTerms] = useState("");
  const [checkoutErrors, setCheckoutErrors] = useState<CheckoutErrors>({});
  const [selectedCustomer, setSelectedCustomer] = useState<DemoCustomer | null>(null);
  const [confirmedNewCustomerPhone, setConfirmedNewCustomerPhone] = useState<string | null>(null);
  const [customerRefreshKey, setCustomerRefreshKey] = useState(0);

  // Items
  const [budget, setBudget] = useState(0);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [urgentFee, setUrgentFee] = useState(0);
  const [senderNote, setSenderNote] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saveSenderNote, setSaveSenderNote] = useState(false);
  const [saveRecipientNote, setSaveRecipientNote] = useState(false);
  const [recipientPartnerId, setRecipientPartnerId] = useState<number | undefined>();
  const [recipientContact, setRecipientContact] = useState<PartnerNoteRecord | null>(null);
  const [senderContactDraft, setSenderContactDraft] = useState("");
  const [recipientContactDraft, setRecipientContactDraft] = useState("");
  const [refreshingSender, setRefreshingSender] = useState(false);
  const [refreshingRecipient, setRefreshingRecipient] = useState(false);
  const [savingSenderContact, setSavingSenderContact] = useState(false);
  const [savingRecipientContact, setSavingRecipientContact] = useState(false);
  const [notesConflict, setNotesConflict] = useState<{
    target: NotesConflictTarget;
    message: string;
  } | null>(null);

  // Delivery
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryTimeMode, setDeliveryTimeMode] = useState<DeliveryTimeMode>();
  const [deliverySlotId, setDeliverySlotId] = useState<number>();
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>(
    () => hasOdooBackend ? [] : [...DEMO_DELIVERY_SLOTS],
  );
  const [deliverySlotsLoading, setDeliverySlotsLoading] = useState(hasOdooBackend);
  const [deliverySlotsError, setDeliverySlotsError] = useState<string | null>(null);
  const [deliverySlotsRefreshKey, setDeliverySlotsRefreshKey] = useState(0);
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryDetail, setDeliveryDetail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [failedDeliveryAction, setFailedDeliveryAction] = useState("none");

  // Gift card
  const [giftCardEnabled, setGiftCardEnabled] = useState(false);
  const [giftCardMessage, setGiftCardMessage] = useState("");
  // Payment
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentReceivedAt, setPaymentReceivedAt] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(
    () => pendingSubmission?.order.paymentIdempotencyKey || crypto.randomUUID(),
  );
  const [checkoutId, setCheckoutId] = useState(
    () => pendingSubmission?.order.id || crypto.randomUUID(),
  );
  const [paymentOptions, setPaymentOptions] = useState<AccountingPaymentOption[]>([]);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false);
  const [paymentOptionsError, setPaymentOptionsError] = useState<string | null>(null);
  const [salesId, setSalesId] = useState("");
  const [operatorEmployeeId, setOperatorEmployeeId] = useState<number | undefined>();
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // History
  const [localOrders, setLocalOrders] = useState<Order[]>(loadUnsyncedOrders);
  const [remoteOrders, setRemoteOrders] = useState<Order[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [orderRecordsLoading, setOrderRecordsLoading] = useState(false);
  const [orderRecordsLoaded, setOrderRecordsLoaded] = useState(!hasOdooBackend);
  const [orderRecordsError, setOrderRecordsError] = useState<string | null>(null);
  const [orderRecordsTruncated, setOrderRecordsTruncated] = useState(false);
  const [orderRecordsRefreshKey, setOrderRecordsRefreshKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleOrderRecords = useMemo(
    () => mergeOrderRecords(remoteOrders, localOrders, pendingSubmission?.order),
    [localOrders, pendingSubmission, remoteOrders],
  );

  useEffect(() => {
    if (!historyOpen || !hasOdooBackend) return;
    const controller = new AbortController();
    setOrderRecordsLoading(true);
    setOrderRecordsError(null);

    getOdooOrderRecords(hongKongBusinessDate(), controller.signal)
      .then((response) => {
        setRemoteOrders(response.orders);
        setLocalOrders((current) => {
          const remaining = removeSyncedLocalOrders(response.orders, current);
          if (remaining.length === current.length) return current;
          saveUnsyncedOrders(remaining);
          return remaining;
        });
        setOrderRecordsTruncated(response.truncated);
        setOrderRecordsLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setOrderRecordsError(error instanceof Error ? error.message : "未能載入 Odoo 訂單記錄");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrderRecordsLoading(false);
      });

    return () => controller.abort();
  }, [historyOpen, orderRecordsRefreshKey]);

  const subtotal = useMemo(() => {
    const itemsTotal = orderItemsTotal(items);
    return itemsTotal + deliveryFee + urgentFee;
  }, [items, deliveryFee, urgentFee]);

  const finalPrice = priceOverridden && manualPrice !== null ? manualPrice : subtotal;
  const hasSalesperson = salesId.trim().length > 0;
  const frozenDeliverySlotSelection = pendingSubmission?.order.deliveryTimeMode === "slot"
    && pendingSubmission.order.deliverySlotId !== undefined
    ? {
        slotId: pendingSubmission.order.deliverySlotId,
        snapshot: pendingSubmission.order.deliveryTime,
      }
    : undefined;
  const hasLegacyPendingDelivery = Boolean(
    pendingSubmission
      && !Object.prototype.hasOwnProperty.call(pendingSubmission.order, "deliveryTimeMode")
      && !Object.prototype.hasOwnProperty.call(pendingSubmission.order, "deliverySlotId"),
  );

  useEffect(() => {
    if (!hasOdooBackend) return;
    const controller = new AbortController();
    setPaymentOptionsLoading(true);
    setPaymentOptionsError(null);
    getAccountingPaymentOptions(controller.signal)
      .then(setPaymentOptions)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPaymentOptions([]);
        setPaymentOptionsError(error instanceof Error ? error.message : "未能檢查 Odoo 收款設定");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentOptionsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!hasOdooBackend) {
      setDeliverySlots([...DEMO_DELIVERY_SLOTS]);
      setDeliverySlotsLoading(false);
      setDeliverySlotsError(null);
      return;
    }

    const controller = new AbortController();
    setDeliverySlotsLoading(true);
    setDeliverySlotsError(null);
    getDeliverySlots(controller.signal)
      .then(setDeliverySlots)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDeliverySlots([]);
        setDeliverySlotsError(error instanceof Error ? error.message : "未能載入送貨時段");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDeliverySlotsLoading(false);
      });
    return () => controller.abort();
  }, [deliverySlotsRefreshKey]);

  const handleFinalPriceChange = (v: number) => {
    setManualPrice(v);
    setPriceOverridden(true);
  };

  const resetPrice = () => {
    setPriceOverridden(false);
    setManualPrice(null);
  };

  const clearRecipientPersistenceBinding = useCallback(() => {
    setRecipientPartnerId(undefined);
    setRecipientContact(null);
    setNotesConflict((current) => current?.target === "recipient" ? null : current);
  }, []);

  const resetRecipientPersistence = useCallback(() => {
    clearRecipientPersistenceBinding();
    setRecipientContactDraft("");
    setSaveRecipientNote(false);
  }, [clearRecipientPersistenceBinding]);

  const detachSelectedCustomerProfile = useCallback(() => {
    const emptyProfile = detachedCustomerProfile();
    setSelectedCustomer(null);
    setCustomerEmail(emptyProfile.customerEmail);
    setCustomerType(emptyProfile.customerType);
    setCompanyName(emptyProfile.companyName);
    setBillingAddress(emptyProfile.billingAddress);
    setSenderContactDraft("");
    setSaveSenderNote(false);
    resetRecipientPersistence();
  }, [resetRecipientPersistence]);

  const clearCheckoutErrors = useCallback((...fields: CheckoutField[]) => {
    setCheckoutErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  }, []);

  const resetOrderForm = useCallback(() => {
    setPhone("");
    setCustomerName("");
    setSenderName("");
    setCustomerType("personal");
    setCompanyName("");
    setCustomerEmail("");
    setBillingAddress("");
    setCustomerGroup("");
    setSenderDoNumber("");
    setRecipientDoNumber("");
    setSourceReference("");
    setDepartment("");
    setTerms("");
    setCheckoutErrors({});
    setSelectedCustomer(null);
    setConfirmedNewCustomerPhone(null);
    setItems([]);
    setBudget(0);
    setDeliveryFee(0);
    setUrgentFee(0);
    setSenderNote("");
    setDeliveryNote("");
    setInternalNote("");
    setSaveSenderNote(false);
    setSaveRecipientNote(false);
    setRecipientPartnerId(undefined);
    setRecipientContact(null);
    setSenderContactDraft("");
    setRecipientContactDraft("");
    setNotesConflict(null);
    setDeliveryDate("");
    setDeliveryTime("");
    setDeliveryTimeMode(undefined);
    setDeliverySlotId(undefined);
    setDeliveryRegion("");
    setDeliveryDistrict("");
    setDeliveryArea("");
    setDeliveryDetail("");
    setRecipientName("");
    setRecipientPhone("");
    setDeliveryPerson("");
    setFailedDeliveryAction("none");
    setGiftCardEnabled(false);
    setGiftCardMessage("");
    setPaymentStatus("unpaid");
    setDepositAmount(0);
    setPaymentMethod("");
    setPaymentReference("");
    setPaymentReceivedAt("");
    setPaymentIdempotencyKey(crypto.randomUUID());
    setCheckoutId(crypto.randomUUID());
    setPriceOverridden(false);
    setManualPrice(null);
  }, []);

  const handleClearForm = useCallback(() => {
    if (pendingSubmission) {
      toast.error("呢張 Odoo 訂單嘅結果仍未確認，請先用原本資料重試，唔可以清空");
      return;
    }
    resetOrderForm();
  }, [pendingSubmission, resetOrderForm]);

  useEffect(() => {
    if (!restoredPendingSubmission) return;
    const { order, options } = restoredPendingSubmission;
    setPhone(order.phone);
    setCustomerName(order.customerName);
    setSenderName(order.senderName ?? order.customerName ?? "");
    setCustomerType(order.customerType || options.customerType || "personal");
    setCompanyName(order.companyName || options.companyName || "");
    setCustomerEmail(order.customerEmail || "");
    setBillingAddress(order.billingAddress || "");
    setCustomerGroup(order.customerGroup || "");
    setSenderDoNumber(order.senderDoNumber || "");
    setRecipientDoNumber(order.recipientDoNumber || "");
    setSourceReference(order.sourceReference || "");
    setDepartment(order.department || "");
    setTerms(order.terms || "");
    setSelectedCustomer(options.customerId ? {
      id: `odoo-${options.customerId}`,
      name: order.customerName,
      phone: order.phone,
      history: [],
      odooPartnerId: options.customerId,
    } : null);
    setItems(order.items);
    setDeliveryFee(order.deliveryFee);
    setUrgentFee(order.urgentFee);
    setSenderNote(order.senderNote);
    setDeliveryNote(order.deliveryNote);
    setInternalNote(order.internalNote);
    setSenderContactDraft(order.customerNoteMutation?.commentText || "");
    setRecipientContactDraft(order.recipientNoteMutation?.commentText || "");
    setRecipientPartnerId(order.recipientPartnerId);
    setDeliveryDate(order.deliveryDate);
    setDeliveryTime(order.deliveryTime);
    setDeliveryTimeMode(order.deliveryTimeMode);
    setDeliverySlotId(order.deliverySlotId);
    setDeliveryRegion("");
    setDeliveryDistrict("");
    setDeliveryArea("");
    setDeliveryDetail(order.deliveryAddress);
    setRecipientName(order.recipientName);
    setRecipientPhone(order.recipientPhone);
    setDeliveryPerson(order.deliveryPerson);
    setGiftCardEnabled(order.giftCardEnabled);
    setGiftCardMessage(order.giftCardMessage);
    setPaymentStatus(order.paymentStatus);
    setDepositAmount(order.depositAmount);
    setPaymentMethod(order.paymentMethod);
    setPaymentReference(order.paymentReference || "");
    setPaymentReceivedAt(order.paymentReceivedAt || "");
    setPaymentIdempotencyKey(order.paymentIdempotencyKey || crypto.randomUUID());
    setCheckoutId(order.id);
    setPriceOverridden(order.priceOverridden);
    setManualPrice(order.priceOverridden ? order.finalPrice : null);
    setSalesId(order.salesId);
    setOperatorEmployeeId(order.operatorEmployeeId);
    toast.info("已恢復尚未確認嘅 Odoo 訂單，重試會沿用原本嘅訂單編號");
  }, [restoredPendingSubmission]);

  const handleDeliverySlotChange = (slot: DeliverySlot) => {
    const snapshot = deliverySlotSnapshot(slot);
    setDeliveryTimeMode("slot");
    setDeliverySlotId(slot.id);
    setDeliveryTime(snapshot);
    clearCheckoutErrors("deliveryTime");
  };

  const handleSpecifiedTimeSelect = () => {
    if (deliveryTimeMode !== "specified") setDeliveryTime("");
    setDeliveryTimeMode("specified");
    setDeliverySlotId(undefined);
    clearCheckoutErrors("deliveryTime");
  };

  const applyPartnerRecord = useCallback((target: NotesConflictTarget, record: PartnerNoteRecord) => {
    if (target === "recipient") {
      setRecipientContact(record);
      setRecipientContactDraft(record.commentText);
      return;
    }

    setSelectedCustomer((current) => {
      if (!current || current.odooPartnerId !== record.partnerId) return current;
      return {
        ...current,
        commentText: record.commentText,
        tags: record.tags,
        writeDate: record.writeDate,
      };
    });
    setSenderContactDraft(record.commentText);
  }, []);

  const refreshSenderContact = useCallback(async (signal?: AbortSignal) => {
    if (!selectedCustomer?.odooPartnerId || !hasOdooBackend) return;
    setRefreshingSender(true);
    try {
      const record = await getOdooPartnerNotes(selectedCustomer.odooPartnerId, signal);
      applyPartnerRecord("sender", record);
      setNotesConflict((current) => current?.target === "sender" ? null : current);
    } catch (error) {
      if (signal?.aborted) return;
      toast.error(error instanceof Error ? error.message : "未能載入客戶長期備註");
    } finally {
      if (!signal?.aborted) setRefreshingSender(false);
    }
  }, [applyPartnerRecord, selectedCustomer?.odooPartnerId]);

  useEffect(() => {
    if (!selectedCustomer?.odooPartnerId) return;
    const controller = new AbortController();
    void refreshSenderContact(controller.signal);
    return () => controller.abort();
  }, [refreshSenderContact, selectedCustomer?.odooPartnerId]);

  const refreshRecipientContact = useCallback(async (signal?: AbortSignal) => {
    if (!recipientPartnerId || !hasOdooBackend) return;
    setRefreshingRecipient(true);
    try {
      const record = await getOdooPartnerNotes(recipientPartnerId, signal);
      applyPartnerRecord("recipient", record);
      setNotesConflict((current) => current?.target === "recipient" ? null : current);
    } catch (error) {
      if (signal?.aborted) return;
      setRecipientContact(null);
      toast.error(error instanceof Error ? error.message : "未能載入收花人長期備註");
    } finally {
      if (!signal?.aborted) setRefreshingRecipient(false);
    }
  }, [applyPartnerRecord, recipientPartnerId]);

  useEffect(() => {
    if (!recipientPartnerId) return;
    const controller = new AbortController();
    void refreshRecipientContact(controller.signal);
    return () => controller.abort();
  }, [recipientPartnerId, refreshRecipientContact]);

  const writePartnerComment = async (
    target: NotesConflictTarget,
    partnerId: number,
    current: PartnerNoteRecord,
    commentText: string
  ): Promise<PartnerNoteRecord | null> => {
    try {
      const record = await updateOdooPartnerNotes(partnerId, {
        commentText,
        expectedWriteDate: current.writeDate,
      });
      applyPartnerRecord(target, record);
      return record;
    } catch (error) {
      if (error instanceof OdooConflictError) {
        const latest = error.latest as PartnerNoteRecord | undefined;
        if (latest?.writeDate) applyPartnerRecord(target, latest);
        setNotesConflict({
          target,
          message: `${error.message}。請核對 Odoo 最新內容後再確認訂單。`,
        });
        toast.error("長期備註有新版本，已停止送出訂單");
      } else {
        toast.error(error instanceof Error ? error.message : "長期備註儲存失敗");
      }
      return null;
    }
  };

  const saveSenderContactComment = async () => {
    if (!selectedCustomer?.odooPartnerId || !selectedCustomer.writeDate) return;
    setSavingSenderContact(true);
    const current: PartnerNoteRecord = {
      partnerId: selectedCustomer.odooPartnerId,
      commentText: selectedCustomer.commentText || "",
      tags: selectedCustomer.tags || [],
      writeDate: selectedCustomer.writeDate,
    };
    try {
      const updated = await writePartnerComment(
        "sender",
        selectedCustomer.odooPartnerId,
        current,
        senderContactDraft
      );
      if (updated) {
        setNotesConflict((conflict) => conflict?.target === "sender" ? null : conflict);
        toast.success("客戶長期備註已儲存到 Odoo");
      }
    } finally {
      setSavingSenderContact(false);
    }
  };

  const saveRecipientContactComment = async () => {
    if (!recipientPartnerId || !recipientContact?.writeDate) return;
    setSavingRecipientContact(true);
    try {
      const updated = await writePartnerComment(
        "recipient",
        recipientPartnerId,
        recipientContact,
        recipientContactDraft
      );
      if (updated) {
        setNotesConflict((conflict) => conflict?.target === "recipient" ? null : conflict);
        toast.success("收花人長期備註已儲存到 Odoo");
      }
    } finally {
      setSavingRecipientContact(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!hasOdooBackend && !allowLocalOnlyOrders) {
      toast.error("未連接 Odoo backend，訂單未建立。請先恢復 backend 連線後再試。", {
        duration: 8000,
      });
      return;
    }
    // Validation
    if (!salesId.trim()) {
      toast.error("請先選擇負責員工");
      return;
    }
    if (hasOdooBackend && !operatorEmployeeId) {
      toast.error("請選擇已同步到 Odoo 嘅負責員工");
      return;
    }
    if (
      pendingSubmission
      && !pendingOptionBindingsMatch(pendingSubmission, {
        customerId: selectedCustomer?.odooPartnerId,
        customerType,
        companyName,
      })
    ) {
      toast.error(
        "待確認訂單嘅客戶、客戶類型或公司名稱已改變；請還原原本資料，或先到 Odoo 核對訂單結果",
      );
      return;
    }
    const deliveryAddress = [
      deliveryRegion,
      deliveryDistrict,
      deliveryArea,
      deliveryDetail.trim(),
    ].filter(Boolean).join(" ");
    const validationErrors = validateCheckout({
      customerName,
      customerType,
      companyName,
      customerEmail,
      billingAddress,
      allowLegacyMissingCompanyFields: Boolean(
        pendingSubmission
          && customerType === "company"
          && (
            !Object.prototype.hasOwnProperty.call(pendingSubmission.order, "companyName")
            || !Object.prototype.hasOwnProperty.call(pendingSubmission.order, "billingAddress")
          )
      ),
      phone,
      selectedCustomerPhone: selectedCustomer?.phone,
      confirmedNewCustomerPhone,
      restoredPendingSubmission: Boolean(pendingSubmission),
      requiresCustomerResolution: hasOdooBackend,
      senderName,
      recipientName,
      recipientPhone,
      deliveryAddress,
      deliveryDate,
      deliveryTime,
      deliveryTimeMode,
      deliverySlotId,
      deliverySlots,
      frozenSlotSelection: frozenDeliverySlotSelection,
    });
    setCheckoutErrors(validationErrors);
    const validationErrorCount = Object.keys(validationErrors).length;
    if (validationErrorCount > 0) {
      toast.error(`請修正以下 ${validationErrorCount} 項訂單資料`);
      return;
    }

    const addedLegacyBusinessField = pendingSubmission
      ? firstAddedLegacyBusinessField(pendingSubmission.order, {
          customerEmail,
          billingAddress,
          customerGroup,
          senderDoNumber,
          recipientDoNumber,
          sourceReference,
          department,
          terms,
        })
      : null;
    if (addedLegacyBusinessField) {
      toast.error(
        `舊格式待確認訂單唔可以新增「${addedLegacyBusinessField}」；請先到 Odoo 核對原訂單結果`,
      );
      return;
    }

    if (items.length === 0) {
      toast.error("請至少加入一個項目");
      return;
    }

    if (hasOdooBackend && priceOverridden) {
      toast.error("Odoo 訂單價格必須跟商品目錄；請先重設最終價格");
      return;
    }

    const itemMissingAdjustmentReason = items.find(orderLineAdjustmentNeedsReason);
    if (itemMissingAdjustmentReason) {
      toast.error(`「${itemMissingAdjustmentReason.name}」已改價或折扣，請填寫原因`);
      return;
    }

    const totalError = validatePositiveOrderTotal(finalPrice);
    if (totalError) {
      toast.error(totalError);
      return;
    }

    const receivesPayment = paymentStatus === "paid" || paymentStatus === "deposit";
    if (receivesPayment && !paymentMethod) {
      toast.error("請選擇已啟用嘅 Odoo 付款方式");
      return;
    }
    if (receivesPayment && !paymentReference.trim()) {
      toast.error("請輸入付款參考編號");
      return;
    }
    if (paymentStatus === "deposit" && (depositAmount <= 0 || depositAmount >= finalPrice)) {
      toast.error("訂金必須大過 $0 並少過訂單總額");
      return;
    }
    const receiptTimestamp = receivesPayment
      ? (paymentReceivedAt || new Date().toISOString())
      : "";
    const receiptIdempotencyKey = receivesPayment ? paymentIdempotencyKey : "";
    if (receivesPayment && !paymentReceivedAt) setPaymentReceivedAt(receiptTimestamp);

    const hasRecipientIdentity = Boolean(
      recipientPartnerId || recipientName.trim() || recipientPhone.trim() || deliveryDetail.trim()
    );
    if (recipientContactDraft && !hasRecipientIdentity) {
      toast.error("請先輸入收花人資料，先可以儲存收花人長期備註");
      return;
    }

    const customerNoteMutation = pendingSubmission
      ? pendingSubmission.order.customerNoteMutation
      : buildPartnerNoteMutation({
          draft: senderContactDraft,
          currentComment: selectedCustomer?.commentText || "",
          appendNote: senderNote,
          shouldAppend: saveSenderNote,
          targetPartnerId: selectedCustomer?.odooPartnerId,
          expectedWriteDate: selectedCustomer?.writeDate,
        });
    const recipientNoteMutation = pendingSubmission
      ? pendingSubmission.order.recipientNoteMutation
      : buildPartnerNoteMutation({
          draft: recipientContactDraft,
          currentComment: recipientContact?.commentText || "",
          appendNote: deliveryNote,
          shouldAppend: saveRecipientNote,
          targetPartnerId: recipientPartnerId,
          expectedWriteDate: recipientContact?.writeDate,
        });

    const preserveLegacySenderPayload = Boolean(
      pendingSubmission && !Object.prototype.hasOwnProperty.call(pendingSubmission.order, "senderName")
    );
    const includePendingField = (field: keyof Order) => (
      !pendingSubmission || Object.prototype.hasOwnProperty.call(pendingSubmission.order, field)
    );
    const currentOrder: Order = {
      id: pendingSubmission?.order.id || checkoutId,
      salesId,
      operatorEmployeeId,
      customerName: customerName.trim(),
      ...(includePendingField("customerType") ? { customerType } : {}),
      ...(includePendingField("companyName") ? { companyName: companyName.trim() } : {}),
      ...(includePendingField("customerEmail") ? { customerEmail: customerEmail.trim() } : {}),
      ...(includePendingField("billingAddress") ? { billingAddress: billingAddress.trim() } : {}),
      ...(includePendingField("customerGroup") ? { customerGroup: customerGroup.trim() } : {}),
      ...(includePendingField("senderDoNumber") ? { senderDoNumber: senderDoNumber.trim() } : {}),
      ...(includePendingField("recipientDoNumber") ? { recipientDoNumber: recipientDoNumber.trim() } : {}),
      ...(includePendingField("sourceReference") ? { sourceReference: sourceReference.trim() } : {}),
      ...(includePendingField("department") ? { department: department.trim() } : {}),
      ...(includePendingField("terms") ? { terms: terms.trim() } : {}),
      ...(preserveLegacySenderPayload ? {} : { senderName: senderName.trim() }),
      phone: phone.trim(),
      items,
      deliveryFee,
      urgentFee,
      subtotal,
      finalPrice,
      priceOverridden,
      paymentStatus,
      depositAmount: paymentStatus === "deposit" ? depositAmount : 0,
      paymentMethod,
      paymentReference: receivesPayment ? paymentReference.trim() : "",
      paymentReceivedAt: receiptTimestamp,
      paymentIdempotencyKey: pendingSubmission?.order.paymentIdempotencyKey || receiptIdempotencyKey,
      deliveryDate,
      ...deliveryContractFieldsForSubmission(
        deliveryTimeMode,
        deliverySlotId,
        hasLegacyPendingDelivery ? undefined : pendingSubmission?.order,
      ),
      deliveryTime,
      deliveryAddress,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      deliveryPerson: deliveryPerson.trim(),
      giftCardEnabled,
      giftCardMessage: giftCardEnabled ? giftCardMessage.trim() : "",
      senderNote: senderNote.trim(),
      deliveryNote: deliveryNote.trim(),
      internalNote: internalNote.trim(),
      ...(customerNoteMutation ? { customerNoteMutation } : {}),
      ...(recipientNoteMutation ? { recipientNoteMutation } : {}),
      recipientPartnerId,
      createdAt: pendingSubmission?.order.createdAt || new Date().toISOString(),
    };
    const currentOptions = pendingSubmission
      ? pendingSubmission.options
      : {
          customerId: selectedCustomer?.odooPartnerId,
          customerType,
          companyName: companyName.trim(),
        };
    const currentSubmission = {
      order: currentOrder,
      options: currentOptions,
      savedAt: pendingSubmission?.savedAt || new Date().toISOString(),
    };
    let submission: PendingOrderSubmission = currentSubmission;
    if (pendingSubmission) {
      const hasLegacyPendingBusinessFields = [
        "customerType",
        "companyName",
        "customerEmail",
        "billingAddress",
        "customerGroup",
        "senderDoNumber",
        "recipientDoNumber",
        "sourceReference",
        "department",
        "terms",
      ].some((field) => !Object.prototype.hasOwnProperty.call(pendingSubmission.order, field));
      if (hasLegacyPendingDelivery) {
        try {
          submission = upgradeLegacyPendingDeliverySelection(
            pendingSubmission,
            {
              deliveryTimeMode: deliveryTimeMode!,
              deliverySlotId,
              deliveryTime,
            },
            currentSubmission,
          );
          setPendingSubmission(submission);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "未能安全更新待確認訂單嘅送貨時間",
          );
          return;
        }
      } else if (!submissionPayloadMatches(pendingSubmission, currentSubmission)) {
        toast.error(
          hasLegacyPendingBusinessFields
            ? "呢張舊格式待確認訂單唔可以修改；請保留原本內容重試，或先到 Odoo 核對訂單結果"
            : "已恢復嘅待確認訂單曾被修改；請還原原本內容後先重試",
        );
        return;
      } else {
        submission = pendingSubmission;
      }
    }

    setIsSubmitting(true);
    setNotesConflict(null);

    const order = submission.order;

    let syncedOrder: Order = order;

    try {
      if (hasOdooBackend) {
        setPendingSubmission(submission);
        const odooOrder = await submitPersistedOrder(submission, submitOdooOrder);
        setPendingSubmission(null);
        syncedOrder = {
          ...order,
          odooOrderId: odooOrder.id,
          odooOrderName: odooOrder.name,
          odooInvoiceId: odooOrder.accounting?.invoice.id,
          odooInvoiceName: odooOrder.accounting?.invoice.name,
          odooPaymentId: odooOrder.accounting?.payment?.id,
          odooPaymentName: odooOrder.accounting?.payment?.name,
        };
        const references = [
          `訂單 ${odooOrder.name}`,
          odooOrder.accounting?.invoice.name ? `發票 ${odooOrder.accounting.invoice.name}` : null,
          odooOrder.accounting?.payment?.name ? `收款 ${odooOrder.accounting.payment.name}` : null,
        ].filter(Boolean).join(" · ");
        toast.success(`已同步到 Odoo staging：${references}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      if (isDeterministicSubmissionFailure(err)) {
        setPendingSubmission(null);
        toast.error(`Odoo 驗證失敗：${message}。訂單已解鎖，可以修改後再提交。`, { duration: 9000 });
      } else {
        toast.error(`Odoo 同步失敗：${message}`, { duration: 8000 });
      }
      setIsSubmitting(false);
      return;
    }

    if (hasOdooBackend) {
      setOrderRecordsRefreshKey((key) => key + 1);
    } else {
      const updated = [...localOrders, syncedOrder];
      setLocalOrders(updated);
      saveUnsyncedOrders(updated);
    }

    if (order.paymentStatus === "unpaid") {
      toast.warning("訂單已建立 — 未付款", { duration: 5000 });
    } else if (order.paymentStatus === "deposit") {
      toast.info(
        `訂單已建立 — 已收訂金 $${order.depositAmount}，尚欠 $${order.finalPrice - order.depositAmount}`,
      );
    } else {
      toast.success("訂單已建立 ✓");
    }

    // Show print dialog
    toast("列印單據", {
      duration: 15000,
      description: "選擇要列印嘅單據：",
      action: {
        label: "收據",
        onClick: () => printDocument(generateReceipt(syncedOrder)),
      },
      cancel: {
        label: "全部列印",
        onClick: () => printDocument(generateAllDocuments(syncedOrder)),
      },
    });

    resetOrderForm();
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-full flex-col items-stretch gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="flex min-w-0 items-center" aria-label="中西花店 POS">
            <img
              src="/anglo-chinese-florist-logo.webp"
              alt="中西花店 Anglo Chinese Florist"
              className="h-9 w-auto max-w-[150px] object-contain sm:h-10 sm:max-w-[180px]"
            />
          </h1>
          <div className="flex w-full items-center justify-end gap-1 overflow-x-auto sm:w-auto sm:gap-2">
            <CsvImportButton onCustomersUpdated={() => setCustomerRefreshKey((k) => k + 1)} />
            <Button variant="ghost" size="sm" onClick={() => navigate("/day-end")} className="gap-1.5 text-xs">
              <Calculator className="w-3.5 h-3.5" /> 日結
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearForm} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> 清空
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="gap-1.5 text-xs relative"
            >
              <ClipboardList className="w-3.5 h-3.5" /> 訂單記錄
            </Button>
          </div>
        </div>
      </header>

      {/* Body: left panel + main */}
      <div className="flex flex-1">
        {/* Left: Customer history panel */}
        {hasSalesperson && selectedCustomer && (
          <CustomerHistoryDock
            key={selectedCustomer.id}
            customer={selectedCustomer}
            onUseAddress={(selection) => {
              const parsed = parseDeliveryAddress(selection.address);
              setDeliveryRegion(parsed.region);
              setDeliveryDistrict(parsed.district);
              setDeliveryArea(parsed.area);
              setDeliveryDetail(parsed.detail);
              setRecipientName(selection.recipientName || "");
              setRecipientPhone(selection.recipientPhone || "");
              setRecipientPartnerId(selection.shippingPartnerId);
              setRecipientContact(null);
              setRecipientContactDraft("");
              setSaveRecipientNote(false);
              clearCheckoutErrors("deliveryAddress", "recipientName", "recipientPhone");
              toast.success("已套用過往送貨地址");
            }}
          />
        )}

        {/* Main form */}
        <main className="flex-1 max-w-3xl mx-auto px-4 py-5 space-y-4 pb-28">
        <SalesIdSection
          salesId={salesId}
          onSalespersonChange={(label, employeeId) => {
            setSalesId(label);
            setOperatorEmployeeId(employeeId);
          }}
        />

        {hasSalesperson ? (
          <>
        {Object.keys(checkoutErrors).length > 0 && (
          <div
            role="alert"
            aria-labelledby="checkout-errors-title"
            className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-destructive"
          >
            <p id="checkout-errors-title" className="text-sm font-semibold">
              請修正以下訂單資料
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {Object.values(checkoutErrors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        <CustomerSection
          phone={phone}
          customerName={customerName}
          senderName={senderName}
          customerType={customerType}
          companyName={companyName}
          customerEmail={customerEmail}
          billingAddress={billingAddress}
          onPhoneChange={(v) => {
            setPhone(v);
            clearCheckoutErrors("phone");
            const normalizedPhone = normalizePhoneNumber(v);
            setConfirmedNewCustomerPhone((current) => (
              current && current !== normalizedPhone ? null : current
            ));
            if (
              selectedCustomer
              && normalizedPhone !== normalizePhoneNumber(selectedCustomer.phone)
            ) {
              detachSelectedCustomerProfile();
            }
          }}
          onNameChange={(value) => {
            setCustomerName(value);
            clearCheckoutErrors("customerName");
            if (selectedCustomer && value !== selectedCustomer.name) {
              detachSelectedCustomerProfile();
            }
          }}
          onSenderNameChange={(value) => {
            setSenderName(value);
            clearCheckoutErrors("senderName");
          }}
          onCustomerTypeChange={(value) => {
            const profile = companyFieldsForCustomerType(value, companyName, billingAddress);
            setCustomerType(profile.customerType);
            setCompanyName(profile.companyName);
            setBillingAddress(profile.billingAddress);
            clearCheckoutErrors("companyName", "billingAddress");
          }}
          onCompanyNameChange={(value) => {
            setCompanyName(value);
            clearCheckoutErrors("companyName");
          }}
          onCustomerEmailChange={(value) => {
            setCustomerEmail(value);
            clearCheckoutErrors("customerEmail");
          }}
          onBillingAddressChange={(value) => {
            setBillingAddress(value);
            clearCheckoutErrors("billingAddress");
          }}
          onCustomerSelect={(c) => {
            setSelectedCustomer(c);
            setConfirmedNewCustomerPhone(null);
            setCustomerName(c.name);
            setPhone(c.phone);
            setCustomerEmail(c.email || "");
            setCustomerType(c.customerType || "personal");
            setCompanyName(c.companyName || "");
            setBillingAddress(c.billingAddress || "");
            clearCheckoutErrors(
              "customerName",
              "phone",
              "companyName",
              "customerEmail",
              "billingAddress",
            );
            setSenderContactDraft(c.commentText || "");
            setSaveSenderNote(false);
            setNotesConflict(null);
            resetRecipientPersistence();
          }}
          phoneError={checkoutErrors.phone}
          customerNameError={checkoutErrors.customerName}
          senderNameError={checkoutErrors.senderName}
          companyNameError={checkoutErrors.companyName}
          customerEmailError={checkoutErrors.customerEmail}
          billingAddressError={checkoutErrors.billingAddress}
          selectedCustomer={selectedCustomer}
          confirmedNewCustomerPhone={confirmedNewCustomerPhone}
          onConfirmNewCustomer={(normalizedPhone) => {
            setSelectedCustomer(null);
            setConfirmedNewCustomerPhone(normalizedPhone);
            clearCheckoutErrors("phone");
          }}
          refreshKey={customerRefreshKey}
        />

        <BusinessDetailsSection
          customerGroup={customerGroup}
          senderDoNumber={senderDoNumber}
          recipientDoNumber={recipientDoNumber}
          sourceReference={sourceReference}
          department={department}
          terms={terms}
          onCustomerGroupChange={setCustomerGroup}
          onSenderDoNumberChange={setSenderDoNumber}
          onRecipientDoNumberChange={setRecipientDoNumber}
          onSourceReferenceChange={setSourceReference}
          onDepartmentChange={setDepartment}
          onTermsChange={setTerms}
        />

        <OrderItemsSection
          items={items}
          onItemsChange={setItems}
          deliveryFee={deliveryFee}
          urgentFee={urgentFee}
          onDeliveryFeeChange={setDeliveryFee}
          onUrgentFeeChange={setUrgentFee}
          onCustomOrderSummary={(summary) => {
            setInternalNote((current) => current ? `${current}\n\n${summary}` : summary);
          }}
          budget={budget}
          onBudgetChange={setBudget}
          subtotal={subtotal}
        />

        <DeliverySection
          deliveryDate={deliveryDate}
          deliveryTime={deliveryTime}
          deliveryTimeMode={deliveryTimeMode}
          deliverySlotId={deliverySlotId}
          frozenSlotSelection={frozenDeliverySlotSelection}
          deliverySlots={deliverySlots}
          deliverySlotsLoading={deliverySlotsLoading}
          deliverySlotsError={deliverySlotsError}
          deliveryTimeError={checkoutErrors.deliveryTime ?? null}
          deliveryDateError={checkoutErrors.deliveryDate}
          deliveryAddressError={checkoutErrors.deliveryAddress}
          recipientNameError={checkoutErrors.recipientName}
          recipientPhoneError={checkoutErrors.recipientPhone}
          legacyDeliveryTime={Boolean(
            hasLegacyPendingDelivery
              && deliveryTimeMode === undefined
              && pendingSubmission?.order.deliveryTime
          )}
          deliveryRegion={deliveryRegion}
          deliveryDistrict={deliveryDistrict}
          deliveryArea={deliveryArea}
          deliveryDetail={deliveryDetail}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          deliveryPerson={deliveryPerson}
          onDateChange={(value) => {
            setDeliveryDate(value);
            clearCheckoutErrors("deliveryDate", "deliveryTime");
          }}
          onTimeChange={(value) => {
            setDeliveryTime(value);
            clearCheckoutErrors("deliveryTime");
          }}
          onSlotChange={handleDeliverySlotChange}
          onSpecifiedTimeSelect={handleSpecifiedTimeSelect}
          onRetryDeliverySlots={() => setDeliverySlotsRefreshKey((key) => key + 1)}
          onRegionChange={(value) => {
            setDeliveryRegion(value);
            clearCheckoutErrors("deliveryAddress");
            resetRecipientPersistence();
          }}
          onDistrictChange={(value) => {
            setDeliveryDistrict(value);
            clearCheckoutErrors("deliveryAddress");
            resetRecipientPersistence();
          }}
          onAreaChange={(value) => {
            setDeliveryArea(value);
            clearCheckoutErrors("deliveryAddress");
            resetRecipientPersistence();
          }}
          onGoogleAddressSelect={(selection) => {
            setDeliveryRegion(selection.region);
            setDeliveryDistrict(selection.district);
            setDeliveryArea(selection.area);
            setDeliveryDetail(selection.address);
            clearCheckoutErrors("deliveryAddress");
            resetRecipientPersistence();
          }}
          onDetailChange={(value) => {
            setDeliveryDetail(value);
            clearCheckoutErrors("deliveryAddress");
            resetRecipientPersistence();
          }}
          onRecipientNameChange={(value) => {
            setRecipientName(value);
            clearCheckoutErrors("recipientName");
            resetRecipientPersistence();
          }}
          onRecipientPhoneChange={(value) => {
            setRecipientPhone(value);
            clearCheckoutErrors("recipientPhone");
            resetRecipientPersistence();
          }}
          onDeliveryPersonChange={setDeliveryPerson}
          failedDeliveryAction={failedDeliveryAction}
          onFailedDeliveryActionChange={setFailedDeliveryAction}
        />

        <OrderNotesSection
          senderNote={senderNote}
          deliveryNote={deliveryNote}
          internalNote={internalNote}
          onSenderNoteChange={(value) => {
            setSenderNote(value);
          }}
          onDeliveryNoteChange={(value) => {
            setDeliveryNote(value);
          }}
          onInternalNoteChange={setInternalNote}
          senderCustomer={selectedCustomer}
          hasSenderIdentity={Boolean(phone.trim() || customerName.trim())}
          hasRecipientIdentity={Boolean(
            recipientPartnerId || recipientName.trim() || recipientPhone.trim() || deliveryDetail.trim()
          )}
          recipientPartnerId={recipientPartnerId}
          recipientContact={recipientContact}
          senderContactDraft={senderContactDraft}
          recipientContactDraft={recipientContactDraft}
          onSenderContactDraftChange={setSenderContactDraft}
          onRecipientContactDraftChange={setRecipientContactDraft}
          onSaveSenderContact={() => void saveSenderContactComment()}
          onSaveRecipientContact={() => void saveRecipientContactComment()}
          saveSenderNote={saveSenderNote}
          saveRecipientNote={saveRecipientNote}
          onSaveSenderNoteChange={setSaveSenderNote}
          onSaveRecipientNoteChange={setSaveRecipientNote}
          onRefreshSender={() => void refreshSenderContact()}
          onRefreshRecipient={() => void refreshRecipientContact()}
          refreshingSender={refreshingSender}
          refreshingRecipient={refreshingRecipient}
          savingSender={savingSenderContact}
          savingRecipient={savingRecipientContact}
          conflict={notesConflict}
        />

        <GiftCardSection
          enabled={giftCardEnabled}
          message={giftCardMessage}
          onEnabledChange={setGiftCardEnabled}
          onMessageChange={setGiftCardMessage}
        />

        <PaymentSection
          subtotal={subtotal}
          finalPrice={finalPrice}
          priceOverridden={priceOverridden}
          allowPriceOverride={!hasOdooBackend}
          onFinalPriceChange={handleFinalPriceChange}
          onResetPrice={resetPrice}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={(status) => {
            setPaymentStatus(status);
            if (status === "unpaid") {
              setPaymentMethod("");
              setPaymentReference("");
              setPaymentReceivedAt("");
            }
          }}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          paymentReference={paymentReference}
          onPaymentReferenceChange={setPaymentReference}
          paymentOptions={paymentOptions}
          paymentOptionsLoading={paymentOptionsLoading}
          paymentOptionsError={paymentOptionsError}
          depositAmount={depositAmount}
          onDepositAmountChange={setDepositAmount}
          priceWarning={finalPrice <= 0 && items.length > 0}
        />

          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm font-medium">請先選擇負責員工</p>
            <p className="mt-1 text-xs text-muted-foreground">選擇後先會顯示客戶及訂單資料。</p>
          </div>
        )}
      </main>
      </div>
      {/* Sticky submit */}
      {hasSalesperson && <div
        className="fixed bottom-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border transition-[left]"
        style={{ left: selectedCustomer ? "min(360px, 85vw)" : 0 }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">總計</p>
            <p className="text-2xl font-bold font-mono tracking-tight">${finalPrice.toLocaleString()}</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="lg"
            className="px-8 text-base font-semibold shadow-lg"
          >
            {isSubmitting ? "同步中..." : "確認訂單"}
          </Button>
        </div>
      </div>}

      {/* Order history drawer */}
      <OrderHistory
        orders={visibleOrderRecords}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={orderRecordsLoading}
        loaded={orderRecordsLoaded}
        error={orderRecordsError}
        stale={orderRecordsLoaded && Boolean(orderRecordsError)}
        truncated={orderRecordsTruncated}
        onRetry={() => setOrderRecordsRefreshKey((key) => key + 1)}
      />
    </div>
  );
};

export default Index;
