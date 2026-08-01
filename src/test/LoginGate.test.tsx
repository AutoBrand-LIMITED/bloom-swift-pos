import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";


const identity = {
  id: 95,
  name: "Elma",
  login: "elma",
  salesLabel: "AC02 — Elma",
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  window.sessionStorage.clear();
});

describe("LoginGate employee authentication", () => {
  it("requires both employee login and password, then exposes the signed identity", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(response({
      accessToken: "signed-session",
      expiresAt: "2026-08-01T12:00:00+00:00",
      employee: identity,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { default: LoginGate } = await import("@/components/auth/LoginGate");
    const { usePosAuth } = await import("@/components/auth/PosAuthContext");
    const Identity = () => {
      const { employee, logout } = usePosAuth();
      return (
        <div>
          <span>{employee?.salesLabel}</span>
          <button onClick={logout}>測試登出</button>
        </div>
      );
    };

    render(<LoginGate><Identity /></LoginGate>);
    fireEvent.change(await screen.findByLabelText("員工登入代號"), {
      target: { value: "elma" },
    });
    fireEvent.change(screen.getByLabelText("POS 密碼"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登入" }));

    expect(await screen.findByText("AC02 — Elma")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("anglo-chinese-florist-pos-session")).toBe("signed-session");
    fireEvent.click(screen.getByRole("button", { name: "測試登出" }));
    expect(await screen.findByLabelText("員工登入代號")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("anglo-chinese-florist-pos-session")).toBeNull();
  });

  it("restores the employee identity from an existing signed session", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-session");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      authenticated: true,
      employee: identity,
    })));
    const { default: LoginGate } = await import("@/components/auth/LoginGate");
    const { usePosAuth } = await import("@/components/auth/PosAuthContext");
    const Identity = () => <span>{usePosAuth().employee?.name}</span>;

    render(<LoginGate><Identity /></LoginGate>);

    await waitFor(() => expect(screen.getByText("Elma")).toBeInTheDocument());
  });
});
