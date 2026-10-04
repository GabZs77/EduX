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

  function renameTaskLabels() {
    var nodes = document.querySelectorAll("h1, h2, h3, a, button, span, p");
    nodes.forEach(function (node) {
      var text = String(node.textContent || "").trim();
      if (text === "Tarefas") node.textContent = "Redações";
      else if (text === "Tarefa") node.textContent = "Redação";
      else if (text === "Tarefas pendentes") node.textContent = "Redações pendentes";
    });
  }

  var observer = new MutationObserver(function () {
    renameTaskLabels();
    if (lastTurmaTexto && !document.getElementById("sdf-turma-line")) showTurmaLine(lastTurmaTexto);
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
