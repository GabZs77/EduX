import { ChevronRight, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  askQuestionHelp,
  fetchCaptchaChallenge,
  fetchTaskDetails,
  isSubmittedAnswer,
  statusLabel,
  submitTask,
  verifyCaptcha,
} from "@/lib/sed/client";
import { DEMO_TASK_DETAILS } from "@/lib/sed/demo";
import type { CaptchaChallenge, Task, TaskQuestion } from "@/lib/sed/types";
import { sanitizeHtml, simpleMarkdown } from "./page-ui";
import { useStudent } from "./student-context";

function normalizeOptions(raw: unknown): { id: string; text: string }[] {
  if (Array.isArray(raw)) {
    return raw.map((item, i) => {
      if (typeof item === "string") return { id: String(i), text: item };
      const rec = (item || {}) as Record<string, unknown>;
      return {
        id: String(rec.id ?? rec.codigo ?? i),
        text: String(rec.statement ?? rec.texto ?? rec.text ?? rec.label ?? rec.enunciado ?? ""),
      };
    });
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([id, value]) => ({
      id,
      text: typeof value === "string" ? value : String((value as { text?: string })?.text ?? ""),
    }));
  }
  return [];
}

function normalizeQuestionType(raw: string, optionsLen: number) {
  const h = raw.toLowerCase().replace(/[_ ]/g, "-");
  if (h === "info" || h.includes("inform")) return "info";
  if (h.includes("fill") || h.includes("lacuna") || h.includes("gap") || h.includes("blank")) return "fill";
  if (h.includes("order") || h.includes("sort") || h.includes("ordena")) return "order";
  if (h.includes("true") || h.includes("false") || h.includes("certo") || h.includes("errado")) return "true-false";
  if (h.includes("multi")) return "multi";
  if (h.includes("single") || h.includes("choice") || h.includes("radio") || optionsLen) return "single";
  return "text";
}

function extractTaskQuestions(payload: unknown): TaskQuestion[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const task = root.task && typeof root.task === "object" ? (root.task as Record<string, unknown>) : {};
  const list = [root.questions, root.questoes, root.items, root.data, task.questions, task.questoes, task.items].find(
    Array.isArray,
  ) as unknown[] | undefined;
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : { statement: String(item || "") };
    const rawType = String(rec.type ?? rec.question_type ?? rec.questionType ?? rec.tipo ?? "text");
    const options = normalizeOptions(rec.options ?? rec.alternativas ?? rec.opcoes ?? rec.choices ?? rec.answers);
    return {
      id: String(rec.id ?? rec.question_id ?? rec.questionId ?? rec.codigo ?? `q${index}`),
      type: normalizeQuestionType(rawType, options.length),
      rawType,
      statement: String(rec.statement ?? rec.enunciado ?? rec.texto ?? rec.question ?? rec.text ?? rec.description ?? "").trim(),
      options,
      maxLength: Number(rec.max_text_count ?? 0) || 0,
      raw: rec,
    };
  });
}

function extractStatement(payload: unknown) {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const task = root.task && typeof root.task === "object" ? (root.task as Record<string, unknown>) : {};
  return String(root.statement ?? root.enunciado ?? task.statement ?? task.title ?? root.title ?? "").trim();
}

function hasAnswer(value: unknown, type: string) {
  if (type === "true-false") return !!(value && typeof value === "object" && Object.keys(value as object).length);
  if (Array.isArray(value)) return value.length > 0;
  return String(value ?? "").trim().length > 0;
}

