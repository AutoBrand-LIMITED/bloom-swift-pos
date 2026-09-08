import { formatHkd } from "@/lib/money";

export const formatDayEndMoney = (amount: number) => formatHkd(amount || 0);
