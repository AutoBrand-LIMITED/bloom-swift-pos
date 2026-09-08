import { Input } from "@/components/ui/input";
import {
  isQuarterHourDeliveryRange,
  parseQuarterHourDeliveryRange,
  QUARTER_HOUR_DELIVERY_TIME_OPTIONS,
} from "@/lib/delivery-time-options";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface QuarterHourTimeSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
}

type Period = "am" | "pm";

interface TimeParts {
  period: Period;
  hour: string;
  minute: string;
}

const EMPTY_TIME_PARTS = (): TimeParts => ({ period: "am", hour: "", minute: "" });
const VALID_MINUTES = new Set([0, 15, 30, 45]);
const padTwoDigits = (value: number) => String(value).padStart(2, "0");

const from24HourTime = (hour: string, minute: string): TimeParts => {
  const hourNumber = Number(hour);
  return {
    period: hourNumber < 12 ? "am" : "pm",
    hour: padTwoDigits(hourNumber % 12 || 12),
    minute,
  };
};

const to24HourTime = ({ period, hour, minute }: TimeParts) => {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (hourNumber < 1 || hourNumber > 12 || !VALID_MINUTES.has(minuteNumber)) return null;
  const hour24 = (hourNumber % 12) + (period === "pm" ? 12 : 0);
  return `${padTwoDigits(hour24)}:${padTwoDigits(minuteNumber)}`;
};

const onlyTwoDigits = (value: string) => value.replace(/\D/g, "").slice(0, 2);

const normaliseInput = (value: string, kind: "hour" | "minute") => {
  if (!value) return value;
  const number = Number(value);
  if (kind === "hour" && number >= 1 && number <= 12) return padTwoDigits(number);
  if (kind === "minute" && VALID_MINUTES.has(number)) return padTwoDigits(number);
  return value;
};

interface TimeEndpointProps {
  id: string;
  label: string;
  accessibleLabel: string;
  value: TimeParts;
  onChange: (value: TimeParts) => void;
  invalid: boolean;
  describedBy?: string;
}

