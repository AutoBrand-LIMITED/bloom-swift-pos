import { ChevronDown, KeyRound, LoaderCircle, Mail, MapPin, Save, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CustomerCodeManagementContent } from "@/components/pos/CustomerCodeManagementDialog";
import RegionalPhoneInput from "@/components/pos/RegionalPhoneInput";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import type { CustomerCodeChangeResult } from "@/lib/odoo-api";

export interface CustomerContactEditorProps {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  partnerId: number;
  name: string;
  phone: string;
  alternatePhone: string;
  email: string;
  billingAddress: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAlternatePhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onBillingAddressChange: (value: string) => void;
  onSave: () => void;
}

interface CustomerContactEditDialogProps {
  editor: CustomerContactEditorProps;
  customerCodeManager?: {
    sourceCode: string;
    onCompleted: (result: CustomerCodeChangeResult) => void | Promise<void>;
  };
}

const CustomerContactEditDialog = ({
  editor,
  customerCodeManager,
}: CustomerContactEditDialogProps) => {
  const [alternatePhoneExpanded, setAlternatePhoneExpanded] = useState(Boolean(editor.alternatePhone.trim()));
  const [activeSection, setActiveSection] = useState<"contact" | "customer-id">("contact");
  const [customerCodeSaving, setCustomerCodeSaving] = useState(false);
  const alternatePhoneRef = useRef(editor.alternatePhone);
  alternatePhoneRef.current = editor.alternatePhone;

  useEffect(() => {
    if (editor.open) setAlternatePhoneExpanded(Boolean(alternatePhoneRef.current.trim()));
  }, [editor.open, editor.partnerId]);

  useEffect(() => {
    if (!editor.open) return;
    setActiveSection("contact");
    setCustomerCodeSaving(false);
  }, [editor.open, editor.partnerId]);

  return (
  <Dialog open={editor.open} onOpenChange={(open) => {
    if (!customerCodeSaving) editor.onOpenChange(open);
  }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-0">
      <DialogHeader className="border-b border-border px-5 py-5 pr-12 text-left">
        <DialogTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" aria-hidden="true" />
          {customerCodeManager ? "編輯客戶資料" : "編輯聯絡人"}
        </DialogTitle>
        <DialogDescription className="space-y-1">
          <span className="block font-mono text-xs">Odoo Contact #{editor.partnerId}</span>
          <span className="block">
            {customerCodeManager
              ? "可以喺同一個視窗更新聯絡人資料或管理 Customer ID。"
              : "儲存後會更新同一個 Odoo Contact；過往訂單及消費記錄仍會保留喺呢位客人名下。"}
          </span>
        </DialogDescription>
      </DialogHeader>

      {customerCodeManager && (
        <div
          role="tablist"
          aria-label="客戶資料設定類別"
          className="mx-5 mt-4 grid grid-cols-2 rounded-lg bg-muted p-1"
        >
          <Button
            type="button"
            role="tab"
            id="contact-settings-tab"
            aria-controls="contact-settings-panel"
            aria-selected={activeSection === "contact"}
            variant={activeSection === "contact" ? "secondary" : "ghost"}
            className="min-h-11 gap-2 touch-manipulation"
            disabled={editor.saving || customerCodeSaving}
            onClick={() => setActiveSection("contact")}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            聯絡人資料
          </Button>
          <Button
            type="button"
            role="tab"
            id="customer-id-settings-tab"
            aria-controls="customer-id-settings-panel"
            aria-selected={activeSection === "customer-id"}
            variant={activeSection === "customer-id" ? "secondary" : "ghost"}
            className="min-h-11 gap-2 touch-manipulation"
            disabled={editor.saving || customerCodeSaving}
            onClick={() => setActiveSection("customer-id")}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Customer ID
          </Button>
        </div>
      )}

      {activeSection === "contact" ? (
        <>
      <div
        id="contact-settings-panel"
        role={customerCodeManager ? "tabpanel" : undefined}
        aria-labelledby={customerCodeManager ? "contact-settings-tab" : undefined}
        className={`grid gap-4 px-5 py-1 sm:grid-cols-2 ${customerCodeManager ? "mt-4" : ""}`}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contact-editor-name">聯絡人名稱</Label>
          <Input
            id="contact-editor-name"
            value={editor.name}
            disabled={editor.saving}
            onChange={(event) => editor.onNameChange(event.target.value)}
            maxLength={100}
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contact-editor-phone">電話（選填）</Label>
          <RegionalPhoneInput
            id="contact-editor-phone"
            ariaLabel="編輯聯絡人電話"
            value={editor.phone}
            disabled={editor.saving}
            onChange={editor.onPhoneChange}
          />
        </div>

        <Collapsible
          open={alternatePhoneExpanded}
          onOpenChange={setAlternatePhoneExpanded}
          className="overflow-hidden rounded-lg border border-border bg-muted/15 sm:col-span-2"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              disabled={editor.saving}
              className="flex min-h-12 w-full touch-manipulation items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-sm font-medium">後備電話（選填）</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {editor.alternatePhone.trim() ? "已填寫" : "未填寫"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${alternatePhoneExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 border-t border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="contact-editor-alternate-phone">電話號碼</Label>
                {editor.alternatePhone.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9 gap-1.5 px-2 text-xs text-muted-foreground touch-manipulation"
                    disabled={editor.saving}
                    onClick={() => {
                      editor.onAlternatePhoneChange("");
                      setAlternatePhoneExpanded(false);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    移除後備電話
                  </Button>
                )}
              </div>
              <RegionalPhoneInput
                id="contact-editor-alternate-phone"
                ariaLabel="編輯聯絡人後備電話"
                value={editor.alternatePhone}
                disabled={editor.saving}
                onChange={editor.onAlternatePhoneChange}
              />
              <p className="text-[11px] text-muted-foreground">
                會同主要電話一齊保存喺同一個 Odoo Contact。
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contact-editor-email" className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            電郵（選填）
          </Label>
          <Input
            id="contact-editor-email"
            type="email"
            inputMode="email"
            value={editor.email}
            disabled={editor.saving}
            onChange={(event) => editor.onEmailChange(event.target.value)}
            maxLength={254}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contact-editor-billing-address" className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            帳單地址（選填）
          </Label>
          <Textarea
            id="contact-editor-billing-address"
            value={editor.billingAddress}
            disabled={editor.saving}
            onChange={(event) => editor.onBillingAddressChange(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {editor.error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-2">
            {editor.error}
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 border-t border-border px-5 py-4 sm:space-x-0">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 touch-manipulation"
          disabled={editor.saving}
          onClick={() => editor.onOpenChange(false)}
        >
          取消
        </Button>
        <Button
          type="button"
          className="min-h-11 gap-2 touch-manipulation"
          disabled={editor.saving}
          onClick={editor.onSave}
        >
          {editor.saving
            ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            : <Save className="h-4 w-4" aria-hidden="true" />}
          儲存到 Odoo
        </Button>
      </DialogFooter>
        </>
      ) : customerCodeManager ? (
        <div
          id="customer-id-settings-panel"
          role="tabpanel"
          aria-labelledby="customer-id-settings-tab"
          className="mt-4"
        >
          <p className="mx-5 mb-4 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            更名會建立新 ID；如果新 ID 已經存在，就會將兩個帳戶合併。更改前必須先預覽並填寫原因。
          </p>
          <CustomerCodeManagementContent
            active={editor.open && activeSection === "customer-id"}
            sourceCode={customerCodeManager.sourceCode}
            onCancel={() => editor.onOpenChange(false)}
            onCompleted={customerCodeManager.onCompleted}
            onSavingChange={setCustomerCodeSaving}
          />
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
  );
};

export default CustomerContactEditDialog;
