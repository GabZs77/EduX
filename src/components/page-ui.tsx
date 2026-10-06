import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

export function PageHeading({
  eyebrow,
  title,
  description,
  onRefresh,
  spinning,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onRefresh?: () => void;
  spinning?: boolean;
}) {
  return (
    <header className="page-heading">
      <div className="heading-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {onRefresh ? (
        <button className="heading-refresh" type="button" onClick={onRefresh} aria-label="Atualizar">
          <RefreshCw size={19} className={spinning ? "spin" : ""} />
        </button>
      ) : null}
    </header>
  );
}

export function StateCard({
  title,
  message,
  error,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  error?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`state-card ${error ? "state-error" : ""}`}>
      <span className="state-mark">{error ? "!" : "i"}</span>
      <strong>{title}</strong>
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button className="state-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "violet" | "green" | "cyan" | "amber";
}) {
  const toneClass = tone === "green" ? "tone-green" : tone === "cyan" ? "tone-cyan" : tone === "amber" ? "tone-amber" : "";
  return (
    <article className={`stat-card ${toneClass}`}>
      <div className="stat-icon">{icon}</div>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

export function simpleMarkdown(text: string) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul className="markdown-list" key={`l-${blocks.length}`}>
        {list.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 className="markdown-heading" key={i} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(4)) }} />,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 className="markdown-heading" key={i} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(3)) }} />,
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2 className="markdown-heading" key={i} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(2)) }} />,
      );
    } else if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote className="markdown-quote" key={i} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed.slice(2)) }} />,
      );
    } else {
      blocks.push(
        <p className="markdown-paragraph" key={i} dangerouslySetInnerHTML={{ __html: inlineMd(trimmed) }} />,
      );
    }
  });
  flushList();
  return <div className="markdown-content">{blocks}</div>;
}

function inlineMd(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
}
