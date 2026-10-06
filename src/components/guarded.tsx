import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { LoginPage } from "./login-page";
import { useStudent } from "./student-context";

export function Guarded({ children }: { children: ReactNode }) {
  const { session, hydrated } = useStudent();
  if (!hydrated) {
    return (
      <div className="login-page">
        <div className="login-surface">
          <div className="login-brand">
            <div className="login-mark-wrap">
              <img src="/logo.svg" alt="EduX" />
            </div>
            <span>
              EduX <em>Aluno</em>
            </span>
          </div>
          <p className="login-note">Carregando sua sessão...</p>
        </div>
      </div>
    );
  }
  if (!session?.token2) return <LoginPage />;
  return <AppShell>{children}</AppShell>;
}
