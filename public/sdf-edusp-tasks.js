/*
 * Tarefas "A Fazer" consultadas direto do navegador do aluno.
 *
 * A API de tarefas (edusp-api.ip.tv) libera CORS para qualquer origem, mas
 * bloqueia com frequência servidores de hospedagem (Cloudflare 403). A
 * plataforma oficial faz essas chamadas a partir do navegador; aqui fazemos o
 * mesmo: identificamos as turmas do aluno logado (/room/user) e buscamos as
 * tarefas pendentes (/tms/task/todo) com exatamente os mesmos alvos. O
 * resultado é mesclado na resposta do painel antes de o app exibi-la.
 */
(function () {
  if (window.__sdfEduspTasksInstalled) return;
  window.__sdfEduspTasksInstalled = true;

  var EDUSP = "https://edusp-api.ip.tv";
  var SESSION_KEY = "sed_sessao";
  var CACHE_MS = 60 * 1000;
  var originalFetch = window.fetch.bind(window);
  var cache = null; // { at, key, promise }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(patch) {
    try {
      var current = readSession();
      if (!current) return;
      localStorage.setItem(SESSION_KEY, JSON.stringify(Object.assign({}, current, patch)));
    } catch (e) {}
  }

  function jwtPayload(token) {
    try {
      var part = String(token || "").split(".")[1];
      if (!part) return null;
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return JSON.parse(atob(b64));
    } catch (e) {
      return null;
    }
  }

  function isEduspToken(token) {
    var p = jwtPayload(token);
    return !!(p && p.realm === "edusp" && p.nick);
  }

  function eduspHeaders(apiKey) {
    var h = { Accept: "application/json", "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" };
    if (apiKey) h["x-api-key"] = apiKey;
    return h;
  }

  async function exchangeToken(sedToken) {
    var resp = await originalFetch(EDUSP + "/registration/edusp/token", {
      method: "POST",
      headers: eduspHeaders(),
      body: JSON.stringify({ token: sedToken }),
    });
    if (!resp.ok) return null;
    var data = await resp.json().catch(function () { return null; });
    if (!data || !data.auth_token) return null;
    return { apiKey: String(data.auth_token).trim(), nick: String(data.nick || "").trim() };
  }

  async function resolveCredentials(session) {
    // 1) Renova com o token do SED (sessões antigas guardam chave vencida).
    if (session.token) {
      try {
        var fresh = await exchangeToken(session.token);
        if (fresh) {
          if (!fresh.nick) fresh.nick = (jwtPayload(fresh.apiKey) || {}).nick || "";
          writeSession({ token2: fresh.apiKey });
          return fresh;
        }
      } catch (e) {}
    }
    // 2) Usa a chave salva, se for realmente uma chave do EduSP.
    if (isEduspToken(session.token2)) {
      return { apiKey: session.token2, nick: jwtPayload(session.token2).nick };
    }
    return null;
  }

  function addUnique(list, value) {
    if (value === undefined || value === null) return;
    var text = String(value).trim();
    if (text && list.indexOf(text) === -1) list.push(text);
  }

  async function fetchRooms(apiKey) {
    var resp = await originalFetch(EDUSP + "/room/user?list_all=true&with_cards=true", { headers: eduspHeaders(apiKey) });
    if (!resp.ok) throw new Error("room/user " + resp.status);
    var data = await resp.json();
    return Array.isArray(data && data.rooms) ? data.rooms : [];
  }

  function buildTargets(rooms, nick) {
    // Mesma ordem da plataforma oficial: salas, salas:nick, categorias.
    var names = [];
    var categories = [];
    rooms.forEach(function (room) {
      addUnique(names, room && room.name);
      (Array.isArray(room && room.group_categories) ? room.group_categories : []).forEach(function (cat) {
        addUnique(categories, cat && cat.id);
      });
    });
    var targets = names.slice();
    if (nick) names.forEach(function (n) { addUnique(targets, n + ":" + nick); });
    categories.forEach(function (c) { addUnique(targets, c); });
    return targets;
  }

  async function fetchTodo(apiKey, targets) {
    var p = new URLSearchParams();
    p.set("expired_only", "false");
    p.set("limit", "100");
    p.set("offset", "0");
    p.set("filter_expired", "true");
    p.set("is_exam", "false");
    p.set("with_answer", "true");
    p.set("is_essay", "false");
    targets.forEach(function (t) { p.append("publication_target", t); });
    p.append("answer_statuses", "draft");
    p.set("with_apply_moment", "true");
    var resp = await originalFetch(EDUSP + "/tms/task/todo?" + p.toString(), { headers: eduspHeaders(apiKey) });
    if (!resp.ok) throw new Error("tms/task/todo " + resp.status);
    var data = await resp.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tasks)) return data.tasks;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalize(raw, roomTopics) {
    var answer = raw.answer_status == null ? null : String(raw.answer_status).toLowerCase();
    var target = String(raw.publication_target || "").split(":")[0];
    return {
      id: raw.id != null ? raw.id : raw.task_id,
      title: raw.title || raw.name || "Tarefa",
      subject: raw.discipline_name || raw.subject_name || "",
      room: roomTopics[target] || raw.room_name || target,
      status: "pending",
      answerStatus: answer || "pending",
      due: raw.apply_moment || raw.expire_at || raw.due_date || null,
      raw: raw,
    };
  }

  async function loadTasks() {
    var session = readSession();
    if (!session) return null;
    var creds = await resolveCredentials(session);
    if (!creds) return null;
    var rooms = await fetchRooms(creds.apiKey);
    var targets = buildTargets(rooms, creds.nick);
    if (!targets.length) return { tasks: [], targets: targets, rooms: rooms };
    var raws = await fetchTodo(creds.apiKey, targets);
    var topics = {};
    rooms.forEach(function (r) { if (r && r.name) topics[r.name] = r.topic || r.name; });
    var tasks = raws
      .filter(function (t) {
        if (!t || t.task_expired) return false;
        var a = t.answer_status == null ? null : String(t.answer_status).toLowerCase();
        return a === null || a === "draft" || a === "pending";
      })
      .map(function (t) { return normalize(t, topics); });
    tasks.sort(function (a, b) { return (Date.parse(a.due || "") || 0) - (Date.parse(b.due || "") || 0); });
    return { tasks: tasks, targets: targets, rooms: rooms };
  }

  function getTasks() {
    var session = readSession();
    var key = session ? String(session.token || session.token2 || "") : "";
    if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.promise;
    var promise = loadTasks().catch(function (err) {
      console.warn("[EduX] Tarefas via navegador indisponíveis:", err && err.message ? err.message : err);
      return null;
    });
    cache = { at: Date.now(), key: key, promise: promise };
    return promise;
  }

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var isPanel = /\/api\/public\/sdf\/(dashboard|tarefas)(\?|$)/.test(url);
    if (!isPanel) return originalFetch(input, init);

    var browserPromise = getTasks();
    var resp = await originalFetch(input, init);
    try {
      var data = await resp.clone().json();
      if (!data || typeof data !== "object") return resp;
      var browser = await browserPromise;
      if (!browser) return resp;

      var merged = [];
      var seen = {};
      browser.tasks.concat(Array.isArray(data.tarefas) ? data.tarefas : []).forEach(function (t) {
        var id = String(t && t.id != null ? t.id : JSON.stringify(t));
        if (seen[id]) return;
        seen[id] = true;
        merged.push(t);
      });
      data.tarefas = merged;
      data.pendencias = merged.filter(function (t) { return t.status === "pending"; }).length;
      data.targets = browser.targets;
      data.tarefasFonte = "navegador";
      var headers = new Headers(resp.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify(data), { status: resp.status, statusText: resp.statusText, headers: headers });
    } catch (e) {
      return resp;
    }
  };
})();
