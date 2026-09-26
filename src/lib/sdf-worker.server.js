const SUBSCRIPTION_KEYS = {
  login: "d701a2043aa24d7ebb37e9adf60d043b",
  aluno: "d701a2043aa24d7ebb37e9adf60d043b",
  boletim: "a84380a41b144e0fa3d86cbc25027fe6",
  hub: "5936fddda3484fe1aa4436df1bd76dab",
};

const EXTRA_TARGETS = ["1052", "1820", "764"];
const EDUSP_BASE = "https://edusp-api.ip.tv";
const TASKITOS_BASE = "https://taskitos.cupiditys.lol";
const SED_BASE = "https://sedintegracoes.educacao.sp.gov.br";
const WORKER_BUILD = "sdf-flash-v23-20260911-direct-task-completion";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Notificações: sem KV/D1/R2. O Worker mantém a lista no runtime atual.
// O frontend também guarda um cache no localStorage para sobreviver a recarregamentos.
// Observação: sem um banco/KV externo, nenhuma solução no Worker puro garante
// persistência após reinicialização/novo deploy do Worker.
let NOTIFICATIONS_DB = [];

const UPSTREAM_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Origin: "https://saladofuturo.educacao.sp.gov.br",
  Referer: "https://saladofuturo.educacao.sp.gov.br/",
};

// =======================================================
// FUNÇÕES AUXILIARES
// =======================================================
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Token, X-Token2, X-Api-Key, X-Cd-Usuario, X-Task-User, X-Usuario, X-Captcha-Token, X-Captcha-Session, X-Captcha-Cookie, X-Admin-User",
  };
}

function getEduApiKey(request) {
  const raw = request.headers.get("X-Token2") || request.headers.get("X-Api-Key") || "";
  const key = String(raw).trim();
  if (!key || key === "null" || key === "undefined") return "";
  return key;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Worker-Build": WORKER_BUILD,
      ...corsHeaders(),
    },
  });
}

