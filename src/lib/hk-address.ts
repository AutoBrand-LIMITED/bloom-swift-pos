export const HK_DISTRICTS: Record<string, Record<string, string[]>> = {
  "香港島": {
    "中西區": ["中環", "上環", "西營盤", "堅尼地城", "山頂", "半山"],
    "灣仔區": ["灣仔", "銅鑼灣", "跑馬地", "大坑", "天后"],
    "東區": ["北角", "鰂魚涌", "太古", "西灣河", "筲箕灣", "柴灣"],
    "南區": ["香港仔", "鴨脷洲", "黃竹坑", "淺水灣", "赤柱"],
  },
  "九龍": {
    "油尖旺區": ["尖沙咀", "佐敦", "油麻地", "旺角", "太子", "大角咀"],
    "深水埗區": ["深水埗", "長沙灣", "荔枝角", "石硤尾", "又一村"],
    "九龍城區": ["紅磡", "土瓜灣", "九龍城", "何文田", "九龍塘"],
    "黃大仙區": ["黃大仙", "鑽石山", "慈雲山", "彩虹", "新蒲崗"],
    "觀塘區": ["觀塘", "牛頭角", "九龍灣", "藍田", "秀茂坪", "油塘"],
  },
  "新界": {
    "荃灣區": ["荃灣", "深井", "青龍頭", "馬灣"],
    "葵青區": ["葵芳", "葵涌", "青衣"],
    "屯門區": ["屯門市中心", "屯門碼頭", "蝴蝶邨", "三聖"],
    "元朗區": ["元朗", "天水圍", "錦田", "流浮山"],
    "北區": ["上水", "粉嶺", "沙頭角", "古洞"],
    "大埔區": ["大埔", "大埔墟", "太和", "大美督"],
    "沙田區": ["沙田", "火炭", "大圍", "馬鞍山", "石門"],
    "西貢區": ["將軍澳", "坑口", "寶琳", "西貢市中心", "清水灣"],
  },
  "離島": {
    "離島區": ["東涌", "大嶼山", "長洲", "南丫島", "愉景灣", "機場"],
  },
};

export interface DeliveryAddressSelection {
  address: string;
  recipientName?: string;
  recipientPhone?: string;
  shippingPartnerId?: number;
}

export interface ParsedDeliveryAddress {
  region: string;
  district: string;
  area: string;
  detail: string;
}

interface PrefixMatch {
  region: string;
  district: string;
  area: string;
  length: number;
}

const normalizedTokens = (value: string) => value.trim().split(/\s+/).filter(Boolean);

const prefixMatch = (tokens: string[]): PrefixMatch | null => {
  const region = tokens[0];
  if (!region || !HK_DISTRICTS[region]) return null;

  const district = tokens[1];
  if (!district || !HK_DISTRICTS[region][district]) {
    return { region, district: "", area: "", length: 1 };
  }

  const area = tokens[2];
  if (!area || !HK_DISTRICTS[region][district].includes(area)) {
    return { region, district, area: "", length: 2 };
  }

  return { region, district, area, length: 3 };
};

/**
 * Splits only a recognised leading hierarchy. Unknown/free-form addresses stay
 * intact, so selecting an old address can never discard user data.
 */
export const parseDeliveryAddress = (value: string): ParsedDeliveryAddress => {
  const normalized = normalizedTokens(value).join(" ");
  if (!normalized) return { region: "", district: "", area: "", detail: "" };

  let tokens = normalizedTokens(normalized);
  let match = prefixMatch(tokens);
  if (!match) return { region: "", district: "", area: "", detail: normalized };

  tokens = tokens.slice(match.length);

  // Older POS builds could prepend the current selectors to an already complete
  // stored address. Repeated recognised prefixes are collapsed from the start.
  while (tokens.length > 0) {
    const repeated = prefixMatch(tokens);
    if (!repeated) break;
    match = repeated;
    tokens = tokens.slice(repeated.length);
  }

  return {
    region: match.region,
    district: match.district,
    area: match.area,
    detail: tokens.join(" "),
  };
};
