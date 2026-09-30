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

function addPlatformsLink(nav: Element | null, mobile = false) {
  if (!nav || nav.querySelector('a[href="/plataformas"]')) return;
  const link = document.createElement("a");
  link.href = "/plataformas";
  link.className = mobile ? "bottom-link" : "rail-link";
  link.setAttribute("aria-label", "Plataformas");
  link.innerHTML = mobile
    ? '<span class="bottom-icon-wrap">▦</span><span>Plataformas</span>'
    : '<span aria-hidden="true" style="font-size:19px;line-height:1">▦</span><span>Plataformas</span>';
  nav.appendChild(link);
}

export function SdfApp() {
  const isStandaloneRoute =
    typeof window !== "undefined" &&
    (window.location.pathname === "/plataformas" || window.location.pathname === "/leiasp");

  useEffect(() => {
    if (isStandaloneRoute) return;

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

    const ensureExtraLinks = () => {
      addPlatformsLink(document.querySelector(".rail-nav"));
      addPlatformsLink(document.querySelector(".bottom-nav"), true);
    };
    const extraLinksObserver = new MutationObserver(ensureExtraLinks);
    extraLinksObserver.observe(document.body, { childList: true, subtree: true });
    ensureExtraLinks();

    for (const id of ["sdf-saved-accounts", "sdf-notas"]) {
      if (document.getElementById(id)) continue;
      const extras = document.createElement("script");
      extras.id = id;
      extras.src = `/${id}.js`;
      extras.defer = true;
      document.body.appendChild(extras);
    }

    return () => extraLinksObserver.disconnect();
  }, [isStandaloneRoute]);

  if (isStandaloneRoute) return null;
  return <div id="root" />;
}