async function readJson(resp) {
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function upstreamErrorMessage(data, status) {
  const raw = String(data?.message || data?.error || data?.erro || data?.raw || "");
  if (
    status === 403 &&
    /just a moment|cloudflare|challenge-platform|enable javascript and cookies/i.test(raw)
  ) {
    return "O Sala do Futuro bloqueou temporariamente a abertura da sessão por uma proteção anti-bot (Cloudflare). Aguarde alguns minutos e tente novamente.";
  }
  return raw.slice(0, 300) || "O serviço da Sala do Futuro não retornou uma mensagem detalhada.";
}

// Algumas rotas SED aceitam o caminho com o prefixo /saladofuturobffapi e outras
// só respondem sem o prefixo (com prefixo devolvem 401). Tentamos as duas formas,
// com e sem Bearer, e devolvemos a primeira resposta que funcionar.
async function sedGet(pathAndQuery, { subKey, token } = {}) {
  const clean = String(pathAndQuery || "").replace(/^\/+/, "");
  const withoutPrefix = clean.replace(/^saladofuturobffapi\//, "");
  const candidates = [
    `${SED_BASE}/${withoutPrefix}`,
    `${SED_BASE}/saladofuturobffapi/${withoutPrefix}`,
  ];
  let last = { resp: { ok: false, status: 0 }, data: null, url: candidates[0] };
  for (const url of candidates) {
    for (const useToken of token ? [true, false] : [false]) {
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subKey || SUBSCRIPTION_KEYS.login,
        "x-product-name": "SalaDoFuturo",
      };
      if (useToken) headers.Authorization = `Bearer ${token}`;
      let resp;
      try { resp = await fetch(url, { headers }); } catch { continue; }
      const data = await readJson(resp);
      last = { resp, data, url };
      if (resp.ok) return last;
    }
  }
  return last;
}

function currentAnoLetivo() {
  return new Date().getFullYear();
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const cleaned = value.trim().replace(/%$/, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function firstValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function addUnique(array, value) {
  if (value === null || value === undefined || value === "") return;
  const s = String(value);
  if (!array.includes(s)) array.push(s);
}

function unwrapSedList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of ["data", "items", "result", "results", "avaliacoes", "avaliations", "value"]) {
    const nested = data[key];
    if (Array.isArray(nested)) return nested;
    if (nested && typeof nested === "object") {
      const rows = unwrapSedList(nested);
      if (rows.length) return rows;
    }
  }
  return typeof data === "object" ? [data] : [];
}

function toTitleCase(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

function roomNameFromDescription(description) {
  const raw = String(description || "").trim();
  if (!raw) return "";
  const parts = raw.split(" - ");
  if (parts.length >= 3) {
    const curso = toTitleCase(parts[1].trim());
    let serieRaw = parts[2].trim();
    const match = serieRaw.match(/(MANH|TARD|NOIT|ANUA)/i);
    if (match) serieRaw = serieRaw.slice(0, match.index);
    const serieLimpa = toTitleCase(serieRaw.trim().replace(/SERIE/gi, "Série"));
    return `${curso} - ${serieLimpa}`;
  }
  if (parts.length >= 2) return toTitleCase(parts[1].trim());
  return toTitleCase(raw);
}

function normalizeRoom(room) {
  const descricao = room?.DescricaoTurma ?? room?.descricaoTurma ?? room?.descricao ?? room?.description ?? "";
  const name = roomNameFromDescription(descricao) || String(room?.NomeTurma ?? room?.name ?? room?.topic ?? "").trim();
  return {
    id: room?.CodigoTurma ?? room?.codigoTurma ?? room?.id ?? null,
    numeroClasse: room?.NumeroClasse ?? room?.numeroClasse ?? null,
    identificador: room?.IdentificadorTurma ?? room?.identificadorTurma ?? "",
    descricao: descricao,
    name,
    escola: room?.NomeEscola ?? room?.nomeEscola ?? "",
    codigoEscola: room?.CodigoEscola ?? room?.codigoEscola ?? null,
    curso: name ? name.split(" - ")[0] : "",
  };
}

function extractTasks(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["tasks", "items", "data", "results", "todo"]) if (Array.isArray(data[key])) return data[key];
  for (const key of ["data", "result", "response", "payload"]) {
    if (data[key] && typeof data[key] === "object") {
      const nested = extractTasks(data[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function taskRoomTarget(task, fallback = "") {
  const candidates = [task?.room_name, task?.roomName, task?.target_value, task?.targetValue, task?.publication_target, task?.publicationTarget, task?.room, task?.turma, task?.classroom];
  for (const value of candidates) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
    if (value && typeof value === "object") {
      const nested = value.name ?? value.room_name ?? value.roomName ?? value.id;
      if (nested !== undefined && String(nested).trim()) return String(nested).trim();
    }
  }
  return String(fallback || "").trim();
}
function normalizeTask(task, roomName = "") {
  const due = task?.apply_moment ?? task?.applyMoment ?? task?.due_date ?? task?.dueDate ?? task?.deadline ?? null;
  const rawStatus = String(task?.answer_status ?? task?.status ?? "pending").toLowerCase();
  // A API oficial usa answer_status=pending mesmo quando apply_moment já passou.
  // A data não pode transformar uma tarefa não respondida em expired, senão
  // tarefas pendentes legítimas desaparecem do cartão "Tarefas pendentes".
  let status = rawStatus || "pending";
  const answered = ["submitted", "completed", "done", "finished"].includes(status);
  if (!answered && !["expired", "overdue"].includes(status)) status = "pending";
  if (["overdue"].includes(status)) status = "expired";
  return {
    id: task?.id ?? task?.task_id ?? task?.taskId ?? null,
    title: task?.title ?? task?.name ?? task?.titulo ?? task?.description ?? "Tarefa",
    subject: task?.discipline_name ?? task?.disciplineName ?? task?.subject_name ?? task?.subject ?? task?.materia ?? "",
    room: taskRoomTarget(task, roomName),
    status,
    answerStatus: rawStatus,
    due,
    raw: task,
  };
}


// =======================================================
// PROXY DE PDF DAS APOSTILAS
// =======================================================
async function handlePdfProxy(request, url) {
  const target = url.searchParams.get("url") || "";
  if (!target) return new Response("Parâmetro url ausente", { status: 400, headers: corsHeaders() });
  let targetUrl;
  try { targetUrl = new URL(target); } catch { return new Response("URL inválida", { status: 400, headers: corsHeaders() }); }
  if (targetUrl.protocol !== "https:" || targetUrl.hostname !== "raw.githubusercontent.com") {
    return new Response("Domínio não permitido", { status: 403, headers: corsHeaders() });
  }
  const resp = await fetch(targetUrl.toString(), { headers: { Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8" }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!resp.ok) return new Response(await resp.text(), { status: resp.status, headers: { ...corsHeaders(), "Content-Type": resp.headers.get("content-type") || "text/plain" } });
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", resp.headers.get("content-type") || "application/pdf");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Content-Disposition", "inline");
  return new Response(resp.body, { status: 200, headers });
}

// =======================================================
// CAPTCHA SED / EduSP
// =======================================================
function cookiePair(value) {
  return String(value || "").split(";", 1)[0].trim();
}

// Reúne TODOS os cookies devolvidos pelo upstream (o desafio pode depender de
// mais de um cookie de sessão; usar apenas o primeiro causava 401 na validação).
function collectCookies(resp) {
  let raw = [];
  try {
    if (typeof resp.headers.getSetCookie === "function") raw = resp.headers.getSetCookie() || [];
  } catch {}
  if (!raw.length) {
    const single = resp.headers.get("set-cookie");
    if (single) raw = single.split(/,\s*(?=[^;=]+=)/);
  }
  const seen = new Map();
  for (const item of raw) {
    const pair = cookiePair(item);
    if (!pair || !pair.includes("=")) continue;
    seen.set(pair.split("=", 1)[0], pair);
  }
  return Array.from(seen.values()).join("; ");
}

function randomSessionKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// O cliente oficial envia apenas x-session-key (+ content-type) nas rotas de
// CAPTCHA: nada de x-api-key/x-api-realm, senão o verify é recusado.
function captchaHeaders(_token2, sessionKey = "", cookie = "") {
  return {
    Accept: "*/*",
    "Content-Type": "application/json",
    Origin: UPSTREAM_HEADERS.Origin,
    Referer: UPSTREAM_HEADERS.Referer,
    "User-Agent": UPSTREAM_HEADERS["User-Agent"],
    "Accept-Language": UPSTREAM_HEADERS["Accept-Language"],
    ...(sessionKey ? { "x-session-key": sessionKey } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function handleCaptchaChallenge(request) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ erro: "Cabeçalho X-Token2 ausente" }, 400);
  let body = { realm: "edusp", type: "image" };
  try {
    const incoming = await request.json();
    if (incoming && typeof incoming === "object") body = { ...body, ...incoming };
  } catch {}
  // A sessão do CAPTCHA é criada pelo cliente (32 hex) e precisa ser a MESMA no
  // challenge e no verify — é isso que fazia a primeira tentativa falhar.
  const sessionKey = String(body?.sessionKey || request.headers.get("X-Captcha-Session") || "").trim() || randomSessionKey();
  delete body.sessionKey;
  let last = null;
  try {
    const resp = await fetch(`${EDUSP_BASE}/captcha/challenge`, {
      method: "POST",
      headers: captchaHeaders(token2, sessionKey),
      body: JSON.stringify(body),
    });
    const data = await readJson(resp);
    last = { resp, data };
    if (resp.ok) {
      return jsonResponse({
        ...data,
        challengeId: data?.challengeId ?? data?.challenge_id ?? data?.id ?? data?.data?.challenge_id ?? data?.data?.id,
        image: data?.challenge?.image ?? data?.image ?? data?.data?.image ?? data?.data?.challenge?.image,
        sessionKey,
        captchaCookie: collectCookies(resp) || cookiePair(data?.captchaCookie || data?.cookie || ""),
      }, resp.status);
    }
  } catch {}
  return jsonResponse({ erro: "Não foi possível carregar o CAPTCHA.", detalhe: last?.data || null }, last?.resp?.status || 502);
}

async function handleCaptchaVerify(request) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ erro: "Cabeçalho X-Token2 ausente" }, 400);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo do CAPTCHA inválido" }, 400); }
  const payload = body?.payload || {};
  if (!payload.challengeId || !payload.answer) return jsonResponse({ erro: "challengeId e answer são obrigatórios" }, 400);
  const sessionKey = String(body?.sessionKey || request.headers.get("X-Captcha-Session") || "").trim();
  const captchaCookie = String(body?.captchaCookie || request.headers.get("X-Captcha-Cookie") || "").trim();
  const answer = String(payload.answer).trim();

  // O corpo é exatamente o do cliente oficial (sem sessionKey); a sessão vai só
  // no cabeçalho x-session-key. Se faltar sessão, tentamos apenas pelos cookies.
  const payloadBody = { type: "image", realm: "edusp", payload: { challengeId: payload.challengeId, answer } };
  const attempts = sessionKey ? [sessionKey, ""] : [""];
  let resp = null;
  let data = null;
  for (const key of attempts) {
    try {
      resp = await fetch(`${EDUSP_BASE}/captcha/verify`, {
        method: "POST",
        headers: captchaHeaders(token2, key, captchaCookie),
        body: JSON.stringify(payloadBody),
        redirect: "manual",
      });
    } catch (error) {
      return jsonResponse({ erro: "Não foi possível conectar ao serviço de CAPTCHA. Verifique a conexão e gere um novo desafio.", detalhe: String(error?.message || error), valid: false }, 502);
    }
    data = await readJson(resp);
    if (resp.ok) break;
    if (resp.status !== 401 && resp.status !== 400) break;
  }

  const token = data?.token || data?.captcha_token || data?.captchaToken || data?.data?.token || data?.data?.captcha_token || data?.data?.captchaToken || "";
  if (resp.status >= 300 && resp.status < 400) return jsonResponse({ erro: "O serviço de CAPTCHA redirecionou a validação. Gere um novo desafio.", upstream_status: resp.status, valid: false }, 502);
  if (!resp.ok) return jsonResponse({ erro: resp.status === 401 ? "A plataforma recusou a sessão do CAPTCHA. Gere um novo desafio e tente novamente." : "O código do CAPTCHA não foi aceito.", upstream_status: resp.status, upstream: data, token: "", valid: false }, resp.status);
  return jsonResponse({ ...data, token, valid: Boolean(token || data?.valid), sessionKey }, resp.status);
}


// =======================================================
// FUNÇÕES DE API (SED/EDUSP)
// =======================================================
async function fetchTurmas(cdUsuarioCurto, token) {
  const { resp, data } = await sedGet(
    `apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}`,
    { subKey: SUBSCRIPTION_KEYS.hub, token },
  );
  return { resp, data, rooms: unwrapSedList(data).map(normalizeRoom) };
}

async function fetchTasksForTargets(token2, targets, options = {}) {
  const params = new URLSearchParams();
  params.set("expired_only", options.expiredOnly ? "true" : "false");
  params.set("limit", "100"); params.set("offset", "0");
  params.set("filter_expired", options.filterExpired === false ? "false" : "true");
  params.set("is_exam", "false"); params.set("with_answer", "true");
  params.set("is_essay", "false");
  if (options.statuses !== false) {
    for (const status of options.statuses || ["draft", "pending"]) params.append("answer_statuses", status);
  }
  params.set("with_apply_moment", "true");
  for (const target of targets || []) params.append("publication_target", target);
  const resp = await fetch(`${EDUSP_BASE}/tms/task/todo?${params.toString()}`, {
    headers: { ...UPSTREAM_HEADERS, "content-type": "application/json", "x-api-platform": "webclient", "x-api-realm": "edusp", "x-api-key": token2 },
  });
  return { resp, data: await readJson(resp) };
}

async function fetchEduspRoomTargets(token2) {
  const targets = [];
  try {
    const resp = await fetch(`${EDUSP_BASE}/room/user?list_all=true&with_cards=true`, {
      headers: { ...UPSTREAM_HEADERS, "content-type": "application/json", "x-api-platform": "webclient", "x-api-realm": "edusp", "x-api-key": token2 },
    });
    if (!resp.ok) return targets;
    const data = await readJson(resp);
    const eduspRooms = Array.isArray(data?.rooms) ? data.rooms : [];
    for (const room of eduspRooms) {
      addUnique(targets, room?.name);
      const categories = Array.isArray(room?.group_categories) ? room.group_categories : [];
      for (const cat of categories) addUnique(targets, cat?.id);
    }
  } catch {}
  return targets;
}

async function fetchTasks(token2, rooms, username) {
  // Mesma consulta que a plataforma original faz na aba "A Fazer":
  // apenas os alvos reais do aluno, filtro draft e sem expiradas. A API inclui
  // nesse filtro as tarefas ainda não iniciadas, cujo answer_status vem nulo.
  const baseTargets = [];
  for (const target of await fetchEduspRoomTargets(token2)) addUnique(baseTargets, target);
  for (const room of rooms) {
    if (!room.name) continue;
    addUnique(baseTargets, room.name);
  }
  if (username) {
    for (const target of [...baseTargets]) addUnique(baseTargets, `${target}:${username}-sp`);
    addUnique(baseTargets, `${username}-sp`);
  }

  let lastResp = null;
  let lastData = null;
  const rawTasks = [];

  try {
    const result = await fetchTasksForTargets(token2, baseTargets, {
      statuses: ["draft"],
      filterExpired: true,
      expiredOnly: false,
    });
    lastResp = result.resp; lastData = result.data;
    if (result.resp?.ok) rawTasks.push(...extractTasks(result.data));
  } catch {}

  const seen = new Set();
  const tasks = [];
  for (const raw of rawTasks) {
    const id = String(raw?.id ?? raw?.task_id ?? raw?.taskId ?? `${raw?.title}|${raw?.apply_moment ?? ""}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const task = normalizeTask(raw, findRoomForTask(raw, rooms));
    // Somente tarefas pendentes: entregues e expiradas ficam de fora.
    if (task.status !== "pending") continue;
    const answered = raw?.answer_status ?? raw?.answerStatus ?? null;
    if (answered && !["pending", "draft"].includes(String(answered).toLowerCase())) continue;
    tasks.push(task);
  }
  tasks.sort((a, b) => (Date.parse(a.due || "") || 0) - (Date.parse(b.due || "") || 0));
  return { ok: lastResp ? Boolean(lastResp.ok) : true, status: lastResp?.status ?? 200, tasks, targets: baseTargets, raw: lastData };
}



function findRoomForTask(task, rooms) {
  const text = JSON.stringify(task || "").toLowerCase();
  for (const room of rooms) {
    if (room.name && text.includes(room.name.toLowerCase())) return room.name;
    if (room.id !== null && text.includes(String(room.id))) return room.name;
  }
  return "";
}

async function fetchFaltas(cdUsuarioCurto, token) {
  const { resp, data } = await sedGet(
    `apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}`,
    { subKey: SUBSCRIPTION_KEYS.boletim, token },
  );
  return { resp, data, total: extractFaltasBimestre(data) };
}

async function fetchBoletim(cdUsuarioCurto, token, anoLetivo) {
  const ano = anoLetivo || currentAnoLetivo();
  const { resp, data } = await sedGet(
    `apiboletim/api/Boletim/GetBoletimCompleto?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}&anoLetivo=${ano}&codigoTurma=0`,
    { subKey: SUBSCRIPTION_KEYS.boletim, token },
  );
  return { ok: !!resp.ok, status: resp.status, data };
}

async function fetchFrequenciaBimestre(cdUsuarioCurto, token, bimestre, anoLetivo) {
  const ano = anoLetivo || currentAnoLetivo();
  const { resp, data } = await sedGet(
    `apiboletim/api/Frequencia/ConsultaFrequenciaBimestre?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}&anoLetivo=${ano}&bimestre=${bimestre || 1}&somenteAtivo=0`,
    { subKey: SUBSCRIPTION_KEYS.boletim, token },
  );
  return { ok: !!resp.ok, status: resp.status, data };
}

function extractFaltasBimestre(data) {
  const exactKeys = ["faltasBimestreAtual", "FaltasBimestreAtual", "totalFaltasBimestre", "TotalFaltasBimestre", "quantidadeFaltasBimestre", "QuantidadeFaltasBimestre", "totalFaltas", "TotalFaltas", "faltas", "Faltas"];
  const seen = new WeakSet();
  function walk(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) { for (const item of node) { const found = walk(item); if (found !== null) return found; } return null; }
    for (const key of exactKeys) { if (Object.prototype.hasOwnProperty.call(node, key)) { const n = numberValue(node[key]); if (n !== null) return n; } }
    for (const value of Object.values(node)) { const found = walk(value); if (found !== null) return found; }
    return null;
  }
  const explicit = walk(data);
  if (explicit !== null) return explicit;
  let sum = 0; let found = false;
  const visited = new WeakSet();
  function sumExact(node) {
    if (!node || typeof node !== "object" || visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) return node.forEach(sumExact);
    for (const [key, value] of Object.entries(node)) {
      if (/^faltas?$/i.test(key)) { const n = numberValue(value); if (n !== null) { sum += n; found = true; } } 
      else if (value && typeof value === "object") { sumExact(value); }
    }
  }
  sumExact(data);
  return found ? sum : null;
}

async function fetchNotifications(cdUsuario) {
  const url = `${SED_BASE}/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao-cmsp?userId=${encodeURIComponent(cdUsuario)}`;
  const resp = await fetch(url, { headers: { Accept: "application/json", "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEYS.boletim } });
  const data = await readJson(resp);
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.notifications)) list = data.notifications;
  else if (Array.isArray(data?.data)) list = data.data;
  const unread = list.filter(item => item?.statusLeitura === false || item?.lido === false || item?.read === false || item?.isRead === false || item?.status === "UNREAD").length;
  return { ok: resp.ok, data, total: list.length, unread };
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Dias úteis (seg-sex) a partir de hoje, cobrindo a janela usada pela aba Agenda.
function nextWorkdays(count = 6, from = new Date()) {
  const days = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; days.length < count && i < 21; i += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + i);
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) days.push(day);
  }
  return days;
}

// GET /apiboletim/api/Agenda/GetAgendaDia → aulas do dia (horário + disciplina)
async function fetchAgendaDia(cdUsuarioCurto, token, dateStr) {
  const ano = Number(String(dateStr).slice(0, 4)) || currentAnoLetivo();
  const { resp, data } = await sedGet(
    `apiboletim/api/Agenda/GetAgendaDia?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}&anoLetivo=${ano}&dataAgenda=${dateStr}`,
    { subKey: SUBSCRIPTION_KEYS.boletim, token },
  );
  const payload = data?.data && typeof data.data === "object" ? data.data : {};
  const aulas = Array.isArray(payload.agendaAluno) ? payload.agendaAluno : [];
  const escola = Array.isArray(payload.agendaEscola) ? payload.agendaEscola : [];
  const events = aulas.map((row, index) => ({
    id: `${dateStr}-${index}-${row?.disciplinaId ?? "x"}`,
    data: dateStr,
    horaInicio: String(row?.horaInicioAula || "").slice(0, 5),
    horaFim: String(row?.horaFimAula || "").slice(0, 5),
    nomeDisciplina: toTitleCase(row?.nomeDisciplina || "Aula"),
    descricaoTurma: row?.descricaoTurma || "",
    sala: "",
    tipo: /intervalo|almo/i.test(String(row?.nomeDisciplina || "")) ? "intervalo" : "aula",
    raw: row,
  }));
  const extras = escola.map((row, index) => ({
    id: `${dateStr}-escola-${index}`,
    data: dateStr,
    horaInicio: String(row?.horaInicio || row?.horaInicioAula || "").slice(0, 5),
    horaFim: String(row?.horaFim || row?.horaFimAula || "").slice(0, 5),
    nomeDisciplina: row?.descricao || row?.titulo || row?.nomeEvento || "Evento escolar",
    descricaoTurma: "",
    tipo: "evento",
    raw: row,
  }));
  return { ok: !!resp.ok, status: resp.status, events: [...events, ...extras] };
}

function normalizeAgendaEvento(row, index) {
  const rawDate = row?.dataInicio || row?.DataInicio || row?.data || row?.Data || row?.dataAgenda || "";
  const dateStr = String(rawDate).slice(0, 10);
  return {
    id: `evento-${index}`,
    data: dateStr,
    horaInicio: String(row?.horaInicio || row?.HoraInicio || "").slice(0, 5),
    horaFim: String(row?.horaFim || row?.HoraFim || "").slice(0, 5),
    nomeDisciplina: row?.descricao || row?.Descricao || row?.titulo || row?.Titulo || row?.nomeEvento || "Evento escolar",
    descricaoTurma: "",
    tipo: "evento",
    raw: row,
  };
}

async function fetchAgenda(token, cdUsuarioCurto, dataInicio, dataFim) {
  const now = new Date();
  const start = dataInicio ? new Date(`${dataInicio}T00:00:00`) : now;
  const end = dataFim ? new Date(`${dataFim}T00:00:00`) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 30);
  const days = nextWorkdays(6, start);
  const [periodo, ...dias] = await Promise.all([
    sedGet(
      `apiboletim/api/Agenda/GetAgendaPeriodoEscola?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}&anoLetivo=${start.getFullYear()}&dataInicio=${fmtDate(start)}&dataFim=${fmtDate(end)}`,
      { subKey: SUBSCRIPTION_KEYS.boletim, token },
    ),
    ...days.map((day) => fetchAgendaDia(cdUsuarioCurto, token, fmtDate(day))),
  ]);
  const aulas = dias.flatMap((d) => d.events);
  const eventos = unwrapSedList(periodo.data).map(normalizeAgendaEvento).filter((e) => e.data);
  const ok = !!periodo.resp?.ok || dias.some((d) => d.ok);
  return { ok, status: periodo.resp?.status || 0, data: periodo.data, events: [...aulas, ...eventos] };
}

async function fetchAluno(token, cdUsuarioCurto) {
  const { resp, data } = await sedGet(
    `api/Aluno/ObterAlunoPorCodigo?codigoAluno=${encodeURIComponent(cdUsuarioCurto)}`,
    { subKey: SUBSCRIPTION_KEYS.aluno, token },
  );
  return { resp, data };
}

async function fetchTaskDetails(token2, taskId, roomName, captchaToken, captchaSessionKey = "", captchaCookie = "") {
  const apiKey = String(token2 || "").trim();
  if (!apiKey || apiKey === "null" || apiKey === "undefined") return { resp: { ok: false, status: 400 }, data: { erro: "API_KEY_AUSENTE", detalhe: "Token EduSP ausente." } };
  const roomCandidates = Array.from(new Set([String(roomName || "").trim(), ""].filter((room) => room.length)));
  const headers = new Headers({
    "accept": "application/json", "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7", "content-type": "application/json",
    "origin": "https://saladofuturo.educacao.sp.gov.br", "referer": "https://saladofuturo.educacao.sp.gov.br/",
    "x-api-platform": "webclient", "x-api-realm": "edusp",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
  });
  headers.set("x-api-key", apiKey);
  if (captchaToken) headers.set("x-captcha-token", String(captchaToken).trim());
  // A consulta de detalhes usa o token do CAPTCHA; sessão e cookie ficam restritos à validação do desafio.
  let lastResponse = null;
  let lastData = null;
  let lastError = null;
  for (const candidateRoom of roomCandidates) {
    const roomQueries = candidateRoom
      ? [`&room_name=${encodeURIComponent(candidateRoom)}`, `&publication_target=${encodeURIComponent(candidateRoom)}`, `&target_value=${encodeURIComponent(candidateRoom)}`]
      : [""];
    for (const roomQuery of roomQueries) {
      const url = `${EDUSP_BASE}/tms/task/${taskId}/apply?preview_mode=false&token_code=null${roomQuery}`;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const resp = await fetch(url, { method: "GET", headers, cache: "no-store" });
          const data = await readJson(resp);
          lastResponse = resp;
          lastData = data;
          if (resp.ok) return { resp, data };
          if (![400, 401, 403, 404, 422].includes(resp.status)) break;
        } catch (error) {
          lastError = error;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }
  }
  return { resp: lastResponse || { ok: false, status: 502 }, data: lastData || { erro: "Não foi possível conectar ao serviço de atividades.", detalhe: String(lastError?.message || lastError || "Erro de rede") } };
}

async function submitTaskAnswers(token2, taskId, roomName, answers, captchaToken, accessedOn, executedOn, captchaSessionKey = "", options = {}) {
  const baseHeaders = {
    Accept: "application/json", "Content-Type": "application/json", "User-Agent": UPSTREAM_HEADERS["User-Agent"],
    "Accept-Language": UPSTREAM_HEADERS["Accept-Language"],
    Origin: UPSTREAM_HEADERS.Origin, Referer: UPSTREAM_HEADERS.Referer,
    "x-api-platform": "webclient", "x-api-realm": "edusp", "x-api-key": token2,
  };
  // O rascunho é salvo apenas com x-api-key. Mandar o token do CAPTCHA (já
  // consumido) nessas chamadas fazia a plataforma responder HTTP 400.
  const submitHeaders = { ...baseHeaders };
  if (captchaToken) submitHeaders["x-captcha-token"] = captchaToken;
  if (captchaSessionKey) submitHeaders["x-session-key"] = captchaSessionKey;

  const log = [];
  const call = async (step, url, method, body, headers) => {
    try {
      const resp = await fetch(url, { method, headers: headers || baseHeaders, cache: "no-store", ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await readJson(resp);
      log.push({ step, url, method, status: resp.status, ok: resp.ok, data });
      return { ok: resp.ok, status: resp.status, data, url };
    } catch (err) {
      log.push({ step, url, method, status: 0, ok: false, erro: String(err) });
      return { ok: false, status: 0, data: null, url };
    }
  };

  // A API aceita arrays para ordenação e lacunas. O leitor da atividade guarda
  // temporariamente esses valores como objetos indexados, então convertemos na
  // ordem numérica antes de salvar o rascunho.
  const normalizedAnswers = Object.fromEntries(Object.entries(answers || {}).map(([questionId, item]) => {
    if (!item || typeof item !== "object") return [questionId, item];
    const type = String(item.question_type || item.type || "").toLowerCase();
    const answer = item.answer;
    if ((type === "order-sentences" || type === "fill-words") && answer && !Array.isArray(answer) && typeof answer === "object") {
      const ordered = Object.keys(answer)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => answer[key]);
      return [questionId, { ...item, answer: ordered }];
    }
    return [questionId, item];
  }));

  // ---- 1. APPLY: obtém answer_id, min_execution_time e o publication_target correto ----
  const applyQS = (room) => `?preview_mode=false&token_code=null${room ? `&room_name=${encodeURIComponent(room)}` : ""}`;
  const apply = await call("apply", `${EDUSP_BASE}/tms/task/${taskId}/apply${applyQS(roomName)}`, "GET", null, submitHeaders);
  const lesson = apply.ok ? apply.data : null;

  const isPublicationTarget = (value) => /^(?:r[a-z0-9]+-l(?::[^\s]+)?|\d+)$/i.test(String(value || "").trim());
  const target =
    (isPublicationTarget(executedOn) ? String(executedOn).trim() : null) ||
    lesson?.publication_target ||
    (Array.isArray(lesson?.publication_targets) && lesson.publication_targets.length
      ? (typeof lesson.publication_targets[0] === "string" ? lesson.publication_targets[0] : lesson.publication_targets[0]?.publication_target)
      : null) ||
    roomName || "room";

  const minTime = Number(lesson?.min_execution_time ?? lesson?.minExecutionTime ?? 0) || 0;
  const duration = Math.max(Number(options.duration) || 0, minTime, 60);
  const answerId =
    lesson?.answer_id ?? lesson?.answerId ?? lesson?.answer?.id ?? options.answerId ?? null;

  // Conclusão direta conforme do_complete_task: não cria nem atualiza rascunho.
  const completion = await call("complete-direct", `${TASKITOS_BASE}/api/complete`, "POST", {
    x_auth_key: token2,
    room_code: target,
    lesson_id: taskId,
    draft: false,
    lesson_info: lesson,
    time_spent: duration,
    answer_id: answerId || 0,
    target_score: 100,
    captchaToken,
    answers: normalizedAnswers,
    accessed_on: accessedOn || "room",
    executed_on: executedOn || target,
  }, {
    Accept: "*/*",
    "Accept-Language": "pt-BR,pt;q=0.7",
    "Content-Type": "application/json",
    Origin: TASKITOS_BASE,
    Referer: `${TASKITOS_BASE}/`,
    "User-Agent": UPSTREAM_HEADERS["User-Agent"],
  });

  return {
    resp: { ok: completion.ok, status: completion.status || 502 },
    data: completion.ok ? { ...(completion.data || {}), answer_status: "submitted" } : completion.data,
    url: completion.url,
    attempts: log,
    answer_id: answerId,
    duration,
    answer_status: completion.ok ? "submitted" : null,
  };
}



function stripHtmlServer(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ").trim();
}

async function handleGroqResearch(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo inválido." }, 400); }
  const question = body?.question || {};
  const topic = stripHtmlServer(body?.topic || question.statement || question.enunciado || question.text || "").trim().slice(0, 500);
  if (!topic) return jsonResponse({ erro: "Tópico ou enunciado ausente." }, 400);
  const query = topic.replace(/\s+/g, " ").trim();
  const sourceMap = new Map();
  const addSource = (source) => {
    if (!source?.url || sourceMap.has(source.url)) return;
    sourceMap.set(source.url, { title: String(source.title || "Fonte"), url: String(source.url), snippet: String(source.snippet || "").slice(0, 900) });
  };
  const wikiSearchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=4&format=json&origin=*`;
  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const [wikiResult, ddgResult] = await Promise.allSettled([fetch(wikiSearchUrl, { headers: { Accept: "application/json" } }).then(readJson), fetch(ddgUrl, { headers: { Accept: "application/json" } }).then(readJson)]);
  const wikiData = wikiResult.status === "fulfilled" ? wikiResult.value : null;
  const ddgData = ddgResult.status === "fulfilled" ? ddgResult.value : null;
  const wikiHits = Array.isArray(wikiData?.query?.search) ? wikiData.query.search : [];
  for (const hit of wikiHits.slice(0, 3)) {
    const title = String(hit?.title || "").trim();
    if (!title) continue;
    const url = `https://pt.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    addSource({ title: `Wikipédia: ${title}`, url, snippet: stripHtmlServer(hit?.snippet || "") });
  }
  const related = Array.isArray(ddgData?.RelatedTopics) ? ddgData.RelatedTopics : [];
  const flattenRelated = (items) => items.flatMap((item) => Array.isArray(item?.Topics) ? flattenRelated(item.Topics) : [item]);
  for (const item of flattenRelated(related).slice(0, 4)) {
    if (item?.FirstURL) addSource({ title: item?.Text?.split(" - ")[0] || "Resultado de pesquisa", url: item.FirstURL, snippet: item.Text || "" });
  }
  const sourceList = Array.from(sourceMap.values()).slice(0, 6);
  const sourcesText = sourceList.map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\nResumo: ${source.snippet}`).join("\n\n");
  const options = Array.isArray(question.options) ? question.options : [];
  const optionsText = options.map((opt, index) => `${index + 1}. ${stripHtmlServer(opt?.text ?? opt?.texto ?? opt?.label ?? opt?.statement ?? "")}`).filter(Boolean).join("\n");
  const apiKey = String(env?.GROQ_API_KEY || GROQ_API_KEY || "").trim();
  if (!apiKey) return jsonResponse({ erro: "GROQ_API_KEY não configurada no Worker." }, 500);
  const prompt = `Você é um assistente de pesquisa e escrita escolar em português do Brasil. Produza uma resposta completa, clara e didática para o tópico abaixo, como um estudante dedicado que compreendeu o conteúdo. Use Markdown com título, introdução, desenvolvimento e conclusão quando fizer sentido. Sintetize as fontes, compare informações e não copie trechos longos. Toda afirmação factual importante deve indicar a fonte no formato [n], usando apenas os números fornecidos. Ao final, inclua uma seção ## Referências com os links numerados. Se o tópico pedir criação literária, use os fatos pesquisados como contexto e deixe claro o que é criação. Não mencione APIs, modelos, treinamento ou infraestrutura. Nunca envie a resposta para a plataforma; ela será revisada e inserida manualmente pelo aluno.\n\nTópico/enunciado:\n${query}\n${optionsText ? `\nAlternativas ou instruções adicionais:\n${optionsText}` : ""}\n\nFontes encontradas:\n${sourcesText || "Nenhuma fonte externa retornou dados; responda com cautela e informe essa limitação."}`;
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "system", content: "Você é um assistente escolar de pesquisa e escrita. Seja preciso, didático e transparente sobre fontes e incertezas." }, { role: "user", content: prompt }], temperature: 0.35, max_completion_tokens: 1800 })
  });
  const data = await readJson(resp);
  if (!resp.ok) return jsonResponse({ erro: "Falha na pesquisa assistida", detalhe: data?.error?.message || data?.message || `Groq retornou HTTP ${resp.status}` }, resp.status);
  const answer = data?.choices?.[0]?.message?.content || "";
  if (!answer) return jsonResponse({ erro: "A IA não retornou uma resposta de pesquisa." }, 502);
  return jsonResponse({ ok: true, answer, sources: sourceList, model: "openai/gpt-oss-20b" });
}

