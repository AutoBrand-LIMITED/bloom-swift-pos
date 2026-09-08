import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Search, UserRoundCheck, UsersRound } from "lucide-react";

import CustomerFlags from "@/components/pos/CustomerFlags";
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
import type { DemoCustomer } from "@/data/demo-customers";
import { searchOdooCustomerAccount, searchOdooCustomers } from "@/lib/odoo-api";

interface CustomerContactChooserDialogProps {
  open: boolean;
  customer: DemoCustomer;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: DemoCustomer) => void;
}

interface ContactLookupState {
  loading: boolean;
  error: string | null;
  contacts: DemoCustomer[];
  truncated: boolean;
}

const sameContact = (left: DemoCustomer, right: DemoCustomer) => (
  left.odooPartnerId !== undefined && right.odooPartnerId !== undefined
    ? left.odooPartnerId === right.odooPartnerId
    : left.id === right.id
);

const contactKey = (contact: DemoCustomer) => String(contact.odooPartnerId ?? contact.id);

const parseOdooDate = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const CustomerContactChooserDialog = ({
  open,
  customer,
  onOpenChange,
  onSelect,
}: CustomerContactChooserDialogProps) => {
  const [query, setQuery] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [lookup, setLookup] = useState<ContactLookupState>({
    loading: false,
    error: null,
    contacts: [],
    truncated: false,
  });

  const customerCode = customer.customerCode?.trim() || "";

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const fallbackQuery = customer.phone.trim() || customer.name.trim();
    setQuery("");
    setLookup({ loading: true, error: null, contacts: [], truncated: false });

    const request = customerCode
      ? searchOdooCustomerAccount(customerCode, controller.signal)
          .then((account) => ({ contacts: account.contacts, truncated: account.truncated }))
      : searchOdooCustomers(fallbackQuery, controller.signal)
          .then((contacts) => ({ contacts, truncated: false }));

    request
      .then(({ contacts, truncated }) => {
        if (controller.signal.aborted) return;
        const hasCurrentContact = contacts.some((contact) => sameContact(contact, customer));
        setLookup({
          loading: false,
          error: null,
          contacts: hasCurrentContact ? contacts : [customer, ...contacts],
          truncated,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLookup({
          loading: false,
          error: error instanceof Error ? error.message : "未能載入 Odoo 聯絡人。",
          contacts: [],
          truncated: false,
        });
      });

    return () => controller.abort();
  }, [customer, customerCode, open, retryKey]);

  const visibleContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return lookup.contacts;
    return lookup.contacts.filter((contact) => (
      contact.name.toLocaleLowerCase().includes(normalizedQuery)
      || contact.phone.toLocaleLowerCase().includes(normalizedQuery)
      || Boolean(contact.email?.toLocaleLowerCase().includes(normalizedQuery))
      || Boolean(contact.customerCode?.toLocaleLowerCase().includes(normalizedQuery))
    ));
  }, [lookup.contacts, query]);

  const alternativeCount = lookup.contacts.filter((contact) => !sameContact(contact, customer)).length;
  const latestContactKey = useMemo(() => {
    const datedContacts = lookup.contacts.flatMap((contact) => {
      const timestamp = parseOdooDate(contact.createDate);
      return timestamp === null ? [] : [{ contact, timestamp }];
    });
    if (datedContacts.length < 2 || datedContacts.length !== lookup.contacts.length) return null;

    const latest = datedContacts.reduce((currentLatest, candidate) => {
      if (candidate.timestamp !== currentLatest.timestamp) {
        return candidate.timestamp > currentLatest.timestamp ? candidate : currentLatest;
      }
      return contactKey(candidate.contact).localeCompare(
        contactKey(currentLatest.contact),
        undefined,
        { numeric: true },
      ) > 0
        ? candidate
        : currentLatest;
    });
    return contactKey(latest.contact);
  }, [lookup.contacts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" aria-hidden="true" />
            選擇其他聯絡人
          </DialogTitle>
          <DialogDescription>
            {customerCode
              ? `選擇 Customer ID ${customerCode} 下面另一位實際聯絡人。取消唔會更改目前客戶。`
              : "選擇另一位符合目前客戶資料嘅 Odoo 聯絡人。取消唔會更改目前客戶。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 px-5">
          {!lookup.loading && !lookup.error && lookup.contacts.length > 1 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="篩選聯絡人"
                placeholder="輸入姓名、電話或電郵篩選"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11 pl-9"
                autoComplete="off"
              />
            </div>
          )}

          <div className="max-h-[55dvh] min-h-36 overflow-y-auto overscroll-contain rounded-xl border border-border">
            {lookup.loading ? (
              <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在載入 Odoo 聯絡人…
              </div>
            ) : lookup.error ? (
              <div className="flex min-h-36 flex-col items-center justify-center gap-3 p-5 text-center">
                <p role="alert" className="text-sm text-destructive">{lookup.error}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2 touch-manipulation"
                  onClick={() => setRetryKey((key) => key + 1)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  重新載入
                </Button>
              </div>
            ) : visibleContacts.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center p-5 text-center text-sm text-muted-foreground">
                冇符合篩選條件嘅聯絡人。
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleContacts.map((contact) => {
                  const current = sameContact(contact, customer);
                  const latest = latestContactKey === contactKey(contact);
                  return (
                    <button
                      key={contact.odooPartnerId ?? contact.id}
                      type="button"
                      disabled={current}
                      aria-label={current ? `${contact.name} 目前聯絡人` : `選擇聯絡人 ${contact.name}`}
                      className="flex min-h-16 w-full touch-manipulation items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 disabled:cursor-default disabled:bg-muted/30 disabled:opacity-100"
                      onClick={() => {
                        onOpenChange(false);
                        onSelect(contact);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="break-words text-sm font-semibold">{contact.name}</span>
                          {latest && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                              最新
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block break-all font-mono text-xs text-muted-foreground">
                          {contact.phone || "沒有電話"}
                        </span>
                        {contact.email && (
                          <span className="mt-1 block break-all text-xs text-muted-foreground">{contact.email}</span>
                        )}
                        <CustomerFlags tags={contact.tags} className="mt-1.5" />
                        {contact.commentText?.trim() && (
                          <span className="mt-1 block line-clamp-2 break-words text-xs text-muted-foreground">
                            長期備註：{contact.commentText}
                          </span>
                        )}
                      </span>
                      <span className={current
                        ? "flex shrink-0 items-center gap-1 text-xs font-medium text-primary"
                        : "shrink-0 text-xs font-medium text-primary"}
                      >
                        {current && <UserRoundCheck className="h-4 w-4" aria-hidden="true" />}
                        {current ? "目前使用" : "選擇"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!lookup.loading && !lookup.error && alternativeCount === 0 && (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              呢個 Customer ID 暫時只有目前呢位聯絡人，冇其他聯絡人可以切換。
            </p>
          )}
          {lookup.truncated && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              此帳戶聯絡人較多，目前只顯示部分結果；可用上方欄位篩選已載入名單。
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 touch-manipulation"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerContactChooserDialog;
