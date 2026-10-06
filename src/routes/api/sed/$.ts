import { createFileRoute } from "@tanstack/react-router";
import { handleSedRequest } from "@/lib/sed/upstream";

async function proxy({ request }: { request: Request }) {
  const incoming = new URL(request.url);
  const splat = incoming.pathname.replace(/^\/api\/sed\/?/, "");
  const rewritten = new URL(incoming.toString());
  rewritten.pathname = `/${splat}`.replace(/\/+/g, "/") || "/";
  const env = { XAI_API_KEY: process.env.XAI_API_KEY || "" };
  const forwarded = new Request(rewritten.toString(), request);
  return handleSedRequest(forwarded, env);
}

export const Route = createFileRoute("/api/sed/$")({
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
