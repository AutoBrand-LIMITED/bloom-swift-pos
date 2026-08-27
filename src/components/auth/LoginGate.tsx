import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  POS_AUTH_EXPIRED_EVENT,
  clearPosSession,
  loginToPos,
  posAuthRequired,
  type PosEmployeeIdentity,
  validatePosSession,
} from "@/lib/pos-auth";
import { clearOperationalOrders } from "@/lib/operational-orders";
import { PosAuthContext } from "@/components/auth/PosAuthContext";

interface LoginGateProps {
  children: ReactNode;
}

const LoginGate = ({ children }: LoginGateProps) => {
  const [checking, setChecking] = useState(posAuthRequired);
  const [authenticated, setAuthenticated] = useState(!posAuthRequired);
  const [employee, setEmployee] = useState<PosEmployeeIdentity | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!posAuthRequired) return;
    const controller = new AbortController();
    validatePosSession(controller.signal)
      .then((restoredEmployee) => {
        setEmployee(restoredEmployee);
        setAuthenticated(Boolean(restoredEmployee));
      })
      .catch(() => {
        setEmployee(null);
        setAuthenticated(false);
      })
      .finally(() => setChecking(false));
    const expire = () => {
      clearOperationalOrders();
      setAuthenticated(false);
      setEmployee(null);
      setLogin("");
      setPassword("");
      setError("登入已過期，請重新登入。");
    };
    window.addEventListener(POS_AUTH_EXPIRED_EVENT, expire);
    return () => {
      controller.abort();
      window.removeEventListener(POS_AUTH_EXPIRED_EVENT, expire);
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!login.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const authenticatedEmployee = await loginToPos(login.trim(), password);
      setEmployee(authenticatedEmployee);
      setPassword("");
      setAuthenticated(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登入失敗，請再試一次。");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" aria-label="檢查登入狀態" />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
        <form
          className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm"
          onSubmit={submit}
        >
          <img
            src="/anglo-chinese-florist-logo.webp"
            alt="中西花店"
            className="mx-auto mb-7 h-20 w-auto max-w-full object-contain"
          />
          <h1 className="text-center text-2xl font-semibold">中西花店 POS</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">員工登入</p>
          <label htmlFor="pos-login" className="mt-7 block text-sm font-medium">
            員工登入代號
          </label>
          <Input
            id="pos-login"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            className="mt-2 h-12"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            disabled={submitting}
          />
          <label htmlFor="pos-password" className="mt-5 block text-sm font-medium">
            POS 密碼
          </label>
          <Input
            id="pos-password"
            type="password"
            autoComplete="current-password"
            className="mt-2 h-12"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button
            type="submit"
            className="mt-6 h-12 w-full touch-manipulation"
            disabled={!login.trim() || !password || submitting}
          >
            {submitting ? <LoaderCircle className="animate-spin" /> : <LogIn />}
            {submitting ? "登入中" : "登入"}
          </Button>
        </form>
      </main>
    );
  }

  const logout = () => {
    clearPosSession();
    clearOperationalOrders();
    setEmployee(null);
    setAuthenticated(false);
    setLogin("");
    setPassword("");
    setError("");
  };

  return (
    <PosAuthContext.Provider value={{ employee, logout }}>
      {children}
    </PosAuthContext.Provider>
  );
};

export default LoginGate;
