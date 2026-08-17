import { useEffect, useState, type RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPhoneValue,
  explicitPhoneRegion,
  parsePhoneValue,
  PHONE_REGIONS,
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
  const [region, setRegion] = useState<PhoneRegion>(() => explicitPhoneRegion(value) || "HK");
  const parsed = parsePhoneValue(value, region);
  const hasExplicitRegion = Boolean(explicitPhoneRegion(value));

  useEffect(() => {
    const explicitRegion = explicitPhoneRegion(value);
    if (explicitRegion) setRegion(explicitRegion);
    else if (!value) setRegion("HK");
  }, [value]);

  const updatePhone = (rawValue: string) => {
    const pastedRegion = explicitPhoneRegion(rawValue);
    const rawDigits = rawValue.replace(/\D/g, "");
    if ((rawValue.trim().startsWith("+") || rawDigits.length > 8) && !pastedRegion) {
      onChange(rawValue.trim());
      return;
    }
    const nextRegion = pastedRegion || region;
    const localNumber = parsePhoneValue(rawValue, nextRegion).localNumber.slice(0, 8);
    if (pastedRegion) setRegion(pastedRegion);
    // Keep existing Hong Kong records as eight local digits.  Macau and explicitly
    // international values retain their country code so they are unambiguous.
    onChange(nextRegion === "HK" && !pastedRegion && !hasExplicitRegion
      ? localNumber
      : buildPhoneValue(localNumber, nextRegion));
  };

  return (
    <div className="flex min-w-0 gap-2">
      <Select value={region} onValueChange={(value) => {
        const nextRegion = value as PhoneRegion;
        setRegion(nextRegion);
        onChange(nextRegion === "HK" && !hasExplicitRegion
          ? parsed.localNumber
          : buildPhoneValue(parsed.localNumber, nextRegion));
      }}>
        <SelectTrigger aria-label="國家或地區區號" className={cn("shrink-0 px-2 font-mono", compact ? "w-[104px] text-xs" : "w-[118px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PHONE_REGIONS) as PhoneRegion[]).map((phoneRegion) => (
            <SelectItem key={phoneRegion} value={phoneRegion}>+{PHONE_REGIONS[phoneRegion].dialCode} {PHONE_REGIONS[phoneRegion].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        inputMode="tel"
        autoComplete="tel"
        placeholder="8 位電話號碼"
        value={parsed.localNumber}
        onChange={(event) => updatePhone(event.target.value)}
        onFocus={onFocus}
        className={cn("min-w-0 font-mono", compact ? "text-sm" : "text-base", inputClassName, invalid && "border-destructive ring-1 ring-destructive")}
        maxLength={20}
      />
    </div>
  );
}
