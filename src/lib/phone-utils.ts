export type PhoneRegion = "HK" | "MO";

export const PHONE_REGIONS: Record<PhoneRegion, { dialCode: "852" | "853"; label: string }> = {
  HK: { dialCode: "852", label: "香港" },
  MO: { dialCode: "853", label: "澳門" },
};

export interface ParsedPhoneValue {
  region: PhoneRegion;
  localNumber: string;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function explicitPhoneRegion(value: string): PhoneRegion | null {
  const trimmed = value.trim();
  const digits = digitsOnly(trimmed);
  const explicitlyInternational = trimmed.startsWith("+") || digits.length > 8;
  if (!explicitlyInternational) return null;
  if (digits.startsWith("852")) return "HK";
  if (digits.startsWith("853")) return "MO";
  return null;
}

export function parsePhoneValue(value: string, fallbackRegion: PhoneRegion = "HK"): ParsedPhoneValue {
  const digits = digitsOnly(value);
  const explicitRegion = explicitPhoneRegion(value);
  return {
    region: explicitRegion || fallbackRegion,
    localNumber: explicitRegion ? digits.slice(3) : digits,
  };
}

export function buildPhoneValue(localNumber: string, region: PhoneRegion): string {
  const digits = digitsOnly(localNumber);
  return digits ? `+${PHONE_REGIONS[region].dialCode}${digits}` : "";
}

export function isValidSupportedPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = digitsOnly(trimmed);
  if (digits.length === 8) return !trimmed.startsWith("+");
  return digits.length === 11 && (digits.startsWith("852") || digits.startsWith("853"));
}

export function canonicalPhoneValue(value: string, fallbackRegion: PhoneRegion = "HK"): string {
  if (!isValidSupportedPhone(value)) return value.trim();
  const parsed = parsePhoneValue(value, fallbackRegion);
  return buildPhoneValue(parsed.localNumber, parsed.region);
}

export function phoneLocalDigits(value: string): string {
  return parsePhoneValue(value).localNumber;
}

export function phoneMatchesQuery(candidate: string, query: string): boolean {
  const queryDigits = phoneLocalDigits(query);
  return Boolean(queryDigits && phoneLocalDigits(candidate).includes(queryDigits));
}

export function phoneSearchRank(candidate: string, query: string): number {
  const queryDigits = phoneLocalDigits(query);
  const candidateDigits = phoneLocalDigits(candidate);
  const queryRegion = parsePhoneValue(query).region;
  const candidateRegion = parsePhoneValue(candidate).region;
  if (queryDigits.length === 8 && candidateDigits === queryDigits && candidateRegion === queryRegion) return 0;
  if (candidateDigits === queryDigits) return 1;
  if (candidateDigits.startsWith(queryDigits) && candidateRegion === queryRegion) return 2;
  return 3;
}
