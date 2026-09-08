const wholeHkd = new Intl.NumberFormat("zh-HK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** POS display policy: show Hong Kong dollar amounts without decimal places. */
export function formatMoney(value: number): string {
  return wholeHkd.format(Number.isFinite(value) ? value : 0);
}

export function formatHkd(value: number): string {
  return `HK$${formatMoney(value)}`;
}

/** Fixed-dollar discounts and direct POS money entry use whole dollars. */
export function normalizeWholeMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
