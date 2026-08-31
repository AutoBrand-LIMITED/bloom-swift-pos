import { Plus, Trash2 } from "lucide-react";

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
  onChange: (occasions: RecipientOccasion[]) => void;
  disabled?: boolean;
}

const OCCASION_TYPES = Object.entries(RECIPIENT_OCCASION_LABELS) as Array<[
  RecipientOccasionType,
  string,
]>;

const RecipientOccasionEditor = ({
  label = "收花人重要日子",
  occasions,
  onChange,
  disabled = false,
}: RecipientOccasionEditorProps) => {
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
          disabled={disabled}
          onClick={() => onChange([...occasions, { type: "birthday", date: "" }])}
          aria-label={`新增${label}`}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />新增
        </Button>
      </div>
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
              <Input
                type="date"
                required
                disabled={disabled}
                value={occasion.date}
                onChange={(event) => update(index, { date: event.target.value })}
                aria-label={`${rowLabel} 日期`}
                className="min-h-11 touch-manipulation"
              />
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