async function handleGroqHelp(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo inválido." }, 400); }
  const question = body?.question || {};
  const statement = stripHtmlServer(question.statement ?? question.enunciado ?? question.texto ?? question.question ?? question.text ?? "");
  if (!statement) return jsonResponse({ erro: "Enunciado ausente." }, 400);
  const rawOptions = question.options ?? question.alternativas ?? question.opcoes ?? null;
  let options = [];
  if (Array.isArray(rawOptions)) options = rawOptions;
  else if (rawOptions && typeof rawOptions === "object") options = Object.values(rawOptions);
  const optionsText = options.map((opt, index) => {
    const id = opt?.id ?? opt?.codigo ?? index;
    const text = stripHtmlServer(opt?.statement ?? opt?.texto ?? opt?.text ?? opt?.enunciado ?? opt?.label ?? "");
    return `${index + 1}. [${id}] ${text}`;
  }).filter(Boolean).join("\n");
  const type = String(question.type || "desconhecido");
  const wantsAnswer = String(body?.mode || "").toLowerCase() === "answer" || /\b(resposta|gabarito|resolva|resolver)\b/i.test(String(body?.request || ""));
  const prompt = `Você é um tutor escolar do Flash, em português do Brasil. Explique a questão de forma objetiva, didática e adequada ao nível escolar. ${wantsAnswer ? "O aluno pediu explicitamente a resposta final: entregue a resposta mais provável de forma clara, começando direto com o texto da resposta, sem nenhum título como 'Resposta'. Para ordenação, liste a sequência final; para lacunas, preencha em ordem; para alternativas, indique o número e o texto. Depois explique brevemente os motivos." : "Não entregue simplesmente a resposta final: explique o conceito e mostre um caminho curto para o aluno chegar à resposta. Se houver alternativas, ajude a comparar/eliminar as opções sem apenas dizer a letra correta."} Se houver cálculo, mostre as etapas. Escreva TODAS as contas e fórmulas em texto simples e legível, usando símbolos comuns (× ÷ √ ² ³ ≤ ≥ π %), NUNCA use notação LaTeX como \times, \frac, \( \) ou $...$ — escreva por exemplo: M = 10.000 × (1 + 0,05 × 2) = 11.000. Nunca clique, preencha campos ou envie a atividade na plataforma; o aluno fará essas ações manualmente. Não termine com dica, não escreva nenhuma seção de 'Dica'.\n\nTipo da questão: ${type}\nEnunciado:\n${statement}\n${optionsText ? `\nAlternativas/itens:\n${optionsText}` : ""}`.trim();
  const apiKey = String(env?.GROQ_API_KEY || GROQ_API_KEY || "").trim();
  if (!apiKey) return jsonResponse({ erro: "GROQ_API_KEY não configurada no Worker." }, 500);

  const MODELS = ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastStatus = 502;
  let lastMessage = "A IA não respondeu.";

  for (let attempt = 0; attempt < 5; attempt++) {
    const model = MODELS[Math.min(attempt, MODELS.length - 1)];
    let resp, data;
    try {
      resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Você é o Flash IA, um tutor escolar em português do Brasil. Seja claro, curto e didático. Nunca fale sobre APIs, código, infraestrutura, provedor, empresa, modelo, treinamento ou quem criou/treinou você. Quando o aluno pedir explicitamente a resposta de uma questão fornecida, informe a resposta mais provável e explique o motivo. Não invente dados." },
            { role: "user", content: prompt }
          ],
          temperature: 0.35,
          max_completion_tokens: 700
        })
      });
      data = await readJson(resp);
    } catch (err) {
      lastStatus = 502;
      lastMessage = String(err?.message || err);
      await sleep(800);
      continue;
    }

    if (resp.ok) {
      const help = data?.choices?.[0]?.message?.content || "";
      if (help) return jsonResponse({ ok: true, help, model });
      lastStatus = 502;
      lastMessage = "A IA não retornou texto.";
      await sleep(600);
      continue;
    }

    const message = String(data?.error?.message || data?.message || `HTTP ${resp.status}`);
    lastStatus = resp.status;
    lastMessage = message;

    if (resp.status === 429 || resp.status >= 500) {
      const retryAfter = Number(resp.headers.get("retry-after"));
      const hinted = Number((message.match(/try again in ([\d.]+)s/i) || [])[1]);
      const waitMs = Math.min(12000, Math.max(900, (retryAfter || hinted || 2) * 1000 + 400));
      await sleep(waitMs);
      continue;
    }
    break;
  }

  return jsonResponse({ erro: "Falha na IA", detalhe: lastMessage, upstream_status: lastStatus }, lastStatus === 429 ? 429 : lastStatus || 502);
}


