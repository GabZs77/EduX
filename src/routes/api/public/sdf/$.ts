import { createFileRoute } from "@tanstack/react-router";

const PREFIX = "/api/public/sdf";

async function proxy({ request }: { request: Request }) {
  const { default: worker } = await import("@/lib/sdf-worker.server.js");
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(PREFIX.length) || "/";
  const forwarded = new Request(url.toString(), request);
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
