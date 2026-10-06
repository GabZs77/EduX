/** Student-facing task status helpers for Sala do Futuro / EduSP. */

const SUBMITTED_RE = /^(submitted|finished|completed|complete|done)$/i;
const OPEN_RE = /pending|draft|expir|todo|open|rascunho/i;

export function studentAnswerStatus(task: Record<string, unknown> | null | undefined): string {
  const nested = task?.answer && typeof task.answer === "object" ? (task.answer as Record<string, unknown>) : null;
  const raw = task?.answer_status ?? task?.answerStatus ?? nested?.status;
  if (raw == null) return "pending";
  const value = String(raw).trim();
  if (!value || /^(null|undefined|none|n\/a)$/i.test(value)) return "pending";
  return value;
}

export function isSubmittedAnswer(status: string | null | undefined): boolean {
  return SUBMITTED_RE.test(String(status || "").trim());
}

export function isOpenTask(status: string | null | undefined): boolean {
  const value = String(status || "pending").trim();
  if (OPEN_RE.test(value)) return true;
  if (isSubmittedAnswer(value)) return false;
  return true;
}
