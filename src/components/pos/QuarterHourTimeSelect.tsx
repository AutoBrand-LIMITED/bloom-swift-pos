import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isQuarterHourDeliveryRange,
  parseQuarterHourDeliveryRange,
  QUARTER_HOUR_DELIVERY_TIME_OPTIONS,
} from "@/lib/delivery-time-options";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface QuarterHourTimeSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
}

const QuarterHourTimeSelect = ({
  id,
  label,
  value,
  onChange,
  ariaInvalid = false,
  ariaDescribedBy,
  className,
}: QuarterHourTimeSelectProps) => {
  const legacyValue = value.trim() && !isQuarterHourDeliveryRange(value) ? value : null;
  const parsedValue = parseQuarterHourDeliveryRange(value);
  const [startTime, setStartTime] = useState(
    parsedValue ? `${parsedValue.startHour}:${parsedValue.startMinute}` : "",
  );
  const [endTime, setEndTime] = useState(
    parsedValue ? `${parsedValue.endHour}:${parsedValue.endMinute}` : "",
  );

  const emitRange = (nextStartTime: string, nextEndTime: string) => {
    if (nextStartTime && nextEndTime) {
      onChange(`${nextStartTime}-${nextEndTime}`);
    }
  };

  const defaultEndTime = (nextStartTime: string) => {
    const startIndex = QUARTER_HOUR_DELIVERY_TIME_OPTIONS.findIndex(
      (option) => option.value === nextStartTime,
    );
    if (startIndex < 0) return "";
    return QUARTER_HOUR_DELIVERY_TIME_OPTIONS[Math.min(
      startIndex + 4,
      QUARTER_HOUR_DELIVERY_TIME_OPTIONS.length - 1,
    )]?.value || "";
  };

  useEffect(() => {
    const parsed = parseQuarterHourDeliveryRange(value);
    setStartTime(parsed ? `${parsed.startHour}:${parsed.startMinute}` : "");
    setEndTime(parsed ? `${parsed.endHour}:${parsed.endMinute}` : "");
  }, [value]);

  return (
    <fieldset
      className={cn("space-y-1.5", className)}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
    >
      <legend className="text-sm font-medium">{label}</legend>
      {legacyValue && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          原有時間：{legacyValue}。選擇新時間後會改用一段 15 分鐘間隔嘅時間。
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">From（由）</span>
          <Select
            value={startTime}
            onValueChange={(nextStartTime) => {
              setStartTime(nextStartTime);
              let nextEndTime = endTime;
              if (!nextEndTime || nextEndTime <= nextStartTime) {
                nextEndTime = defaultEndTime(nextStartTime);
                setEndTime(nextEndTime);
              }
              emitRange(nextStartTime, nextEndTime);
            }}
          >
            <SelectTrigger
              id={`${id}-from`}
              aria-label={`${label} From（由）`}
              aria-invalid={ariaInvalid}
              className="min-h-11 w-full touch-manipulation"
            >
              <SelectValue placeholder="選擇開始時間" />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_HOUR_DELIVERY_TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="hidden min-h-11 items-center text-lg text-muted-foreground sm:flex" aria-hidden="true">→</span>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">To（至）</span>
          <Select
            value={endTime}
            onValueChange={(nextEndTime) => {
              setEndTime(nextEndTime);
              emitRange(startTime, nextEndTime);
            }}
          >
            <SelectTrigger
              id={`${id}-to`}
              aria-label={`${label} To（至）`}
              aria-invalid={ariaInvalid}
              className="min-h-11 w-full touch-manipulation"
            >
              <SelectValue placeholder="選擇結束時間" />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_HOUR_DELIVERY_TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {value && parseQuarterHourDeliveryRange(value) && !isQuarterHourDeliveryRange(value) && (
        <p role="alert" className="text-xs font-medium text-destructive">結束時間必須遲過開始時間。</p>
      )}
    </fieldset>
  );
};

export default QuarterHourTimeSelect;
