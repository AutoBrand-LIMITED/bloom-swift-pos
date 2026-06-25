import { DRIVERS as DEFAULT_DRIVERS } from "@/types/order";

export interface Driver {
  id: string;
  name: string;
  casual?: boolean; // hired/temporary peak-season driver
}

const DRIVERS_STORAGE_KEY = "florist-pos-drivers";

export function loadDrivers(): Driver[] {
  try {
    const raw = localStorage.getItem(DRIVERS_STORAGE_KEY);
    if (!raw) return DEFAULT_DRIVERS;
    const parsed = JSON.parse(raw) as Driver[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DRIVERS;
    return parsed;
  } catch {
    return DEFAULT_DRIVERS;
  }
}

export function saveDrivers(drivers: Driver[]): void {
  localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(drivers));
}

export function resetDrivers(): void {
  localStorage.removeItem(DRIVERS_STORAGE_KEY);
}
