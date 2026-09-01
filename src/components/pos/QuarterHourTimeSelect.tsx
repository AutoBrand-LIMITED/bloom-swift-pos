import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DELIVERY_HOUR_OPTIONS,
  isQuarterHourDeliveryTime,
  parseQuarterHourDeliveryTime,
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
  const legacyValue = value.trim() && !isQuarterHourDeliveryTime(value) ? value : null;
  const parsedValue = parseQuarterHourDeliveryTime(value);
  const [draftHour, setDraftHour] = useState(parsedValue?.hour || "");
  const [draftMinute, setDraftMinute] = useState(parsedValue?.minute || "00");

  useEffect(() => {
    const parsed = parseQuarterHourDeliveryTime(value);
    setDraftHour(parsed?.hour || "");
    setDraftMinute(parsed?.minute || "00");
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
          原有時間：{legacyValue}。選擇新時間後會改用 15 分鐘格式。
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">小時</span>
          <Select
            value={draftHour}
            onValueChange={(hour) => {
              setDraftHour(hour);
              onChange(`${hour}:${draftMinute}`);
            }}
          >
            <SelectTrigger
              id={`${id}-hour`}
              aria-label={`${label} 小時`}
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
          <span className="text-xs text-muted-foreground">分鐘（每 15 分鐘）</span>
          <Select
            value={draftMinute}
            onValueChange={(minute) => {
              setDraftMinute(minute);
              if (draftHour) onChange(`${draftHour}:${minute}`);
            }}
          >
            <SelectTrigger
              id={`${id}-minute`}
              aria-label={`${label} 分鐘`}
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
      </div>
    </fieldset>
  );
};

export default QuarterHourTimeSelect;
