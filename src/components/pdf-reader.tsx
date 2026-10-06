import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { pdfProxyUrl, type Book, type GradePack } from "@/lib/sed/apostilas";
import { researchTopic } from "@/lib/sed/client";
import { simpleMarkdown } from "./page-ui";

export function PdfReader({
  pack,
  book,
  onClose,
}: {
  pack: GradePack;
  book: Book;
  onClose: () => void;
}) {
  const src = pdfProxyUrl(pack.repoPath, book.file);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");

  async function summarize() {
    setSummarizing(true);
    setError("");
    try {
      const text = await researchTopic({
        topic: `Resuma de forma didática a apostila escolar "${book.title}" do ${pack.grade}, destacando os eixos principais, vocabulário essencial e uma rota de estudo em 8 tópicos.`,
      });
      setSummary(text || "Não foi possível resumir este material agora.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resumir este PDF.");
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="pdf-reader-backdrop" onClick={onClose}>
      <div className="pdf-reader-modal" onClick={(e) => e.stopPropagation()}>
        <header className="pdf-reader-header">
          <div>
            <span className="eyebrow">{pack.grade}</span>
            <h2>{book.title}</h2>
            <p>{book.file}</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="pdf-reader-body">
          <div className="pdf-toolbar">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior">
              <ChevronLeft size={16} />
            </button>
            <input
              value={page}
              onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
              aria-label="Número da página"
            />
            <button type="button" onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="pdf-canvas-wrap">
            <iframe title={book.title} src={`${src}#page=${page}`} style={{ width: "100%", minHeight: "62vh", border: 0, background: "#fff" }} />
          </div>
          <button className="ai-summary-button" type="button" disabled={summarizing} onClick={() => void summarize()}>
            <Sparkles size={16} />
            {summarizing ? "Resumindo material..." : "Resumir com o Flash IA"}
          </button>
          {error ? <p className="pdf-inline-error">{error}</p> : null}
          {summary ? (
            <div className="pdf-summary-card">
              <div className="summary-heading">
                <span>Síntese do material</span>
                <button type="button" onClick={() => setSummary("")} aria-label="Fechar resumo">
                  <X size={14} />
                </button>
              </div>
              {simpleMarkdown(summary)}
            </div>
          ) : null}
          <p className="pdf-reader-note">O PDF é aberto pelo repositório oficial de apostilas, via proxy.</p>
        </div>
      </div>
    </div>
  );
}
