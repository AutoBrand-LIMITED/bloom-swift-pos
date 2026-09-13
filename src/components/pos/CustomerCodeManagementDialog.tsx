import { ArrowRight, GitMerge, KeyRound, ListChecks, LoaderCircle, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  applyCustomerCodeChange,
  getCustomerCodeTransferOptions,
  OdooConflictError,
  previewCustomerCodeChange,
  type CustomerCodeChangePreview,
  type CustomerCodeChangeResult,
  type CustomerCodeTransferOptions,
} from "@/lib/odoo-api";
import { formatHkd } from "@/lib/money";

export interface CustomerCodeManagementContentProps {
  active: boolean;
  sourceCode: string;
  onCancel: () => void;
  onCompleted: (result: CustomerCodeChangeResult) => void | Promise<void>;
  onSavingChange?: (saving: boolean) => void;
}

interface CustomerCodeManagementDialogProps {
  open: boolean;
  sourceCode: string;
  onOpenChange: (open: boolean) => void;
  onCompleted: (result: CustomerCodeChangeResult) => void | Promise<void>;
}

const newRequestKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const CustomerCodeManagementContent = ({
  active,
  sourceCode,
  onCancel,
  onCompleted,
  onSavingChange,
}: CustomerCodeManagementContentProps) => {
  const [targetCode, setTargetCode] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [transferOptions, setTransferOptions] = useState<CustomerCodeTransferOptions | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CustomerCodeChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef(newRequestKey());

  useEffect(() => {
    if (!active) return;
    setTargetCode("");
    setScope("all");
    setTransferOptions(null);
    setSelectedContactIds([]);
    setSelectedOrderIds([]);
    setOptionsLoading(false);
    setReason("");
    setPreview(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    onSavingChange?.(false);
    requestKeyRef.current = newRequestKey();
  }, [active, onSavingChange, sourceCode]);

  useEffect(() => {
    if (!active || scope !== "selected") return undefined;
    const controller = new AbortController();
    setOptionsLoading(true);
    setError(null);
    getCustomerCodeTransferOptions(sourceCode, controller.signal)
      .then((options) => {
        setTransferOptions(options);
        setSelectedContactIds([]);
        setSelectedOrderIds([]);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setTransferOptions(null);
        setError(cause instanceof Error ? cause.message : "暫時未能載入可轉移資料。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false);
      });
    return () => controller.abort();
  }, [active, scope, sourceCode]);

  const targetIsValid = Boolean(
    targetCode.trim()
    && targetCode.trim().toLocaleLowerCase() !== sourceCode.trim().toLocaleLowerCase(),
  );
  const activeSourceContactIds = (transferOptions?.contacts ?? [])
    .filter((contact) => contact.active)
    .map((contact) => contact.id);
  const leavesActiveSourceContact = scope === "all"
    || activeSourceContactIds.some((id) => !selectedContactIds.includes(id));
  const selectionIsValid = scope === "all"
    || (
      (selectedContactIds.length > 0 || selectedOrderIds.length > 0)
      && leavesActiveSourceContact
    );

  const toggleSelection = (
    id: number,
    selected: boolean,
    setter: typeof setSelectedContactIds,
  ) => {
    setter((current) => (
      selected
        ? Array.from(new Set([...current, id])).sort((left, right) => left - right)
        : current.filter((value) => value !== id)
    ));
    setPreview(null);
    setError(null);
  };

  const loadPreview = async () => {
    if (!targetIsValid) return;
    setLoading(true);
    setError(null);
    try {
      const nextPreview = scope === "selected"
        ? await previewCustomerCodeChange(
            sourceCode,
            targetCode.trim(),
            { selectionMode: "selected", contactIds: selectedContactIds, orderIds: selectedOrderIds },
          )
        : await previewCustomerCodeChange(sourceCode, targetCode.trim());
      setPreview(nextPreview);
      setTargetCode(nextPreview.targetCode);
      requestKeyRef.current = newRequestKey();
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "暫時未能預覽 Customer ID 更改。");
    } finally {
      setLoading(false);
    }
  };

  const applyChange = async () => {
    if (!preview || !reason.trim()) return;
    setSaving(true);
    onSavingChange?.(true);
    setError(null);
    try {
      const result = await applyCustomerCodeChange({
        sourceCode: preview.sourceCode,
        targetCode: preview.targetCode,
        previewToken: preview.previewToken,
        requestKey: requestKeyRef.current,
        reason: reason.trim(),
        ...(preview.operationType === "transfer"
          ? {
              selectionMode: "selected" as const,
              contactIds: preview.selectedContactIds ?? selectedContactIds,
              orderIds: preview.selectedOrderIds ?? selectedOrderIds,
            }
          : {}),
      });
      await onCompleted(result);
      onCancel();
    } catch (cause) {
      if (cause instanceof OdooConflictError) {
        setPreview(null);
        requestKeyRef.current = newRequestKey();
      }
      setError(cause instanceof Error ? cause.message : "暫時未能完成 Customer ID 更改。");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  return (
    <>
      <div className="space-y-4 px-5 py-1">
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="customer-code-source">目前 Customer ID</Label>
              <Input
                id="customer-code-source"
                value={sourceCode}
                readOnly
                className="font-mono"
              />
            </div>
            <ArrowRight className="mb-3 hidden h-5 w-5 text-muted-foreground sm:block" aria-hidden="true" />
            <div className="space-y-1.5">
              <Label htmlFor="customer-code-target">新／目標 Customer ID</Label>
              <Input
                id="customer-code-target"
                value={targetCode}
                disabled={loading || saving}
                className="font-mono"
                maxLength={100}
                autoComplete="off"
                onChange={(event) => {
                  setTargetCode(event.target.value);
                  setPreview(null);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>處理範圍</Label>
            <RadioGroup
              value={scope}
              onValueChange={(value) => {
                setScope(value as "all" | "selected");
                setPreview(null);
                setError(null);
              }}
              className="grid gap-2 sm:grid-cols-2"
              aria-label="Customer ID 處理範圍"
            >
              <Label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3">
                <RadioGroupItem value="all" className="mt-0.5" />
                <span>
                  <strong className="block">整個帳戶</strong>
                  <span className="text-xs text-muted-foreground">更名，或者將全部聯絡人合併到另一個 ID。</span>
                </span>
              </Label>
              <Label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3">
                <RadioGroupItem value="selected" className="mt-0.5" />
                <span>
                  <strong className="block">只轉移指定資料</strong>
                  <span className="text-xs text-muted-foreground">逐項選擇聯絡人或 Sales History；舊 ID 繼續有效。</span>
                </span>
              </Label>
            </RadioGroup>
          </div>

          {scope === "selected" && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2 font-medium">
                <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                選擇要轉移嘅資料
              </div>
              {optionsLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> 正在載入…
                </p>
              ) : transferOptions ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">聯絡人</p>
                    {transferOptions.contacts.map((contact) => (
                      <Label
                        key={contact.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3"
                      >
                        <Checkbox
                          aria-label={`轉移聯絡人 ${contact.name}`}
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            toggleSelection(contact.id, checked === true, setSelectedContactIds);
                          }}
                        />
                        <span className="min-w-0 text-sm">
                          <strong className="block truncate">{contact.name}</strong>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[contact.phone, contact.email].filter(Boolean).join(" · ") || `Odoo Contact #${contact.id}`}
                            {!contact.active && " · 已封存"}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </div>
                  {!leavesActiveSourceContact && (
                    <p role="alert" className="text-xs text-amber-700">
                      原有 Customer ID 要保留至少一位有效聯絡人；如要全部搬走，請改用「整個帳戶」。
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales History</p>
                    {transferOptions.orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">呢個 ID 暫時冇可轉移訂單。</p>
                    ) : transferOptions.orders.map((order) => (
                      <Label
                        key={order.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3"
                      >
                        <Checkbox
                          aria-label={`轉移訂單 ${order.name}`}
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={(checked) => {
                            toggleSelection(order.id, checked === true, setSelectedOrderIds);
                          }}
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <strong>{order.name}</strong>
                            <span>{formatHkd(order.amountTotal)}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {(order.dateOrder || "").slice(0, 10) || "未有日期"} · {order.contactName}
                          </span>
                        </span>
                      </Label>
                    ))}
                    {transferOptions.ordersTruncated && (
                      <p className="text-xs text-amber-700">只顯示最近 200 張訂單；較舊紀錄暫時唔可喺呢度選擇。</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {!preview && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full gap-2 touch-manipulation"
              disabled={!targetIsValid || !selectionIsValid || loading || saving || optionsLoading}
              onClick={() => { void loadPreview(); }}
            >
              {loading
                ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <SearchCheck className="h-4 w-4" aria-hidden="true" />}
              預覽更改
            </Button>
          )}

          {preview && (
            <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <GitMerge className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    {preview.operationType === "rename"
                      ? "更改 Customer ID"
                      : preview.operationType === "merge"
                        ? "合併 Customer ID"
                        : "轉移指定資料"}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {preview.operationType === "rename"
                      ? `${preview.sourceContactCount} 位聯絡人會由 ${preview.sourceCode} 改為 ${preview.targetCode}。`
                      : preview.operationType === "merge"
                        ? `${preview.sourceContactCount} 位聯絡人會加入已有 ${preview.targetContactCount} 位聯絡人嘅 ${preview.targetCode}；完成後共有 ${preview.contactsAfterCount} 位。`
                        : `${preview.movedContactCount ?? 0} 位聯絡人同 ${preview.movedOrderCount ?? 0} 張訂單會轉移到 ${preview.targetCode}。`}
                  </p>
                  {preview.targetWasAlias && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      你輸入嘅目標本身係舊 ID，系統已改用目前 ID：{preview.targetCode}。
                    </p>
                  )}
                </div>
              </div>
              {preview.operationType === "transfer" ? (
                <div className="rounded-lg border border-border bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
                  舊 ID「{preview.sourceCode}」會繼續有效，亦唔會建立 alias。只會更改所選聯絡人嘅 Customer ID，
                  或所選訂單喺 POS 顯示邊個 Customer ID；invoice、credit note、payment 同訂單法定客戶都唔會被改寫。
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
                  舊 ID「{preview.sourceCode}」會保留做 alias；之後搜尋舊 ID 會自動導向「{preview.targetCode}」。
                  Odoo Contact ID、舊訂單內容、invoice、credit note 同 payment 都唔會被重寫。
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="customer-code-change-reason">更改原因</Label>
                <Textarea
                  id="customer-code-change-reason"
                  value={reason}
                  disabled={saving}
                  rows={3}
                  maxLength={1000}
                  placeholder="例如：客戶轉公司，確認改用新 Customer ID"
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
      </div>

      <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 touch-manipulation"
            disabled={saving}
            onClick={onCancel}
          >
            取消
          </Button>
          {preview && (
            <Button
              type="button"
              className="min-h-11 gap-2 touch-manipulation"
              disabled={!reason.trim() || saving}
              onClick={() => { void applyChange(); }}
            >
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              確認{preview.operationType === "rename"
                ? "更名"
                : preview.operationType === "merge" ? "合併" : "轉移"}
            </Button>
          )}
      </DialogFooter>
    </>
  );
};

const CustomerCodeManagementDialog = ({
  open,
  sourceCode,
  onOpenChange,
  onCompleted,
}: CustomerCodeManagementDialogProps) => {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!saving) onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
            管理 Customer ID
          </DialogTitle>
          <DialogDescription>
            可以更名、整個帳戶合併，或者只轉移指定聯絡人／Sales History。只有 Manager 可以確認。
          </DialogDescription>
        </DialogHeader>
        <CustomerCodeManagementContent
          active={open}
          sourceCode={sourceCode}
          onCancel={() => onOpenChange(false)}
          onCompleted={onCompleted}
          onSavingChange={setSaving}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CustomerCodeManagementDialog;
