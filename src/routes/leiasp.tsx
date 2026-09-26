import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Loader2, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const title = "LeiaSP — EduX";
const description = "Biblioteca LeiaSP integrada diretamente ao EduX.";
const API = "/api/public/sdf";
const SESSION_KEY = "sed_sessao";

type Session = {
  nome?: string;
  apelido?: string;
  email?: string;
  cdUsuario?: number;
  cdUsuarioCurto?: string;
  token?: string;
  token2?: string;
};

type Book = {
  id: number;
  title: string;
  author: string;
  total_pages: number;
  current_page: number;
  progress: number;
  is_complete: boolean;
  cover_url?: string;
  level?: string;
};

export const Route = createFileRoute("/leiasp")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: LeiaSPPage,
});

function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as Session | null;
  } catch {
    return null;
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const session = readSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (session?.token) headers.set("X-Token", session.token);
  if (session?.token2) headers.set("X-Token2", session.token2);
  if (session?.cdUsuarioCurto) headers.set("X-Cd-Usuario", session.cdUsuarioCurto);
  if (session?.apelido) headers.set("X-Task-User", session.apelido);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || data.error || `Falha na API (${response.status})`);
  return data;
}

function LeiaSPPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    const current = readSession();
    setSession(current);
    if (!current?.token) {
      setError("Faça login no EduX para acessar o LeiaSP.");
      setLoading(false);
      return;
    }
    try {
      const [library, profile] = await Promise.all([
        apiFetch("/leiasp/books"),
        apiFetch("/leiasp/student").catch(() => ({ stats: {} })),
      ]);
      setBooks(library.books || []);
      setStats(profile.stats || {});
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Não foi possível carregar o LeiaSP.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const completed = useMemo(() => books.filter((book) => book.is_complete).length, [books]);

  const startReading = async (book: Book) => {
    setReadingId(book.id);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch("/leiasp/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: book.id,
          current_page: book.current_page,
          total_pages: book.total_pages,
        }),
      });
      setMessage(result.message || `Leitura de “${book.title}” iniciada.`);
      await load();
    } catch (readError) {
      setError(
        readError instanceof Error ? readError.message : "Não foi possível iniciar a leitura.",
      );
    } finally {
      setReadingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <a
            href="/plataformas"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <ArrowLeft size={17} aria-hidden="true" /> Plataformas
          </a>
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
            <BookOpen size={18} aria-hidden="true" /> LeiaSP
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400/50 hover:text-white"
          >
            <RefreshCw size={14} aria-hidden="true" /> Atualizar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <section className="mb-8 grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900 to-slate-900 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-400 p-3 text-slate-950">
                <UserRound size={25} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                  Aluno logado
                </p>
                <h1 className="mt-1 text-2xl font-bold">
                  {session?.nome || session?.apelido || "Aluno"}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {session?.email || "Sessão EduX ativa"}
                </p>
                {session?.cdUsuario && (
                  <p className="mt-2 text-xs text-slate-500">
                    Código do aluno: {session.cdUsuario}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <Sparkles size={18} aria-hidden="true" />
              <span className="text-sm font-semibold">Resumo da biblioteca</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <strong className="text-3xl">{books.length}</strong>
                <p className="text-xs text-slate-500">livros encontrados</p>
              </div>
              <div>
                <strong className="text-3xl">{completed}</strong>
                <p className="text-xs text-slate-500">concluídos</p>
              </div>
            </div>
            {typeof stats.Points === "number" && (
              <p className="mt-4 text-xs text-slate-400">
                Pontos LeiaSP: <span className="font-semibold text-white">{stats.Points}</span>
              </p>
            )}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
          >
            {message}
          </div>
        )}

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                Minha biblioteca
              </p>
              <h2 className="mt-1 text-2xl font-bold">Livros do LeiaSP</h2>
            </div>
            <span className="text-sm text-slate-500">Clique em um livro para iniciar</span>
          </div>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={20} /> Carregando biblioteca...
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-400">
              Nenhum livro foi encontrado na biblioteca deste aluno.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => void startReading(book)}
                  disabled={readingId !== null}
                  className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-left transition hover:-translate-y-1 hover:border-cyan-400/50 disabled:cursor-wait disabled:opacity-70"
                >
                  <div className="flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-400/20 to-slate-800">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <BookOpen className="text-cyan-300" size={48} aria-hidden="true" />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-bold uppercase text-cyan-300">
                        {book.level || "Leitura"}
                      </span>
                      <span className="text-xs text-slate-500">{Math.round(book.progress)}%</span>
                    </div>
                    <h3 className="line-clamp-2 font-bold text-white">{book.title}</h3>
                    <p className="mt-1 truncate text-xs text-slate-500">{book.author}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${Math.min(100, Math.max(0, book.progress))}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-cyan-300">
                      {readingId === book.id
                        ? "Iniciando leitura..."
                        : book.is_complete
                          ? "Ler novamente"
                          : book.current_page > 0
                            ? "Continuar leitura"
                            : "Iniciar leitura"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
