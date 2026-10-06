import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  ListTodo,
  LogOut,
  Menu,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { firstName, initials } from "@/lib/sed/client";
import { useStudent } from "./student-context";

const NAV = [
  { href: "/", label: "Início", short: "Início", icon: Home },
  { href: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { href: "/presenca", label: "Presença", short: "Presença", icon: UserRound },
  { href: "/notas", label: "Notas", short: "Notas", icon: GraduationCap },
  { href: "/boletim", label: "Boletim", short: "Boletim", icon: BookOpen },
  { href: "/tarefas", label: "Tarefas", short: "Tarefas", icon: ListTodo },
  { href: "/apostilas", label: "Apostilas", short: "Apostilas", icon: BookOpen },
  { href: "/inteligencia-artificial", label: "Inteligência Artificial", short: "IA", icon: Sparkles },
];
const MOBILE_NAV = NAV.filter((item) => ["/", "/presenca", "/notas", "/boletim", "/tarefas"].includes(item.href));

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { session, dashboard, loading, refresh, logout } = useStudent();
  const active =
    pathname === "/"
      ? "/"
      : NAV.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.href || "/";
  const pending = dashboard?.pendencias ?? dashboard?.tarefas?.length ?? 0;

  return (
    <div className="app-shell">
      {open ? <button className="menu-overlay" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`side-rail ${open ? "is-open" : ""}`}>
        <div className="rail-brand">
          <img src="/logo.svg" alt="EduX" className="brand-mark" />
          <div>
            <strong>SED</strong>
            <span>Aluno</span>
          </div>
          <button className="mobile-close" type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={19} />
          </button>
        </div>
        <div className="rail-profile">
          <div className="avatar avatar-small">{initials(session?.nome)}</div>
          <div className="rail-profile-copy">
            <strong>{firstName(session?.nome)}</strong>
            <span>Área do aluno</span>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Navegação principal">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`rail-link ${active === item.href ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                {item.label}
                {item.href === "/tarefas" && pending > 0 ? <span className="nav-count">{pending}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="rail-footer">
          <button className="rail-link rail-action danger" type="button" onClick={logout}>
            <LogOut size={18} />
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="menu-toggle" type="button" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <Link to="/" className="mobile-brand">
            <img src="/logo.svg" alt="EduX" />
            EduX <em>Aluno</em>
          </Link>
          <div className="topbar-spacer" />
          <div className="topbar-user">
            <span>{session?.nome}</span>
            <button className="mobile-refresh" type="button" onClick={() => void refresh()} aria-label="Atualizar">
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
            <button className="topbar-logout" type="button" onClick={logout}>
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <nav className="bottom-nav" aria-label="Navegação mobile">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} to={item.href} className={`bottom-link ${active === item.href ? "active" : ""}`}>
                <span className="bottom-icon-wrap">
                  <Icon size={19} strokeWidth={active === item.href ? 2.5 : 1.8} />
                  {item.href === "/tarefas" && pending > 0 ? <span className="nav-count">{pending}</span> : null}
                </span>
                <span>{item.short}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
