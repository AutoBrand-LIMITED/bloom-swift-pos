const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
const SESSION_KEY = "anglo-chinese-florist-pos-session";
export const POS_AUTH_EXPIRED_EVENT = "pos-auth-expired";

export type PosEmployeeRole = "staff" | "manager";

export interface PosEmployeeIdentity {
  id: number;
  name: string;
  login: string;
  salesLabel: string;
  role: PosEmployeeRole;
}

interface PosSessionResponse {
  authenticated: boolean;
  employee: PosEmployeeIdentity;
}

// A configured POS backend means every order must carry a signed employee
// identity. Do not let a frontend-only build flag bypass that attribution.
export const posAuthRequired = Boolean(BACKEND_URL);

export function getPosSession(): string {
  return window.sessionStorage.getItem(SESSION_KEY) || "";
}

export function clearPosSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function loginToPos(
  login: string,
  password: string,
): Promise<PosEmployeeIdentity> {
  if (!BACKEND_URL) throw new Error("Odoo backend is not configured");
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
  } catch {
    throw new Error("暫時未能連接登入服務，請稍後再試。");
  }
  const body = await response.json().catch(() => null) as {
    accessToken?: string;
    employee?: PosEmployeeIdentity;
    detail?: string;
  } | null;
  if (!response.ok || !body?.accessToken || !body.employee) {
    throw new Error(body?.detail || `登入失敗：${response.status}`);
  }
  window.sessionStorage.setItem(SESSION_KEY, body.accessToken);
  return body.employee;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getPosSession();
  const requestInit = token
    ? (() => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        if (!headers.has("X-Client-Trace-Id")) {
          const randomPart = typeof globalThis.crypto?.randomUUID === "function"
            ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
            : Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
          headers.set("X-Client-Trace-Id", `POS-${randomPart.toUpperCase()}`);
        }
        return { ...init, headers };
      })()
    : init;
  const response = await fetch(input, requestInit);
  if (response.status === 401 && token) {
    clearPosSession();
    window.dispatchEvent(new Event(POS_AUTH_EXPIRED_EVENT));
  }
  return response;
}

export async function validatePosSession(
  signal?: AbortSignal,
): Promise<PosEmployeeIdentity | null> {
  if (!posAuthRequired) return null;
  if (!getPosSession()) return null;
  const response = await authenticatedFetch(`${BACKEND_URL}/auth/session`, { signal });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as PosSessionResponse | null;
  return body?.authenticated && body.employee ? body.employee : null;
}