export function TaskCard({ task, compact }: { task: Task; compact?: boolean }) {
  const done = isSubmittedAnswer(task.status);
  return (
    <article className={`task-card ${compact ? "compact" : ""}`}>
      <div className="task-icon">
        <ChevronRight size={18} />
      </div>
      <div className="task-copy">
        <div className="task-title-line">
          <h3>{task.title}</h3>
          <span className={`status-pill ${done ? "done" : /expir/i.test(task.status) ? "expired" : /draft/i.test(task.status) ? "draft" : "pending"}`}>
            {statusLabel(task.status)}
          </span>
        </div>
        <p>
          {[task.subject, task.room].filter(Boolean).join(" · ") || "Sala do Futuro"}
        </p>
        {task.due ? <span className="task-code">{new Date(task.due).toLocaleDateString("pt-BR")}</span> : null}
      </div>
      <button
        className="task-action"
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("sed:open-task", { detail: task }))}
      >
        {done ? "Ver atividade" : "Resolver"}
        <ChevronRight size={16} />
      </button>
    </article>
  );
}

export function TaskReaderHost() {
  const [task, setTask] = useState<Task | null>(null);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<Task>).detail;
      if (detail) setTask(detail);
    };
    window.addEventListener("sed:open-task", onOpen as EventListener);
    return () => window.removeEventListener("sed:open-task", onOpen as EventListener);
  }, []);
  if (!task) return null;
  return <TaskReaderModal task={task} onClose={() => setTask(null)} />;
}

function TaskReaderModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { session } = useStudent();
  const demo = !!session?.demo;
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [details, setDetails] = useState<unknown>(demo ? DEMO_TASK_DETAILS : null);
  const [phase, setPhase] = useState<"loading" | "ready" | "verifying" | "success" | "error">(demo ? "success" : "loading");
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "error" | "ok">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [help, setHelp] = useState<Record<string, string>>({});
  const questions = useMemo(() => extractTaskQuestions(details), [details]);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setPhase("loading");
    fetchCaptchaChallenge()
      .then((data) => {
        if (!cancelled) {
          setChallenge(data);
          setPhase("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPhase("error");
          setMessage(err instanceof Error ? err.message : "Não foi possível carregar o CAPTCHA.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [demo, task.id]);

  const imageSrc = challenge?.image
    ? challenge.image.startsWith("data:")
      ? challenge.image
      : `data:image/png;base64,${challenge.image}`
    : "";
  const statement = extractStatement(details) || task.title;

  async function refreshCaptcha() {
    setPhase("loading");
    setMessage("");
    try {
      setChallenge(await fetchCaptchaChallenge());
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Não foi possível gerar um novo CAPTCHA.");
    }
  }

  async function verify() {
    if (!challenge || !answer.trim()) {
      setMessage("Digite o código exibido na imagem.");
      setPhase("error");
      return;
    }
    setPhase("verifying");
    setMessage("");
    try {
      const token = await verifyCaptcha(challenge, answer);
      setCaptchaToken(token);
      const payload = await fetchTaskDetails(task.id || "", task.room, token, challenge.sessionKey, challenge.captchaCookie);
      setDetails(payload);
      setPhase("success");
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Não foi possível validar o CAPTCHA.");
    }
  }

  async function send() {
    const answerable = questions.filter((q) => q.type !== "info");
    const missing = answerable.filter((q) => !hasAnswer(answers[q.id], q.type));
    if (!answerable.length) {
      setSubmitState("error");
      setSubmitMessage("A atividade não retornou questões respondíveis.");
      return;
    }
    if (missing.length) {
      setSubmitState("error");
      setSubmitMessage(`Preencha todas as questões antes de enviar. Faltam ${missing.length}.`);
      return;
    }
    if (!window.confirm("Você revisou suas respostas e deseja enviar a atividade para a Sala do Futuro?")) return;
    if (demo) {
      setSubmitState("ok");
      setSubmitMessage("Demonstração: o envio real só acontece com login da SED.");
      return;
    }
    setSubmitState("saving");
    try {
      const packed = Object.fromEntries(
        answerable.map((q) => [
          q.id,
          { question_type: q.rawType || q.type, answer: answers[q.id] },
        ]),
      );
      await submitTask({
        task_id: task.id,
        room_name: task.room,
        answers: packed,
        captcha_token: captchaToken,
      });
      setSubmitState("ok");
      setSubmitMessage("Atividade enviada com sucesso para a Sala do Futuro.");
    } catch (err) {
      setSubmitState("error");
      setSubmitMessage(err instanceof Error ? err.message : "Não foi possível enviar a atividade.");
    }
  }

  async function requestHelp(question: TaskQuestion) {
    setHelp((prev) => ({ ...prev, [question.id]: "Consultando o tutor..." }));
    try {
      const text = demo
        ? "Pista: relacione o trecho ao Realismo — o olhar crítico sobre a sociedade e a ironia do narrador são o caminho."
        : await askQuestionHelp({
            statement: question.statement,
            options: question.options,
            type: question.type,
          });
      setHelp((prev) => ({ ...prev, [question.id]: text || "A IA não retornou uma resposta." }));
    } catch (err) {
      setHelp((prev) => ({
        ...prev,
        [question.id]: err instanceof Error ? err.message : "Não foi possível pedir ajuda agora.",
      }));
    }
  }

  return (
    <div className="task-modal-backdrop" onClick={onClose}>
      <div className="task-reader-modal" onClick={(e) => e.stopPropagation()}>
        <header className="task-reader-header">
          <div>
            <span className="eyebrow">Sala do Futuro</span>
            <h2>{task.title}</h2>
            <p>{[task.subject, task.room].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {phase !== "success" ? (
          <div className="captcha-panel">
            <div className="captcha-intro">
              <div className="captcha-badge">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3>Confirme que é você</h3>
                <p>A Sala do Futuro pede um CAPTCHA antes de abrir o enunciado.</p>
              </div>
            </div>
            {phase === "loading" || phase === "verifying" ? (
              <div className="captcha-loading">
                <span className="loader-ring" />
                {phase === "verifying" ? "Validando código..." : "Carregando CAPTCHA..."}
              </div>
            ) : (
              <>
                <div className="captcha-image-wrap">
                  {imageSrc ? <img className="captcha-image" src={imageSrc} alt="CAPTCHA" /> : <span>Imagem indisponível</span>}
                  <button className="captcha-refresh-button" type="button" onClick={() => void refreshCaptcha()} aria-label="Atualizar CAPTCHA">
                    <RefreshCw size={16} />
                  </button>
                </div>
                <label className="captcha-label" htmlFor="captcha-answer">
                  Código da imagem
                </label>
                <div className="captcha-input-row">
                  <input
                    id="captcha-answer"
                    className="captcha-input"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                  <button className="login-submit captcha-submit" type="button" onClick={() => void verify()}>
                    Continuar
                  </button>
                </div>
                {message ? (
                  <div className="captcha-error-block">
                    <p className="captcha-error-message">{message}</p>
                    <button className="captcha-retry-button" type="button" onClick={() => void refreshCaptcha()}>
                      Gerar outro CAPTCHA e tentar novamente
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="statement-panel">
            <div className="statement-toolbar">
              <span className="verified-pill">
                <ShieldCheck size={14} /> Acesso verificado
              </span>
              <span className="statement-id">#{task.id}</span>
            </div>
            <article className="statement-card">
              <div className="statement-kicker">
                Enunciado
                <span className="statement-spark">
                  <Sparkles size={14} />
                </span>
              </div>
              <h3>{task.title}</h3>
              <div className="statement-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(statement) }} />
            </article>
            <div className="task-question-list">
              <div className="question-list-heading">
                <h3>Questões</h3>
                <span className="question-list-note">{questions.length} questões</span>
              </div>
              {questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  index={index}
                  question={question}
                  value={answers[question.id]}
                  help={help[question.id]}
                  onChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
                  onHelp={() => void requestHelp(question)}
                />
              ))}
            </div>
            {submitMessage ? (
              <div className={`submit-feedback ${submitState === "ok" ? "success" : ""}`}>{submitMessage}</div>
            ) : null}
            <div className="statement-actions">
              <span className="token-note">Revise antes de enviar. O tutor explica, mas você confirma as respostas.</span>
              <button className="submit-task-button" type="button" disabled={submitState === "saving"} onClick={() => void send()}>
                {submitState === "saving" ? "Enviando..." : "Enviar atividade"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  value,
  help,
  onChange,
  onHelp,
}: {
  index: number;
  question: TaskQuestion;
  value: unknown;
  help?: string;
  onChange: (value: unknown) => void;
  onHelp: () => void;
}) {
  return (
    <article className={`task-question-card ${question.type === "info" ? "info" : ""}`}>
      <div className="question-card-top">
        <span className="question-number">Questão {index + 1}</span>
        <span className="question-type">{question.type}</span>
      </div>
      <div className="question-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.statement || "Sem enunciado.") }} />
      {question.type === "single" || question.type === "multi" ? (
        <div className="question-options">
          {question.options.map((opt) => {
            const selected = question.type === "multi"
              ? Array.isArray(value) && value.includes(opt.id)
              : value === opt.id;
            return (
              <label key={opt.id} className={`question-option ${selected ? "selected" : ""}`}>
                <input
                  type={question.type === "multi" ? "checkbox" : "radio"}
                  checked={selected}
                  onChange={() => {
                    if (question.type === "multi") {
                      const current = Array.isArray(value) ? [...value] : [];
                      onChange(current.includes(opt.id) ? current.filter((id) => id !== opt.id) : [...current, opt.id]);
                    } else onChange(opt.id);
                  }}
                />
                <span>{opt.text}</span>
              </label>
            );
          })}
        </div>
      ) : question.type === "true-false" ? (
        <div className="true-false-list">
          {(question.options.length ? question.options : [{ id: "item", text: "Afirmação" }]).map((opt) => {
            const rec = (value && typeof value === "object" ? value : {}) as Record<string, string>;
            return (
              <div className="true-false-row" key={opt.id}>
                <span>{opt.text}</span>
                <div className="true-false-actions">
                  {["Certo", "Errado"].map((label) => (
                    <label key={label}>
                      <input
                        type="radio"
                        checked={rec[opt.id] === label}
                        onChange={() => onChange({ ...rec, [opt.id]: label })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : question.type === "order" ? (
        <div className="order-list">
          {(Array.isArray(value) ? (value as string[]) : question.options.map((o) => o.text)).map((item, i, arr) => (
            <div className="order-item" key={`${item}-${i}`}>
              <span>{i + 1}.</span>
              <span>{item}</span>
              <button
                type="button"
                className="help-button"
                disabled={i === 0}
                onClick={() => {
                  const next = [...arr];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
              >
                Subir
              </button>
            </div>
          ))}
        </div>
      ) : question.type === "fill" ? (
        <div className="fill-row">
          {(question.options.length ? question.options : [{ id: "0", text: "Lacuna 1" }]).map((opt, i) => {
            const rec = (value && typeof value === "object" ? value : {}) as Record<string, string>;
            return (
              <input
                key={opt.id}
                placeholder={opt.text || `Lacuna ${i + 1}`}
                value={rec[opt.id] || ""}
                onChange={(e) => onChange({ ...rec, [opt.id]: e.target.value })}
              />
            );
          })}
        </div>
      ) : question.type !== "info" ? (
        <textarea
          className="task-answer-textarea"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva sua resposta"
        />
      ) : null}
      {question.type !== "info" ? (
        <div className="statement-actions" style={{ marginTop: 14 }}>
          <button className="help-button" type="button" onClick={onHelp}>
            <Sparkles size={14} /> Pedir ajuda do tutor
          </button>
        </div>
      ) : null}
      {help ? <div className="help-card">{simpleMarkdown(help)}</div> : null}
    </article>
  );
}
