/* Envio como rascunho.
   Enhancement externo: não altera o bundle das atividades.
   - O botão "Enviar" da atividade passa a ser "Enviar como Rascunho"
   - A requisição /answer-task ganha draft:true (API de rascunho da SDF)
   - Textos de confirmação passam a falar de rascunho
*/
(function () {
  if (window.__sdfDraftSubmit) return;
  window.__sdfDraftSubmit = true;

  var LABEL = "Enviar como Rascunho";

  /* ---------- 1. força o modo rascunho na API ---------- */
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (method === "POST" && url.indexOf("/answer-task") >= 0 && init && typeof init.body === "string") {
        var body = JSON.parse(init.body);
        if (body && typeof body === "object") {
          body.draft = true;
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }
      }
    } catch (e) { /* mantém a requisição original */ }
    return nativeFetch(input, init);
  };

  /* ---------- 2. rótulos ---------- */
  function relabelSendButton() {
    var modal = document.querySelector(".task-reader-modal");
    if (!modal) return;
    Array.prototype.slice.call(modal.querySelectorAll("button")).forEach(function (btn) {
      var txt = (btn.textContent || "").trim();
      if (!/^(enviar|enviar tarefa|enviar atividade)$/i.test(txt)) return;
      var target = null;
      Array.prototype.slice.call(btn.childNodes).forEach(function (node) {
        if (node.nodeType === 3 && node.nodeValue.trim()) target = node;
      });
      if (target) target.nodeValue = " " + LABEL;
      else btn.textContent = LABEL;
    });

    // mensagens de status
    Array.prototype.slice.call(modal.querySelectorAll("p,span,div")).forEach(function (el) {
      if (el.children.length) return;
      var t = el.textContent || "";
      if (/enviada com sucesso para a Sala do Futuro/i.test(t)) {
        el.textContent = "Rascunho salvo com sucesso na Sala do Futuro.";
      } else if (/^Enviada$/i.test(t.trim())) {
        el.textContent = "Rascunho salvo";
      }
    });
  }

  function relabelCaptcha() {
    var card = document.querySelector(".sdf-cap-card");
    if (!card || card.dataset.sdfDraftLabel) return;
    card.dataset.sdfDraftLabel = "1";
    var h = card.querySelector("h3");
    if (h) h.textContent = "Confirme o rascunho";
    var p = card.querySelector("p");
    if (p) p.textContent = "Resolva o CAPTCHA para salvar a atividade como rascunho.";
    var ok = card.querySelector('[data-act="ok"]');
    if (ok) ok.textContent = "Salvar rascunho";
  }

  function scan() {
    relabelSendButton();
    relabelCaptcha();
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scan();
})();
