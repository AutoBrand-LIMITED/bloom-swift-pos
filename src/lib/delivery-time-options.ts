export interface DeliveryTimeOption {
  value: string;
  label: string;
}

const padTwoDigits = (value: number) => String(value).padStart(2, "0");

export const formatQuarterHourDeliveryTime = (hour: number, minute: number) => {
  const period = hour < 12 ? "上午" : "下午";
  const displayHour = hour % 12 || 12;
  return `${period} ${padTwoDigits(displayHour)}:${padTwoDigits(minute)}`;
};

export const DELIVERY_HOUR_OPTIONS: readonly DeliveryTimeOption[] = Array.from(
  { length: 24 },
  (_, hour) => ({
    value: padTwoDigits(hour),
    label: `${hour < 12 ? "上午" : "下午"} ${padTwoDigits(hour % 12 || 12)} 時`,
  }),
);

export const QUARTER_HOUR_MINUTE_OPTIONS: readonly DeliveryTimeOption[] = [0, 15, 30, 45].map(
  (minute) => ({
    value: padTwoDigits(minute),
    label: `${padTwoDigits(minute)} 分`,
  }),
);

export const QUARTER_HOUR_DELIVERY_TIME_OPTIONS: readonly DeliveryTimeOption[] = (
  DELIVERY_HOUR_OPTIONS.flatMap((hour) => (
    QUARTER_HOUR_MINUTE_OPTIONS.map((minute) => ({
      value: `${hour.value}:${minute.value}`,
      label: formatQuarterHourDeliveryTime(Number(hour.value), Number(minute.value)),
    }))
  ))
);

export const isQuarterHourDeliveryTime = (value: string) => (
  QUARTER_HOUR_DELIVERY_TIME_OPTIONS.some((option) => option.value === value)
);

export const parseQuarterHourDeliveryTime = (value: string) => {
  if (!isQuarterHourDeliveryTime(value)) return null;
  const [hour, minute] = value.split(":");
  return { hour, minute };
};
