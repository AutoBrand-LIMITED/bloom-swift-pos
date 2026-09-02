import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock3,
  LoaderCircle,
  MapPin,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  StickyNote,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import OrderEditDialog, { type OrderEditSection } from "@/components/pos/OrderEditDialog";
import PrintButtons from "@/components/pos/PrintButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getOdooOrderEditHistory,
  type OdooOrderEditHistory,
} from "@/lib/odoo-api";
import type { OrderRecordView } from "@/lib/order-records";
import { formatRecipientOccasions } from "@/lib/recipient-occasions";
import { orderItemTotal } from "@/lib/order-pricing";
import type { DeliverySplit, PaymentStatus } from "@/types/order";

interface OrderHistoryProps {
  orders: OrderRecordView[];
  open: boolean;
  onClose: () => void;
  selectedDate?: string;
  onSelectedDateChange?: (value: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  loading?: boolean;
  loaded?: boolean;
  searchPhase?: "idle" | "too_short" | "debouncing" | "searching" | "success" | "error";
  error?: string | null;
  stale?: boolean;
  truncated?: boolean;
  onRetry?: () => void;
  onOrderUpdated?: () => void;
  canRetryOperationalOrders?: boolean;
  onRetryOperationalOrder?: (operationalOrderId: string) => Promise<void>;
}

type PaymentFilter = "all" | PaymentStatus;

const statusBadge: Record<PaymentStatus, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  unpaid: { label: "未付款", variant: "destructive" },
  paid: { label: "已付款", variant: "default" },
  deposit: { label: "已付訂金", variant: "secondary" },
};

const syncAttentionBadge = (order: OrderRecordView): { label: string; className: string } | null => {
  if (order.syncState === "needs_review") {
    return { label: "需主管處理", className: "border-destructive/40 bg-destructive/10 text-destructive" };
  }
  if (order.operationalRetryEligible) {
    return { label: "同步延誤", className: "border-amber-300 bg-amber-50 text-amber-800" };
  }
  return null;
};

