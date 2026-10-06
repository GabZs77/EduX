import assert from "node:assert/strict";
import { test } from "node:test";
import { handleSedRequest } from "./upstream.ts";

async function loginWithMockedUpstreams(validationData: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    calls.push(`${init.method || "GET"} ${url.hostname}${url.pathname}`);

    if (url.pathname.endsWith("/LoginCompletoToken")) {
      return new Response(JSON.stringify({
        token: "test-sed-token",
        DadosUsuario: { CD_USUARIO: 123456789, NM_NICK: "test-student", NAME: "Estudante Teste" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/registration/edusp/token") {
      return new Response("<html><title>Just a moment</title>Cloudflare challenge-platform</html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.pathname.endsWith("/ValidarToken")) {
      return new Response(JSON.stringify(validationData), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected upstream URL: ${url.hostname}${url.pathname}`);
  };

  try {
    const response = await handleSedRequest(new Request("https://local.test/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuario: "dummy-user", senha: "dummy-password" }),
    }));
    return { response, data: await response.json(), calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Cloudflare challenge no token EduSP mantém acesso após validação SED", async () => {
  const { response, data, calls } = await loginWithMockedUpstreams({
    statusCode: 200,
    statusRetorno: "Acesso permitido!",
  });

  assert.equal(response.status, 200);
  assert.equal(data.eduspUnavailable, true);
  assert.equal(data.token2, "test-sed-token");
  assert.equal(data.erro, undefined);
  assert(calls.some((call) => call.endsWith("/ValidarToken")));
  assert(calls.some((call) => call.endsWith("/registration/edusp/token")));
});

test("não cria sessão quando a SED não valida o token", async () => {
  const { response, data } = await loginWithMockedUpstreams({
    statusCode: 401,
    statusRetorno: "Acesso negado",
  });

  assert.equal(response.status, 401);
  assert.equal(data.stage, "sed-validation");
  assert.equal(data.token, undefined);
  assert.equal(data.token2, undefined);
});
