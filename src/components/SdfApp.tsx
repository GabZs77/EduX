import { useEffect } from "react";

export const sdfHeadLinks = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap",
  },
  { rel: "stylesheet", href: "/sdf-app.css" },
];

export function SdfApp() {
  useEffect(() => {
    // O bundle legado declara variaveis no escopo global (script classico).
    // Executa-lo duas vezes causa "Identifier 'x' has already been declared"
    // e deixa a tela em branco — por isso ele e montado uma unica vez.
    const w = window as unknown as { __sdfAppMounted?: boolean };
    if (w.__sdfAppMounted) return;
    if (document.getElementById("sdf-app-bundle")) return;
    w.__sdfAppMounted = true;

    // A ponte precisa rodar antes do bundle principal (corrige o token de
    // tarefas quando o servidor e bloqueado). async=false preserva a ordem.
    if (!document.getElementById("sdf-edusp-bridge")) {
      const bridge = document.createElement("script");
      bridge.id = "sdf-edusp-bridge";
      bridge.src = "/sdf-edusp-bridge.js";
      bridge.async = false;
      document.body.appendChild(bridge);
    }

    const script = document.createElement("script");
    script.id = "sdf-app-bundle";
    script.src = "/sdf-app.js";
    script.async = false;
    document.body.appendChild(script);

    for (const id of [
      "sdf-question-widgets",
      "sdf-saved-accounts",
      "sdf-task-helper",
      "sdf-notas",
      "sdf-empty-tasks-note",
    ]) {
      if (document.getElementById(id)) continue;
      const extras = document.createElement("script");
      extras.id = id;
      extras.src = `/${id}.js`;
      extras.defer = true;
      document.body.appendChild(extras);
    }
  }, []);

  return <div id="root" />;
}