const formatMoney = (amount: number | undefined) => `HK$${(amount ?? 0).toLocaleString("zh-HK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatHistoryValue = (value: string | null) => value?.trim() || "（空白）";

const deliveryTimeLabel = (
  order: Pick<OrderRecordView, "deliveryTimeMode" | "deliveryTime">
    | Pick<DeliverySplit, "deliveryTimeMode" | "deliveryTime">,
) => (
  order.deliveryTimeMode === "specified"
    ? `指定時間：${order.deliveryTime || "未指定"}`
    : order.deliveryTime || "未指定時段"
);

const fulfillmentLabel = (fulfillmentType?: "delivery" | "pickup") => (
  fulfillmentType === "pickup" ? "自取" : "送貨"
);

const orderIdentity = (order: OrderRecordView) => order.odooOrderName || order.id;

const InfoGrid = ({ rows }: { rows: Array<[string, ReactNode]> }) => (
  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
    {rows.map(([label, value]) => (
      <div key={label} className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{value || "—"}</dd>
      </div>
    ))}
  </dl>
);

const DetailSection = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
    <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-wide text-foreground">{title}</h3>
      {actions}
    </div>
    {children}
  </section>
);

const editSections: Array<{
  section: OrderEditSection;
  label: string;
  icon: typeof UserRound;
}> = [
  { section: "customer", label: "修改客戶與送花人", icon: UserRound },
  { section: "delivery", label: "修改收貨點與商品分配", icon: Truck },
  { section: "notes", label: "修改備註及心意卡", icon: StickyNote },
  { section: "payment", label: "補記付款", icon: Banknote },
];

const OrderEditMenu = ({
  onEdit,
  availableSections,
}: {
  onEdit: (section: OrderEditSection) => void;
  availableSections: OrderEditSection[];
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-2 touch-manipulation"
        aria-label="編輯訂單資料"
      >
        <Pencil className="h-4 w-4" /> 編輯訂單資料／補記付款
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-60">
      {editSections
        .filter(({ section }) => availableSections.includes(section))
        .map(({ section, label, icon: Icon }) => (
          <DropdownMenuItem
            key={section}
            className="min-h-11 gap-2 touch-manipulation"
            onSelect={() => onEdit(section)}
          >
            <Icon className="h-4 w-4" /> {label}
          </DropdownMenuItem>
        ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const SectionEditMenu = ({
  title,
  section,
  onEdit,
}: {
  title: string;
  section: OrderEditSection;
  onEdit: (section: OrderEditSection) => void;
}) => {
  const config = editSections.find((entry) => entry.section === section);
  if (!config) return null;
  const Icon = config.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 shrink-0 touch-manipulation"
          aria-label={`${title}操作選單`}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="min-h-11 gap-2 touch-manipulation"
          onSelect={() => onEdit(section)}
        >
          <Icon className="h-4 w-4" /> {config.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const OrderEditHistoryPanel = ({
  eligible,
  history,
  status,
  error,
  onRetry,
}: {
  eligible: boolean;
  history: OdooOrderEditHistory | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  onRetry: () => void;
}) => (
  <DetailSection
    title="修改記錄"
    actions={status === "success" && history ? (
      <Badge variant="outline" aria-label={`${history.entries.length} 次修改`}>
        {history.entries.length} 次修改
      </Badge>
    ) : undefined}
  >
    {!eligible ? (
      <p className="text-sm text-muted-foreground">此訂單尚未有 Odoo 訂單記錄，因此暫時未能顯示修改記錄。</p>
    ) : status === "loading" ? (
      <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" /> 正在載入修改記錄…
      </p>
    ) : status === "error" ? (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error || "未能載入修改記錄。"}
        </span>
        <Button variant="outline" className="min-h-11 gap-2 touch-manipulation" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> 重試修改記錄
        </Button>
      </div>
    ) : status === "success" && history?.entries.length === 0 ? (
      <p className="text-sm text-muted-foreground">暫無修改記錄。</p>
    ) : status === "success" && history ? (
      <div className="space-y-4">
        {history.truncated && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            修改記錄較多；目前只顯示最新 100 筆。
          </p>
        )}
        <ol className="space-y-4">
          {history.entries.map((entry) => (
            <li key={String(entry.id)} className="relative border-l-2 border-border pl-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <UserRound className="h-4 w-4" />
                  {entry.operatorName || (entry.operatorEmployeeId ? `員工 #${entry.operatorEmployeeId}` : "未知操作員")}
                </p>
                <time className="text-xs text-muted-foreground" dateTime={entry.changedAt}>
                  {formatDateTime(entry.changedAt)}
                </time>
              </div>
              <ul className="mt-3 space-y-2">
                {entry.changes.map((change, index) => (
                  <li key={`${change.field}-${index}`} className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{change.label}</p>
                    <p className="mt-1 break-words text-muted-foreground">
                      <span>{formatHistoryValue(change.oldValue)}</span>
                      <span aria-hidden="true"> → </span>
                      <span className="text-foreground">{formatHistoryValue(change.newValue)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    ) : null}
  </DetailSection>
);

const DestinationCard = ({
  title,
  fulfillmentType,
  deliveryDate,
  deliveryTimeMode,
  deliveryTime,
  address,
  addressParts,
  recipientType,
  recipientCompanyName,
  recipientName,
  recipientPhone,
  recipientOccasions,
  deliveryPerson,
  failedDeliveryAction,
  deliveryNote,
  giftCardEnabled,
  giftCardMessage,
  allocations,
}: {
  title: string;
  fulfillmentType?: "delivery" | "pickup";
  deliveryDate: string;
  deliveryTimeMode?: "slot" | "specified";
  deliveryTime: string;
  address: string;
  addressParts: string[];
  recipientType?: "personal" | "company";
  recipientCompanyName?: string;
  recipientName: string;
  recipientPhone: string;
  recipientOccasions?: string;
  deliveryPerson?: string;
  failedDeliveryAction?: string;
  deliveryNote?: string;
  giftCardEnabled?: boolean;
  giftCardMessage?: string;
  allocations: Array<{ itemId: string; itemName: string; quantity: number }>;
}) => (
  <article className="rounded-lg border border-border/80 bg-muted/20 p-4" aria-label={title}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">{title}</h4>
      <Badge variant="outline">{fulfillmentLabel(fulfillmentType)}</Badge>
    </div>
    <InfoGrid rows={[
      ["日期", deliveryDate || "未指定日期"],
      ["時間", deliveryTimeLabel({ deliveryTimeMode, deliveryTime })],
      [fulfillmentType === "pickup" ? "自取地點" : "地址", address || "—"],
      ["地址補充", addressParts.filter(Boolean).join(" · ") || "—"],
      ["收件類型", recipientType === "company" ? "公司" : "個人"],
      ["收貨公司", recipientCompanyName || "—"],
      ["收貨人／聯絡人", recipientName || "—"],
      ["收貨電話", recipientPhone || "—"],
      ["收花人重要日子", recipientOccasions || "—"],
      ["送貨員", deliveryPerson || "—"],
      ["派送失敗安排", failedDeliveryAction || "—"],
      ["收貨點備註", deliveryNote || "—"],
      ["心意卡", giftCardEnabled ? "需要" : "不需要"],
      ["心意卡內容", giftCardEnabled ? giftCardMessage || "—" : "—"],
    ]} />
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">商品分配</p>
      {allocations.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {allocations.map((allocation) => (
            <li key={`${allocation.itemId}-${allocation.itemName}`} className="flex justify-between gap-4">
              <span className="break-words">{allocation.itemName}</span>
              <span className="shrink-0 font-mono">× {allocation.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">沒有分配商品</p>
      )}
    </div>
  </article>
);

const OrderDetail = ({
  order,
  history,
  historyStatus,
  historyError,
  onRetryHistory,
  onEdit,
  canRetryOperationalOrders,
  retryingOperationalOrderId,
  operationalRetryError,
  onRetryOperationalOrder,
}: {
  order: OrderRecordView;
  history: OdooOrderEditHistory | null;
  historyStatus: "idle" | "loading" | "success" | "error";
  historyError: string | null;
  onRetryHistory: () => void;
  onEdit: (section: OrderEditSection) => void;
  canRetryOperationalOrders: boolean;
  retryingOperationalOrderId: string | null;
  operationalRetryError: string | null;
  onRetryOperationalOrder: (order: OrderRecordView) => void;
}) => {
  const payment = statusBadge[order.paymentStatus];
  const syncAttention = syncAttentionBadge(order);
  const splitAllocatedByItem = new Map<string, number>();
  (order.deliverySplits || []).forEach((split) => {
    split.itemAllocations.forEach((allocation) => {
      splitAllocatedByItem.set(
        allocation.itemId,
        (splitAllocatedByItem.get(allocation.itemId) || 0) + allocation.quantity,
      );
    });
  });
  const primaryAllocations = order.items
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      quantity: Math.max(0, item.quantity - (splitAllocatedByItem.get(item.id) || 0)),
    }))
    .filter((allocation) => allocation.quantity > 0);
  const productsSubtotal = order.items.reduce((total, item) => total + orderItemTotal(item), 0);
  const operationalEditable = order.source === "odoo"
    && Boolean(order.odooOrderId && order.writeDate);
  const deliveryEditable = operationalEditable && Boolean(order.deliveryTimeMode);
  const outstandingAmount = order.balanceAmount
    ?? Math.max(0, order.finalPrice - order.depositAmount);
  const paymentEditable = order.source === "odoo"
    && Boolean(order.odooOrderId)
    && order.paymentStatus !== "paid"
    && outstandingAmount > 0;
  const availableEditSections: OrderEditSection[] = [
    ...(operationalEditable ? ["customer" as const, "notes" as const] : []),
    ...(deliveryEditable ? ["delivery" as const] : []),
    ...(paymentEditable ? ["payment" as const] : []),
  ];
  const canRetry = canRetryOperationalOrders
    && Boolean(order.operationalOrderId && order.operationalRetryEligible);
  const historyEligible = order.source === "odoo"
    && order.syncState === "synced"
    && Boolean(order.odooOrderId);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-10 sm:p-6 sm:pb-12">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-all font-mono text-xl font-bold sm:text-2xl">{orderIdentity(order)}</h2>
            <Badge variant={payment.variant}>{payment.label}</Badge>
            {historyStatus === "success" && history && (
              <Badge variant="outline">修改 {history.entries.length} 次</Badge>
            )}
            {syncAttention && (
              <Badge variant="outline" className={syncAttention.className}>{syncAttention.label}</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            本機訂單 ID：<span className="break-all font-mono">{order.id}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <p className="font-mono text-2xl font-bold">{formatMoney(order.finalPrice)}</p>
          {availableEditSections.length > 0 && (
            <OrderEditMenu
              onEdit={onEdit}
              availableSections={availableEditSections}
            />
          )}
        </div>
      </div>

      <DetailSection title="訂單身份與時間">
        <InfoGrid rows={[
          ["Odoo 訂單編號", order.odooOrderName || "未有 Odoo 編號"],
          ["Odoo 訂單 ID", order.odooOrderId ? `#${order.odooOrderId}` : "—"],
          ["落單時間", formatDateTime(order.createdAt)],
          ["最後更新", formatDateTime(order.writeDate)],
          ["發票", order.odooInvoiceName || (order.odooInvoiceId ? `#${order.odooInvoiceId}` : "—")],
          ["付款記錄", order.odooPaymentName || (order.odooPaymentId ? `#${order.odooPaymentId}` : "—")],
        ]} />
      </DetailSection>

      <OrderEditHistoryPanel
        eligible={historyEligible}
        history={history}
        status={historyStatus}
        error={historyError}
        onRetry={onRetryHistory}
      />

      <DetailSection
        title="客戶與送花人"
        actions={operationalEditable ? (
          <SectionEditMenu title="客戶與送花人" section="customer" onEdit={onEdit} />
        ) : undefined}
      >
        <InfoGrid rows={[
          ["客戶名稱", order.customerName || "—"],
          ["客戶編號", order.customerCode || "—"],
          ["客戶類型", order.customerType === "company" ? "公司" : order.customerType === "personal" ? "個人" : "—"],
          ["公司名稱", order.companyName || "—"],
          ["客戶電話", order.phone || "—"],
          ["客戶電郵", order.customerEmail || "—"],
          ["帳單地址", order.billingAddress || "—"],
          ["送花人", order.senderName || order.customerName || "—"],
        ]} />
      </DetailSection>

      <DetailSection
        title="收貨點與商品分配"
        actions={deliveryEditable ? (
          <SectionEditMenu title="收貨點與商品分配" section="delivery" onEdit={onEdit} />
        ) : undefined}
      >
        <div className="space-y-3">
          <DestinationCard
            title="主要收貨點 1"
            fulfillmentType={order.fulfillmentType}
            deliveryDate={order.deliveryDate}
            deliveryTimeMode={order.deliveryTimeMode}
            deliveryTime={order.deliveryTime}
            address={order.deliveryAddress}
            addressParts={[
              order.deliveryGoogleAddress || "",
              order.deliveryBuilding ? `大廈：${order.deliveryBuilding}` : "",
              order.deliveryFloor ? `樓層：${order.deliveryFloor}` : "",
              order.deliveryUnit ? `單位：${order.deliveryUnit}` : "",
            ]}
            recipientType={order.recipientType}
            recipientCompanyName={order.recipientCompanyName}
            recipientName={order.recipientName}
            recipientPhone={order.recipientPhone}
            recipientOccasions={formatRecipientOccasions(order)}
            deliveryPerson={order.deliveryPerson}
            deliveryNote={order.deliveryNote}
            giftCardEnabled={order.giftCardEnabled}
            giftCardMessage={order.giftCardMessage}
            allocations={primaryAllocations}
          />
          {(order.deliverySplits || []).map((split, index) => (
            <DestinationCard
              key={split.id}
              title={`額外收貨點 ${index + 2}`}
              fulfillmentType={split.fulfillmentType}
              deliveryDate={split.deliveryDate}
              deliveryTimeMode={split.deliveryTimeMode}
              deliveryTime={split.deliveryTime}
              address={split.deliveryAddress}
              addressParts={[
                split.deliveryRegion,
                split.deliveryDistrict,
                split.deliveryArea,
                split.deliveryDetail,
                split.deliveryGoogleAddress,
                split.deliveryBuilding ? `大廈：${split.deliveryBuilding}` : "",
                split.deliveryFloor ? `樓層：${split.deliveryFloor}` : "",
                split.deliveryUnit ? `單位：${split.deliveryUnit}` : "",
              ]}
              recipientType={split.recipientType}
              recipientCompanyName={split.recipientCompanyName}
              recipientName={split.recipientName}
              recipientPhone={split.recipientPhone}
              recipientOccasions={formatRecipientOccasions(split)}
              deliveryPerson={split.deliveryPerson}
              failedDeliveryAction={split.failedDeliveryAction}
              deliveryNote={split.deliveryNote}
              giftCardEnabled={split.giftCardEnabled}
              giftCardMessage={split.giftCardMessage}
              allocations={split.itemAllocations}
            />
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="產品與價錢"
        actions={<Badge variant="outline">唯讀</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">產品</th>
                <th className="pb-2 pr-3 font-medium">單價</th>
                <th className="pb-2 pr-3 font-medium">數量</th>
                <th className="pb-2 pr-3 font-medium">折扣</th>
                <th className="pb-2 text-right font-medium">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.productCode, item.categoryName].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {(item.packing || item.remarks) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          item.packing ? `包裝：${item.packing}` : "",
                          item.remarks ? `備註：${item.remarks}` : "",
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {item.priceOverrideReason && (
                      <p className="mt-1 text-xs text-amber-700">改價原因：{item.priceOverrideReason}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-mono">
                    {formatMoney(item.price)}
                    {item.catalogPrice !== undefined && item.catalogPrice !== item.price && (
                      <span className="block text-xs text-muted-foreground line-through">{formatMoney(item.catalogPrice)}</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-mono">{item.quantity}</td>
                  <td className="py-3 pr-3 font-mono">{item.discountPercent || 0}%</td>
                  <td className="py-3 text-right font-mono font-medium">{formatMoney(orderItemTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-4 max-w-sm space-y-2 border-t border-border pt-4 text-sm">
          {[
            ["產品小計", productsSubtotal],
            ["送貨費", order.deliveryFee],
            ["急單費", order.urgentFee],
            ["計算小計", order.subtotal],
            ["已付訂金", order.depositAmount],
            ["尚欠金額", order.balanceAmount],
          ].map(([label, amount]) => (
            <div key={String(label)} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono">{amount === undefined ? "—" : formatMoney(amount as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold">
            <dt>訂單總額</dt>
            <dd className="font-mono">{formatMoney(order.finalPrice)}</dd>
          </div>
          {order.priceOverridden && <p className="text-right text-xs text-amber-700">訂單總價曾經人手調整</p>}
        </dl>
      </DetailSection>

      <DetailSection
        title="付款與會計參考"
        actions={paymentEditable ? (
          <SectionEditMenu title="付款與會計參考" section="payment" onEdit={onEdit} />
        ) : undefined}
      >
        <InfoGrid rows={[
          ["付款狀態", payment.label],
          ["付款方式", order.paymentMethod || "—"],
          ["付款參考編號", order.paymentReference || "—"],
          ["收款時間", formatDateTime(order.paymentReceivedAt)],
          ["發票編號", order.odooInvoiceName || "—"],
          ["發票 ID", order.odooInvoiceId ? `#${order.odooInvoiceId}` : "—"],
          ["付款記錄編號", order.odooPaymentName || "—"],
          ["付款記錄 ID", order.odooPaymentId ? `#${order.odooPaymentId}` : "—"],
        ]} />
      </DetailSection>

      <DetailSection
        title="備註"
        actions={operationalEditable ? (
          <SectionEditMenu title="備註" section="notes" onEdit={onEdit} />
        ) : undefined}
      >
        <InfoGrid rows={[
          ["送花人備註", order.senderNote || "—"],
          ["送貨備註", order.deliveryNote || "—"],
          ["內部備註", order.internalNote || order.notes || "—"],
          ["舊版備註", order.notes || "—"],
        ]} />
      </DetailSection>

      <DetailSection title="業務詳情">
        <InfoGrid rows={[
          ["登入操作員編號", order.operatorEmployeeId ? `#${order.operatorEmployeeId}` : "—"],
          ["負責銷售員", order.salesId || (order.salespersonEmployeeId ? `員工 #${order.salespersonEmployeeId}` : "—")],
          ["Sales Team", order.department || (order.salesTeamId ? `Sales Team #${order.salesTeamId}` : "—")],
          ["客戶群組", order.customerGroup || (order.customerGroupId ? `Contact Tag #${order.customerGroupId}` : "—")],
          ["送花 DO 編號", order.senderDoNumber || "—"],
          ["收花 DO 編號", order.recipientDoNumber || "—"],
          ["來源參考", order.sourceReference || "—"],
          ["付款條款", order.terms || "—"],
        ]} />
      </DetailSection>

      <DetailSection title="操作">
        <div className="space-y-3">
          {canRetry && order.operationalOrderId && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2 touch-manipulation"
              disabled={retryingOperationalOrderId === order.operationalOrderId}
              onClick={() => onRetryOperationalOrder(order)}
              aria-label={`重試訂單 ${orderIdentity(order)} Odoo 同步`}
            >
              {retryingOperationalOrderId === order.operationalOrderId
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              重試 Odoo 同步
            </Button>
          )}
          {operationalRetryError && (
            <p role="alert" className="text-sm text-destructive">{operationalRetryError}</p>
          )}
          <div className="[&_button]:min-h-11 [&_button]:touch-manipulation">
            <PrintButtons order={order} size="default" />
          </div>
        </div>
      </DetailSection>

    </div>
  );
};

const OrderHistory = ({
  orders,
  open,
  onClose,
  selectedDate = "",
  onSelectedDateChange,
  searchQuery = "",
  onSearchQueryChange,
  loading = false,
  loaded = true,
  searchPhase = "idle",
  error,
  stale = false,
  truncated = false,
  onRetry,
  onOrderUpdated,
  canRetryOperationalOrders = false,
  onRetryOperationalOrder,
}: OrderHistoryProps) => {
  const [editingOrder, setEditingOrder] = useState<{
    order: OrderRecordView;
    section: OrderEditSection;
  } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [history, setHistory] = useState<OdooOrderEditHistory | null>(null);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [retryingOperationalOrderId, setRetryingOperationalOrderId] = useState<string | null>(null);
  const [operationalRetryError, setOperationalRetryError] = useState<string | null>(null);

  const filteredOrders = useMemo(() => orders.filter((order) => (
    paymentFilter === "all" || order.paymentStatus === paymentFilter
  )), [orders, paymentFilter]);
  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId)
    || filteredOrders[0]
    || null;
  const selectedHistoryOrderId = selectedOrder?.source === "odoo"
    && selectedOrder.syncState === "synced"
    ? selectedOrder.odooOrderId
    : undefined;

  useEffect(() => {
    if (!open || !selectedHistoryOrderId) {
      setHistory(null);
      setHistoryStatus("idle");
      setHistoryError(null);
      return;
    }
    const controller = new AbortController();
    setHistory(null);
    setHistoryStatus("loading");
    setHistoryError(null);
    getOdooOrderEditHistory(selectedHistoryOrderId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setHistory(response);
        setHistoryStatus("success");
      })
      .catch((historyLoadError) => {
        if (controller.signal.aborted) return;
        setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "未能載入修改記錄。");
        setHistoryStatus("error");
      });
    return () => controller.abort();
  }, [historyRefreshKey, open, selectedHistoryOrderId]);

  useEffect(() => {
    if (!open) {
      setMobileDetailOpen(false);
      setEditingOrder(null);
      setOperationalRetryError(null);
    }
  }, [open]);

  if (!open) return null;

  const normalizedSearch = searchQuery.trim();
  const searchNeedsMoreInput = normalizedSearch.length > 0 && normalizedSearch.length < 2;
  const searchActive = normalizedSearch.length >= 2;
  const searchSettled = searchActive && searchPhase === "success";
  const showOrderCount = !searchActive || searchSettled;
  const selectedDateLabel = selectedDate || "全部日期";
  const filtersActive = paymentFilter !== "all";
  const countLabel = filtersActive ? `${filteredOrders.length}/${orders.length}` : String(orders.length);

  const handleOperationalRetry = async (order: OrderRecordView) => {
    if (!order.operationalOrderId || !onRetryOperationalOrder) return;
    setRetryingOperationalOrderId(order.operationalOrderId);
    setOperationalRetryError(null);
    try {
      await onRetryOperationalOrder(order.operationalOrderId);
    } catch (retryError) {
      setOperationalRetryError(retryError instanceof Error ? retryError.message : "未能重試 Odoo 同步。");
    } finally {
      setRetryingOperationalOrderId(null);
    }
  };

  const listContent = searchActive && !searchSettled ? (
    searchPhase === "error" ? null : (
      <p aria-live="polite" className="p-8 text-center text-muted-foreground">
        {searchPhase === "debouncing"
          ? selectedDate
            ? `等待搜尋 ${selectedDateLabel} 的訂單...`
            : "等待跨日期搜尋訂單..."
          : selectedDate
            ? `正在搜尋 ${selectedDateLabel} 的訂單...`
            : "正在跨日期搜尋訂單..."}
      </p>
    )
  ) : orders.length === 0 && !loaded ? (
    loading ? null : <p className="p-8 text-center text-muted-foreground">未能確認 Odoo 訂單記錄，請重試</p>
  ) : orders.length === 0 ? (
    <p className="p-8 text-center text-muted-foreground">
      {searchNeedsMoreInput
        ? "請輸入至少 2 個字元開始搜尋"
        : searchActive
          ? selectedDate
            ? `未找到 ${selectedDateLabel} 符合資料的訂單`
            : "未找到符合資料的訂單"
          : selectedDate
            ? `${selectedDateLabel} 暫無訂單`
            : "暫無訂單"}
    </p>
  ) : filteredOrders.length === 0 ? (
    <p className="p-8 text-center text-muted-foreground">沒有符合付款狀態篩選的訂單</p>
  ) : (
    <div className="space-y-2 p-3">
      {filteredOrders.map((order) => {
        const payment = statusBadge[order.paymentStatus];
        const syncAttention = syncAttentionBadge(order);
        const selected = selectedOrder?.id === order.id;
        return (
          <div
            key={order.id}
            role="group"
            aria-label={`訂單 ${orderIdentity(order)} ${order.customerName || order.phone}`}
          >
            <button
              type="button"
              className={`min-h-11 w-full touch-manipulation rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? "border-primary bg-primary/5" : "border-border bg-card active:bg-muted/70"
              }`}
              onClick={() => {
                setSelectedOrderId(order.id);
                setMobileDetailOpen(true);
                setOperationalRetryError(null);
              }}
              aria-label={`查看訂單 ${orderIdentity(order)}`}
              aria-current={selected ? "true" : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-base font-bold">{order.odooOrderName || "未有 Odoo 編號"}</p>
                  <p className="mt-0.5 truncate text-sm font-medium">{order.customerName || order.phone || "未有客戶名稱"}</p>
                </div>
                <p className="shrink-0 font-mono text-sm font-bold">{formatMoney(order.finalPrice)}</p>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  落單：{formatDateTime(order.createdAt)}
                </p>
                <p className="flex items-start gap-1.5 font-medium text-foreground">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {fulfillmentLabel(order.fulfillmentType)}：{order.deliveryDate || "未指定日期"} · {deliveryTimeLabel(order)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant={payment.variant}>{payment.label}</Badge>
                {syncAttention && (
                  <Badge variant="outline" className={syncAttention.className}>{syncAttention.label}</Badge>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-5">
        <h1 className="flex min-w-0 items-center gap-2 font-semibold">
          <ClipboardList className="h-5 w-5 shrink-0" />
          <span className="truncate">訂單記錄{showOrderCount ? ` (${countLabel})` : ""}</span>
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 shrink-0 touch-manipulation"
          onClick={onClose}
          aria-label="關閉訂單記錄"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={`${mobileDetailOpen && selectedOrder ? "hidden" : "flex"} min-h-0 w-full flex-col border-border bg-muted/10 md:flex md:w-[22rem] md:shrink-0 md:border-r lg:w-[25rem]`} aria-label="訂單列表">
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜尋訂單"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange?.(event.target.value)}
                placeholder="搜尋訂單號碼、電話、電郵、客戶或地址"
                className="min-h-11 pl-9 pr-11 text-sm"
                maxLength={200}
                autoComplete="off"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="清除訂單搜尋"
                  className="absolute right-0 top-0 min-h-11 min-w-11 touch-manipulation"
                  onClick={() => onSearchQueryChange?.("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="order-history-date" className="text-xs font-medium text-foreground">落單日期（選填）</label>
                <div className="flex gap-1">
                  <Input
                    id="order-history-date"
                    type="date"
                    aria-label="落單日期（選填）"
                    value={selectedDate}
                    onChange={(event) => onSelectedDateChange?.(event.target.value)}
                    className="min-h-11 min-w-0 touch-manipulation px-2 text-sm"
                  />
                  {selectedDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="清除落單日期篩選"
                      className="min-h-11 min-w-11 shrink-0 touch-manipulation"
                      onClick={() => onSelectedDateChange?.("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="order-history-payment-filter" className="text-xs font-medium text-foreground">付款狀態</label>
                <select
                  id="order-history-payment-filter"
                  aria-label="付款狀態篩選"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                  className="min-h-11 w-full touch-manipulation rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">全部付款狀態</option>
                  <option value="unpaid">未付款</option>
                  <option value="deposit">已付訂金</option>
                  <option value="paid">已付款</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {searchNeedsMoreInput
                ? "請輸入至少 2 個字元"
                : searchActive
                  ? searchPhase === "debouncing"
                    ? selectedDate
                      ? `等待搜尋 ${selectedDateLabel} 的訂單...`
                      : "等待跨日期搜尋訂單..."
                    : searchPhase === "searching"
                      ? selectedDate
                        ? `正在搜尋 ${selectedDateLabel} 的訂單...`
                        : "正在跨日期搜尋訂單..."
                      : searchSettled
                        ? selectedDate
                          ? `${selectedDateLabel} 搜尋結果：${orders.length} 筆`
                          : `跨日期搜尋結果：${orders.length} 筆`
                        : searchPhase === "error"
                          ? "搜尋未完成，請重試"
                          : "準備搜尋..."
                  : selectedDate
                    ? `顯示 ${selectedDateLabel} 的落單記錄，按時間由新至舊排列。`
                    : "顯示最新訂單，按落單時間由新至舊排列；日期只在需要時篩選。"}
            </p>
          </div>

          {(loading || error || truncated) && (
            <div className="shrink-0 space-y-2 border-b border-border p-3">
              {loading && (
                <p aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {searchActive
                    ? selectedDate
                      ? `正在 Odoo 搜尋 ${selectedDateLabel} 的訂單`
                      : "正在 Odoo 跨日期搜尋訂單"
                    : selectedDate
                      ? `正在從 Odoo 載入 ${selectedDateLabel} 的落單記錄`
                      : "正在從 Odoo 載入最新訂單"}
                </p>
              )}
              {error && (
                <div role="alert" className="flex items-start justify-between gap-3 text-xs text-destructive">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {stale
                      ? "Odoo 更新失敗，暫時顯示上次成功載入嘅資料。"
                      : searchActive
                        ? "未能完成 Odoo 訂單搜尋。"
                        : "未能從 Odoo 載入完整訂單記錄。"}
                  </p>
                  {onRetry && (
                    <Button variant="outline" className="min-h-11 shrink-0 gap-1 touch-manipulation" onClick={onRetry}>
                      <RefreshCw className="h-3.5 w-3.5" /> 重試
                    </Button>
                  )}
                </div>
              )}
              {truncated && (
                <p className="text-xs text-amber-700">
                  {searchActive
                    ? "搜尋結果超過顯示上限，請輸入更完整資料收窄結果。"
                    : selectedDate
                      ? "當日訂單超過顯示上限，完整記錄請到 Odoo 查看。"
                      : "目前只顯示最新 100 張訂單；可用搜尋或日期篩選收窄結果。"}
                </p>
              )}
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1" data-testid="order-history-scroll-area">
            {listContent}
          </ScrollArea>
        </aside>

        <main
          className={`${mobileDetailOpen && selectedOrder ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col bg-background md:flex`}
          aria-label="訂單詳情"
        >
          {selectedOrder ? (
            <>
              <div className="shrink-0 border-b border-border bg-card px-3 py-2 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 gap-2 touch-manipulation"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label="返回訂單列表"
                >
                  <ArrowLeft className="h-4 w-4" /> 返回訂單列表
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto" data-testid="order-history-detail-pane">
                <OrderDetail
                  order={selectedOrder}
                  history={history}
                  historyStatus={historyStatus}
                  historyError={historyError}
                  onRetryHistory={() => setHistoryRefreshKey((key) => key + 1)}
                  onEdit={(section) => setEditingOrder({ order: selectedOrder, section })}
                  canRetryOperationalOrders={canRetryOperationalOrders}
                  retryingOperationalOrderId={retryingOperationalOrderId}
                  operationalRetryError={operationalRetryError}
                  onRetryOperationalOrder={handleOperationalRetry}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              <div>
                <MapPin className="mx-auto mb-3 h-8 w-8" />
                <p>請先從左邊選擇一張訂單。</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <OrderEditDialog
        order={editingOrder?.order || null}
        section={editingOrder?.section || "customer"}
        open={Boolean(editingOrder)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingOrder(null);
        }}
        onSaved={() => {
          setHistoryRefreshKey((key) => key + 1);
          onOrderUpdated?.();
        }}
      />
    </div>
  );
};

export default OrderHistory;
