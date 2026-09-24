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
    <fieldset className="space-y-2">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-xs font-medium">收花人重要日子</p>
          <span className="text-[11px] text-muted-foreground">
            {occasions.length > 0
              ? `${occasions.length} 項`
              : deliveryDate
                ? "未有紀錄"
                : "先選擇送貨日期"}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 text-xs touch-manipulation"
          disabled={disabled || !deliveryDate}
          onClick={() => onChange([...occasions, {
            type: "birthday",
            date: deliveryDate,
            autoDateFromDelivery: true,
          }])}
          aria-label={`新增${label}`}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />新增
        </Button>
      </div>
      {occasions.length > 0 && (
        <p className="text-[10px] text-muted-foreground">日期沿用收貨點送貨日，無需輸入年份。</p>
      )}
      {occasions.map((occasion, index) => {
        const rowLabel = `${label} ${index + 1}`;
        return (
          <div
            key={`${occasion.id ?? "new"}-${index}`}
            className="grid items-end gap-2 border-t border-border/70 pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(130px,0.55fr)_36px]"
          >
            <div>
              <Label className="sr-only">類型</Label>
              <Select
                value={occasion.type}
                disabled={disabled}
                onValueChange={(type: RecipientOccasionType) => update(index, {
                  type,
                  ...(type === "other" ? {} : { label: undefined }),
                })}
              >
                <SelectTrigger className="h-9 touch-manipulation text-sm" aria-label={`${rowLabel} 類型`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCASION_TYPES.map(([type, typeLabel]) => (
                    <SelectItem key={type} value={type}>{typeLabel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="sr-only">日期</Label>
              <div
                aria-label={`${rowLabel} 日期`}
                className="flex h-9 items-center rounded-md border border-input bg-muted/20 px-3 text-sm"
              >
                {monthDayLabel(occasion.date)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 touch-manipulation text-destructive"
              disabled={disabled}
              onClick={() => onChange(occasions.filter((_, candidateIndex) => candidateIndex !== index).map((entry) => ({ ...entry })))}
              aria-label={`移除${rowLabel}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            {occasion.type === "other" && (
              <div className="sm:col-span-3">
                <Label className="sr-only">自訂名稱 *</Label>
                <Input
                  required
                  maxLength={200}
                  disabled={disabled}
                  value={occasion.label || ""}
                  onChange={(event) => update(index, { label: event.target.value })}
                  aria-label={`${rowLabel} 自訂名稱`}
                  className="h-9 touch-manipulation text-sm"
                  placeholder="輸入重要日子名稱"
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
