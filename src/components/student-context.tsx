import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  enterDemo,
  fetchDashboard,
  readSession,
  rememberAccount,
} from "@/lib/sed/client";
import { signIn } from "@/lib/sed/client";
import type { Dashboard, StudentSession } from "@/lib/sed/types";

type StudentContextValue = {
  session: StudentSession | null;
  dashboard: Dashboard | null;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  login: (usuario: string, senha: string, account?: { numero: string; digito: string; uf: string }) => Promise<void>;
  startDemo: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const StudentContext = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setSession(readSession());
    setHydrated(true);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = (async () => {
      const current = readSession();
      if (!current?.token2) {
        setDashboard(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchDashboard();
        setDashboard(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível atualizar os dados.");
      } finally {
        setLoading(false);
      }
    })();
    refreshInFlight.current = run;
    try {
      await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (session?.token2) void refresh();
    else {
      setDashboard(null);
      setLoading(false);
    }
  }, [hydrated, session?.token2, refresh]);

  const login = useCallback(
    async (
      usuario: string,
      senha: string,
      account?: { numero: string; digito: string; uf: string },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const next = await signIn(usuario, senha);
        if (account) rememberAccount({ ...account, senha, nome: next.nome });
        setSession(next);
        setDashboard(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Não foi possível entrar.";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const startDemo = useCallback(() => {
    const next = enterDemo();
    setSession(next);
    setError(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setDashboard(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ session, dashboard, loading, hydrated, error, login, startDemo, logout, refresh }),
    [session, dashboard, loading, hydrated, error, login, startDemo, logout, refresh],
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used within StudentProvider");
  return ctx;
}
