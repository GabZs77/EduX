import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Maximize2 } from "lucide-react";

const title = "LeiaSP — EduX";
const description = "Biblioteca LeiaSP integrada ao EduX.";

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

function LeiaSPPage() {
  const leiaspUrl = import.meta.env.VITE_LEIASP_URL?.trim() || "http://localhost:8080";
  const hasConfiguredUrl = Boolean(import.meta.env.VITE_LEIASP_URL?.trim());

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
        <a
          href="/plataformas"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Voltar para Plataformas
        </a>
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
          <span className="rounded-lg bg-cyan-400/15 px-2 py-1">EduX</span>
          <span className="text-slate-500">/</span>
          <span>LeiaSP</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={leiaspUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-white"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Nova aba
          </a>
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
            <Maximize2 size={13} aria-hidden="true" /> Tela cheia
          </span>
        </div>
      </header>

      <section className="relative flex min-h-0 flex-1 flex-col bg-[#080d14]">
        {hasConfiguredUrl ? (
          <iframe
            title="LeiaSP — informações do aluno e biblioteca"
            src={leiaspUrl}
            className="min-h-[calc(100vh-65px)] w-full flex-1 border-0"
            allow="fullscreen"
          />
        ) : (
          <div className="m-auto max-w-xl px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/15 text-2xl text-cyan-300">
              L
            </div>
            <h1 className="text-2xl font-bold">LeiaSP pronto para iniciar</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Inicie o backend LeiaSP em uma URL acessível pelo navegador e configure
              <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-cyan-200">
                VITE_LEIASP_URL
              </code>
              para carregar nesta tela o aluno logado, a biblioteca e a leitura dos livros.
            </p>
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-left font-mono text-xs leading-6 text-slate-300">
              <div>cd integrations/leiasp</div>
              <div>pip install -r requirements.txt</div>
              <div>python app.py</div>
            </div>
            <a
              href={leiaspUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Abrir LeiaSP <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
