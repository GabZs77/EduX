import { DEMO_SESSION, demoAvaliacoes, demoBoletim, demoDashboard, demoFrequencia } from "./demo";
import { isOpenTask, isSubmittedAnswer } from "./tasks";
import type { CaptchaChallenge, Dashboard, StudentSession } from "./types";

const SESSION_KEY = "sed_sessao";
const ACCOUNTS_KEY = "sdf.saved-accounts.v1";

export type SavedAccount = {
  numero: string;
  digito: string;
  uf: string;
  senha: string;
  nome?: string;
};

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (typeof rec.erro === "string") return rec.erro;
    if (typeof rec.error === "string") return rec.error;
    if (typeof rec.message === "string") return rec.message;
    if (typeof rec.detalhe === "string") return rec.detalhe;
  }
  return fallback;
}

export function readSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StudentSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StudentSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveSavedAccounts(list: SavedAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export function rememberAccount(account: SavedAccount) {
  const list = loadSavedAccounts().filter(
    (item) => !(item.numero === account.numero && item.digito === account.digito && item.uf === account.uf),
  );
  list.unshift(account);
  saveSavedAccounts(list.slice(0, 8));
}

export async function apiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (session?.token2 && !headers.has("X-Token2")) headers.set("X-Token2", session.token2);
  if (session?.token && !headers.has("X-Token")) headers.set("X-Token", session.token);
  if (session?.cdUsuarioCurto && !headers.has("X-Cd-Usuario")) headers.set("X-Cd-Usuario", String(session.cdUsuarioCurto));
  if (session?.apelido && !headers.has("X-Task-User")) headers.set("X-Task-User", session.apelido);
  if (session?.usuario && !headers.has("X-Usuario")) headers.set("X-Usuario", session.usuario);

  const res = await fetch(`/api/sed${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw Object.assign(new Error(getErrorMessage(data, `Não foi possível consultar os dados (HTTP ${res.status}).`)), {
      status: res.status,
      data,
    });
  }
  return data as T;
}

export async function signIn(usuario: string, senha: string): Promise<StudentSession> {
  const data = await apiRequest<StudentSession>("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha }),
  });
  const session = { ...data, usuario };
  saveSession(session);
  return session;
}

export function enterDemo(): StudentSession {
  saveSession(DEMO_SESSION);
  return DEMO_SESSION;
}

export async function fetchDashboard(): Promise<Dashboard> {
  const session = readSession();
  if (session?.demo) return demoDashboard();
  return apiRequest<Dashboard>("/dashboard");
}

export async function fetchAgenda() {
  const session = readSession();
  if (session?.demo) return { ok: true, data: demoDashboard().agenda };
  return apiRequest<{ ok: boolean; data: Dashboard["agenda"] }>("/agenda");
}

export async function fetchBoletim() {
  const session = readSession();
  if (session?.demo) return { ok: true, data: demoBoletim() };
  return apiRequest<{ ok: boolean; data: ReturnType<typeof demoBoletim> }>("/boletim");
}

export async function fetchNotas() {
  const session = readSession();
  if (session?.demo) return { ok: true, data: demoAvaliacoes(), boletim: demoBoletim() };
  return apiRequest<{ ok: boolean; data: ReturnType<typeof demoAvaliacoes>; boletim: ReturnType<typeof demoBoletim> }>("/notas");
}

export async function fetchFrequencia() {
  const session = readSession();
  if (session?.demo) {
    const pack = demoFrequencia();
    return { ok: true, data: pack.data, faltas: pack.faltas, faltasBimestreAtual: pack.faltas };
  }
  return apiRequest<{
    ok: boolean;
    data: ReturnType<typeof demoFrequencia>["data"];
    faltas: number | null;
    faltasBimestreAtual: number | null;
  }>("/frequencia");
}

export async function fetchCaptchaChallenge(): Promise<CaptchaChallenge> {
  const data = await apiRequest<Record<string, unknown>>("/captcha/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ realm: "edusp", type: "image" }),
  });
  const nested = data.challenge && typeof data.challenge === "object" ? (data.challenge as Record<string, unknown>) : {};
  const image = String(data.image ?? nested.image ?? "");
  const challengeId = String(data.challengeId ?? data.challenge_id ?? data.id ?? nested.challengeId ?? nested.challenge_id ?? "");
  const sessionKey = String(data.sessionKey ?? data.session_key ?? nested.sessionKey ?? "");
  const captchaCookie = String(data.captchaCookie ?? data.captcha_cookie ?? data.cookie ?? nested.captchaCookie ?? "");
  if (!challengeId || !image) throw new Error("Não foi possível gerar o CAPTCHA.");
  return { challengeId, image, sessionKey, captchaCookie };
}

export async function verifyCaptcha(challenge: CaptchaChallenge, answer: string) {
  const data = await apiRequest<Record<string, unknown>>("/captcha/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Captcha-Session": challenge.sessionKey,
      "X-Captcha-Cookie": challenge.captchaCookie,
    },
    body: JSON.stringify({
      sessionKey: challenge.sessionKey,
      captchaCookie: challenge.captchaCookie,
      payload: { challengeId: challenge.challengeId, answer },
    }),
  });
  const token = String(data.token ?? data.captcha_token ?? data.captchaToken ?? "");
  if (!token) throw new Error("O CAPTCHA foi aceito, mas o token não retornou.");
  return token;
}

export async function fetchTaskDetails(
  taskId: string | number,
  roomName: string,
  captchaToken: string,
  captchaSession = "",
  captchaCookie = "",
) {
  const params = new URLSearchParams({ task_id: String(taskId) });
  if (roomName) params.set("room_name", roomName);
  return apiRequest<Record<string, unknown>>(`/task-details?${params.toString()}`, {
    headers: {
      "X-Captcha-Token": captchaToken,
      "X-Captcha-Session": captchaSession,
      "X-Captcha-Cookie": captchaCookie,
    },
  });
}

export async function submitTask(body: Record<string, unknown>) {
  return apiRequest("/answer-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendAssistantMessage(messages: { role: string; content: string }[], image?: string, imageMime?: string) {
  const data = await apiRequest<{ response?: string; help?: string; answer?: string; erro?: string }>("/groq-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, image, imageMime }),
  });
  const text = String(data.response || data.help || data.answer || "").trim();
  if (/fui\s+treinad|meu\s+treinamento|modelo\s+de\s+linguagem|quem\s+me\s+(criou|treinou)/i.test(text)) {
    return "Sou o Flash IA, seu tutor de estudos. Posso ajudar com a matéria, explicar um conceito ou organizar uma revisão.";
  }
  return text || "A IA não retornou uma resposta.";
}

export async function askQuestionHelp(question: unknown, mode?: string) {
  const data = await apiRequest<{ help?: string; answer?: string }>("/groq-help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }),
  });
  return String(data.help || data.answer || "").trim();
}

export async function researchTopic(payload: Record<string, unknown>) {
  const data = await apiRequest<{ answer?: string }>("/groq-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return String(data.answer || "").trim();
}

export function firstName(nome?: string) {
  return (nome || "Aluno").trim().split(/\s+/)[0] || "Aluno";
}

export function initials(nome?: string) {
  return (
    (nome || "Aluno")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "A"
  ).toUpperCase();
}

export function workday(date = new Date()) {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

export function formatDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function weekdayShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

export function dayNumber(iso: string) {
  return iso.slice(8, 10);
}

export function statusLabel(status: string) {
  const value = String(status || "").toLowerCase();
  if (isSubmittedAnswer(value)) return "Enviada";
  if (value.includes("draft") || value.includes("rascunho")) return "Rascunho";
  if (value.includes("expir")) return "Expirada";
  return "Pendente";
}

export { isOpenTask, isSubmittedAnswer };


export function fmtNota(nota?: number | null) {
  if (nota === null || nota === undefined || Number.isNaN(Number(nota))) return "—";
  return Number(nota).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
