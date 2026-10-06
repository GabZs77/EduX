export type Book = { title: string; file: string };
export type GradePack = { grade: string; repoPath: string; books: Book[] };

export const APOSTILAS: Record<"medio" | "fund", GradePack[]> = {
  medio: [
    {
      grade: "1º Ano",
      repoPath: "EM/1ano",
      books: [
        { title: "Biologia / Física / Química", file: "biologia-fisica-quimica.pdf" },
        { title: "História / Geografia / Inglês", file: "historia-geografia-ingles.pdf" },
        { title: "Português / Matemática", file: "portugues-matematica.pdf" },
      ],
    },
    {
      grade: "2º Ano",
      repoPath: "EM/2ano",
      books: [
        { title: "Biologia / Física / Química", file: "biologia-fisica-quimica.pdf" },
        { title: "História / Geografia / Inglês", file: "historia-geografia-ingles.pdf" },
        { title: "Português / Matemática", file: "portugues-matematica.pdf" },
      ],
    },
    {
      grade: "3º Ano",
      repoPath: "EM/3ano",
      books: [
        { title: "História / Física / Inglês", file: "historia-fisica-ingles.pdf" },
        { title: "Português / Matemática", file: "portugues-matematica.pdf" },
      ],
    },
  ],
  fund: [
    {
      grade: "6º Ano",
      repoPath: "EF/6ano",
      books: [
        { title: "Matemática / Português", file: "portugues-matematica.pdf" },
        { title: "Geografia / História", file: "geografia-historia.pdf" },
        { title: "Ciências / Inglês / Projeto de Vida", file: "ciencias-ingles-projeto-vida.pdf" },
      ],
    },
    {
      grade: "7º Ano",
      repoPath: "EF/7ano",
      books: [
        { title: "Ciências / Inglês / Projeto de Vida", file: "ciencias-ingles-projeto-vida.pdf" },
        { title: "Geografia / História", file: "geografia-historia.pdf" },
        { title: "Matemática / Português", file: "portugues-matematica.pdf" },
      ],
    },
    {
      grade: "8º Ano",
      repoPath: "EF/8ano",
      books: [
        { title: "Ciências / Inglês / Projeto de Vida", file: "ciencias-ingles-projeto-vida.pdf" },
        { title: "Geografia / História", file: "geografia-historia.pdf" },
        { title: "Matemática / Português", file: "portugues-matematica.pdf" },
      ],
    },
    {
      grade: "9º Ano",
      repoPath: "EF/9ano",
      books: [
        { title: "Ciências / Inglês / Projeto de Vida", file: "ciencias-ingles-projeto-vida.pdf" },
        { title: "Geografia / História", file: "geografia-historia.pdf" },
        { title: "Matemática / Português", file: "portugues-matematica.pdf" },
      ],
    },
  ],
};

export const APOSTILA_REPO = "https://raw.githubusercontent.com/GabZs77/Sed/main";

export function pdfProxyUrl(repoPath: string, file: string) {
  const target = `${APOSTILA_REPO}/${repoPath}/${file}`;
  return `/api/sed/pdf-proxy?url=${encodeURIComponent(target)}`;
}
