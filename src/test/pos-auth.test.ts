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
  it("stores a server-issued session without bundling the password", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      accessToken: "signed-session",
      expiresAt: "2026-07-20T18:00:00+00:00",
    })));
    const { getPosSession, loginToPos } = await import("@/lib/pos-auth");

    await loginToPos("operator password");

    expect(getPosSession()).toBe("signed-session");
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
  });

  it("clears an expired session after a 401 response", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "expired" }, 401)));
    const { authenticatedFetch, getPosSession } = await import("@/lib/pos-auth");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "expired-session");

    await authenticatedFetch("https://backend.test/products");

    expect(getPosSession()).toBe("");
  });
});
