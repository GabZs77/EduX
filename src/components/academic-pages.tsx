import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Info,
  ListChecks,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { APOSTILAS } from "@/lib/sed/apostilas";
import { currentSchoolBimestre, summarizeAttendanceYear } from "@/lib/sed/attendance";
import {
  fetchAgenda,
  fetchBoletim,
  fetchFrequencia,
  fetchNotas,
  firstName,
  fmtNota,
  isOpenTask,
  sendAssistantMessage,
  weekdayShort,
  workday,
} from "@/lib/sed/client";
import type { AgendaEvent, Avaliacao, BoletimRow, FrequenciaBimestre, Task } from "@/lib/sed/types";
import { PageHeading, simpleMarkdown, StatCard, StateCard } from "./page-ui";
import { PdfReader } from "./pdf-reader";
import { useStudent } from "./student-context";
import { TaskCard, TaskReaderHost } from "./task-reader";

function uniqueDays(events: AgendaEvent[]) {
  const seen = new Map<string, AgendaEvent[]>();
  events.forEach((event) => {
    if (!event.data) return;
    const list = seen.get(event.data) || [];
    list.push(event);
    seen.set(event.data, list);
  });
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function HomePage() {
  const { session, dashboard, loading, error, refresh } = useStudent();
  const today = new Date();
  const tasks = (dashboard?.tarefas ?? []).filter((task) => isOpenTask(task.status));
  const agenda = dashboard?.agenda ?? [];
  const todayKey = today.toISOString().slice(0, 10);
  const todayEvents = agenda.filter((item) => item.data === todayKey && item.tipo !== "evento");
  const tasksFailed = dashboard?.tarefasApiOk === false;

  return (
    <div className="dashboard-page page-stack">
      <PageHeading
        eyebrow={workday(today) ? "Rotina de hoje" : "Próximo passo"}
        title={`Olá, ${firstName(session?.nome)}.`}
        description={
          workday(today)
            ? "Sua rotina escolar organizada para você."
            : "Hoje não há aulas em dia útil. Consulte os próximos compromissos."
        }
        onRefresh={() => void refresh()}
        spinning={loading}
      />
      <section className="welcome-strip">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h2>Continue no seu ritmo.</h2>
          <p>Veja rapidamente o que merece sua atenção agora.</p>
        </div>
        <Zap size={27} />
      </section>
      {error ? <StateCard error title="Não foi possível atualizar" message={error} actionLabel="Tentar de novo" onAction={() => void refresh()} /> : null}
      <section className="stat-grid">
        <Link to="/tarefas" className="stat-link">
          <StatCard icon={<ListChecks size={16} />} label="Tarefas pendentes" value={String(tasks.length)} note={tasks.length ? "Toque para conferir" : "Tudo em dia"} />
        </Link>
        <Link to="/presenca" className="stat-link">
          <StatCard icon={<CalendarClock size={16} />} label="Faltas no bimestre" value={String(dashboard?.faltas ?? "—")} note="% de faltas" tone="amber" />
        </Link>
        <Link to="/agenda" className="stat-link">
          <StatCard icon={<CalendarDays size={16} />} label="Aulas de hoje" value={String(todayEvents.length)} note={workday(today) ? "Agenda do dia" : "Dia não útil"} tone="cyan" />
        </Link>
        <Link to="/inteligencia-artificial" className="stat-link">
          <StatCard icon={<Sparkles size={16} />} label="Flash IA" value="Tutor" note="Tire dúvidas agora" tone="green" />
        </Link>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Pendências</h2>
          <Link to="/tarefas" className="text-link">
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>
        {tasks.length ? (
          <div className="task-preview-list">
            {tasks.slice(0, 3).map((task) => (
              <TaskCard key={String(task.id)} task={task} compact />
            ))}
          </div>
        ) : (
          <StateCard
            error={tasksFailed}
            title={tasksFailed ? "Não foi possível carregar as tarefas" : "Nenhuma pendência encontrada"}
            message={
              tasksFailed
                ? "A Sala do Futuro não devolveu a lista agora. Atualize a página para tentar de novo."
                : "Quando uma atividade precisar da sua atenção, ela aparecerá aqui."
            }
            actionLabel={tasksFailed ? "Tentar de novo" : undefined}
            onAction={tasksFailed ? () => void refresh() : undefined}
          />
        )}
      </section>
      <section className="section-block">
        <div className="section-heading">
          <h2>Agenda de hoje</h2>
          <CalendarDays size={18} />
        </div>
        {todayEvents.length ? (
          <AgendaList items={todayEvents} />
        ) : (
          <StateCard
            title={workday(today) ? "Nenhuma aula encontrada para hoje" : "Hoje não é dia útil"}
            message={workday(today) ? "Quando houver aulas lançadas na agenda oficial, elas aparecerão neste espaço." : "A agenda de aulas é exibida de segunda a sexta-feira."}
          />
        )}
      </section>
      <TaskReaderHost />
    </div>
  );
}

function AgendaList({ items }: { items: AgendaEvent[] }) {
  return (
    <div className="agenda-list">
      {items.map((item) => (
        <article key={item.id} className={`agenda-card ${item.tipo === "intervalo" ? "compact" : ""}`}>
          <div className="time-column">
            <strong>{item.horaInicio || "--:--"}</strong>
            <span>{item.horaFim || ""}</span>
          </div>
          <div className="agenda-line">
            <span className="agenda-dot" />
            <span className="agenda-connector" />
          </div>
          <div className="agenda-card-copy">
            <h3>{item.nomeDisciplina}</h3>
            <p>{item.descricaoTurma || (item.tipo === "evento" ? "Evento escolar" : "Aula")}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AgendaPage() {
  const { dashboard, loading, refresh } = useStudent();
  const [events, setEvents] = useState<AgendaEvent[]>(dashboard?.agenda ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = uniqueDays(events);
  const [selected, setSelected] = useState(days[0]?.[0] || "");

  useEffect(() => {
    if (dashboard?.agenda?.length) {
      setEvents(dashboard.agenda);
      const next = uniqueDays(dashboard.agenda);
      if (next[0] && !selected) setSelected(next[0][0]);
    }
  }, [dashboard, selected]);

  async function reload() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchAgenda();
      const list = result.data || [];
      setEvents(list);
      const next = uniqueDays(list);
      if (next[0]) setSelected(next[0][0]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a agenda.");
    } finally {
      setBusy(false);
    }
  }

  const current = days.find(([day]) => day === selected)?.[1] || [];

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Horários"
        title="Agenda da semana"
        description="Aulas e eventos escolares dos próximos dias úteis."
        onRefresh={() => void reload()}
        spinning={busy || loading}
      />
      {error ? <StateCard error title="Agenda indisponível" message={error} actionLabel="Tentar de novo" onAction={() => void reload()} /> : null}
      <section className="agenda-selector">
        <div className="section-heading">
          <h2>Dias úteis</h2>
          <span className="agenda-total">{days.length} dias</span>
        </div>
        <div className="day-tabs">
          {days.slice(0, 5).map(([day, list]) => (
            <button key={day} type="button" className={day === selected ? "selected" : ""} onClick={() => setSelected(day)}>
              <strong>{weekdayShort(day)}</strong>
              <span>{day.slice(8)}</span>
              <em style={{ fontSize: 9, fontStyle: "normal", opacity: 0.7 }}>{list.length}</em>
            </button>
          ))}
        </div>
      </section>
      <section className="agenda-panel">
        {current.length ? <AgendaList items={current} /> : <StateCard title="Nenhuma aula neste dia" message="Quando houver aulas lançadas na agenda oficial, elas aparecerão neste espaço." />}
      </section>
      <p className="data-note">
        <Info size={14} /> A agenda de aulas é exibida de segunda a sexta-feira.
      </p>
    </div>
  );
}

export function PresencaPage() {
  const { dashboard, loading } = useStudent();
  const systemBimestre = currentSchoolBimestre();
  const [rows, setRows] = useState<FrequenciaBimestre[]>([]);
  const [faltas, setFaltas] = useState<number | null>(dashboard?.faltas ?? null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [periodoSelecionado, setPeriodoSelecionado] = useState<1 | 2 | 3 | 4 | "year">(() =>
    (systemBimestre >= 1 && systemBimestre <= 4 ? systemBimestre : 1) as 1 | 2 | 3 | 4,
  );

  async function reload() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchFrequencia();
      const listedRows = result.data || [];
      setRows(listedRows);
      setFaltas(result.faltasBimestreAtual ?? result.faltas ?? null);
      const latestListed = [...listedRows]
        .filter((row) => row.aulasDadas > 0 || row.faltas > 0)
        .sort((a, b) => b.bimestre - a.bimestre)[0];
      if (latestListed && typeof periodoSelecionado === "number" && !listedRows.some((row) => row.bimestre === periodoSelecionado && row.aulasDadas > 0)) {
        setPeriodoSelecionado(latestListed.bimestre as 1 | 2 | 3 | 4);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a frequência.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const annual = summarizeAttendanceYear(rows);
  const selectedRow = typeof periodoSelecionado === "number" ? rows.find((row) => row.bimestre === periodoSelecionado) : null;
  const futureBimestre = typeof periodoSelecionado === "number" && periodoSelecionado > systemBimestre;
  const hasSelectedBimestreData = Boolean(selectedRow && selectedRow.aulasDadas > 0 && selectedRow.frequencia !== null);
  const selectedPercent = periodoSelecionado === "year" ? annual.frequencia : selectedRow?.frequencia ?? null;
  const selectedLabel = periodoSelecionado === "year" ? "Ano Inteiro" : `${periodoSelecionado}º Bimestre`;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Frequência"
        title="Presença"
        description="Acompanhe faltas, aulas dadas e o percentual de presença por bimestre."
        onRefresh={() => void reload()}
        spinning={busy || loading}
      />
      {error ? <StateCard error title="Frequência indisponível" message={error} actionLabel="Tentar de novo" onAction={() => void reload()} /> : null}

      {periodoSelecionado === "year" ? (
        !busy ? (
          <section className="progress-card attendance-period-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Ano inteiro · todos os bimestres</span>
                <h2>Ano Inteiro</h2>
              </div>
              <strong>{annual.frequencia != null ? `${annual.frequencia}%` : "—"}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.max(0, Math.min(100, annual.frequencia ?? 0))}%` }} />
            </div>
            <p className="data-note">
              <Info size={14} />
              {annual.aulasDadas > 0
                ? `${annual.presencas} presenças e ${annual.faltas} faltas em ${annual.aulasDadas} aulas, somando os bimestres disponíveis deste ano.`
                : "Ainda não há aulas lançadas neste ano letivo para calcular o percentual."}
            </p>
          </section>
        ) : null
      ) : futureBimestre ? (
        <StateCard title={`${selectedLabel} ainda não está pronto`} message="Esse bimestre ainda não começou no calendário escolar deste ano." />
      ) : !busy && !hasSelectedBimestreData ? (
        <StateCard title={`${selectedLabel} ainda não está pronto`} message="A frequência desse bimestre ainda não foi disponibilizada pela SED." />
      ) : selectedRow ? (
        <>
          <section className="stat-grid attendance-stats">
            <StatCard icon={<CalendarClock size={16} />} label="Faltas no bimestre" value={String(selectedRow.faltas ?? faltas ?? "—")} note="Lançadas na SED" tone="amber" />
            <StatCard icon={<CalendarDays size={16} />} label="Aulas dadas" value={String(selectedRow.aulasDadas)} note="No período selecionado" tone="cyan" />
            <StatCard icon={<ListChecks size={16} />} label="Presença" value={selectedRow.frequencia != null ? `${selectedRow.frequencia}%` : "—"} note="Média das disciplinas" tone="green" />
            <StatCard icon={<BookOpen size={16} />} label="Disciplinas" value={String(selectedRow.disciplinas.length)} note="Com lançamento" />
          </section>
          <section className="progress-card">
            <div className="section-heading">
              <h2>{selectedLabel}</h2>
              <strong>{selectedPercent != null ? `${selectedPercent}%` : "—"}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${Math.max(0, Math.min(100, selectedPercent ?? 0))}%` }} />
            </div>
          </section>
        </>
      ) : null}

      <div className="period-tabs attendance-period-tabs" role="group" aria-label="Período de presença">
        {[1, 2, 3, 4].map((bimestre) => (
          <button key={bimestre} type="button" aria-pressed={periodoSelecionado === bimestre} className={periodoSelecionado === bimestre ? "active" : ""} onClick={() => setPeriodoSelecionado(bimestre as 1 | 2 | 3 | 4)}>
            {bimestre}º Bimestre
          </button>
        ))}
        <button type="button" aria-pressed={periodoSelecionado === "year"} className={periodoSelecionado === "year" ? "active" : ""} onClick={() => setPeriodoSelecionado("year")}>
          Ano Inteiro
        </button>
      </div>

      {!busy && periodoSelecionado !== "year" && selectedRow && hasSelectedBimestreData ? (
        <div className="period-list">
          {selectedRow.disciplinas.map((item) => (
            <article className="period-card" key={item.nomeDisciplina}>
              <div>
                <h3>{item.nomeDisciplina}</h3>
                <p>{item.faltas} faltas · {item.presencas} presenças</p>
              </div>
              <strong>{item.frequencia != null ? `${item.frequencia}%` : "—"}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BoletimPage() {
  const [rows, setRows] = useState<BoletimRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"1" | "2" | "3" | "4" | "final">("3");

  async function reload() {
    setBusy(true);
    setError("");
    try {
      const [boletim, notas] = await Promise.all([fetchBoletim(), fetchNotas()]);
      setRows(boletim.data?.length ? boletim.data : notas.boletim || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o boletim.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = rows.filter((row) => {
    if (tab === "final") return /média final|media final/i.test(row.bimestre);
    return String(row.bimestreNumero) === tab || row.bimestre.startsWith(`${tab}º`);
  });

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Boletim"
        title="Boletim"
        description="Consulte notas, faltas e médias finais por disciplina e bimestre."
        onRefresh={() => void reload()}
        spinning={busy}
      />
      {error ? <StateCard error title="Boletim indisponível" message={error} actionLabel="Tentar de novo" onAction={() => void reload()} /> : null}
      <div className="period-tabs">
        {(["1", "2", "3", "4", "final"] as const).map((key) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {key === "final" ? "Média" : `${key}º Bim`}
          </button>
        ))}
      </div>
      <div className="grade-head">
        <span>Disciplina</span>
        <span>Faltas</span>
        <span>Nota</span>
      </div>
      {filtered.length ? (
        <div className="grade-list">
          {filtered.map((row) => {
            const nota = row.nota;
            const tone = nota == null ? "" : nota >= 6 ? "positive" : "warning";
            return (
              <article className="grade-card" key={row.id}>
                <span className="subject-star">
                  <Star size={14} />
                </span>
                <div className="grade-copy">
                  <h3>{row.nomeDisciplina}</h3>
                  <p>{row.descricaoTurma || row.bimestre}</p>
                </div>
                <div className="grade-value">{row.faltas ?? "—"}</div>
                <div className={`grade-value ${tone}`}>{fmtNota(nota)}</div>
              </article>
            );
          })}
        </div>
      ) : (
        <StateCard title="Boletim ainda não disponível" message="Não encontramos notas para este bimestre nas APIs disponíveis para sua sessão." />
      )}
    </div>
  );
}

export function NotasPage() {
  const [rows, setRows] = useState<Avaliacao[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [bimestreSelecionado, setBimestreSelecionado] = useState<number | null>(null);

  async function reload() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchNotas();
      setRows(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as notas.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const bimestres = [...new Set(rows.map((row) => row.bimestre).filter((value): value is number => value !== null))].sort((a, b) => a - b);
  const filtered = bimestreSelecionado === null ? rows : rows.filter((row) => row.bimestre === bimestreSelecionado);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Avaliações"
        title="Notas"
        description="Consulte as notas de provas e trabalhos lançados por disciplina."
        onRefresh={() => void reload()}
        spinning={busy}
      />
      {error ? <StateCard error title="Notas indisponíveis" message={error} actionLabel="Tentar de novo" onAction={() => void reload()} /> : null}
      <div className="period-tabs">
        <button type="button" className={bimestreSelecionado === null ? "active" : ""} onClick={() => setBimestreSelecionado(null)}>
          Todas
        </button>
        {bimestres.map((periodo) => (
          <button key={periodo} type="button" className={bimestreSelecionado === periodo ? "active" : ""} onClick={() => setBimestreSelecionado(periodo)}>
            {periodo}º Bim
          </button>
        ))}
      </div>
      <div className="grade-head">
        <span>Avaliação</span>
        <span>Peso</span>
        <span>Nota</span>
      </div>
      {filtered.length ? (
        <div className="grade-list">
          {filtered.map((row) => {
            const tone = row.nota == null ? "" : row.nota >= 6 ? "positive" : "warning";
            const date = row.data && /^\d{4}-\d{2}-\d{2}/.test(row.data) ? row.data.slice(0, 10).split("-").reverse().join("/") : row.data;
            const detail = [row.disciplina || "Disciplina não informada", date, row.bimestre != null ? `${row.bimestre}º bimestre` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <article className="grade-card" key={row.id}>
                <span className="subject-star">
                  <Star size={14} />
                </span>
                <div className="grade-copy">
                  <h3>{row.prova}</h3>
                  <p>{detail}</p>
                </div>
                <div className="grade-value">{row.peso != null ? `Peso ${row.peso}` : "—"}</div>
                <div className={`grade-value ${tone}`}>{fmtNota(row.nota)}</div>
              </article>
            );
          })}
        </div>
      ) : (
        <StateCard
          title={bimestreSelecionado === null ? "Nenhuma avaliação encontrada" : "Nenhuma nota neste bimestre"}
          message="Quando a escola lançar provas ou trabalhos, as notas aparecerão aqui."
        />
      )}
      <p className="data-note">
        <Info size={14} /> Notas individuais de avaliações. Para consultar o resumo consolidado, acesse a aba Boletim.
      </p>
    </div>
  );
}

export function TarefasPage() {
  const { dashboard, loading, refresh } = useStudent();
  const tasks = dashboard?.tarefas ?? [];
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Sala do Futuro"
        title="Tarefas"
        description="Atividades publicadas para a sua turma. Abra, responda e envie com CAPTCHA."
        onRefresh={() => void refresh()}
        spinning={loading}
      />
      <div className="task-summary">
        <div>
          <span className="stat-label">Pendências</span>
          <strong>{tasks.length}</strong>
          <p>atividades visíveis</p>
        </div>
        <div>
          <span className="stat-label">Status</span>
          <strong>{tasks.filter((t: Task) => isOpenTask(t.status)).length}</strong>
          <p>aguardando envio</p>
        </div>
      </div>
      {tasks.length ? (
        <div className="task-list-full">
          {tasks.map((task) => (
            <TaskCard key={String(task.id)} task={task} />
          ))}
        </div>
      ) : (
        <StateCard title="Nenhuma tarefa encontrada" message="As tarefas publicadas para sua conta aparecerão aqui." />
      )}
      <TaskReaderHost />
    </div>
  );
}

export function ApostilasPage() {
  const [level, setLevel] = useState<"medio" | "fund">("medio");
  const packs = APOSTILAS[level];
  const [grade, setGrade] = useState(packs[0]?.grade || "");
  const current = packs.find((item) => item.grade === grade) || packs[0];
  const [open, setOpen] = useState<{ pack: (typeof packs)[0]; book: (typeof packs)[0]["books"][0] } | null>(null);

  useEffect(() => {
    setGrade(APOSTILAS[level][0]?.grade || "");
  }, [level]);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Materiais"
        title="Apostilas"
        description="Cadernos digitais do ensino fundamental e médio, com leitura e síntese assistida."
      />
      <div className="level-tabs">
        <button type="button" className={level === "medio" ? "active" : ""} onClick={() => setLevel("medio")}>
          Ensino Médio
        </button>
        <button type="button" className={level === "fund" ? "active" : ""} onClick={() => setLevel("fund")}>
          Fundamental
        </button>
      </div>
      <div className="books-layout">
        <aside className="grade-selector">
          <h2>Série</h2>
          <div>
            {packs.map((item) => (
              <button key={item.grade} type="button" className={item.grade === current?.grade ? "active" : ""} onClick={() => setGrade(item.grade)}>
                {item.grade}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
        </aside>
        <section className="book-list">
          <div className="section-heading">
            <h2>{current?.grade}</h2>
            <span className="book-count">{current?.books.length} volumes</span>
          </div>
          {current?.books.map((book) => (
            <button key={book.file} type="button" className="book-card" onClick={() => current && setOpen({ pack: current, book })}>
              <span className="book-cover">
                <BookOpen size={18} />
              </span>
              <div>
                <h3>{book.title}</h3>
                <p>{book.file}</p>
              </div>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      </div>
      {open ? <PdfReader pack={open.pack} book={open.book} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

const SUGGESTIONS = [
  "Explique funções do 2º grau com um exemplo",
  "Como estudar para a prova de História?",
  "Monte um plano de revisão para esta semana",
];

export function IaPage() {
  const { session } = useStudent();
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError("");
    try {
      const reply = session?.demo
        ? demoReply(content)
        : await sendAssistantMessage(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível falar com o tutor agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="Tutor"
        title="Flash IA"
        description="Um assistente escolar para explicar conteúdo, revisar e organizar o estudo."
      />
      <section className="chat-shell">
        <header className="chat-header">
          <div className="chat-avatar">
            <Sparkles size={16} />
          </div>
          <div>
            <strong>Flash IA</strong>
            <span>Tutor escolar</span>
          </div>
          <span className="online-dot">online</span>
        </header>
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon">
                <Sparkles size={22} />
              </div>
              <h2>Como posso te ajudar hoje?</h2>
              <p>Peça uma explicação, um plano de estudo ou uma revisão da matéria.</p>
              <div className="suggestion-row">
                {SUGGESTIONS.map((item) => (
                  <button key={item} type="button" onClick={() => void send(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="message-label">{msg.role === "user" ? "Você" : "Flash IA"}</div>
                <div className="message-bubble">{msg.role === "assistant" ? simpleMarkdown(msg.content) : msg.content}</div>
              </div>
            ))
          )}
          {busy ? (
            <div className="chat-message assistant">
              <div className="message-bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>
        {error ? <p className="chat-error">{error}</p> : null}
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem para a Inteligência Artificial"
            rows={1}
            aria-label="Mensagem para a Inteligência Artificial"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <button className="login-submit chat-send" type="submit" disabled={busy || !draft.trim()} aria-label="Enviar">
            <ChevronRight size={18} />
          </button>
        </form>
        <p className="chat-disclaimer">O tutor explica e organiza o estudo. Você revisa e envia as atividades.</p>
      </section>
    </div>
  );
}

function demoReply(prompt: string) {
  if (/funç|funcao|2º grau|segundo grau/i.test(prompt)) {
    return "## Função do 2º grau\nUma função do 2º grau tem a forma **f(x) = ax² + bx + c**, com a ≠ 0.\n\n- Se **a > 0**, a parábola abre para cima.\n- Se **a < 0**, abre para baixo.\n- O vértice é o ponto de máximo ou mínimo.\n\nExemplo: f(x) = x² - 4x + 3. As raízes são 1 e 3, e o vértice está em x = 2.\n\nDica: treine esboçar o gráfico a partir de a, Δ e o vértice.";
  }
  if (/hist/i.test(prompt)) {
    return "## Plano rápido para História\n1. Liste os eixos do bimestre (capítulos e datas).\n2. Faça uma linha do tempo com 8 marcos.\n3. Para cada marco, escreva causa → evento → consequência.\n4. Resolva 5 questões dissertativas curtas.\n5. Explique o tema em voz alta em 2 minutos.\n\nFoque em relações, não em decorar nomes isolados.";
  }
  return `Olá! Sou o Flash IA.\n\nSobre “${prompt}”, comece assim:\n1. Separe o que você já entende e o que ainda trava.\n2. Peça um exemplo resolvido passo a passo.\n3. Tente refazer sem olhar a resolução.\n\nSe quiser, me envie o enunciado completo que eu te guio.`;
}
