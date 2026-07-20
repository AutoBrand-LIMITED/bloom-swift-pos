import { AlertTriangle, Contact, MessageSquareText, RefreshCw, Save, Truck } from "lucide-react";
import CustomerFlags from "@/components/pos/CustomerFlags";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DemoCustomer } from "@/data/demo-customers";
import type { PartnerNoteRecord } from "@/lib/odoo-api";

export type NotesConflictTarget = "sender" | "recipient";

interface OrderNotesSectionProps {
  senderNote: string;
  deliveryNote: string;
  internalNote: string;
  onSenderNoteChange: (value: string) => void;
  onDeliveryNoteChange: (value: string) => void;
  onInternalNoteChange: (value: string) => void;
  senderCustomer: DemoCustomer | null;
  hasSenderIdentity: boolean;
  hasRecipientIdentity: boolean;
  recipientPartnerId?: number;
  recipientContact: PartnerNoteRecord | null;
  senderContactDraft: string;
  recipientContactDraft: string;
  onSenderContactDraftChange: (value: string) => void;
  onRecipientContactDraftChange: (value: string) => void;
  onSaveSenderContact: () => void;
  onSaveRecipientContact: () => void;
  saveSenderNote: boolean;
  saveRecipientNote: boolean;
  onSaveSenderNoteChange: (checked: boolean) => void;
  onSaveRecipientNoteChange: (checked: boolean) => void;
  onRefreshSender?: () => void;
  onRefreshRecipient?: () => void;
  refreshingSender?: boolean;
  refreshingRecipient?: boolean;
  savingSender?: boolean;
  savingRecipient?: boolean;
  conflict?: { target: NotesConflictTarget; message: string } | null;
}

