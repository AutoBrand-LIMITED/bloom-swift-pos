import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECIPIENT_OCCASION_LABELS } from "@/lib/recipient-occasions";
import type { RecipientOccasion, RecipientOccasionType } from "@/types/order";

interface RecipientOccasionEditorProps {
  label?: string;
  occasions: readonly RecipientOccasion[];
  deliveryDate: string;
  onChange: (occasions: RecipientOccasion[]) => void;
  disabled?: boolean;
}

const OCCASION_TYPES = Object.entries(RECIPIENT_OCCASION_LABELS) as Array<[
  RecipientOccasionType,
  string,
]>;

const monthDayLabel = (date: string) => {
  const match = /^(?:\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return "尚未設定";
  return `${Number(match[1])} 月 ${Number(match[2])} 日`;
};

const RecipientOccasionEditor = ({
  label = "收花人重要日子",
  occasions,
  deliveryDate,
  onChange,
  disabled = false,
}: RecipientOccasionEditorProps) => {
  const previousDeliveryDate = useRef(deliveryDate);

  useEffect(() => {
    const previousDate = previousDeliveryDate.current;
    if (!deliveryDate || deliveryDate === previousDate) return;
    previousDeliveryDate.current = deliveryDate;

    const shouldFollowDeliveryDate = (occasion: RecipientOccasion) => (
      occasion.autoDateFromDelivery === true
    );
    if (!occasions.some(shouldFollowDeliveryDate)) return;

    onChange(occasions.map((occasion) => (
      shouldFollowDeliveryDate(occasion)
        ? { ...occasion, date: deliveryDate }
        : { ...occasion }
    )));
  }, [deliveryDate, occasions, onChange]);

  const update = (index: number, changes: Partial<RecipientOccasion>) => {
    onChange(occasions.map((occasion, candidateIndex) => (
      candidateIndex === index ? { ...occasion, ...changes } : { ...occasion }
    )));
  };

  return (
    <fieldset className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">{label}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 touch-manipulation"
          disabled={disabled || !deliveryDate}
          onClick={() => onChange([...occasions, {
            type: "birthday",
            date: deliveryDate,
            autoDateFromDelivery: true,
          }])}
          aria-label={`新增${label}`}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />新增
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {deliveryDate
          ? "日期自動跟收貨點送貨日；無需輸入年份。"
          : "請先選擇這個收貨點的送貨日期。"}
      </p>
      {occasions.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">未有重要日子；需要時可新增多項。</p>
      ) : occasions.map((occasion, index) => {
        const rowLabel = `${label} ${index + 1}`;
        return (
          <div
            key={`${occasion.id ?? "new"}-${index}`}
            className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.8fr)_44px]"
          >
            <div className="space-y-1">
              <Label className="text-[11px]">類型</Label>
              <Select
                value={occasion.type}
                disabled={disabled}
                onValueChange={(type: RecipientOccasionType) => update(index, {
                  type,
                  ...(type === "other" ? {} : { label: undefined }),
                })}
              >
                <SelectTrigger className="min-h-11 touch-manipulation" aria-label={`${rowLabel} 類型`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCASION_TYPES.map(([type, typeLabel]) => (
                    <SelectItem key={type} value={type}>{typeLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">日期</Label>
              <div
                aria-label={`${rowLabel} 日期`}
                className="flex min-h-11 items-center rounded-md border border-input bg-muted/20 px-3 text-sm"
              >
                {monthDayLabel(occasion.date)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 self-end touch-manipulation text-destructive"
              disabled={disabled}
              onClick={() => onChange(occasions.filter((_, candidateIndex) => candidateIndex !== index).map((entry) => ({ ...entry })))}
              aria-label={`移除${rowLabel}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            {occasion.type === "other" && (
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-[11px]">自訂名稱 *</Label>
                <Input
                  required
                  maxLength={200}
                  disabled={disabled}
                  value={occasion.label || ""}
                  onChange={(event) => update(index, { label: event.target.value })}
                  aria-label={`${rowLabel} 自訂名稱`}
                  className="min-h-11 touch-manipulation"
                />
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
};

export default RecipientOccasionEditor;
