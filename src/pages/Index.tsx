import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calculator, ClipboardList, LogOut, RotateCcw, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CsvImportButton from "@/components/pos/CsvImportButton";
import { generateAllDocuments, generateReceipt, printDocument } from "@/lib/print-utils";
import CustomerSection from "@/components/pos/CustomerSection";
import BusinessDetailsSection from "@/components/pos/BusinessDetailsSection";
import OrderItemsSection from "@/components/pos/OrderItemsSection";
import DeliverySection from "@/components/pos/DeliverySection";
import SplitDeliverySection from "@/components/pos/SplitDeliverySection";
import {
  normalizeDeliverySplitsForSubmission,
  validateDeliverySplits,
} from "@/lib/split-delivery";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
import GiftCardSection from "@/components/pos/GiftCardSection";
import PaymentSection from "@/components/pos/PaymentSection";
import OrderHistory from "@/components/pos/OrderHistory";
import CustomerHistoryDock from "@/components/pos/CustomerHistoryDock";
import OrderNotesSection, { type NotesConflictTarget } from "@/components/pos/OrderNotesSection";
import OrderSummaryPanel from "@/components/pos/OrderSummaryPanel";
import type { WorkflowSectionId } from "@/components/pos/PosWorkflowTabs";
import type {
  DeliveryTimeMode,
  DeliverySplit,
  FulfillmentType,
  Order,
  OrderItem,
  PaymentStatus,
  RecipientType,
} from "@/types/order";
import SalesIdSection from "@/components/pos/SalesIdSection";
import { usePosAuth } from "@/components/auth/PosAuthContext";
import { posAuthRequired } from "@/lib/pos-auth";
import type { DemoCustomer } from "@/data/demo-customers";
import { buildPartnerNoteMutation } from "@/lib/customer-notes";
import {
  companyFieldsForCustomerType,
  type CustomerResolutionState,
  detachedCustomerProfile,
} from "@/lib/customer-profile";
import {
  discardPendingSubmissionAfterOdooReview,
  deliveryContractFieldsForSubmission,
  employeeSnapshotForSubmission,
  firstAddedLegacyBusinessField,
  isDeterministicSubmissionFailure,
  loadPendingSubmission,
  pendingOptionBindingsMatch,
  pendingRecipientBindingsMatch,
  pendingSubmissionBelongsToEmployee,
  pendingSubmissionForEmployee,
  submissionPayloadMatches,
  submitPersistedOrder,
  upgradeLegacyPendingDeliverySelection,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";
import {
  getDeliverySlots,
  getOdooCustomer,
  getOdooPartnerNotes,
  getOperationalOrderStatus,
  getOdooOrderRecords,
  searchOdooOrderRecords,
  getAccountingPaymentOptions,
  allowLocalOnlyOrders,
  hasOdooBackend,
  OdooConflictError,
  submitOdooOrder,
  updateOdooPartnerNotes,
  type AccountingPaymentOption,
  type DeliverySlot,
  type PartnerNoteRecord,
  type RecipientSuggestion,
} from "@/lib/odoo-api";
import {
  DEMO_DELIVERY_SLOTS,
  deliverySlotSnapshot,
} from "@/lib/delivery-slots";
import {
  validateCheckout,
  validatePositiveOrderTotal,
  isValidDeliveryDate,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeCustomerIdentityName,
  normalizePhoneNumber,
  type CheckoutErrors,
  type CheckoutField,
} from "@/lib/checkout-validation";
import { orderItemsTotal, orderLineAdjustmentNeedsReason } from "@/lib/order-pricing";
import { parseDeliveryAddress } from "@/lib/hk-address";
import { checkoutBarLeftOffset } from "@/lib/pos-layout";
import {
  loadCachedPaymentOptions,
  resolvePaymentReference,
  saveCachedPaymentOptions,
} from "@/lib/payment-options";
import {
  hongKongBusinessDate,
  loadUnsyncedOrders,
  mergeOrderRecords,
  orderMatchesSearch,
  removeSyncedLocalOrders,
  saveUnsyncedOrders,
} from "@/lib/order-records";
import {
  loadOperationalOrders,
  saveOperationalOrdersForEmployee,
  type OperationalOrderRecord,
} from "@/lib/operational-orders";

type RecipientSelectionDetails = Pick<
  RecipientSuggestion,
  | "recipientType"
  | "recipientCompanyName"
  | "recipientName"
  | "recipientPhone"
  | "deliveryAddress"
  | "shippingPartnerId"
>;

const CUSTOMER_CHECKOUT_FIELDS: CheckoutField[] = [
  "customerName",
  "phone",
  "senderName",
  "companyName",
  "customerEmail",
  "billingAddress",
];

const DELIVERY_CHECKOUT_FIELDS: CheckoutField[] = [
  "recipientCompanyName",
  "recipientName",
  "recipientPhone",
  "deliveryAddress",
  "deliveryDate",
  "deliveryTime",
];

const Index = () => {
  const navigate = useNavigate();
  const { employee, logout } = usePosAuth();
  const [pendingSubmission, setPendingSubmission] = useState<PendingOrderSubmission | null>(
    () => loadPendingSubmission(employee, posAuthRequired),
  );
  const restoredPendingSubmission = useRef(pendingSubmission).current;
  const restoredEmployeePendingSubmission = pendingSubmissionForEmployee(
    restoredPendingSubmission,
    employee,
    posAuthRequired,
  );
  const employeePendingSubmission = pendingSubmissionForEmployee(
    pendingSubmission,
    employee,
    posAuthRequired,
  );
  // Customer
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
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
  const [customerResolution, setCustomerResolution] = useState<CustomerResolutionState>({
    phase: "idle",
    identityKey: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<DemoCustomer | null>(null);
  const [customerHistoryOpen, setCustomerHistoryOpen] = useState(true);
  const [confirmedNewCustomerName, setConfirmedNewCustomerName] = useState<string | null>(null);
  const [confirmedNewCustomerPhone, setConfirmedNewCustomerPhone] = useState<string | null>(null);
  const [customerRefreshKey, setCustomerRefreshKey] = useState(0);
  const linkedPartySelectionRequestRef = useRef(0);

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
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("delivery");
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
  const [deliveryBuilding, setDeliveryBuilding] = useState("");
  const [deliveryFloor, setDeliveryFloor] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("personal");
  const [recipientCompanyName, setRecipientCompanyName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [failedDeliveryAction, setFailedDeliveryAction] = useState("none");
  const [deliverySplits, setDeliverySplits] = useState<DeliverySplit[]>(
    () => restoredEmployeePendingSubmission?.order.deliverySplits || [],
  );

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
    () => restoredEmployeePendingSubmission?.order.paymentIdempotencyKey || crypto.randomUUID(),
  );
  const [checkoutId, setCheckoutId] = useState(
    () => restoredEmployeePendingSubmission?.order.id || crypto.randomUUID(),
  );
  const [paymentOptions, setPaymentOptions] = useState<AccountingPaymentOption[]>(loadCachedPaymentOptions);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false);
  const [paymentOptionsError, setPaymentOptionsError] = useState<string | null>(null);
  const [salesId, setSalesId] = useState(employee?.salesLabel || "");
  const [operatorEmployeeId, setOperatorEmployeeId] = useState<number | undefined>(employee?.id);
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // History
  const [localOrders, setLocalOrders] = useState<Order[]>(loadUnsyncedOrders);
  const [operationalOrders, setOperationalOrders] = useState<OperationalOrderRecord[]>(
    () => loadOperationalOrders(employee?.id),
  );
  const operationalOrdersRef = useRef(operationalOrders);
  const [remoteOrders, setRemoteOrders] = useState<Order[]>([]);
  const [remoteOrdersQuery, setRemoteOrdersQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [debouncedOrderSearchQuery, setDebouncedOrderSearchQuery] = useState("");
  const [orderSearchPhase, setOrderSearchPhase] = useState<
    "idle" | "too_short" | "debouncing" | "searching" | "success" | "error"
  >("idle");
  const orderSearchRequestRef = useRef(0);
  const orderSearchQueryRef = useRef("");
  const [orderRecordsLoading, setOrderRecordsLoading] = useState(false);
  const [orderRecordsLoaded, setOrderRecordsLoaded] = useState(!hasOdooBackend);
  const [orderRecordsError, setOrderRecordsError] = useState<string | null>(null);
  const [orderRecordsTruncated, setOrderRecordsTruncated] = useState(false);
  const [orderRecordsRefreshKey, setOrderRecordsRefreshKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const workflowHeaderRef = useRef<HTMLElement | null>(null);
  const workflowSectionRefs = useRef<Record<WorkflowSectionId, HTMLElement | null>>({
    customer: null,
    items: null,
    delivery: null,
    notes: null,
    payment: null,
  });

  const normalizedOrderSearchQuery = orderSearchQuery.trim();
  const orderSearchActive = normalizedOrderSearchQuery.length >= 2;
  const visibleOrderRecords = useMemo(() => {
    if (normalizedOrderSearchQuery && !orderSearchActive) return [];
    const matchingLocalOrders = orderSearchActive
      ? localOrders.filter((order) => orderMatchesSearch(order, normalizedOrderSearchQuery))
      : localOrders;
    const matchingPendingOrder = employeePendingSubmission?.order
      && (!orderSearchActive
        || orderMatchesSearch(employeePendingSubmission.order, normalizedOrderSearchQuery))
      ? employeePendingSubmission.order
      : undefined;
    const matchingRemoteOrders = remoteOrdersQuery === normalizedOrderSearchQuery
      ? remoteOrders
      : [];
    const matchingOperationalOrders = orderSearchActive
      ? operationalOrders.filter((record) => (
          orderMatchesSearch(record.order, normalizedOrderSearchQuery)
        ))
      : operationalOrders;
    return mergeOrderRecords(
      matchingRemoteOrders,
      matchingLocalOrders,
      matchingPendingOrder,
      matchingOperationalOrders,
    );
  }, [
    employeePendingSubmission,
    localOrders,
    normalizedOrderSearchQuery,
    orderSearchActive,
    operationalOrders,
    remoteOrders,
    remoteOrdersQuery,
  ]);

  useEffect(() => {
    operationalOrdersRef.current = operationalOrders;
  }, [operationalOrders]);

  useEffect(() => {
    if (employee?.id === undefined) {
      setOperationalOrders([]);
      return;
    }
    setOperationalOrders(loadOperationalOrders(employee.id));
  }, [employee?.id]);

  useEffect(() => {
    if (!hasOdooBackend || employee?.id === undefined) return;
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    const poll = async () => {
      const current = operationalOrdersRef.current;
      const pending = current.filter(
        (record) => record.syncState === "pending_odoo" || record.syncState === "syncing",
      );
      if (pending.length > 0) {
        controller = new AbortController();
        const results = await Promise.allSettled(
          pending.map((record) => getOperationalOrderStatus(
            record.operationalOrderId,
            controller?.signal,
          )),
        );
        if (!stopped) {
          let transitionedToSynced = false;
          const byId = new Map(results.flatMap((result, index) => {
            if (result.status !== "fulfilled") return [];
            return [[pending[index].operationalOrderId, result.value] as const];
          }));
          if (byId.size > 0) {
            const next = current.map((record) => {
              const status = byId.get(record.operationalOrderId);
              if (!status) return record;
              if (record.syncState !== "synced" && status.syncState === "synced") {
                transitionedToSynced = true;
              }
              return {
                ...record,
                syncState: status.syncState,
                reviewError: status.reviewError,
                lastError: status.lastError,
                attemptCount: status.attemptCount,
                updatedAt: new Date().toISOString(),
                order: {
                  ...record.order,
                  odooOrderId: status.odooOrderId ?? record.order.odooOrderId,
                  odooOrderName: status.odooOrderName ?? record.order.odooOrderName,
                },
              };
            });
            operationalOrdersRef.current = next;
            setOperationalOrders(next);
            saveOperationalOrdersForEmployee(employee.id, next);
            if (transitionedToSynced) {
              setOrderRecordsRefreshKey((key) => key + 1);
            }
          }
        }
      }
      if (!stopped) timer = window.setTimeout(poll, 10_000);
    };

    timer = window.setTimeout(poll, 1_500);
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [employee?.id]);

  useEffect(() => {
    const normalizedQuery = orderSearchQuery.trim();
    orderSearchQueryRef.current = normalizedQuery;
    orderSearchRequestRef.current += 1;
    if (!normalizedQuery) {
      setOrderSearchPhase("idle");
      setDebouncedOrderSearchQuery("");
      return;
    }
    if (normalizedQuery.length < 2) {
      setOrderSearchPhase("too_short");
      setDebouncedOrderSearchQuery(normalizedQuery);
      return;
    }
    setOrderSearchPhase("debouncing");
    if (!hasOdooBackend) {
      setDebouncedOrderSearchQuery(normalizedQuery);
      setOrderSearchPhase("success");
      return;
    }
    const timer = window.setTimeout(() => setDebouncedOrderSearchQuery(normalizedQuery), 300);
    return () => window.clearTimeout(timer);
  }, [orderSearchQuery]);

  useEffect(() => {
    if (!historyOpen || !hasOdooBackend) return;
    if (debouncedOrderSearchQuery && debouncedOrderSearchQuery.length < 2) {
      setOrderRecordsLoading(false);
      setOrderRecordsLoaded(true);
      setOrderRecordsError(null);
      setOrderRecordsTruncated(false);
      return;
    }
    const controller = new AbortController();
    const requestId = orderSearchRequestRef.current + 1;
    orderSearchRequestRef.current = requestId;
    const requestQuery = debouncedOrderSearchQuery;
    setOrderRecordsLoading(true);
    setOrderRecordsError(null);
    if (requestQuery.length >= 2) setOrderSearchPhase("searching");

    const request = debouncedOrderSearchQuery.length >= 2
      ? searchOdooOrderRecords(debouncedOrderSearchQuery, controller.signal)
      : getOdooOrderRecords(hongKongBusinessDate(), controller.signal);

    request
      .then((response) => {
        if (
          controller.signal.aborted
          || orderSearchRequestRef.current !== requestId
          || orderSearchQueryRef.current !== requestQuery
        ) return;
        setRemoteOrdersQuery(requestQuery);
        setRemoteOrders(response.orders);
        if (employee?.id !== undefined) {
          setOperationalOrders((current) => {
            const remaining = current.filter((record) => !response.orders.some((remote) => (
              remote.id === record.order.id
              || Boolean(
                remote.odooOrderId
                && record.order.odooOrderId
                && remote.odooOrderId === record.order.odooOrderId,
              )
              || Boolean(
                remote.odooOrderName
                && record.order.odooOrderName
                && remote.odooOrderName === record.order.odooOrderName,
              )
            )));
            if (remaining.length === current.length) return current;
            operationalOrdersRef.current = remaining;
            saveOperationalOrdersForEmployee(employee.id, remaining);
            return remaining;
          });
        }
        setLocalOrders((current) => {
          const remaining = removeSyncedLocalOrders(response.orders, current);
          if (remaining.length === current.length) return current;
          saveUnsyncedOrders(remaining);
          return remaining;
        });
        setOrderRecordsTruncated(response.truncated);
        setOrderRecordsLoaded(true);
        if (requestQuery.length >= 2) setOrderSearchPhase("success");
      })
      .catch((error) => {
        if (
          controller.signal.aborted
          || orderSearchRequestRef.current !== requestId
          || orderSearchQueryRef.current !== requestQuery
        ) return;
        setOrderRecordsError(error instanceof Error ? error.message : "未能載入 Odoo 訂單記錄");
        if (requestQuery.length >= 2) setOrderSearchPhase("error");
      })
      .finally(() => {
        if (
          !controller.signal.aborted
          && orderSearchRequestRef.current === requestId
          && orderSearchQueryRef.current === requestQuery
        ) setOrderRecordsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedOrderSearchQuery, employee?.id, historyOpen, orderRecordsRefreshKey]);

  const subtotal = useMemo(() => {
    const itemsTotal = orderItemsTotal(items);
    return itemsTotal + deliveryFee + urgentFee;
  }, [items, deliveryFee, urgentFee]);

  const finalPrice = priceOverridden && manualPrice !== null ? manualPrice : subtotal;
  const customerResolutionComplete = !hasOdooBackend
    || Boolean(pendingSubmission)
    || (
      normalizePhoneNumber(selectedCustomer?.phone || "") === normalizePhoneNumber(phone)
      && normalizeCustomerIdentityName(selectedCustomer?.name || "")
        === normalizeCustomerIdentityName(customerName)
    )
    || (
      normalizePhoneNumber(confirmedNewCustomerPhone || "") === normalizePhoneNumber(phone)
      && normalizeCustomerIdentityName(confirmedNewCustomerName || "")
        === normalizeCustomerIdentityName(customerName)
    );
  const customerSectionComplete = Boolean(
    customerName.trim()
      && senderName.trim()
      && isValidPhoneNumber(phone)
      && isValidEmailAddress(customerEmail)
      && customerResolutionComplete
      && (customerType !== "company" || (companyName.trim() && billingAddress.trim())),
  );
  const itemsSectionComplete = Boolean(
    items.length > 0
      && finalPrice > 0
      && !(hasOdooBackend && priceOverridden)
      && !items.some(orderLineAdjustmentNeedsReason),
  );
  const deliverySectionComplete = Boolean(
    isValidDeliveryDate(deliveryDate)
      && deliveryTimeMode
      && deliveryTime.trim()
      && (
        fulfillmentType === "pickup"
        || (
          [deliveryRegion, deliveryDistrict, deliveryArea, deliveryDetail].some((value) => value.trim())
          && recipientName.trim()
          && isValidPhoneNumber(recipientPhone)
          && (recipientType !== "company" || recipientCompanyName.trim())
        )
      ),
  ) && !validateDeliverySplits(deliverySplits, items);
  const receivesPayment = paymentStatus === "paid" || paymentStatus === "deposit";
  const paymentSectionComplete = Boolean(
    finalPrice > 0
      && (
        !receivesPayment
        || (
          paymentMethod
          && (
            paymentStatus !== "deposit"
            || (depositAmount > 0 && depositAmount < finalPrice)
          )
        )
      ),
  );
  const completedRequiredSectionCount = [
    customerSectionComplete,
    itemsSectionComplete,
    deliverySectionComplete,
    paymentSectionComplete,
  ].filter(Boolean).length;
  const hasSalesperson = salesId.trim().length > 0;

  const scrollToWorkflowSection = useCallback((sectionId: WorkflowSectionId) => {
    const target = workflowSectionRefs.current[sectionId];
    if (!target) return;
    const stickyHeaderHeight = workflowHeaderRef.current?.offsetHeight || 128;
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - stickyHeaderHeight - 16,
      behavior: "smooth",
    });
  }, []);
  const frozenDeliverySlotSelection = employeePendingSubmission?.order.deliveryTimeMode === "slot"
    && employeePendingSubmission.order.deliverySlotId !== undefined
    ? {
        slotId: employeePendingSubmission.order.deliverySlotId,
        snapshot: employeePendingSubmission.order.deliveryTime,
      }
    : undefined;
  const hasLegacyPendingDelivery = Boolean(
    employeePendingSubmission
      && !Object.prototype.hasOwnProperty.call(employeePendingSubmission.order, "deliveryTimeMode")
      && !Object.prototype.hasOwnProperty.call(employeePendingSubmission.order, "deliverySlotId"),
  );

  useEffect(() => {
    if (!employee) return;
    setSalesId(employee.salesLabel);
    setOperatorEmployeeId(employee.id);
  }, [employee]);

  useEffect(() => {
    if (!hasOdooBackend) return;
    const controller = new AbortController();
    setPaymentOptionsLoading(true);
    setPaymentOptionsError(null);
    getAccountingPaymentOptions(controller.signal)
      .then((options) => {
        if (options.length === 0) {
          setPaymentOptionsError("暫時未能更新 Odoo 付款方式；已保留上次可用設定");
          return;
        }
        setPaymentOptions(options);
        saveCachedPaymentOptions(options);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const reason = error instanceof Error ? error.message : "未能檢查 Odoo 收款設定";
        setPaymentOptionsError(`暫時未能更新 Odoo 付款方式；已保留上次可用設定（${reason}）`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentOptionsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!receivesPayment || paymentOptions.length === 0) return;
    if (paymentOptions.some((option) => option.code === paymentMethod)) return;
    setPaymentMethod(paymentOptions[0].code);
  }, [paymentMethod, paymentOptions, receivesPayment]);

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
    setCustomerCode("");
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

  const applyCustomerSelection = useCallback((customer: DemoCustomer) => {
    setSelectedCustomer(customer);
    setConfirmedNewCustomerName(null);
    setConfirmedNewCustomerPhone(null);
    setCustomerName(customer.name);
    setCustomerCode(customer.customerCode || "");
    setPhone(customer.phone);
    setCustomerEmail(customer.email || "");
    setCustomerType(customer.customerType || "personal");
    setCompanyName(customer.companyName || "");
    setBillingAddress(customer.billingAddress || "");
    clearCheckoutErrors(
      "customerName",
      "phone",
      "companyName",
      "customerEmail",
      "billingAddress",
    );
    setSenderContactDraft(customer.commentText || "");
    setSaveSenderNote(false);
    setNotesConflict(null);
    resetRecipientPersistence();
  }, [clearCheckoutErrors, resetRecipientPersistence]);

  const startNewCustomerUnderAccount = useCallback((accountCode: string) => {
    const emptyProfile = detachedCustomerProfile();
    setSelectedCustomer(null);
    setConfirmedNewCustomerName(null);
    setConfirmedNewCustomerPhone(null);
    setCustomerCode(accountCode);
    setPhone("");
    setCustomerName("");
    setSenderName("");
    setCustomerEmail(emptyProfile.customerEmail);
    setCustomerType(emptyProfile.customerType);
    setCompanyName(emptyProfile.companyName);
    setBillingAddress(emptyProfile.billingAddress);
    setSenderContactDraft("");
    setSaveSenderNote(false);
    resetRecipientPersistence();
    clearCheckoutErrors("customerName", "phone", "companyName", "customerEmail", "billingAddress");
  }, [clearCheckoutErrors, resetRecipientPersistence]);

  const applyRecipientSelection = useCallback((selection: RecipientSelectionDetails) => {
    setRecipientType(selection.recipientType);
    setRecipientCompanyName(selection.recipientCompanyName || "");
    setRecipientName(selection.recipientName || "");
    setRecipientPhone(selection.recipientPhone || "");
    setRecipientPartnerId(selection.shippingPartnerId || undefined);
    setRecipientContact(null);
    setRecipientContactDraft("");
    setSaveRecipientNote(false);
    setNotesConflict((current) => current?.target === "recipient" ? null : current);
    if (selection.deliveryAddress) {
      const parsed = parseDeliveryAddress(selection.deliveryAddress);
      setDeliveryRegion(parsed.region);
      setDeliveryDistrict(parsed.district);
      setDeliveryArea(parsed.area);
      setDeliveryDetail(parsed.detail);
    }
    clearCheckoutErrors(
      "deliveryAddress",
      "recipientCompanyName",
      "recipientName",
      "recipientPhone",
    );
  }, [clearCheckoutErrors]);

  const applyCustomerAndRecipient = useCallback((
    customer: DemoCustomer,
    recipient: NonNullable<DemoCustomer["recipientMatch"]>,
  ) => {
    applyCustomerSelection(customer);
    applyRecipientSelection({
      recipientType: recipient.recipientType || "personal",
      recipientCompanyName: recipient.companyName || null,
      recipientName: recipient.name || null,
      recipientPhone: recipient.phone || null,
      deliveryAddress: recipient.deliveryAddress || null,
      shippingPartnerId: recipient.shippingPartnerId || null,
    });
    toast.success("已同時套用下單人及收貨人資料");
  }, [applyCustomerSelection, applyRecipientSelection]);

  const applyRecipientAndLinkedCustomer = useCallback(async (
    suggestion: RecipientSuggestion,
  ) => {
    if (!suggestion.orderingCustomerId) {
      applyRecipientSelection(suggestion);
      toast.success("已套用過往收貨人資料");
      return;
    }

    const requestId = linkedPartySelectionRequestRef.current + 1;
    linkedPartySelectionRequestRef.current = requestId;
    try {
      const customer = await getOdooCustomer(suggestion.orderingCustomerId);
      if (linkedPartySelectionRequestRef.current !== requestId) return;
      applyCustomerSelection(customer);
      applyRecipientSelection(suggestion);
      toast.success("已同時套用收貨人及下單人資料");
    } catch (error: unknown) {
      if (linkedPartySelectionRequestRef.current !== requestId) return;
      applyRecipientSelection(suggestion);
      toast.error(
        error instanceof Error
          ? `已套用收貨人，但未能載入相連下單人：${error.message}`
          : "已套用收貨人，但未能載入相連下單人",
      );
    }
  }, [applyCustomerSelection, applyRecipientSelection]);

  const resetOrderForm = useCallback(() => {
    setPhone("");
    setCustomerName("");
    setCustomerCode("");
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
    setConfirmedNewCustomerName(null);
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
    setFulfillmentType("delivery");
    setDeliveryTime("");
    setDeliveryTimeMode(undefined);
    setDeliverySlotId(undefined);
    setDeliveryRegion("");
    setDeliveryDistrict("");
    setDeliveryArea("");
    setDeliveryDetail("");
    setDeliveryBuilding("");
    setDeliveryFloor("");
    setDeliveryUnit("");
    setRecipientType("personal");
    setRecipientCompanyName("");
    setRecipientName("");
    setRecipientPhone("");
    setDeliveryPerson("");
    setFailedDeliveryAction("none");
    setDeliverySplits([]);
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

  const handleDiscardPending = useCallback(() => {
    if (!pendingSubmission) return;
    if (
      posAuthRequired
      && (!employee || !pendingSubmissionBelongsToEmployee(pendingSubmission, employee))
    ) {
      toast.error("只有原本落單員工先可以移除呢張本機待確認資料");
      return;
    }
    const confirmed = window.confirm(
      "請先到 Odoo 用訂單編號核對是否已成功建立。\n\n繼續只會移除這部瀏覽器的本機待確認資料，不會刪除或修改 Odoo 內任何訂單。確定繼續？",
    );
    if (!confirmed) return;
    if (!discardPendingSubmissionAfterOdooReview(
      pendingSubmission,
      employee,
      true,
      posAuthRequired,
    )) {
      toast.error("本機待確認資料已改變，請重新載入後再核對");
      return;
    }
    setPendingSubmission(null);
    setCheckoutId(crypto.randomUUID());
    setPaymentIdempotencyKey(crypto.randomUUID());
    toast.success("已解除待確認狀態；表格資料已保留，可以修改後再提交。");
  }, [employee, pendingSubmission]);

  useEffect(() => {
    if (!restoredEmployeePendingSubmission) return;
    const { order, options } = restoredEmployeePendingSubmission;
    setPhone(order.phone);
    setCustomerName(order.customerName);
    setCustomerCode(order.customerCode || "");
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
      customerCode: order.customerCode,
      history: [],
      odooPartnerId: options.customerId,
    } : null);
    setConfirmedNewCustomerName(options.customerId ? null : order.customerName);
    setConfirmedNewCustomerPhone(options.customerId ? null : normalizePhoneNumber(order.phone));
    setItems(order.items);
    setDeliveryFee(order.deliveryFee);
    setUrgentFee(order.urgentFee);
    setSenderNote(order.senderNote);
    setDeliveryNote(order.deliveryNote);
    setInternalNote(order.internalNote);
    setSenderContactDraft(order.customerNoteMutation?.commentText || "");
    setRecipientContactDraft(order.recipientNoteMutation?.commentText || "");
    setRecipientPartnerId(order.recipientPartnerId);
    setFulfillmentType(order.fulfillmentType || "delivery");
    setDeliveryDate(order.deliveryDate);
    setDeliveryTime(order.deliveryTime);
    setDeliveryTimeMode(order.deliveryTimeMode);
    setDeliverySlotId(order.deliverySlotId);
    setDeliveryRegion("");
    setDeliveryDistrict("");
    setDeliveryArea("");
    setDeliveryDetail(order.deliveryGoogleAddress || order.deliveryAddress);
    setDeliveryBuilding(order.deliveryBuilding || "");
    setDeliveryFloor(order.deliveryFloor || "");
    setDeliveryUnit(order.deliveryUnit || "");
    setRecipientType(
      order.recipientType
        || (order.recipientCompanyName?.trim() ? "company" : "personal"),
    );
    setRecipientCompanyName(order.recipientCompanyName || "");
    setRecipientName(order.recipientName);
    setRecipientPhone(order.recipientPhone);
    setDeliveryPerson(order.deliveryPerson);
    setDeliverySplits(order.deliverySplits || []);
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
    if (!employee) {
      setSalesId(order.salesId);
      setOperatorEmployeeId(order.operatorEmployeeId);
    }
    toast.info("已恢復尚未確認嘅 Odoo 訂單，重試會沿用原本嘅訂單編號");
  }, [employee, restoredEmployeePendingSubmission]);

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
    if (
      pendingSubmission
      && !pendingRecipientBindingsMatch(pendingSubmission, {
        recipientType,
        recipientCompanyName,
      })
    ) {
      toast.error(
        "待確認訂單嘅收貨人類型或公司名稱已改變；請還原原本資料，或先到 Odoo 核對訂單結果",
      );
      return;
    }
    const deliveryGoogleAddress = [
      deliveryRegion,
      deliveryDistrict,
      deliveryArea,
      deliveryDetail.trim(),
    ].filter(Boolean).join(" ");
    const deliveryAddress = fulfillmentType === "pickup"
      ? PICKUP_LOCATION_ADDRESS
      : [
          deliveryGoogleAddress,
          deliveryBuilding.trim(),
          deliveryFloor.trim() ? `${deliveryFloor.trim()}樓` : "",
          deliveryUnit.trim() ? `${deliveryUnit.trim()}室` : "",
        ].filter(Boolean).join("，");
    const validationErrors = validateCheckout({
      fulfillmentType,
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
      selectedCustomerName: selectedCustomer?.name,
      selectedCustomerPhone: selectedCustomer?.phone,
      confirmedNewCustomerName,
      confirmedNewCustomerPhone,
      restoredPendingSubmission: Boolean(pendingSubmission),
      requiresCustomerResolution: hasOdooBackend,
      customerResolution,
      senderName,
      recipientType,
      recipientCompanyName,
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
      scrollToWorkflowSection(
        CUSTOMER_CHECKOUT_FIELDS.some((field) => validationErrors[field])
          ? "customer"
          : "delivery",
      );
      return;
    }
    const deliverySplitsError = validateDeliverySplits(deliverySplits, items);
    if (deliverySplitsError) {
      toast.error(deliverySplitsError);
      scrollToWorkflowSection("delivery");
      return;
    }

    const addedLegacyBusinessField = pendingSubmission
      ? firstAddedLegacyBusinessField(pendingSubmission.order, {
          customerCode,
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
      scrollToWorkflowSection("items");
      return;
    }

    if (hasOdooBackend && priceOverridden) {
      toast.error("Odoo 訂單價格必須跟商品目錄；請先重設最終價格");
      scrollToWorkflowSection("items");
      return;
    }

    const itemMissingAdjustmentReason = items.find(orderLineAdjustmentNeedsReason);
    if (itemMissingAdjustmentReason) {
      toast.error(`「${itemMissingAdjustmentReason.name}」已改價或折扣，請填寫原因`);
      scrollToWorkflowSection("items");
      return;
    }

    const totalError = validatePositiveOrderTotal(finalPrice);
    if (totalError) {
      toast.error(totalError);
      scrollToWorkflowSection("items");
      return;
    }

    const receivesPayment = paymentStatus === "paid" || paymentStatus === "deposit";
    if (receivesPayment && !paymentMethod) {
      toast.error("請選擇已啟用嘅 Odoo 付款方式");
      scrollToWorkflowSection("payment");
      return;
    }
    const resolvedPaymentReference = receivesPayment
      ? resolvePaymentReference(paymentReference, checkoutId)
      : "";
    if (receivesPayment && !paymentReference.trim()) {
      toast.warning(`未填付款參考編號；系統已使用 ${resolvedPaymentReference} 方便後補核對`);
    }
    if (paymentStatus === "deposit" && (depositAmount <= 0 || depositAmount >= finalPrice)) {
      toast.error("訂金必須大過 $0 並少過訂單總額");
      scrollToWorkflowSection("payment");
      return;
    }
    const receiptTimestamp = receivesPayment
      ? (paymentReceivedAt || new Date().toISOString())
      : "";
    const receiptIdempotencyKey = receivesPayment ? paymentIdempotencyKey : "";
    if (receivesPayment && !paymentReceivedAt) setPaymentReceivedAt(receiptTimestamp);

    const hasRecipientIdentity = Boolean(
      recipientPartnerId
        || recipientCompanyName.trim()
        || recipientName.trim()
        || recipientPhone.trim()
        || deliveryDetail.trim()
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
    const submissionEmployee = employeeSnapshotForSubmission(
      pendingSubmission,
      employee,
      { salesId, operatorEmployeeId },
    );
    const currentOrder: Order = {
      id: pendingSubmission?.order.id || checkoutId,
      ...submissionEmployee,
      customerName: customerName.trim(),
      ...(includePendingField("customerCode") ? { customerCode: customerCode.trim() } : {}),
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
      paymentReference: resolvedPaymentReference,
      paymentReceivedAt: receiptTimestamp,
      paymentIdempotencyKey: pendingSubmission?.order.paymentIdempotencyKey || receiptIdempotencyKey,
      fulfillmentType,
      deliveryDate,
      ...deliveryContractFieldsForSubmission(
        deliveryTimeMode,
        deliverySlotId,
        hasLegacyPendingDelivery ? undefined : pendingSubmission?.order,
      ),
      deliveryTime,
      deliveryAddress,
      deliveryGoogleAddress: fulfillmentType === "delivery" ? deliveryGoogleAddress : "",
      deliveryBuilding: fulfillmentType === "delivery" ? deliveryBuilding.trim() : "",
      deliveryFloor: fulfillmentType === "delivery" ? deliveryFloor.trim() : "",
      deliveryUnit: fulfillmentType === "delivery" ? deliveryUnit.trim() : "",
      ...(includePendingField("deliverySplits")
        ? { deliverySplits: normalizeDeliverySplitsForSubmission(deliverySplits) }
        : {}),
      ...(includePendingField("recipientType") ? { recipientType } : {}),
      ...(includePendingField("recipientCompanyName")
        ? { recipientCompanyName: recipientCompanyName.trim() }
        : {}),
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
        "customerCode",
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
    let isPendingOdooSync = false;
    let needsOdooReview = false;

    try {
      if (hasOdooBackend) {
        setPendingSubmission(submission);
        const odooOrder = await submitPersistedOrder(submission, submitOdooOrder);
        setPendingSubmission(null);
        isPendingOdooSync = odooOrder.syncState === "pending_odoo";
        needsOdooReview = odooOrder.syncState === "needs_review";
        syncedOrder = {
          ...order,
          odooOrderId: odooOrder.id ?? undefined,
          odooOrderName: odooOrder.name ?? undefined,
          odooInvoiceId: odooOrder.accounting?.invoice.id,
          odooInvoiceName: odooOrder.accounting?.invoice.name,
          odooPaymentId: odooOrder.accounting?.payment?.id,
          odooPaymentName: odooOrder.accounting?.payment?.name,
        };
        if ((isPendingOdooSync || needsOdooReview) && operatorEmployeeId !== undefined) {
          const tracked: OperationalOrderRecord = {
            operationalOrderId: odooOrder.operationalOrderId || order.id,
            operatorEmployeeId,
            order: syncedOrder,
            syncState: odooOrder.syncState,
            reviewError: odooOrder.reviewError,
            lastError: null,
            attemptCount: 0,
            updatedAt: new Date().toISOString(),
          };
          const next = [
            tracked,
            ...operationalOrdersRef.current.filter(
              (record) => record.operationalOrderId !== tracked.operationalOrderId,
            ),
          ];
          operationalOrdersRef.current = next;
          setOperationalOrders(next);
          saveOperationalOrdersForEmployee(operatorEmployeeId, next);
        }
        if (needsOdooReview) {
          toast.warning(odooOrder.reviewError || "訂單已安全保存，需要管理員核對", {
            duration: 9000,
          });
        } else if (!isPendingOdooSync) {
          const references = [
            odooOrder.name ? `訂單 ${odooOrder.name}` : null,
            odooOrder.accounting?.invoice.name ? `發票 ${odooOrder.accounting.invoice.name}` : null,
            odooOrder.accounting?.payment?.name ? `收款 ${odooOrder.accounting.payment.name}` : null,
          ].filter(Boolean).join(" · ");
          toast.success(`已同步到 Odoo staging：${references}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      if (isDeterministicSubmissionFailure(err)) {
        setPendingSubmission(null);
        // Supabase keeps the rejected checkout as an immutable audit record. A corrected
        // submission therefore needs fresh idempotency identities instead of reusing the
        // checkout that was already marked for review.
        setCheckoutId(crypto.randomUUID());
        setPaymentIdempotencyKey(crypto.randomUUID());
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

    if (needsOdooReview) {
      toast.info("這張訂單不會阻塞下一張單；可在訂單記錄查看核對狀態", {
        duration: 7000,
      });
    } else if (!isPendingOdooSync && order.paymentStatus === "unpaid") {
      toast.warning("訂單已建立 — 未付款", { duration: 5000 });
    } else if (!isPendingOdooSync && order.paymentStatus === "deposit") {
      toast.info(
        `訂單已建立 — 已收訂金 $${order.depositAmount}，尚欠 $${order.finalPrice - order.depositAmount}`,
      );
    } else if (!isPendingOdooSync) {
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
      <header ref={workflowHeaderRef} className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="mx-auto flex max-w-full flex-col items-stretch gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="flex min-w-0 items-center" aria-label="中西花店 POS">
            <img
              src="/anglo-chinese-florist-logo.webp"
              alt="中西花店 Anglo Chinese Florist"
              className="h-9 w-auto max-w-[150px] object-contain sm:h-10 sm:max-w-[180px]"
            />
          </h1>
          <div className="flex w-full items-center justify-end gap-1 overflow-x-auto sm:w-auto sm:gap-2">
            {employee && (
              <div className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-xs">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-40 truncate" title={employee.salesLabel}>{employee.name}</span>
              </div>
            )}
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
            {employee && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="min-h-11 gap-1.5 text-xs touch-manipulation"
                aria-label={`登出 ${employee.name}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" /> 登出
              </Button>
            )}
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
            onOpenChange={setCustomerHistoryOpen}
            onUseAddress={(selection) => {
              const parsed = parseDeliveryAddress(selection.address);
              setDeliveryRegion(parsed.region);
              setDeliveryDistrict(parsed.district);
              setDeliveryArea(parsed.area);
              setDeliveryDetail(parsed.detail);
              const reusedCompanyName = selection.recipientCompanyName || "";
              setRecipientType(
                selection.recipientType
                  || (reusedCompanyName.trim() ? "company" : "personal"),
              );
              setRecipientCompanyName(reusedCompanyName);
              setRecipientName(selection.recipientName || "");
              setRecipientPhone(selection.recipientPhone || "");
              setRecipientPartnerId(selection.shippingPartnerId);
              setRecipientContact(null);
              setRecipientContactDraft("");
              setSaveRecipientNote(false);
              clearCheckoutErrors(
                "deliveryAddress",
                "recipientCompanyName",
                "recipientName",
                "recipientPhone",
              );
              toast.success("已套用過往送貨地址");
            }}
          />
        )}

        {/* Main form + desktop summary */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto flex max-w-[1320px] items-start gap-5 px-4 py-5 pb-28 xl:pb-6">
        <main className="min-w-0 max-w-4xl flex-1 space-y-4">
        <SalesIdSection
          salesId={salesId}
          employee={employee}
          onSalespersonChange={(label, employeeId) => {
            setSalesId(label);
            setOperatorEmployeeId(employeeId);
          }}
        />

        {pendingSubmission && !isSubmitting && (
          <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p>
              {posAuthRequired
                ? "系統已恢復一張屬於目前員工的未確認訂單，請保留原本資料重試。如確認 Odoo 沒有需要保留或重試的訂單，可核對後只移除這部瀏覽器的待確認資料。"
                : "系統已恢復這部瀏覽器的未確認訂單，請保留原本資料重試。如確認 Odoo 沒有需要保留或重試的訂單，可核對後只移除本機待確認資料。"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardPending}
              className="border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
            >
              核對 Odoo 後解除鎖定（保留資料）
            </Button>
          </div>
        )}

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
        <section
          ref={(node) => { workflowSectionRefs.current.customer = node; }}
          aria-label="下單人資料"
          className="scroll-mt-40 space-y-4"
        >
        <CustomerSection
          phone={phone}
          customerName={customerName}
          customerCode={customerCode}
          senderName={senderName}
          customerType={customerType}
          companyName={companyName}
          customerEmail={customerEmail}
          billingAddress={billingAddress}
          onPhoneChange={(v) => {
            setPhone(v);
            clearCheckoutErrors("phone");
            const normalizedPhone = normalizePhoneNumber(v);
            if (
              confirmedNewCustomerPhone
              && confirmedNewCustomerPhone !== normalizedPhone
            ) {
              setCustomerCode("");
            }
            setConfirmedNewCustomerPhone((current) => (
              current && current !== normalizedPhone ? null : current
            ));
            if (
              confirmedNewCustomerPhone
              && confirmedNewCustomerPhone !== normalizedPhone
            ) {
              setConfirmedNewCustomerName(null);
            }
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
            if (
              confirmedNewCustomerName
              && normalizeCustomerIdentityName(value)
                !== normalizeCustomerIdentityName(confirmedNewCustomerName)
            ) {
              setConfirmedNewCustomerName(null);
              setConfirmedNewCustomerPhone(null);
            }
            if (selectedCustomer && value !== selectedCustomer.name) {
              detachSelectedCustomerProfile();
            }
          }}
          onCustomerCodeChange={setCustomerCode}
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
          onCustomerSelect={applyCustomerSelection}
          onStartNewCustomerUnderAccount={startNewCustomerUnderAccount}
          onCustomerAndRecipientSelect={applyCustomerAndRecipient}
          phoneError={checkoutErrors.phone}
          customerNameError={checkoutErrors.customerName}
          senderNameError={checkoutErrors.senderName}
          companyNameError={checkoutErrors.companyName}
          customerEmailError={checkoutErrors.customerEmail}
          billingAddressError={checkoutErrors.billingAddress}
          selectedCustomer={selectedCustomer}
          confirmedNewCustomerName={confirmedNewCustomerName}
          confirmedNewCustomerPhone={confirmedNewCustomerPhone}
          onConfirmNewCustomer={(normalizedPhone, confirmedName) => {
            setSelectedCustomer(null);
            setConfirmedNewCustomerName(confirmedName);
            setConfirmedNewCustomerPhone(normalizedPhone);
            clearCheckoutErrors("customerName", "phone");
          }}
          onResolutionStateChange={setCustomerResolution}
          refreshKey={customerRefreshKey}
        />

        <BusinessDetailsSection
          customerGroup={customerGroup}
          department={department}
          onCustomerGroupChange={setCustomerGroup}
          onDepartmentChange={setDepartment}
        />
        </section>

        <section
          ref={(node) => { workflowSectionRefs.current.items = node; }}
          aria-label="商品資料"
          className="scroll-mt-40"
        >
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
        </section>

        <section
          ref={(node) => { workflowSectionRefs.current.delivery = node; }}
          aria-label="收貨及送貨資料"
          className="scroll-mt-40"
        >
        <DeliverySection
          fulfillmentType={fulfillmentType}
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
          recipientCompanyNameError={checkoutErrors.recipientCompanyName}
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
          deliveryBuilding={deliveryBuilding}
          deliveryFloor={deliveryFloor}
          deliveryUnit={deliveryUnit}
          recipientType={recipientType}
          recipientCompanyName={recipientCompanyName}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          senderType={customerType}
          senderCompanyName={companyName}
          senderName={senderName || customerName}
          senderPhone={phone}
          deliveryPerson={deliveryPerson}
          onDateChange={(value) => {
            setDeliveryDate(value);
            clearCheckoutErrors("deliveryDate", "deliveryTime");
          }}
          onFulfillmentTypeChange={(value) => {
            setFulfillmentType(value);
            clearCheckoutErrors(
              "deliveryAddress",
              "recipientName",
              "recipientCompanyName",
              "recipientPhone",
            );
            resetRecipientPersistence();
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
          onBuildingChange={setDeliveryBuilding}
          onFloorChange={setDeliveryFloor}
          onUnitChange={setDeliveryUnit}
          onRecipientTypeChange={(value) => {
            setRecipientType(value);
            if (value === "personal") setRecipientCompanyName("");
            clearCheckoutErrors("recipientCompanyName");
            resetRecipientPersistence();
          }}
          onRecipientCompanyNameChange={(value) => {
            setRecipientCompanyName(value);
            clearCheckoutErrors("recipientCompanyName");
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
          onRecipientSuggestionSelect={(suggestion) => {
            applyRecipientSelection(suggestion);
            toast.success("已套用過往收貨人資料");
          }}
          onRecipientAndCustomerSuggestionSelect={(suggestion) => {
            void applyRecipientAndLinkedCustomer(suggestion);
          }}
          onConfirmNewRecipient={() => {
            clearRecipientPersistenceBinding();
            toast.success("已確認新增收貨人");
          }}
          onDeliveryPersonChange={setDeliveryPerson}
          failedDeliveryAction={failedDeliveryAction}
          onFailedDeliveryActionChange={setFailedDeliveryAction}
        />
        <SplitDeliverySection
          items={items}
          splits={deliverySplits}
          onChange={setDeliverySplits}
          defaultDeliveryDate={deliveryDate}
          defaultDeliveryTime={deliveryTime}
          defaultDeliveryTimeMode={deliveryTimeMode}
          defaultDeliverySlotId={deliverySlotId}
          deliverySlots={deliverySlots}
          deliverySlotsLoading={deliverySlotsLoading}
          deliverySlotsError={deliverySlotsError}
          onRetryDeliverySlots={() => setDeliverySlotsRefreshKey((key) => key + 1)}
          senderType={customerType}
          senderCompanyName={companyName}
          senderName={senderName || customerName}
          senderPhone={phone}
        />
        </section>

        <section
          ref={(node) => { workflowSectionRefs.current.notes = node; }}
          aria-label="備註及心意卡"
          className="scroll-mt-40 space-y-4"
        >
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
            recipientPartnerId
              || recipientCompanyName.trim()
              || recipientName.trim()
              || recipientPhone.trim()
              || deliveryDetail.trim()
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
        </section>

        <section
          ref={(node) => { workflowSectionRefs.current.payment = node; }}
          aria-label="付款及確認"
          className="scroll-mt-40"
        >
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
        </section>

          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <p className="text-sm font-medium">請先選擇負責員工</p>
            <p className="mt-1 text-xs text-muted-foreground">選擇後先會顯示客戶及訂單資料。</p>
          </div>
        )}
      </main>
        {hasSalesperson && (
          <div className="sticky top-40 hidden w-[310px] shrink-0 xl:block 2xl:w-[360px]">
            <OrderSummaryPanel
              customerName={customerName}
              phone={phone}
              recipientName={recipientType === "company" && recipientCompanyName.trim()
                ? `${recipientCompanyName} · ${recipientName}`
                : recipientName}
              recipientPhone={recipientPhone}
              deliveryDate={deliveryDate}
              deliveryTime={deliveryTime}
              items={items}
              deliveryFee={deliveryFee}
              urgentFee={urgentFee}
              finalPrice={finalPrice}
              paymentStatus={paymentStatus}
              completedCount={completedRequiredSectionCount}
              requiredSectionCount={4}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onNavigate={scrollToWorkflowSection}
            />
          </div>
        )}
          </div>
        </div>
      </div>
      {/* Sticky submit */}
      {hasSalesperson && <div
        className="fixed bottom-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border transition-[left] xl:hidden"
        style={{ left: checkoutBarLeftOffset(Boolean(selectedCustomer), customerHistoryOpen) }}
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
            {isSubmitting ? "下單中" : "確認訂單"}
          </Button>
        </div>
      </div>}

      {/* Order history drawer */}
      <OrderHistory
        orders={visibleOrderRecords}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        searchQuery={orderSearchQuery}
        onSearchQueryChange={(value) => {
          setOrderSearchQuery(value);
          setOrderRecordsError(null);
          setOrderRecordsTruncated(false);
        }}
        loading={orderRecordsLoading}
        loaded={orderRecordsLoaded}
        searchPhase={orderSearchPhase}
        error={orderRecordsError}
        stale={orderRecordsLoaded && Boolean(orderRecordsError) && remoteOrders.length > 0}
        truncated={orderRecordsTruncated}
        onRetry={() => setOrderRecordsRefreshKey((key) => key + 1)}
        onOrderUpdated={() => setOrderRecordsRefreshKey((key) => key + 1)}
      />
    </div>
  );
};

export default Index;
