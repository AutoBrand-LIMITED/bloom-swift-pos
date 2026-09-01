import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => window.sessionStorage.clear());

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  window.sessionStorage.clear();
});

describe("POS session authentication", () => {
  it("requires employee authentication whenever a backend is configured", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubEnv("VITE_POS_AUTH_ENABLED", "false");

    const { posAuthRequired } = await import("@/lib/pos-auth");

    expect(posAuthRequired).toBe(true);
  });

  it("allows backend-free local previews without employee authentication", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "");

    const { posAuthRequired } = await import("@/lib/pos-auth");

    expect(posAuthRequired).toBe(false);
  });

  it("stores a server-issued session without bundling the password", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      accessToken: "signed-session",
      expiresAt: "2026-07-20T18:00:00+00:00",
      employee: {
        id: 95,
        name: "Elma",
        login: "elma",
        salesLabel: "AC02 — Elma",
        role: "manager",
      },
    })));
    const { getPosSession, loginToPos } = await import("@/lib/pos-auth");

    const employee = await loginToPos("elma", "operator password");

    expect(getPosSession()).toBe("signed-session");
    expect(employee).toEqual({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
      role: "manager",
    });
    expect(fetch).toHaveBeenCalledWith("https://backend.test/auth/login", expect.objectContaining({
      body: JSON.stringify({ login: "elma", password: "operator password" }),
    }));
  });

  it("shows a safe localized message when the login service is unreachable", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { loginToPos } = await import("@/lib/pos-auth");

    await expect(loginToPos("elma", "operator password")).rejects.toThrow(
      "暫時未能連接登入服務，請稍後再試。",
    );
  });

  it("attaches the session to backend requests", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { authenticatedFetch } = await import("@/lib/pos-auth");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-session");

    await authenticatedFetch("https://backend.test/products", {
      headers: { "Content-Type": "application/json" },
    });

    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-session");
    expect(headers.get("X-Client-Trace-Id")).toMatch(/^POS-[A-F0-9]{12}$/);
  });

  it("clears an expired session after a 401 response", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "expired" }, 401)));
    const { authenticatedFetch, getPosSession } = await import("@/lib/pos-auth");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "expired-session");

    await authenticatedFetch("https://backend.test/products");

    expect(getPosSession()).toBe("");
  });

  it("restores the signed employee identity from the session endpoint", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      authenticated: true,
      employee: {
        id: 95,
        name: "Elma",
        login: "elma",
        salesLabel: "AC02 — Elma",
        role: "staff",
      },
    })));
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-session");
    const { validatePosSession } = await import("@/lib/pos-auth");

    await expect(validatePosSession()).resolves.toEqual({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
      role: "staff",
    });
  });
});