// =======================================================
// GROQ CHAT (TEXTO E VISÃO)
// =======================================================
async function handleGroqChat(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo inválido" }, 400); }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const imageBase64 = typeof body?.image === "string" ? body.image.trim() : "";
  const mime = String(body?.imageMime || "image/jpeg").split(";")[0] || "image/jpeg";
  const apiKey = String(env?.GROQ_API_KEY || GROQ_API_KEY || "").trim();
  if (!apiKey) return jsonResponse({ erro: "GROQ_API_KEY não configurada no Worker." }, 500);
  if (!messages.length && !imageBase64) return jsonResponse({ erro: "Mensagem vazia." }, 400);

  const safeMessages = messages.slice(-12).map(m => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content || "")
  }));
  if (!safeMessages.length) safeMessages.push({ role: "user", content: "Analise a imagem enviada." });

  if (imageBase64) {
    const last = safeMessages[safeMessages.length - 1];
    const text = last.content || "Analise esta imagem e me ajude a estudar.";
    last.content = [
      { type: "text", text },
      { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } }
    ];
  }

  const models = imageBase64
    ? ["meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"]
    : ["llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

  let lastData = null;
  let lastStatus = 502;
  for (const model of models) {
    const payload = {
      model,
      messages: [
        { role: "system", content: "Você é o Flash IA, um tutor escolar em português do Brasil. Explique de forma clara, objetiva e didática. Ao analisar imagens, leia o conteúdo visível, incluindo questões, tabelas e respostas destacadas. Não invente informações que não estejam disponíveis." },
        ...safeMessages
      ],
      temperature: imageBase64 ? 0.35 : 0.65,
      max_completion_tokens: 2048
    };
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    const data = await readJson(resp);
    if (resp.ok) {
      return jsonResponse({ ok: true, response: data?.choices?.[0]?.message?.content || "Sem resposta", model });
    }
    lastData = data; lastStatus = resp.status;
    // 400/404 = modelo indisponível: tenta o próximo. Outros erros interrompem.
    if (resp.status !== 400 && resp.status !== 404) break;
  }
  const message = lastData?.error?.message || lastData?.message || `Groq retornou HTTP ${lastStatus}`;
  return jsonResponse({ erro: "Falha na Groq", detalhe: message, upstream_status: lastStatus, groq_error: lastData?.error || null }, lastStatus);
}

