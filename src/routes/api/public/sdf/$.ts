import { createFileRoute } from "@tanstack/react-router";

const PREFIX = "/api/public/sdf";

function sessionFromCookie(request: Request) {
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)edux_session=([^;]+)/)?.[1];
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function proxy({ request }: { request: Request }) {
  const { default: worker } = await import("@/lib/sdf-worker.server.js");
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(PREFIX.length) || "/";
  const headers = new Headers(request.headers);
  const session = sessionFromCookie(request);
  const cookieHeaders: Record<string, string> = {
    token2: "X-Token2",
    token: "X-Token",
    cdUsuarioCurto: "X-Cd-Usuario",
    apelido: "X-Task-User",
    usuario: "X-Usuario",
  };
  for (const [field, header] of Object.entries(cookieHeaders)) {
    const value = session?.[field];
    if (typeof value === "string" && value && !headers.has(header)) headers.set(header, value);
  }
  const forwarded = new Request(url.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
  return worker.fetch(forwarded, {
    GROQ_API_KEY: process.env["GROQ_API_KEY"],
  });
}

export const Route = createFileRoute("/api/public/sdf/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
    },
  },
});
