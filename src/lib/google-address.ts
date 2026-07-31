const PRIVATE_PREMISE_MARKER =
  /(?:\b(?:ground\s+floor|lower\s+ground|upper\s+ground|mezzanine|basement|podium|flat|room|rm|unit|suite|floor|fl|shop)\b|\b(?:lg|ug|mg|g|m|b\d+|\d+)\s*\/\s*f\b|\b(?:b\d+|\d+)\s*f\b|(?:地下|地庫|地舖|地鋪|閣樓|低層|中層|高層)|(?:[a-z0-9一二三四五六七八九十百-]+\s*(?:樓|層|室|房|舖|鋪|單位)))/iu;

const TRAILING_PRIVATE_FRAGMENT = /\s+(?:[a-z]\d{0,3}|\d{1,3})$/iu;
const PUBLIC_TERMINAL_IDENTIFIER =
  /\b(?:tower|block|phase|house)(?:\s+no\.?)?\s+(?:[a-z]\d{0,3}|\d{1,3})$/iu;

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
