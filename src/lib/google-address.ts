const PRIVATE_PREMISE_MARKER =
  /(?:\b(?:ground\s+floor|lower\s+ground|upper\s+ground|mezzanine|basement|podium|flat|room|rm|unit|suite|floor|fl|shop)\b|\b(?:lg|ug|mg|g|m|b\d+|\d+)\s*\/\s*f\b|\b(?:b\d+|\d+)\s*f\b|(?:地下|地庫|地舖|地鋪|閣樓|低層|中層|高層)|(?:[a-z0-9一二三四五六七八九十百-]+\s*(?:樓|層|室|房|舖|鋪|單位)))/iu;

const TRAILING_PRIVATE_FRAGMENT = /\s+(?:[a-z]\d{0,3}|\d{1,3})$/iu;
const PUBLIC_TERMINAL_IDENTIFIER =
  /\b(?:tower|block|phase|house)(?:\s+no\.?)?\s+(?:[a-z]\d{0,3}|\d{1,3})$/iu;

const ADDRESS_COMPARISON_SEPARATOR =
  /[\s,，、;；:：.．·・'’"“”()[\]{}（）\-‐‑‒–—―_/／\\]+/gu;
const CJK_CHARACTER =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const ADDRESS_WORD = /[\p{L}\p{N}]+/gu;
const INTRA_WORD_PUNCTUATION =
  /([\p{L}\p{N}])['’ʼ.．](?=[\p{L}\p{N}])/gu;

const normalizeAddressForComparison = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(ADDRESS_COMPARISON_SEPARATOR, "");

const addressWords = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(INTRA_WORD_PUNCTUATION, "$1")
    .match(ADDRESS_WORD) ?? [];

const containsWordSequence = (address: string[], name: string[]) =>
  name.length > 0 &&
  address.some((_, start) =>
    name.every((word, offset) => address[start + offset] === word),
  );

/**
 * Preserves the selected Google prediction name when Place Details returns
 * only a street address, while avoiding a duplicate name already in it.
 */
export const composeGooglePlaceAddress = (
  placeName: string,
  formattedAddress: string,
) => {
  const trimmedPlaceName = placeName.trim();
  const trimmedFormattedAddress = formattedAddress.trim();
  if (!trimmedPlaceName) return trimmedFormattedAddress;
  if (!trimmedFormattedAddress) return trimmedPlaceName;

  const normalizedPlaceName = normalizeAddressForComparison(trimmedPlaceName);
  const normalizedFormattedAddress = normalizeAddressForComparison(
    trimmedFormattedAddress,
  );
  const containsPlaceName = CJK_CHARACTER.test(trimmedPlaceName)
    ? normalizedPlaceName &&
      normalizedFormattedAddress.includes(normalizedPlaceName)
    : containsWordSequence(
        addressWords(trimmedFormattedAddress),
        addressWords(trimmedPlaceName),
      );
  if (containsPlaceName) {
    return trimmedFormattedAddress;
  }

  return `${trimmedPlaceName}, ${trimmedFormattedAddress}`;
};

/**
 * Keeps Google queries at street/building granularity. Floor, room and shop
 * details stay in the POS value and are not sent to Google services.
 */
export const publicGoogleAddressQuery = (value: string) => {
  const marker = PRIVATE_PREMISE_MARKER.exec(value);
  const publicPart = marker?.index === undefined ? value : value.slice(0, marker.index);
  if (PUBLIC_TERMINAL_IDENTIFIER.test(publicPart.trim())) return publicPart.trim();
  return publicPart.replace(TRAILING_PRIVATE_FRAGMENT, "").trim();
};
