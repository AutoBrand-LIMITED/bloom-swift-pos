import { ArrowRight, GitMerge, KeyRound, LoaderCircle, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  applyCustomerCodeChange,
  OdooConflictError,
  previewCustomerCodeChange,
  type CustomerCodeChangePreview,
  type CustomerCodeChangeResult,
} from "@/lib/odoo-api";

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
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<CustomerCodeChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef(newRequestKey());

  useEffect(() => {
    if (!active) return;
    setTargetCode("");
    setReason("");
    setPreview(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    onSavingChange?.(false);
    requestKeyRef.current = newRequestKey();
  }, [active, onSavingChange, sourceCode]);

  const targetIsValid = Boolean(
    targetCode.trim()
    && targetCode.trim().toLocaleLowerCase() !== sourceCode.trim().toLocaleLowerCase(),
  );

  const loadPreview = async () => {
    if (!targetIsValid) return;
    setLoading(true);
    setError(null);
    try {
      const nextPreview = await previewCustomerCodeChange(sourceCode, targetCode.trim());
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

          {!preview && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full gap-2 touch-manipulation"
              disabled={!targetIsValid || loading || saving}
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
                    {preview.operationType === "rename" ? "更改 Customer ID" : "合併 Customer ID"}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {preview.operationType === "rename"
                      ? `${preview.sourceContactCount} 位聯絡人會由 ${preview.sourceCode} 改為 ${preview.targetCode}。`
                      : `${preview.sourceContactCount} 位聯絡人會加入已有 ${preview.targetContactCount} 位聯絡人嘅 ${preview.targetCode}；完成後共有 ${preview.contactsAfterCount} 位。`}
                  </p>
                  {preview.targetWasAlias && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      你輸入嘅目標本身係舊 ID，系統已改用目前 ID：{preview.targetCode}。
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
                舊 ID「{preview.sourceCode}」會保留做 alias；之後搜尋舊 ID 會自動導向「{preview.targetCode}」。
                Odoo Contact ID、舊訂單內容、invoice、credit note 同 payment 都唔會被重寫。
              </div>
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
              確認{preview.operationType === "rename" ? "更名" : "合併"}
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
            更名會建立新 ID；如果新 ID 已經存在，就會將兩個帳戶合併。只有 Manager 可以確認。
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
