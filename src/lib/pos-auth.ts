const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
const SESSION_KEY = "anglo-chinese-florist-pos-session";
export const POS_AUTH_EXPIRED_EVENT = "pos-auth-expired";

export const posAuthRequired = Boolean(BACKEND_URL)
  && import.meta.env.VITE_POS_AUTH_ENABLED !== "false";

export function getPosSession(): string {
  return window.sessionStorage.getItem(SESSION_KEY) || "";
}

export function clearPosSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function loginToPos(password: string): Promise<void> {
  if (!BACKEND_URL) throw new Error("Odoo backend is not configured");
  const response = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const body = await response.json().catch(() => null) as {
    accessToken?: string;
    detail?: string;
  } | null;
  if (!response.ok || !body?.accessToken) {
    throw new Error(body?.detail || `登入失敗：${response.status}`);
  }
  window.sessionStorage.setItem(SESSION_KEY, body.accessToken);
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

export async function validatePosSession(signal?: AbortSignal): Promise<boolean> {
  if (!posAuthRequired) return true;
  if (!getPosSession()) return false;
  const response = await authenticatedFetch(`${BACKEND_URL}/auth/session`, { signal });
  return response.ok;
}