// =======================================================
// NOTIFICAÇÕES (EM MEMÓORIA)
// =======================================================
async function handleGetNotifications() {
  return jsonResponse({ ok: true, notifications: [...NOTIFICATIONS_DB].sort((a,b) => String(b.date).localeCompare(String(a.date))) });
}

function adminAllowed(request) {
  return request.headers.get("X-Admin-User") === "1127241606SP";
}

async function handleSaveNotification(request) {
  if (!adminAllowed(request)) return jsonResponse({ erro: "Não autorizado" }, 403);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo inválido" }, 400); }
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  if (!title || !description) return jsonResponse({ erro: "Título e descrição são obrigatórios" }, 400);
  const item = { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), title, description, date: new Date().toISOString() };
  NOTIFICATIONS_DB.push(item);
  return jsonResponse({ ok: true, notification: item });
}

async function handleEditNotification(request) {
  if (!adminAllowed(request)) return jsonResponse({ erro: "Não autorizado" }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ erro: "ID ausente" }, 400);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo inválido" }, 400); }
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  if (!title || !description) return jsonResponse({ erro: "Título e descrição são obrigatórios" }, 400);
  const index = NOTIFICATIONS_DB.findIndex(n => String(n.id) === String(id));
  if (index < 0) return jsonResponse({ erro: "Notificação não encontrada" }, 404);
  NOTIFICATIONS_DB[index] = { ...NOTIFICATIONS_DB[index], title, description, editedAt: new Date().toISOString() };
  return jsonResponse({ ok: true, notification: NOTIFICATIONS_DB[index] });
}