const OrderNotesSection = ({
  senderNote,
  deliveryNote,
  internalNote,
  onSenderNoteChange,
  onDeliveryNoteChange,
  onInternalNoteChange,
  senderCustomer,
  hasSenderIdentity,
  hasRecipientIdentity,
  recipientPartnerId,
  recipientContact,
  senderContactDraft,
  recipientContactDraft,
  onSenderContactDraftChange,
  onRecipientContactDraftChange,
  onSaveSenderContact,
  onSaveRecipientContact,
  saveSenderNote,
  saveRecipientNote,
  onSaveSenderNoteChange,
  onSaveRecipientNoteChange,
  onRefreshSender,
  onRefreshRecipient,
  refreshingSender = false,
  refreshingRecipient = false,
  savingSender = false,
  savingRecipient = false,
  conflict,
}: OrderNotesSectionProps) => {
  const senderCanPersist = hasSenderIdentity && Boolean(senderNote.trim());
  const recipientCanPersist = hasRecipientIdentity && Boolean(deliveryNote.trim());
  const senderContactCanSave = Boolean(
    senderCustomer?.odooPartnerId &&
    senderCustomer.writeDate &&
    senderContactDraft !== (senderCustomer.commentText || "")
  );
  const recipientContactCanSave = Boolean(
    recipientPartnerId &&
    recipientContact?.writeDate &&
    recipientContactDraft !== recipientContact.commentText
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4" aria-labelledby="order-notes-title">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="order-notes-title"
          className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2"
        >
          <MessageSquareText className="h-4 w-4" />
          訂單備註
        </h2>
        <CustomerFlags tags={senderCustomer?.tags} />
      </div>

      {conflict && (
        <Alert variant="destructive" className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">聯絡人備註已在 Odoo 更新</AlertTitle>
          <AlertDescription className="text-xs">{conflict.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sender-note" className="text-xs font-medium">送花人備註</Label>
          <Textarea
            id="sender-note"
            placeholder="例如：喜歡紅白配、不要滿天星"
            value={senderNote}
            onChange={(event) => onSenderNoteChange(event.target.value)}
            className="min-h-24 text-sm"
            maxLength={1000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery-note" className="text-xs font-medium">送貨備註</Label>
          <Textarea
            id="delivery-note"
            placeholder="例如：到達前先致電、交管理處"
            value={deliveryNote}
            onChange={(event) => onDeliveryNoteChange(event.target.value)}
            className="min-h-24 text-sm"
            maxLength={1000}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor="internal-note" className="text-xs font-medium">內部備註</Label>
        <Textarea
          id="internal-note"
          placeholder="店內製作、拾貨或跟進備註"
          value={internalNote}
          onChange={(event) => onInternalNoteChange(event.target.value)}
          className="min-h-24 text-sm"
          maxLength={3000}
        />
      </div>

      <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
        <div className="space-y-2 md:border-r md:border-border md:pr-4">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <Label htmlFor="sender-contact-note" className="flex items-center gap-1.5 text-xs font-semibold">
              <Contact className="h-3.5 w-3.5 text-primary" />
              客戶長期備註
            </Label>
            <div className="flex items-center gap-1">
              {senderCustomer?.odooPartnerId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRefreshSender}
                  disabled={refreshingSender || savingSender}
                  aria-label="重新載入客戶長期備註"
                  title="重新載入"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingSender ? "animate-spin" : ""}`} />
                </Button>
              )}
              {senderCustomer?.odooPartnerId ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={onSaveSenderContact}
                  disabled={!senderContactCanSave || savingSender || refreshingSender}
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingSender ? "儲存中" : "儲存"}
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">訂單成功後儲存</span>
              )}
            </div>
          </div>
          <Textarea
            id="sender-contact-note"
            value={senderContactDraft}
            onChange={(event) => onSenderContactDraftChange(event.target.value)}
            placeholder={senderCustomer?.odooPartnerId ? "未有長期備註" : "輸入新客戶長期備註"}
            disabled={refreshingSender || savingSender}
            className="min-h-20 text-xs leading-relaxed"
            maxLength={5000}
          />
          <div className="flex min-h-11 items-center gap-2">
            <Checkbox
              id="save-sender-note"
              checked={saveSenderNote}
              onCheckedChange={(checked) => onSaveSenderNoteChange(checked === true)}
              disabled={!senderCanPersist}
            />
            <Label htmlFor="save-sender-note" className="text-xs leading-relaxed">
              將今次送花人備註加入客戶長期備註
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <Label htmlFor="recipient-contact-note" className="flex items-center gap-1.5 text-xs font-semibold">
              <Truck className="h-3.5 w-3.5 text-primary" />
              收花人長期備註
            </Label>
            <div className="flex items-center gap-1">
              {recipientPartnerId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRefreshRecipient}
                  disabled={refreshingRecipient || savingRecipient}
                  aria-label="重新載入收花人長期備註"
                  title="重新載入"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingRecipient ? "animate-spin" : ""}`} />
                </Button>
              )}
              {recipientPartnerId ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={onSaveRecipientContact}
                  disabled={!recipientContactCanSave || savingRecipient || refreshingRecipient}
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingRecipient ? "儲存中" : "儲存"}
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">訂單成功後儲存</span>
              )}
            </div>
          </div>
          <Textarea
            id="recipient-contact-note"
            value={recipientContactDraft}
            onChange={(event) => onRecipientContactDraftChange(event.target.value)}
            placeholder={!recipientPartnerId ? "輸入新收花人長期備註" : "未有長期備註"}
            disabled={refreshingRecipient || savingRecipient}
            className="min-h-20 text-xs leading-relaxed"
            maxLength={5000}
          />
          <div className="flex min-h-11 items-center gap-2">
            <Checkbox
              id="save-recipient-note"
              checked={saveRecipientNote}
              onCheckedChange={(checked) => onSaveRecipientNoteChange(checked === true)}
              disabled={!recipientCanPersist}
            />
            <Label htmlFor="save-recipient-note" className="text-xs leading-relaxed">
              將今次送貨備註加入收花人長期備註
            </Label>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrderNotesSection;
