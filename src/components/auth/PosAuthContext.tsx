import { createContext, useContext } from "react";

import type { PosEmployeeIdentity } from "@/lib/pos-auth";

export interface PosAuthContextValue {
  employee: PosEmployeeIdentity | null;
  logout: () => void;
}

export const PosAuthContext = createContext<PosAuthContextValue>({
  employee: null,
  logout: () => undefined,
});

export function usePosAuth(): PosAuthContextValue {
  return useContext(PosAuthContext);
}