async function handleDeleteNotification(request, url) {
  if (!adminAllowed(request)) return jsonResponse({ erro: "Não autorizado" }, 403);
  const id = url.searchParams.get("id");
  if (!id) return jsonResponse({ erro: "ID ausente" }, 400);
  const before = NOTIFICATIONS_DB.length;
  NOTIFICATIONS_DB = NOTIFICATIONS_DB.filter(n => String(n.id) !== String(id));
  return jsonResponse({ ok: true, deleted: before !== NOTIFICATIONS_DB.length });
}

// =======================================================
// HANDLERS DAS ROTAS
// =======================================================
// Troca o token do SED pelo auth_token do EduSP. O endpoint às vezes responde
// com 403/429/502 de forma intermitente (proteção antibot do ip.tv), por isso
// tentamos algumas vezes com um pequeno atraso antes de desistir.
async function exchangeEduspToken(token) {
  const headerVariants = [
    {
      ...UPSTREAM_HEADERS,
      "content-type": "application/json",
      "x-api-platform": "webclient",
      "x-api-realm": "edusp",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-fetch-dest": "empty",
    },
    // Alguns dias o endpoint rejeita as variantes "sec-fetch-*" (host varia por
    // proteção antibot); se a primeira tentativa falhar por request malformada
    // tentamos de novo com o conjunto mínimo de headers que já funcionou antes.
    {
      ...UPSTREAM_HEADERS,
      "content-type": "application/json",
      "x-api-platform": "webclient",
      "x-api-realm": "edusp",
    },
  ];
  let lastResp = null;
  let lastData = null;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const headers = headerVariants[Math.min(attempt, headerVariants.length - 1)];
    try {
      const resp = await fetch(`${EDUSP_BASE}/registration/edusp/token`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });
      const data = await readJson(resp);
      lastResp = resp;
      lastData = data;
      if (resp.ok && data?.auth_token) return { resp, data };
      // 401/400 normalmente significam token do SED inválido/expirado — tentar
      // de novo não ajuda. 403/429/5xx costumam ser bloqueio temporário/antibot,
      // então vale tentar mais uma vez com um pequeno atraso.
      if (![403, 429, 500, 502, 503, 504].includes(resp.status)) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return {
    resp: lastResp || { ok: false, status: 502 },
    data: lastData || { erro: String(lastError?.message || lastError || "Falha de rede ao contatar o Sala do Futuro") },
  };
}

