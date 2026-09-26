import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ExternalLink, GraduationCap, Server, Sparkles } from "lucide-react";

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
  const leiaspUrl = import.meta.env.VITE_LEIASP_URL?.trim() || "http://localhost:8080";
  const hasConfiguredUrl = Boolean(import.meta.env.VITE_LEIASP_URL?.trim());

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  EduX
                </p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Plataformas</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-slate-400">
              Ferramentas de aprendizagem conectadas ao seu espaço estudantil.
            </p>
          </div>
          <a
            href={leiaspUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-white"
          >
            Abrir LeiaSP em nova aba <ExternalLink size={16} aria-hidden="true" />
          </a>
        </header>

        <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-slate-900 to-slate-900 p-5 shadow-2xl shadow-cyan-950/20 sm:p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-cyan-400 p-3 text-slate-950">
                <BookOpen size={25} aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold">LeiaSP</h2>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    Integrado
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                  Biblioteca de leitura com acompanhamento de progresso e recursos de leitura
                  humanizada.
                </p>
              </div>
            </div>
            <Sparkles className="text-cyan-300" size={22} aria-hidden="true" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/70">
            {hasConfiguredUrl ? (
              <iframe
                title="LeiaSP integrado ao EduX"
                src={leiaspUrl}
                className="h-[min(72vh,720px)] w-full border-0"
                allow="fullscreen"
              />
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <Server className="mb-4 text-cyan-300" size={32} aria-hidden="true" />
                <h3 className="text-lg font-semibold">Backend LeiaSP pronto para iniciar</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Configure{" "}
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-200">
                    VITE_LEIASP_URL
                  </code>{" "}
                  com a URL pública do backend LeiaSP para exibir a plataforma aqui.
                </p>
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left font-mono text-xs leading-6 text-slate-300">
                  <div>cd integrations/leiasp</div>
                  <div>pip install -r requirements.txt</div>
                  <div>python app.py</div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Por padrão, o LeiaSP ficará disponível em http://localhost:8080.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
