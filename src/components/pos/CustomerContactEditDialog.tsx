import { LoaderCircle, Mail, MapPin, Plus, Save, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";

import RegionalPhoneInput from "@/components/pos/RegionalPhoneInput";
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
}

const CustomerContactEditDialog = ({ editor }: CustomerContactEditDialogProps) => {
  const [alternatePhoneExpanded, setAlternatePhoneExpanded] = useState(false);

  useEffect(() => {
    if (editor.open) setAlternatePhoneExpanded(false);
  }, [editor.open, editor.partnerId]);

  return (
  <Dialog open={editor.open} onOpenChange={editor.onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-0">
      <DialogHeader className="border-b border-border px-5 py-5 pr-12 text-left">
        <DialogTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" aria-hidden="true" />
          編輯聯絡人
        </DialogTitle>
        <DialogDescription className="space-y-1">
          <span className="block font-mono text-xs">Odoo Contact #{editor.partnerId}</span>
          <span className="block">
            儲存後會更新同一個 Odoo Contact；過往訂單及消費記錄仍會保留喺呢位客人名下。
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 px-5 py-1 sm:grid-cols-2">
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

        {alternatePhoneExpanded ? (
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/15 p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="contact-editor-alternate-phone">後備電話（選填）</Label>
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
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-start gap-2 border-dashed touch-manipulation sm:col-span-2"
            disabled={editor.saving}
            onClick={() => setAlternatePhoneExpanded(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {editor.alternatePhone.trim() ? "顯示後備電話" : "加入後備電話"}
          </Button>
        )}

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
    </DialogContent>
  </Dialog>
  );
};

export default CustomerContactEditDialog;
