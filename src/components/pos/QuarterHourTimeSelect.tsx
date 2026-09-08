import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DELIVERY_HOUR_OPTIONS,
  isQuarterHourDeliveryRange,
  parseQuarterHourDeliveryRange,
  QUARTER_HOUR_MINUTE_OPTIONS,
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
  const [startHour, setStartHour] = useState(parsedValue?.startHour || "");
  const [startMinute, setStartMinute] = useState(parsedValue?.startMinute || "00");
  const [endHour, setEndHour] = useState(parsedValue?.endHour || "");
  const [endMinute, setEndMinute] = useState(parsedValue?.endMinute || "00");

  const emitRange = (
    nextStartHour: string,
    nextStartMinute: string,
    nextEndHour: string,
    nextEndMinute: string,
  ) => {
    if (nextStartHour && nextEndHour) {
      onChange(`${nextStartHour}:${nextStartMinute}-${nextEndHour}:${nextEndMinute}`);
    }
  };

  useEffect(() => {
    const parsed = parseQuarterHourDeliveryRange(value);
    setStartHour(parsed?.startHour || "");
    setStartMinute(parsed?.startMinute || "00");
    setEndHour(parsed?.endHour || "");
    setEndMinute(parsed?.endMinute || "00");
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">開始小時</span>
          <Select
            value={startHour}
            onValueChange={(hour) => {
              setStartHour(hour);
              let nextEndHour = endHour;
              if (!nextEndHour) {
                nextEndHour = String(Math.min(23, Number(hour) + 1)).padStart(2, "0");
                setEndHour(nextEndHour);
              }
              emitRange(hour, startMinute, nextEndHour, endMinute);
            }}
          >
            <SelectTrigger
              id={`${id}-start-hour`}
              aria-label={`${label} 開始小時`}
              aria-invalid={ariaInvalid}
              className="min-h-11"
            >
              <SelectValue placeholder="選擇小時" />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_HOUR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">開始分鐘</span>
          <Select
            value={startMinute}
            onValueChange={(minute) => {
              setStartMinute(minute);
              emitRange(startHour, minute, endHour, endMinute);
            }}
          >
            <SelectTrigger
              id={`${id}-start-minute`}
              aria-label={`${label} 開始分鐘`}
              aria-invalid={ariaInvalid}
              className="min-h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_HOUR_MINUTE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">結束小時</span>
          <Select
            value={endHour}
            onValueChange={(hour) => {
              setEndHour(hour);
              emitRange(startHour, startMinute, hour, endMinute);
            }}
          >
            <SelectTrigger
              id={`${id}-end-hour`}
              aria-label={`${label} 結束小時`}
              aria-invalid={ariaInvalid}
              className="min-h-11"
            >
              <SelectValue placeholder="選擇小時" />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_HOUR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">結束分鐘</span>
          <Select
            value={endMinute}
            onValueChange={(minute) => {
              setEndMinute(minute);
              emitRange(startHour, startMinute, endHour, minute);
            }}
          >
            <SelectTrigger
              id={`${id}-end-minute`}
              aria-label={`${label} 結束分鐘`}
              aria-invalid={ariaInvalid}
              className="min-h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_HOUR_MINUTE_OPTIONS.map((option) => (
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
