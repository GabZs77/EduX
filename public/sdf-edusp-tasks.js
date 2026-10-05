/*
 * Ajustes de apresentação do painel do EduX.
 *
 * As tarefas e redações vêm do endpoint same-origin /api/public/sdf/dashboard,
 * processadas pelo worker server-side. Não consulte edusp-api.ip.tv pelo
 * navegador: o preflight CORS dessa API é bloqueado pela Cloudflare e a
 * resposta do painel já contém os dados oficiais retornados pelo worker.
 */
(function () {
  if (window.__sdfEduspTasksInstalled) return;
  window.__sdfEduspTasksInstalled = true;

  var originalFetch = window.fetch.bind(window);
  var lastTurmaTexto = "";

  function pickField(obj, pattern) {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && pattern.test(key)) {
        var value = obj[key];
        if (value != null && String(value).trim()) return String(value).trim();
      }
    }
    return "";
  }

  function buildTurmaLabel(turmas, roomNames) {
    var turma = "";
    var sala = "";
    var lista = Array.isArray(turmas) ? turmas : [];
    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      if (!item || typeof item !== "object") continue;
      if (!turma) turma = pickField(item, /turma|serie|série/i) || pickField(item, /^nome$/i);
      if (!sala) sala = pickField(item, /sala/i);
      if (turma && sala) break;
    }
    if (!turma && Array.isArray(roomNames) && roomNames.length) turma = String(roomNames[0] || "").trim();
    if (!turma && !sala) return "";
    if (turma && sala) return "Turma: " + turma + " • Sala: " + sala;
    return turma ? "Turma: " + turma : "Sala: " + sala;
  }

  function showTurmaLine(text) {
    lastTurmaTexto = text;
    var heading = document.querySelector(".page-heading h1") || document.querySelector("h1");
    if (!heading) return;
    var existing = document.getElementById("sdf-turma-line");
    if (existing) {
      existing.textContent = text;
      return;
    }
    var line = document.createElement("p");
    line.id = "sdf-turma-line";
    line.textContent = text;
    line.style.cssText = "margin:4px 0 0;font-size:.95rem;font-weight:500;opacity:.85;";
    heading.insertAdjacentElement("afterend", line);
  }

  var lastActivities = [];
  function installBadgeStyles() {
    if (document.getElementById("sdf-kind-badge-style")) return;
    var style = document.createElement("style");
    style.id = "sdf-kind-badge-style";
    style.textContent = ".activity-kind-badge{display:inline-flex;align-items:center;margin-left:8px;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;vertical-align:middle}.activity-kind-badge.is-task{color:#b9d8ff;background:rgba(66,133,244,.18);border:1px solid rgba(100,160,255,.35)}.activity-kind-badge.is-essay{color:#e4c5ff;background:rgba(164,91,255,.2);border:1px solid rgba(196,130,255,.4)}";
    document.head.appendChild(style);
  }

  function applyActivityBadges(items) {
    if (!Array.isArray(items) || !items.length) return;
    lastActivities = items;
    installBadgeStyles();
    var byTitle = {};
    items.forEach(function (item) {
      var title = String(item && item.title || "").trim().toLowerCase();
      if (title && !byTitle[title]) byTitle[title] = item;
    });
    document.querySelectorAll(".task-card").forEach(function (card) {
      var title = card.querySelector(".task-title-line h3");
      var line = card.querySelector(".task-title-line");
      if (!title || !line || line.querySelector(".activity-kind-badge")) return;
      var item = byTitle[String(title.textContent || "").trim().toLowerCase()];
      if (!item) return;
      var essay = item.kind === "redacao";
      var badge = document.createElement("span");
      badge.className = "activity-kind-badge " + (essay ? "is-essay" : "is-task");
      badge.textContent = essay ? "Redação" : "Tarefa";
      badge.setAttribute("aria-label", essay ? "Tipo: redação" : "Tipo: tarefa");
      line.appendChild(badge);
    });
  }

  function renameTaskLabels() {
    var nodes = document.querySelectorAll("h1, h2, h3, a, button, span, p");
    nodes.forEach(function (node) {
      var text = String(node.textContent || "").trim();
      if (text === "Tarefas pendentes") node.textContent = "Atividades pendentes";
    });
  }

  var observer = new MutationObserver(function () {
    renameTaskLabels();
    if (lastTurmaTexto && !document.getElementById("sdf-turma-line")) showTurmaLine(lastTurmaTexto);
    if (lastActivities.length) applyActivityBadges(lastActivities);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  renameTaskLabels();

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var isPanel = /\/api\/public\/sdf\/(dashboard|tarefas|redacoes)(\?|$)/.test(url);
    if (!isPanel) return originalFetch(input, init);

    var response = await originalFetch(input, init);
    try {
      var data = await response.clone().json();
      if (data && typeof data === "object") {
        var activities = Array.isArray(data.tarefas) ? data.tarefas : [];
        applyActivityBadges(activities);
        setTimeout(function () { applyActivityBadges(activities); }, 0);
        var turmaTexto = buildTurmaLabel(data.turmas, data.turmasIdentificadas);
        if (turmaTexto) showTurmaLine(turmaTexto);
        renameTaskLabels();
      }
    } catch (error) {
      // Não altere a resposta do endpoint se o corpo não for JSON válido.
    }
    return response;
  };
})();
