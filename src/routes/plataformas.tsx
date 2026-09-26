import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, GraduationCap, Sparkles } from "lucide-react";

const title = "Plataformas — EduX";
const description = "Acesse as plataformas de aprendizagem integradas ao EduX.";

export const Route = createFileRoute("/plataformas")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: PlataformasPage,
});

function PlataformasPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <a
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            href="/"
          >
            <span aria-hidden="true">←</span> Voltar ao painel
          </a>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-300">
              <GraduationCap size={26} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">EduX</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Plataformas</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-slate-400">
            Escolha uma plataforma de aprendizagem para continuar seus estudos.
          </p>
        </header>

        <a
          href="/leiasp"
          className="group block rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 via-slate-900 to-slate-900 p-6 shadow-2xl shadow-cyan-950/20 transition hover:-translate-y-1 hover:border-cyan-300/60 hover:shadow-cyan-950/40 sm:p-8"
          aria-label="Abrir plataforma LeiaSP"
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-400 p-3 text-slate-950">
                <BookOpen size={28} aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold">LeiaSP</h2>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    Integrado
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Consulte seus dados de aluno, veja seus livros e acompanhe sua leitura em uma
                  página dedicada.
                </p>
              </div>
            </div>
            <Sparkles className="text-cyan-300" size={22} aria-hidden="true" />
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-4 text-sm text-slate-300 transition group-hover:border-cyan-400/30 group-hover:text-white">
            <span>Entrar na plataforma LeiaSP</span>
            <ArrowRight
              size={19}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            />
          </div>
        </a>
      </div>
    </main>
  );
}