async function handleLogin(request) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo da requisição inválido" }, 400); }
  const { usuario, senha } = body || {};
  if (!usuario || !senha) return jsonResponse({ erro: "Informe usuário e senha" }, 400);
  const loginResp = await fetch(`${SED_BASE}/saladofuturobffapi/credenciais/api/LoginCompletoToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEYS.login },
    body: JSON.stringify({ user: usuario, senha }),
  });
  const loginData = await readJson(loginResp);
  const dados = loginData?.DadosUsuario || {};
  if (!loginResp.ok || !loginData?.token || !dados) return jsonResponse({ erro: "Usuário ou senha inválidos", detalhe: loginData }, loginResp.status >= 400 ? loginResp.status : 401);
  const token = String(loginData.token || "").trim();
  const cdUsuario = Number(dados.CD_USUARIO || 0);
  const username = dados.NM_NICK || loginData?.nick || "";
  const { resp: tokenResp, data: tokenData } = await exchangeEduspToken(token);
  if (!tokenResp.ok || !tokenData?.auth_token) {
    // Coloca o detalhe do erro upstream já dentro do texto principal ("erro"),
    // porque a tela de login hoje só exibe esse campo — sem isso o motivo real
    // (status HTTP, mensagem do ip.tv) fica invisível para quem está no celular.
    const upstreamStatus = tokenResp.status || 0;
    const upstreamMsg = upstreamErrorMessage(tokenData, upstreamStatus);
    if (upstreamStatus === 403 && /Cloudflare/i.test(upstreamMsg)) {
      return jsonResponse({
        nome: dados.NAME || "Aluno",
        apelido: username,
        email: dados.EMAIL || "",
        cdUsuario,
        cdUsuarioCurto: String(Math.trunc(cdUsuario / 10)),
        token,
        token2: token,
        eduspUnavailable: true,
        aviso: upstreamMsg,
      });
    }
    return jsonResponse(
      {
        erro: `Login ok, mas não foi possível abrir a sessão do Sala do Futuro (HTTP ${upstreamStatus}): ${upstreamMsg}`,
        detalhe: tokenData,
        upstream_status: upstreamStatus,
      },
      tokenResp.status || 401,
    );
  }
  return jsonResponse({ nome: dados.NAME || "Aluno", apelido: username, email: dados.EMAIL || "", cdUsuario, cdUsuarioCurto: String(Math.trunc(cdUsuario / 10)), token, token2: tokenData.auth_token });
}

async function handleDashboard(request) {
  const token2 = getEduApiKey(request);
  const token = request.headers.get("X-Token");
  const cdUsuario = request.headers.get("X-Cd-Usuario");
  const username = request.headers.get("X-Task-User") || "";
  if (!token2 || !cdUsuario) return jsonResponse({ erro: "Cabeçalhos X-Token2 e X-Cd-Usuario são obrigatórios" }, 400);
  const [roomsResult, faltasResult, notificationsResult, alunoResult, agendaResult] = await Promise.all([
    fetchTurmas(cdUsuario, token), fetchFaltas(cdUsuario, token), fetchNotifications(cdUsuario),
    token ? fetchAluno(token, cdUsuario) : Promise.resolve({ resp: { ok: false }, data: null }),
    token ? fetchAgenda(token, cdUsuario) : Promise.resolve({ ok: false, events: [] }),
  ]);
  const rooms = roomsResult.rooms;
  // Sessões restauradas do navegador podem conservar um token EduSP antigo.
  // Renove-o com o token SED antes de consultar salas e tarefas; se a troca
  // estiver temporariamente bloqueada, preserve o token recebido como fallback.
  let currentTaskToken = token2;
  if (token) {
    const refreshed = await exchangeEduspToken(token);
    if (refreshed.resp?.ok && refreshed.data?.auth_token) {
      currentTaskToken = String(refreshed.data.auth_token).trim();
    }
  }
  const taskResult = await fetchTasks(currentTaskToken, rooms, username);
  const aluno = alunoResult.data;
  const alunoData = aluno?.data && typeof aluno.data === "object" ? aluno.data : aluno;
  return jsonResponse({
    aluno: alunoData || {}, turmas: rooms, tarefas: taskResult.tasks,
    pendencias: taskResult.tasks.filter((t) => t.status === "pending").length,

    faltas: faltasResult.total, mensagensNaoLidas: notificationsResult.unread, mensagens: notificationsResult.total,
    targets: taskResult.targets, tarefasApiOk: taskResult.ok, tarefasApiStatus: taskResult.status,
    agenda: agendaResult.ok ? agendaResult.events : [],
    meta: { turmasApiOk: roomsResult.resp.ok, faltasApiOk: faltasResult.resp.ok, notificationsApiOk: notificationsResult.ok, alunoApiOk: !!alunoResult.resp?.ok, agendaApiOk: !!agendaResult.ok },
  });
}

function sedSessionFrom(request) {
  return {
    token: request.headers.get("X-Token") || "",
    cdUsuario: request.headers.get("X-Cd-Usuario") || "",
  };
}

async function handleAgenda(request, url) {
  const { token, cdUsuario } = sedSessionFrom(request);
  if (!cdUsuario) return jsonResponse({ ok: false, erro: "Sessão inválida", data: [] }, 400);
  const result = await fetchAgenda(token, cdUsuario, url.searchParams.get("inicio") || "", url.searchParams.get("fim") || "");
  return jsonResponse({ ok: result.ok, status: result.status, data: result.events });
}




function normalizeBoletimRows(data) {
  const rows = unwrapSedList(data).filter((row) => row && typeof row === "object");
  // O GetBoletimCompleto devolve as linhas do bimestre mais recente primeiro,
  // então a ordem de ocorrência é invertida: a última linha da disciplina é o 1º bimestre.
  const grupos = new Map();
  rows.forEach((row, index) => {
    const disciplina = toTitleCase(row?.nomeDisciplina || row?.nomeComponenteCurricular || "Disciplina");
    const chave = String(row?.disciplinaId ?? disciplina);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ row, index, disciplina });
  });

  const list = [];
  grupos.forEach((itens) => {
    const total = itens.length;
    itens.forEach((item, pos) => {
      const { row, index, disciplina } = item;
      const explicito = numberValue(row?.bimestre) || numberValue(row?.periodo);
      let numero = explicito && explicito >= 1 && explicito <= 4 ? explicito : total - pos;
      if (row?.primeiroBimestre === true) numero = 1;
      else if (row?.segundoBimestre === true) numero = 2;
      else if (row?.terceiroBimestre === true) numero = 3;
      else if (row?.quartoBimestre === true) numero = 4;
      const valido = numero >= 1 && numero <= 4;
      const bimestre = valido ? `${numero}º Bimestre` : "Bimestre atual";
      const base = {
        id: `${row?.disciplinaId ?? index}-${numero}`,
        disciplinaId: row?.disciplinaId ?? null,
        bimestreNumero: valido ? numero : null,
        nomeDisciplina: disciplina,
        disciplina: disciplina,
        descricaoTurma: row?.descricaoTurma || "",
        faltas: numberValue(row?.numeroFaltas),
        faltasCompensadas: numberValue(row?.numeroFaltasCompensadas),
        aulasDadas: numberValue(row?.quantidadeAulasRealizadas),
        aulasPlanejadas: numberValue(row?.quantidadeAulasPlanejadas),
        frequencia: numberValue(row?.porcentagemFrequencia),
        raw: row,
      };
      const nota = numberValue(row?.notaAtribuida);
      const media = numberValue(row?.notaAtribuidaMediaFinal);
      list.push({ ...base, nota, bimestre });
      if (media !== null) list.push({ ...base, id: `${base.id}-final`, nota: media, mediaFinal: media, bimestre: "Média final" });
    });
  });
  return list;
}


async function handleBoletim(request, url) {
  const { token, cdUsuario } = sedSessionFrom(request);
  if (!cdUsuario) return jsonResponse({ ok: false, erro: "Sessão inválida", data: [] }, 400);
  const result = await fetchBoletim(cdUsuario, token, url.searchParams.get("ano") || "");
  return jsonResponse({ ok: result.ok, status: result.status, data: normalizeBoletimRows(result.data) });
}

// GetAvaliacaoAluno: uma linha por avaliação/prova lançada pelo professor.
async function fetchAvaliacoes(cdUsuarioCurto, token, anoLetivo) {
  const ano = anoLetivo || currentAnoLetivo();
  const path = `apiboletim/api/Avaliacao/GetAvaliacaoAluno?AlunoId=${encodeURIComponent(cdUsuarioCurto)}&AnoLetivo=${ano}`;
  let result = await sedGet(path, { subKey: SUBSCRIPTION_KEYS.boletim, token });
  if (!result.resp?.ok) result = await sedGet(path, { subKey: SUBSCRIPTION_KEYS.login, token });
  return { ok: !!result.resp?.ok, status: result.resp?.status || 0, data: result.data };
}

function normalizeAvaliacoes(data, disciplinaPorId) {
  const rows = unwrapSedList(data).filter((row) => row && typeof row === "object" && !row.dataExclusao && !row.DataExclusao);
  const list = rows.map((row, index) => {
    const id = firstValue(row, ["disciplinaId", "DisciplinaId", "codigoDisciplina", "CodigoDisciplina"]);
    const nota = firstValue(row, ["notaAtribuida", "NotaAtribuida", "nota", "Nota", "valorNota", "ValorNota", "notaAluno", "NotaAluno", "notaLancada", "NotaLancada", "notaFinal", "NotaFinal"]);
    const bimestreRaw = firstValue(row, ["bimestre", "Bimestre", "bimestreNumero", "BimestreNumero", "periodo", "Periodo"]);
    const bimestreMatch = String(bimestreRaw ?? "").match(/[1-4]/);
    return {
      id: firstValue(row, ["avaliacaoNotaId", "AvaliacaoNotaId", "avaliacaoId", "AvaliacaoId"]) ?? `av-${index}`,
      prova: String(firstValue(row, ["descricaoAvaliacao", "DescricaoAvaliacao", "nomeAvaliacao", "NomeAvaliacao", "descricao", "Descricao"]) || "Avaliação").trim(),
      data: firstValue(row, ["dataAvaliacao", "DataAvaliacao", "data", "Data"]),
      nota: numberValue(nota),
      peso: numberValue(firstValue(row, ["peso", "Peso", "pesoAvaliacao", "PesoAvaliacao"])),
      bimestre: bimestreMatch ? Number(bimestreMatch[0]) : null,
      disciplinaId: id,
      disciplina: disciplinaPorId?.get?.(String(id)) || String(firstValue(row, ["nomeDisciplina", "NomeDisciplina", "disciplina", "Disciplina"]) || ""),
    };
  });
  list.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  return list;
}

async function handleNotas(request, url) {
  const { token, cdUsuario } = sedSessionFrom(request);
  if (!cdUsuario) return jsonResponse({ ok: false, erro: "Sessão inválida", data: [] }, 400);
  const ano = url.searchParams.get("ano") || "";
  const [avaliacoes, boletim] = await Promise.all([
    fetchAvaliacoes(cdUsuario, token, ano),
    fetchBoletim(cdUsuario, token, ano),
  ]);
  const boletimRows = normalizeBoletimRows(boletim.data);
  const disciplinaPorId = new Map();
  for (const row of boletimRows) {
    if (row.disciplinaId !== null && row.disciplinaId !== undefined && !disciplinaPorId.has(String(row.disciplinaId))) {
      disciplinaPorId.set(String(row.disciplinaId), row.nomeDisciplina);
    }
  }
  return jsonResponse({
    ok: avaliacoes.ok,
    status: avaliacoes.status,
    data: normalizeAvaliacoes(avaliacoes.data, disciplinaPorId),
    boletim: boletimRows,
  });
}

// ConsultaFrequenciaBimestre devolve uma linha por disciplina com
// numeroFaltasBimestre / numeroPresencasBimestre / porcentagemPresenca.
function normalizeFrequenciaBimestre(bimestre, data) {
  const rows = unwrapSedList(data).filter((row) => row && typeof row === "object");
  if (!rows.length) return null;
  let faltas = 0;
  let presencas = 0;
  let somaPct = 0;
  let qtdPct = 0;
  const disciplinas = [];
  for (const row of rows) {
    const f = numberValue(row?.numeroFaltasBimestre ?? row?.faltas ?? row?.Faltas ?? row?.totalFaltas) || 0;
    const p = numberValue(row?.numeroPresencasBimestre ?? row?.presencas ?? row?.totalPresencas) || 0;
    const pct = numberValue(row?.porcentagemPresenca ?? row?.frequencia ?? row?.percentualFrequencia);
    faltas += f;
    presencas += p;
    if (pct !== null) { somaPct += pct; qtdPct += 1; }
    disciplinas.push({
      nomeDisciplina: toTitleCase(row?.nomeDisciplina || "Disciplina"),
      faltas: f,
      presencas: p,
      frequencia: pct,
    });
  }
  const aulas = presencas + faltas;
  let frequencia = qtdPct ? Math.round((somaPct / qtdPct) * 10) / 10 : null;
  if (frequencia === null && aulas > 0) frequencia = Math.round(((aulas - faltas) / aulas) * 1000) / 10;
  return {
    descricaoBimestre: `${bimestre}º Bimestre`,
    bimestre,
    faltas,
    aulasDadas: aulas,
    frequencia,
    disciplinas,
  };
}

async function handleFrequencia(request, url) {
  const { token, cdUsuario } = sedSessionFrom(request);
  if (!cdUsuario) return jsonResponse({ ok: false, erro: "Sessão inválida", data: [] }, 400);
  const ano = url.searchParams.get("ano") || "";
  const requested = url.searchParams.get("bimestre");
  const bimestres = requested ? [Number(requested) || 1] : [1, 2, 3, 4];
  const results = await Promise.all(bimestres.map((b) => fetchFrequenciaBimestre(cdUsuario, token, b, ano)));
  const list = [];
  results.forEach((res, index) => {
    const normalized = normalizeFrequenciaBimestre(bimestres[index], res.data);
    if (normalized) list.push(normalized);
  });
  const faltas = await fetchFaltas(cdUsuario, token);
  const total = faltas.total ?? list.reduce((acc, item) => acc + (item.faltas || 0), 0);
  return jsonResponse({ ok: results.some((r) => r.ok), data: list, faltas: total, faltasBimestreAtual: total });
}


async function handleResume(request) {
  const token2 = getEduApiKey(request);
  const token = request.headers.get("X-Token");
  const cdUsuarioCurto = request.headers.get("X-Cd-Usuario") || "";
  const apelido = request.headers.get("X-Task-User") || "";
  if (!token2 || !token) return jsonResponse({ ok: false, erro: "Sessão salva inválida ou expirada" }, 401);
  return jsonResponse({ ok: true, nome: apelido || "Aluno", apelido, token, token2, cdUsuarioCurto, usuario: request.headers.get("X-Usuario") || "" });
}

async function handleStudentRooms(request) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ erro: "Cabeçalho X-Token2 ausente" }, 400);
  try {
    const targets = await fetchEduspRoomTargets(token2);
    const rooms = Array.from(new Set(targets.map((target) => String(target || "").trim()).filter(Boolean))).map((name, index) => ({ id: String(index), name, identifier: name }));
    return jsonResponse({ ok: true, rooms, targets });
  } catch (error) {
    return jsonResponse({ ok: false, erro: "Não foi possível obter as salas do usuário.", detalhe: String(error?.message || error), rooms: [], targets: [] }, 502);
  }
}

async function handleTaskDetails(request, url) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ erro: "Cabeçalho X-Token2 ausente" }, 400);
  const taskId = url.searchParams.get("task_id");
  const roomName = url.searchParams.get("room_name") || "";
  const captchaToken = request.headers.get("X-Captcha-Token") || "";
  const captchaSessionKey = request.headers.get("X-Captcha-Session") || url.searchParams.get("captcha_session") || "";
  const captchaCookie = request.headers.get("X-Captcha-Cookie") || "";
  if (!taskId) return jsonResponse({ erro: "Parâmetro task_id ausente" }, 400);
  if (!captchaToken) return jsonResponse({ erro: "CAPTCHA_REQUIRED", captcha_required: true }, 428);
  try {
    const result = await fetchTaskDetails(token2, taskId, roomName, captchaToken, captchaSessionKey, captchaCookie);
    if (!result.resp.ok) return jsonResponse({ erro: "Falha ao consultar a atividade", upstream_status: result.resp.status, upstream: result.data }, result.resp.status);
    return jsonResponse(result.data, result.resp.status);
  } catch (error) {
    return jsonResponse({ erro: "Falha ao consultar a atividade", upstream_status: 502, detalhe: String(error?.message || error) }, 502);
  }
}

async function handleAnswerTask(request) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ erro: "Cabeçalho X-Token2 ausente" }, 400);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ erro: "Corpo da requisição inválido" }, 400); }
  const { task_id, room_name, answers, captcha_token, accessed_on, executed_on } = body || {};
  const captchaSessionKey = request.headers.get("X-Captcha-Session") || body?.captcha_session || "";
  const answersIsValid = answers && typeof answers === "object" && !Array.isArray(answers) && Object.keys(answers).length > 0;
  if (!task_id || !answersIsValid) return jsonResponse({ erro: "Parâmetros task_id e answers (objeto question_id -> resposta) são obrigatórios" }, 400);
  const result = await submitTaskAnswers(token2, task_id, room_name, answers, captcha_token || request.headers.get("X-Captcha-Token") || "", accessed_on, executed_on, captchaSessionKey, { duration: body?.duration ?? body?.time_spent, answerId: body?.answer_id });
  return jsonResponse({ ok: result.resp.ok, status: result.resp.status, data: result.data, endpoint: result.url, attempts: result.attempts || [] }, result.resp.status || 502);
}

// Resposta provável direto da API: consulta as respostas já registradas
// (rascunho/gabarito) da tarefa no Task Manager do TarefaSP.
async function handleResolverTarefa(request) {
  const token2 = getEduApiKey(request);
  if (!token2) return jsonResponse({ ok: false, erro: "Cabeçalho X-Token2 ausente" }, 400);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const taskId = body?.task_id ?? body?.tarefa_id;
  if (!taskId) return jsonResponse({ ok: false, erro: "Parâmetro task_id é obrigatório" }, 400);
  const rascunho = body?.rascunho !== false;
  const status = rascunho ? "draft" : "submitted";
  const nick = String(request.headers.get("X-Task-User") || body?.nick || "").trim();
  const roomName = String(body?.room_name || "").trim();

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: UPSTREAM_HEADERS.Origin,
    Referer: UPSTREAM_HEADERS.Referer,
    "User-Agent": UPSTREAM_HEADERS["User-Agent"],
    "x-api-platform": "webclient",
    "x-api-realm": "edusp",
    "x-api-key": token2,
  };

  const attempts = [];
  const call = async (step, url, method, payload) => {
    try {
      const resp = await fetch(url, { method, headers, cache: "no-store", ...(payload ? { body: JSON.stringify(payload) } : {}) });
      const data = await readJson(resp);
      attempts.push({ step, url, method, status: resp.status, ok: resp.ok });
      return { ok: resp.ok, status: resp.status, data };
    } catch (error) {
      attempts.push({ step, url, method, status: 0, ok: false, erro: String(error?.message || error) });
      return { ok: false, status: 0, data: null };
    }
  };

  const nickQS = nick ? `?nick=${encodeURIComponent(nick)}` : "";
  // 1) API real do TarefaSP (CMSP Task Manager)
  let result = await call("tms-answer", `${EDUSP_BASE}/tms/answer${nickQS}`, "POST", {
    task_id: String(taskId),
    status,
    answers: {},
  });
  // 2) Fallbacks: respostas já gravadas e o próprio conteúdo da tarefa
  if (!result.ok) result = await call("task-answer", `${EDUSP_BASE}/tms/task/${taskId}/answer${nickQS}`, "GET", null);
  if (!result.ok) {
    const roomQuery = roomName ? `&room_name=${encodeURIComponent(roomName)}` : "";
    result = await call("apply", `${EDUSP_BASE}/tms/task/${taskId}/apply?preview_mode=false&token_code=null${roomQuery}`, "GET", null);
  }

  const payload = result.data;
  const record = Array.isArray(payload) ? payload[payload.length - 1] : payload;
  const answers = (record && typeof record === "object" && record.answers && typeof record.answers === "object") ? record.answers : null;

  return jsonResponse({ ok: Boolean(result.ok && answers), status: result.status, answers, data: payload, attempts }, 200);
}

// =======================================================
// ROTEADOR PRINCIPAL
// =======================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders(), "Access-Control-Max-Age": "600", Vary: "Origin" } });
    try {
      if (path === "/login" && request.method === "POST") return handleLogin(request);
      if (path === "/resume" && request.method === "POST") return handleResume(request);
      if (path === "/dashboard") return handleDashboard(request);
      if (path === "/agenda" && request.method === "GET") return handleAgenda(request, url);
      if (path === "/boletim" && request.method === "GET") return handleBoletim(request, url);
      if ((path === "/notas" || path === "/avaliacoes") && request.method === "GET") return handleNotas(request, url);
      if ((path === "/frequencia" || path === "/presenca") && request.method === "GET") return handleFrequencia(request, url);
      if (path === "/tarefas" && request.method === "GET") return handleDashboard(request);
      if (path === "/captcha/challenge" && request.method === "POST") return handleCaptchaChallenge(request);
      if (path === "/captcha/verify" && request.method === "POST") return handleCaptchaVerify(request);
      if (path === "/student-rooms" && request.method === "GET") return handleStudentRooms(request);
      if (path === "/task-details") return handleTaskDetails(request, url);
      if (path === "/answer-task" && request.method === "POST") return handleAnswerTask(request);
      if (path === "/groq-chat" && request.method === "POST") return handleGroqChat(request, env);
      if (path === "/notifications" && request.method === "GET") return handleGetNotifications();
      if (path === "/admin/notification" && request.method === "POST") return handleSaveNotification(request);
      if (path === "/admin/notification" && request.method === "PUT") return handleEditNotification(request);
      if (path === "/admin/notification" && request.method === "DELETE") return handleDeleteNotification(request, url);
      if (path === "/pdf-proxy" && request.method === "GET") return handlePdfProxy(request, url);
      if (path === "/groq-help" && request.method === "POST") return handleGroqHelp(request, env);
      if (path === "/groq-research" && request.method === "POST") return handleGroqResearch(request, env);
      if (path === "/health") return jsonResponse({ ok: true, worker: "sdf", build: WORKER_BUILD });
      return jsonResponse({ erro: "Rota não encontrada" }, 404);
    } catch (error) {
      return jsonResponse({ erro: "Erro interno no Worker", detalhe: String(error) }, 500);
    }
  },
};