const TimeEndpoint = ({
  id,
  label,
  accessibleLabel,
  value,
  onChange,
  invalid,
  describedBy,
}: TimeEndpointProps) => {
  const updatePart = (part: keyof TimeParts, nextValue: string) => {
    onChange({ ...value, [part]: nextValue });
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-end gap-1.5 sm:flex-nowrap">
        <div
          className="grid min-w-[7.25rem] grid-cols-2 rounded-md border border-input bg-background p-1"
          role="group"
          aria-label={`${accessibleLabel} 上午下午`}
        >
          {(["am", "pm"] as const).map((period) => {
            const selected = value.period === period;
            const periodLabel = period === "am" ? "上午" : "下午";
            return (
              <button
                key={period}
                type="button"
                aria-label={`${accessibleLabel} ${periodLabel}`}
                aria-pressed={selected}
                className={cn(
                  "min-h-11 min-w-11 rounded px-2 text-sm font-medium touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "bg-primary text-primary-foreground" : "text-foreground active:bg-muted",
                )}
                onClick={() => updatePart("period", period)}
              >
                {periodLabel}
              </button>
            );
          })}
        </div>

        <label className="min-w-[4.75rem] flex-1 space-y-1">
          <span className="block text-[11px] text-muted-foreground">小時</span>
          <Input
            id={`${id}-hour`}
            aria-label={`${accessibleLabel} 小時`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            inputMode="numeric"
            autoComplete="off"
            placeholder="HH"
            value={value.hour}
            onChange={(event) => updatePart("hour", onlyTwoDigits(event.target.value))}
            onBlur={() => updatePart("hour", normaliseInput(value.hour, "hour"))}
            className="min-h-11 text-center font-mono text-base tabular-nums touch-manipulation"
          />
        </label>

        <span className="flex min-h-11 items-center pb-0.5 text-lg font-semibold text-muted-foreground" aria-hidden="true">
          :
        </span>

        <label className="min-w-[4.75rem] flex-1 space-y-1">
          <span className="block text-[11px] text-muted-foreground">分鐘</span>
          <Input
            id={`${id}-minute`}
            aria-label={`${accessibleLabel} 分鐘`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            inputMode="numeric"
            autoComplete="off"
            placeholder="00"
            value={value.minute}
            onChange={(event) => updatePart("minute", onlyTwoDigits(event.target.value))}
            onBlur={() => updatePart("minute", normaliseInput(value.minute, "minute"))}
            className="min-h-11 text-center font-mono text-base tabular-nums touch-manipulation"
          />
        </label>
      </div>
    </div>
  );
};

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
  const [startParts, setStartParts] = useState<TimeParts>(
    parsedValue ? from24HourTime(parsedValue.startHour, parsedValue.startMinute) : EMPTY_TIME_PARTS,
  );
  const [endParts, setEndParts] = useState<TimeParts>(
    parsedValue ? from24HourTime(parsedValue.endHour, parsedValue.endMinute) : EMPTY_TIME_PARTS,
  );
  const lastEmittedValue = useRef<string | null>(null);

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

  const emitParts = (nextStartParts: TimeParts, nextEndParts: TimeParts) => {
    const startTime = to24HourTime(nextStartParts);
    const endTime = to24HourTime(nextEndParts);
    const nextValue = startTime && endTime && endTime > startTime
      ? `${startTime}-${endTime}`
      : "";
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  };

  const updateStartParts = (nextStartParts: TimeParts) => {
    setStartParts(nextStartParts);
    const startTime = to24HourTime(nextStartParts);
    const currentEndTime = to24HourTime(endParts);
    let nextEndParts = endParts;

    if (startTime && (!currentEndTime || currentEndTime <= startTime)) {
      const nextEndTime = defaultEndTime(startTime);
      const [nextEndHour = "", nextEndMinute = ""] = nextEndTime.split(":");
      if (nextEndTime && nextEndTime > startTime) {
        nextEndParts = from24HourTime(nextEndHour, nextEndMinute);
        setEndParts(nextEndParts);
      }
    }

    emitParts(nextStartParts, nextEndParts);
  };

  const updateEndParts = (nextEndParts: TimeParts) => {
    setEndParts(nextEndParts);
    emitParts(startParts, nextEndParts);
  };

  useEffect(() => {
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = null;
      return;
    }
    const parsed = parseQuarterHourDeliveryRange(value);
    setStartParts(parsed ? from24HourTime(parsed.startHour, parsed.startMinute) : EMPTY_TIME_PARTS());
    setEndParts(parsed ? from24HourTime(parsed.endHour, parsed.endMinute) : EMPTY_TIME_PARTS());
  }, [value]);

  const startTime = to24HourTime(startParts);
  const endTime = to24HourTime(endParts);
  const startStarted = Boolean(startParts.hour || startParts.minute);
  const endStarted = Boolean(endParts.hour || endParts.minute);
  const invalidStart = startStarted && !startTime;
  const invalidEnd = endStarted && !endTime;
  const invalidOrder = Boolean(startTime && endTime && endTime <= startTime);
  const localError = invalidStart
    ? "From（由）：小時請輸入 1 至 12；分鐘只可輸入 00、15、30 或 45。"
    : invalidEnd
      ? "To（至）：小時請輸入 1 至 12；分鐘只可輸入 00、15、30 或 45。"
      : invalidOrder
        ? "結束時間必須遲過開始時間。"
        : null;
  const describedBy = [ariaDescribedBy, localError ? `${id}-local-error` : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <fieldset
      className={cn("space-y-2", className)}
      aria-invalid={ariaInvalid || Boolean(localError)}
      aria-describedby={describedBy}
    >
      <legend className="text-sm font-medium">{label}</legend>
      {legacyValue && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          原有時間：{legacyValue}。輸入新時間後會改用一段 15 分鐘間隔嘅時間。
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
        <TimeEndpoint
          id={`${id}-from`}
          label="From（由）"
          accessibleLabel={`${label} From（由）`}
          value={startParts}
          onChange={updateStartParts}
          invalid={ariaInvalid || invalidStart || invalidOrder}
          describedBy={describedBy}
        />
        <span className="hidden min-h-11 items-center text-lg text-muted-foreground md:flex" aria-hidden="true">→</span>
        <TimeEndpoint
          id={`${id}-to`}
          label="To（至）"
          accessibleLabel={`${label} To（至）`}
          value={endParts}
          onChange={updateEndParts}
          invalid={ariaInvalid || invalidEnd || invalidOrder}
          describedBy={describedBy}
        />
      </div>
      <p className="text-xs text-muted-foreground">分鐘請輸入 00、15、30 或 45。</p>
      {localError && (
        <p id={`${id}-local-error`} role="alert" className="text-xs font-medium text-destructive">
          {localError}
        </p>
      )}
    </fieldset>
  );
};

export default QuarterHourTimeSelect;
