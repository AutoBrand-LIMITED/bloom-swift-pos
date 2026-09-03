import { useEffect, useRef, useState, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import {
  buildPhoneValue,
  canonicalPhoneValue,
  COMMON_PHONE_REGION_OPTIONS,
  explicitPhoneRegion,
  parsePhoneValue,
  PHONE_REGION_OPTIONS,
  type PhoneRegion,
} from "@/lib/phone-utils";
import { cn } from "@/lib/utils";

interface RegionalPhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  invalid?: boolean;
  inputClassName?: string;
  compact?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel: string;
}

export default function RegionalPhoneInput({
  id, value, onChange, onFocus, invalid = false, inputClassName, compact = false, inputRef, ariaLabel,
}: RegionalPhoneInputProps) {
  const initialRegion = explicitPhoneRegion(value) || "HK";
  const [region, setRegion] = useState<PhoneRegion>(initialRegion);
  const [localNumber, setLocalNumber] = useState(() => parsePhoneValue(value, initialRegion).localNumber);
  const [keepCountryCode, setKeepCountryCode] = useState(() => Boolean(explicitPhoneRegion(value)));
  const [showAllRegions, setShowAllRegions] = useState(false);
  const lastEmittedValueRef = useRef<string | null>(null);
  const visibleRegionOptions = showAllRegions
    ? PHONE_REGION_OPTIONS
    : PHONE_REGION_OPTIONS.filter((option) => (
        COMMON_PHONE_REGION_OPTIONS.some(({ region: commonRegion }) => commonRegion === option.region)
        || option.region === region
      ));

  useEffect(() => {
    if (lastEmittedValueRef.current === value) {
      lastEmittedValueRef.current = null;
      return;
    }
    const explicitRegion = explicitPhoneRegion(value);
    const nextRegion = explicitRegion || "HK";
    setRegion(nextRegion);
    setKeepCountryCode(Boolean(explicitRegion));
    setLocalNumber(parsePhoneValue(value, nextRegion).localNumber);
  }, [value]);

  const emit = (nextValue: string) => {
    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const updateRegion = (nextRegion: PhoneRegion) => {
    setRegion(nextRegion);
    const shouldKeepCountryCode = nextRegion !== "HK";
    setKeepCountryCode(shouldKeepCountryCode);
    const internationalValue = buildPhoneValue(localNumber, nextRegion);
    emit(shouldKeepCountryCode ? internationalValue : localNumber.replace(/\D/g, ""));
  };

  const updatePhone = (rawValue: string) => {
    const pastedRegion = explicitPhoneRegion(rawValue);
    if (pastedRegion) {
      const parsed = parsePhoneValue(rawValue, pastedRegion);
      const canonical = canonicalPhoneValue(rawValue, pastedRegion);
      setRegion(pastedRegion);
      setLocalNumber(parsed.localNumber);
      setKeepCountryCode(true);
      emit(canonical);
      return;
    }

    const digits = rawValue.replace(/\D/g, "");
    setLocalNumber(digits);
    const internationalValue = buildPhoneValue(digits, region);
    emit(region === "HK" && !keepCountryCode ? digits : internationalValue);
  };

  return (
    <div className="flex min-w-0 gap-2">
      <select
        aria-label="國家或地區區號"
        value={region}
        onFocus={() => setShowAllRegions(true)}
        onBlur={() => setShowAllRegions(false)}
        onChange={(event) => updateRegion(event.target.value as PhoneRegion)}
        className={cn(
          "h-10 shrink-0 rounded-md border border-input bg-background px-2 font-mono text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          compact ? "w-[122px] text-xs" : "w-[138px] text-sm",
        )}
      >
        {visibleRegionOptions.map((option) => (
          <option key={option.region} value={option.region}>
            +{option.dialCode} {option.label}
          </option>
        ))}
      </select>
      <Input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="輸入電話號碼"
        value={localNumber}
        onChange={(event) => updatePhone(event.target.value)}
        onFocus={onFocus}
        className={cn("min-w-0 font-mono", compact ? "text-sm" : "text-base", inputClassName, invalid && "border-destructive ring-1 ring-destructive")}
        maxLength={30}
      />
    </div>
  );
}
