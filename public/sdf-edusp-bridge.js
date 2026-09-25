/* Ponte de sessao da plataforma de tarefas (edusp-api.ip.tv).
   Quando o servidor do EduX e bloqueado pelo Cloudflare ao trocar o token
   do SED pelo token de tarefas, o login devolve token2 = token do SED, que a
   plataforma de tarefas nao aceita -> lista de tarefas vazia.
   A plataforma oficial faz essa troca direto no navegador (CORS liberado),
   entao aqui fazemos o mesmo e corrigimos o token antes de pedir as tarefas. */
(function () {
  if (window.__eduxEduspBridge) return;
  window.__eduxEduspBridge = true;

  var SESSION_KEY = "sed_sessao";
  var EXCHANGE_URL = "https://edusp-api.ip.tv/registration/edusp/token";
  var originalFetch = window.fetch.bind(window);
  var pending = null;

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function needsExchange(s) {
    return !!(s && s.token && (!s.token2 || s.token2 === s.token || s.eduspUnavailable));
  }

  function exchange(sedToken) {
    if (pending) return pending;
    pending = originalFetch(EXCHANGE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-platform": "webclient",
        "x-api-realm": "edusp",
      },
      body: JSON.stringify({ token: sedToken }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.auth_token ? d : null; })
      .catch(function () { return null; })
      .finally(function () { setTimeout(function () { pending = null; }, 0); });
    return pending;
  }

  async function fixSession() {
    var s = readSession();
    if (!needsExchange(s)) return s;
    var d = await exchange(s.token);
    if (!d) return s;
    s.token2 = d.auth_token;
    s.eduspUnavailable = false;
    if (d.nick && !s.apelido) s.apelido = String(d.nick).replace(/-sp$/i, "");
    saveSession(s);
    return s;
  }

  function urlOf(input) {
    if (typeof input === "string") return input;
    if (input && input.url) return input.url;
    return String(input || "");
  }

  window.fetch = async function (input, init) {
    var url = urlOf(input);
    var isWorker = url.indexOf("/api/") !== -1 && url.indexOf("edusp-api.ip.tv") === -1;
    if (!isWorker) return originalFetch(input, init);

    // Login: se o servidor nao conseguiu o token de tarefas, troca no navegador.
    if (/\/login(\?|$)/.test(url)) {
      var resp = await originalFetch(input, init);
      if (!resp.ok) return resp;
      var text = await resp.clone().text();
      var data;
      try { data = JSON.parse(text); } catch (e) { return resp; }
      if (data && data.token && (data.eduspUnavailable || data.token2 === data.token)) {
        var d = await exchange(data.token);
        if (d) {
          data.token2 = d.auth_token;
          data.eduspUnavailable = false;
          delete data.aviso;
          var headers = new Headers(resp.headers);
          headers.delete("content-length");
          return new Response(JSON.stringify(data), { status: resp.status, headers: headers });
        }
      }
      return resp;
    }

    // Demais chamadas: garante que o X-Token2 seja o token de tarefas.
    var s = readSession();
    if (needsExchange(s)) {
      s = await fixSession();
      if (s && s.token2 && s.token2 !== s.token) {
        var h = new Headers((init && init.headers) || (input && input.headers) || {});
        if (h.has("X-Token2")) h.set("X-Token2", s.token2);
        init = Object.assign({}, init || {}, { headers: h });
      }
    }
    return originalFetch(input, init);
  };
})();
