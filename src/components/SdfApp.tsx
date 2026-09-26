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
    // O bundle legado declara variáveis no escopo global (script clássico).
    // Executá-lo duas vezes causa "Identifier 'x' has already been declared"
    // e deixa a tela em branco — por isso ele é montado uma única vez.
    const w = window as unknown as { __sdfAppMounted?: boolean };
    if (w.__sdfAppMounted) return;
    if (document.getElementById("sdf-app-bundle")) return;
    w.__sdfAppMounted = true;

    const script = document.createElement("script");
    script.id = "sdf-app-bundle";
    script.src = "/sdf-app.js";
    document.body.appendChild(script);

    const removeTaskUi = () => {
      if (window.location.pathname === "/tarefas") {
        window.history.replaceState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      document.querySelectorAll('a[href="/tarefas"]').forEach((link) => {
        const container = link.closest(".stat-link, .text-link");
        (container || link).remove();
      });
      document
        .querySelectorAll(".rail-nav a, .bottom-nav a, .login-utility-list span")
        .forEach((item) => {
          if (item.textContent?.trim().toLocaleLowerCase("pt-BR").includes("tarefa")) item.remove();
        });
      document.querySelectorAll("section.section-block").forEach((section) => {
        if (section.textContent?.toLocaleLowerCase("pt-BR").includes("atividades pendentes"))
          section.remove();
      });
    };
    const taskUiObserver = new MutationObserver(removeTaskUi);
    taskUiObserver.observe(document.body, { childList: true, subtree: true });
    removeTaskUi();

    for (const id of ["sdf-saved-accounts", "sdf-notas"]) {
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
