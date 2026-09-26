import { createFileRoute, notFound } from "@tanstack/react-router";

import { sdfHeadLinks } from "@/components/SdfApp";

const title = "EduX — Plataforma Estudantil";
const description =
  "Painel acadêmico do aluno: agenda, presença, boletim e materiais em um só lugar.";

export const Route = createFileRoute("/$")({
  // O fallback SPA serve o app em qualquer rota interna, mas rotas de API
  // inexistentes devem continuar retornando 404 em vez de HTML.
  beforeLoad: ({ params }) => {
    const path = params._splat ?? "";
    if (path.startsWith("api/") || path === "api") throw notFound();
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#10171f" },
    ],
    links: sdfHeadLinks,
  }),
  // O app legado é montado em __root para sobreviver a trocas de rota.
  component: () => null,
});
