import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type PhoneRegion = CountryCode;

export interface PhoneRegionOption {
  region: PhoneRegion;
  dialCode: string;
  label: string;
}

export interface ParsedPhoneValue {
  region: PhoneRegion;
  localNumber: string;
}

const DEFAULT_PHONE_REGION: PhoneRegion = "HK";
export const COMMON_PHONE_REGIONS: readonly PhoneRegion[] = [
  "HK", "MO", "CN", "SG", "CA", "US", "GB", "AU", "NZ", "MY", "TW",
];
const displayNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["zh-HK", "zh-Hant", "en"], { type: "region" })
  : null;
const COMMON_PHONE_REGION_LABELS: Partial<Record<PhoneRegion, string>> = {
  HK: "香港",
  MO: "澳門",
  CN: "中國",
  SG: "新加坡",
  CA: "加拿大",
  US: "美國",
  GB: "英國",
  AU: "澳洲",
  NZ: "紐西蘭",
  MY: "馬來西亞",
  TW: "台灣",
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizedInternationalPrefix(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
}

function countryName(region: PhoneRegion): string {
  return COMMON_PHONE_REGION_LABELS[region] || displayNames?.of(region) || region;
}

function uniqueRegions(regions: PhoneRegion[]): PhoneRegion[] {
  return Array.from(new Set(regions));
}

export const PHONE_REGION_OPTIONS: readonly PhoneRegionOption[] = uniqueRegions([
  ...COMMON_PHONE_REGIONS,
  ...getCountries(),
]).map((region) => ({
  region,
  dialCode: getCountryCallingCode(region),
  label: countryName(region),
}));

export const COMMON_PHONE_REGION_OPTIONS: readonly PhoneRegionOption[] = PHONE_REGION_OPTIONS.filter(
  (option) => COMMON_PHONE_REGIONS.includes(option.region),
);

function parsedInternationalNumber(value: string) {
  const normalized = normalizedInternationalPrefix(value);
  const digits = digitsOnly(normalized);
  if (!digits) return undefined;

  if (normalized.startsWith("+")) {
    const formatter = new AsYouType();
    formatter.input(normalized);
    return formatter.getNumber();
  }

  // Preserve the two legacy formats accepted before the international
  // selector existed. Other countries must use +/00 or the country selector,
  // otherwise an ordinary local number can be mistaken for a calling code.
  if (digits.length === 11 && /^(852|853)/.test(digits)) {
    return parsePhoneNumberFromString(`+${digits}`);
  }
  return undefined;
}

export function explicitPhoneRegion(value: string): PhoneRegion | null {
  return parsedInternationalNumber(value)?.country || null;
}

export function parsePhoneValue(
  value: string,
  fallbackRegion: PhoneRegion = DEFAULT_PHONE_REGION,
): ParsedPhoneValue {
  const normalized = normalizedInternationalPrefix(value);
  const explicitNumber = parsedInternationalNumber(normalized);
  if (explicitNumber?.country) {
    return {
      region: explicitNumber.country,
      localNumber: explicitNumber.nationalNumber,
    };
  }

  return {
    region: fallbackRegion,
    localNumber: digitsOnly(normalized),
  };
}

export function buildPhoneValue(localNumber: string, region: PhoneRegion): string {
  const digits = digitsOnly(localNumber);
  if (!digits) return "";

  const formatter = new AsYouType(region);
  formatter.input(digits);
  return formatter.getNumber()?.number || `+${getCountryCallingCode(region)}${digits}`;
}

function parsedValidPhone(value: string, fallbackRegion: PhoneRegion = DEFAULT_PHONE_REGION) {
  const normalized = normalizedInternationalPrefix(value);
  if (!normalized) return undefined;

  const explicitlyInternational = normalized.startsWith("+");
  const digits = digitsOnly(normalized);
  if (!explicitlyInternational && digits.length === 11 && /^(852|853)/.test(digits)) {
    const legacyInternationalNumber = parsePhoneNumberFromString(`+${digits}`);
    return legacyInternationalNumber?.isPossible() ? legacyInternationalNumber : undefined;
  }
  if (!explicitlyInternational && (fallbackRegion === "HK" || fallbackRegion === "MO") && digits.length !== 8) {
    return undefined;
  }
  const localNumber = parsePhoneNumberFromString(
    normalized,
    explicitlyInternational ? undefined : fallbackRegion,
  );
  if (localNumber?.isPossible()) return localNumber;
  return undefined;
}

export function isValidSupportedPhone(value: string, fallbackRegion: PhoneRegion = DEFAULT_PHONE_REGION): boolean {
  return Boolean(parsedValidPhone(value, fallbackRegion));
}

export function canonicalPhoneValue(
  value: string,
  fallbackRegion: PhoneRegion = DEFAULT_PHONE_REGION,
): string {
  return parsedValidPhone(value, fallbackRegion)?.number || value.trim();
}

export function phoneLocalDigits(value: string): string {
  return parsePhoneValue(value).localNumber;
}

export function phoneSearchQueryKey(value: string): string {
  const normalized = normalizedInternationalPrefix(value);
  const digits = digitsOnly(normalized);
  return normalized.startsWith("+") && digits ? `+${digits}` : digits;
}

export function phoneSearchKeys(value: string): string[] {
  const rawDigits = digitsOnly(value);
  if (!rawDigits) return [];

  const parsed = parsedInternationalNumber(value)
    || parsedValidPhone(value)
    || parsePhoneNumberFromString(normalizedInternationalPrefix(value), DEFAULT_PHONE_REGION);
  return Array.from(new Set([
    rawDigits,
    parsed?.number ? digitsOnly(parsed.number) : "",
    parsed?.nationalNumber || "",
  ].filter(Boolean)));
}

function hasExplicitCountryCode(value: string): boolean {
  const normalized = normalizedInternationalPrefix(value);
  return normalized.startsWith("+") || Boolean(parsedInternationalNumber(value)?.country);
}

export function phoneMatchesQuery(candidate: string, query: string): boolean {
  const candidateKeys = phoneSearchKeys(candidate);
  const queryKeys = phoneSearchKeys(query);
  if (!candidateKeys.length || !queryKeys.length) return false;

  if (hasExplicitCountryCode(query)) {
    const fullQuery = queryKeys[0];
    return candidateKeys.some((candidateKey) => candidateKey.includes(fullQuery));
  }
  return queryKeys.some((queryKey) => (
    candidateKeys.some((candidateKey) => candidateKey.includes(queryKey))
  ));
}

export function phoneSearchRank(candidate: string, query: string): number {
  const candidateCanonical = canonicalPhoneValue(candidate);
  const queryCanonical = canonicalPhoneValue(query);
  if (candidateCanonical.startsWith("+") && candidateCanonical === queryCanonical) return 0;

  const candidateKeys = phoneSearchKeys(candidate);
  const queryKeys = phoneSearchKeys(query);
  if (hasExplicitCountryCode(query) && candidateKeys.some((key) => key === queryKeys[0])) return 1;
  if (queryKeys.some((queryKey) => candidateKeys.some((key) => key === queryKey))) return 2;
  if (phoneMatchesQuery(candidate, query)) return 3;
  return 4;
}

export function samePhoneNumber(left: string, right: string): boolean {
  const leftCanonical = canonicalPhoneValue(left);
  const rightCanonical = canonicalPhoneValue(right);
  return Boolean(
    leftCanonical.startsWith("+")
    && rightCanonical.startsWith("+")
    && leftCanonical === rightCanonical
  );
}
