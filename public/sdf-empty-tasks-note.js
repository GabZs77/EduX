/* Exipe um aviso claro quando a lista de tarefas vem vazia
   por sessao expirada, em vez da mensagem neutra. */
(function () {
  if (window.__eduxEmptyTasksNote) return;
  window.__eduxEmptyTasksNote = true;

  var OLD_MSG = "As tarefas publicadas para sua conta aparecer\u00E3o aqui.";
  var NEW_MSG = "Se voc\u00EA tem tarefas no app oficial do Sala do Futuro, saia da conta e entre novamente para atualizar a sess\u00E3o.";

  function patchEmptyState() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim() === OLD_MSG) {
        node.nodeValue = NEW_MSG;
      }
    }
  }

  if (document.documentElement) {
    new MutationObserver(patchEmptyState).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  patchEmptyState();
})();
