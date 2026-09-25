/* Flash IA + rascunho dentro da atividade.
   Enhancement 100% externo: não altera o bundle das atividades.
   - Botões de IA por questão (explicar / resposta provável)
   - Rascunho automático das respostas (localStorage) com restauração
*/
(function () {
  if (window.__sdfTaskHelper) return;
  window.__sdfTaskHelper = true;

  var API = "/api/public/sdf/groq-help";
  var STORE = "sdf.task-drafts.v1";
  var CARD = "task-question-card";

  /* ---------------- estilos ---------------- */
  var css = document.createElement("style");
  css.textContent = [
    ".sdf-ai-box{margin-top:14px;border-top:1px solid rgba(148,163,184,.22);padding-top:12px}",
    ".sdf-ai-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".sdf-ai-btn{font:600 12px/1 'Manrope','DM Sans',sans-serif;letter-spacing:.02em;border-radius:999px;padding:9px 14px;border:1px solid rgba(56,189,248,.45);background:rgba(56,189,248,.14);color:#e2f4ff;cursor:pointer;transition:.18s}",
    ".sdf-ai-btn:hover{background:rgba(56,189,248,.26)}",
    ".sdf-ai-btn[disabled]{opacity:.55;cursor:progress}",
    ".sdf-ai-btn.ghost{border-color:rgba(148,163,184,.35);background:rgba(148,163,184,.12);color:#dbe6f2}",
    ".sdf-ai-out{margin-top:10px;display:none;font:500 13px/1.65 'DM Sans',sans-serif;color:#e6eef8;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:14px 16px;max-height:360px;overflow:auto}",
    ".sdf-ai-out.show{display:block}",
    ".sdf-ai-out.error{border-color:rgba(248,113,113,.5);color:#fecaca}",
    ".sdf-ai-out h3{font:800 15px/1.35 'Manrope',sans-serif;margin:0 0 8px;color:#f1f7ff}",
    ".sdf-ai-out h4{font:700 13px/1.4 'Manrope',sans-serif;margin:14px 0 6px;color:#cfe4f7;text-transform:uppercase;letter-spacing:.06em}",
    ".sdf-ai-out p{margin:0 0 10px}",
    ".sdf-ai-out ul,.sdf-ai-out ol{margin:0 0 10px;padding-left:20px}",
    ".sdf-ai-out li{margin:0 0 6px}",
    ".sdf-ai-out strong{color:#fff;font-weight:700}",
    ".sdf-ai-out code{font:600 12px/1.4 ui-monospace,monospace;background:rgba(148,163,184,.16);padding:1px 5px;border-radius:6px}",

    ".sdf-draft-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}",
    ".sdf-draft-note{font:600 11px/1 'Manrope',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#9fb3c8}",
  ].join("");
  document.head.appendChild(css);

  /* ---------------- armazenamento ---------------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(db) {
    try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* cota */ }
  }
  function taskKey() {
    var t = document.getElementById("task-reader-title");
    return t ? (t.textContent || "").trim().slice(0, 160) : "";
  }
  function cardIndex(card) {
    var all = Array.prototype.slice.call(document.querySelectorAll("." + CARD));
    return all.indexOf(card);
  }
  function fields(card) {
    return Array.prototype.slice.call(card.querySelectorAll("input,textarea,select"));
  }

  var nativeSetters = {
    input: Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"),
    textarea: Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value"),
  };
  function setValue(el, value) {
    var d = el.tagName === "TEXTAREA" ? nativeSetters.textarea : nativeSetters.input;
    if (d && d.set) d.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function snapshot(card) {
    return fields(card).map(function (el) {
      if (el.type === "checkbox" || el.type === "radio") return el.checked ? 1 : 0;
      return el.value == null ? "" : String(el.value);
    });
  }

  function persist(card) {
    var key = taskKey();
    if (!key) return;
    var idx = cardIndex(card);
    if (idx < 0) return;
    var db = load();
    var task = db[key] || (db[key] = { updatedAt: 0, answers: {} });
    task.answers[idx] = snapshot(card);
    task.updatedAt = Date.now();
    save(db);
    markSaved(task.updatedAt);
  }

  function restore(card) {
    var key = taskKey();
    if (!key) return;
    var db = load();
    var task = db[key];
    if (!task) return;
    var data = task.answers[cardIndex(card)];
    if (!data) return;
    var els = fields(card);
    data.forEach(function (value, i) {
      var el = els[i];
      if (!el) return;
      if (el.type === "checkbox" || el.type === "radio") {
        if (value === 1 && !el.checked) el.click();
      } else if (typeof value === "string" && value && el.value !== value) {
        setValue(el, value);
      }
    });
    markSaved(task.updatedAt);
  }

  function markSaved(ts) {
    var note = document.querySelector(".sdf-draft-note");
    if (!note) return;
    if (!ts) { note.textContent = "Rascunho vazio"; return; }
    var d = new Date(ts);
    note.textContent = "Rascunho salvo " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------------- leitura da questão ---------------- */
  function gapsOf(card) {
    return Array.prototype.slice.call(card.querySelectorAll(".sdf-fill-gap"));
  }
  function orderRows(card) {
    return Array.prototype.slice.call(card.querySelectorAll(".sdf-order-item"));
  }
  function tfRows(card) {
    return Array.prototype.slice.call(card.querySelectorAll(".true-false-row"));
  }
  function kindOf(card) {
    if (gapsOf(card).length) return "fill";
    if (orderRows(card).length) return "order";
    if (tfRows(card).length) return "true-false";
    if (card.querySelector(".question-option")) return "choice";
    return "text";
  }

  function questionData(card) {
    var texts = Array.prototype.slice.call(card.querySelectorAll(".question-text"));
    var statementEl = texts.filter(function (el) {
      return !el.closest(".question-options") && !el.closest(".true-false-list");
    })[0];
    var statement = statementEl ? statementEl.innerText.trim() : (card.innerText || "").trim().slice(0, 2000);

    var options = Array.prototype.slice.call(card.querySelectorAll(".question-option")).map(function (el, i) {
      return { id: i + 1, text: el.innerText.trim() };
    });
    if (!options.length) {
      options = tfRows(card).map(function (el, i) {
        var t = el.querySelector(".question-text");
        return { id: i + 1, text: (t ? t.innerText : el.innerText).trim() };
      });
    }

    var kind = kindOf(card);
    if (kind === "fill") {
      var gaps = gapsOf(card);
      var choices = [];
      gaps.forEach(function (g) {
        if (g.tagName !== "SELECT") return;
        Array.prototype.slice.call(g.options).forEach(function (o) {
          var t = (o.textContent || "").trim();
          if (t && t !== "—" && choices.indexOf(t) < 0) choices.push(t);
        });
      });

      // frase com lacunas numeradas, percorrendo toda a árvore da frase
      var phrase = (function () {
        var wrap = card.querySelector(".sdf-fill-phrase");
        if (!wrap) {
          var s = statement;
          var n0 = 0;
          return s.replace(/_{2,}|\[\[.*?\]\]/g, function () { n0++; return " [[" + n0 + "]] "; }).replace(/\s+/g, " ").trim();
        }
        var out = "";
        var n = 0;
        (function walk(node) {
          Array.prototype.slice.call(node.childNodes).forEach(function (child) {
            if (child.nodeType === 3) { out += child.nodeValue; return; }
            if (child.nodeType !== 1) return;
            if (child.classList && child.classList.contains("sdf-fill-gap")) { n++; out += " [[" + n + "]] "; return; }
            if (child.tagName === "INPUT" || child.tagName === "SELECT" || child.tagName === "TEXTAREA") { n++; out += " [[" + n + "]] "; return; }
            walk(child);
          });
        })(wrap);
        return out.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
      })();

      var gapKinds = gaps.map(function (g, i) {
        return (i + 1) + ") " + (g.tagName === "SELECT" ? "escolher uma das opções da lista" : "escrever a palavra ou expressão");
      }).join("\n");

      statement +=
        "\n\nTipo: preencher lacunas.\nFrase completa (cada [[n]] é uma lacuna a preencher): " + (phrase || "(ver enunciado)") +
        "\nTotal de lacunas: " + gaps.length + ".\n" + gapKinds +
        (choices.length
          ? "\nUse EXATAMENTE uma destas opções em cada lacuna, sem repetir se não fizer sentido: " + choices.join(" | ") + "."
          : "\nEscreva apenas a palavra/expressão que completa cada lacuna, sem repetir a frase.") +
        "\nFORMATO OBRIGATÓRIO da resposta: exatamente " + gaps.length + " linha(s), uma por lacuna, na ordem, no formato:\n1) resposta da lacuna 1\n2) resposta da lacuna 2\nNão escreva explicações, títulos ou a frase completa.";
      return { statement: statement, options: options, type: "Preencher lacunas", kind: kind, gaps: gaps.length, choices: choices };
    }

    if (kind === "order") {
      var items = orderRows(card).map(function (row, i) {
        var t = row.querySelector(".sdf-order-text");
        return { id: i + 1, text: ((t ? t.innerText : row.innerText) || "").trim() };
      });
      statement +=
        "\n\nFrases na ordem atual:\n" +
        items.map(function (it) { return it.id + ") " + it.text; }).join("\n") +
        "\nResponda APENAS com a sequência correta dos números, separados por vírgula. Exemplo: 3, 1, 2";
      return { statement: statement, options: items, type: "Ordenar frases", kind: kind };
    }
    if (kind === "true-false") {
      statement +=
        "\n\nAfirmações:\n" + options.map(function (o) { return o.id + ") " + o.text; }).join("\n") +
        "\nResponda APENAS com uma lista numerada indicando Verdadeiro ou Falso. Exemplo: 1) Verdadeiro";
    }
    var typeEl = card.querySelector(".question-type");
    return {
      statement: statement,
      options: options,
      kind: kind,
      type: typeEl ? typeEl.textContent.trim() : "desconhecido",
    };
  }


  /* ---------------- formatação markdown ---------------- */
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  }
  // Converte notação LaTeX (\(...\), \times, frações etc.) em texto legível.
  function cleanMath(t) {
    t = String(t);
    // delimitadores de bloco e inline
    t = t.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
    t = t.replace(/\\\[([\s\S]*?)\\\]/g, "$1");
    t = t.replace(/\\\(([\s\S]*?)\\\)/g, "$1");
    t = t.replace(/\$([^$\n]+)\$/g, "$1");
    // frações \frac{a}{b} -> (a)/(b)
    var frac = /\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g;
    while (frac.test(t)) t = t.replace(frac, "($1)/($2)");
    // raiz quadrada
    t = t.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
    // comandos comuns
    var cmds = {
      "\\\\times": "×", "\\\\cdot": "·", "\\\\div": "÷", "\\\\pm": "±",
      "\\\\leq?": "≤", "\\\\geq?": "≥", "\\\\neq?": "≠", "\\\\approx": "≈",
      "\\\\pi": "π", "\\\\infty": "∞", "\\\\percent": "%",
      "\\\\left": "", "\\\\right": "", "\\\\,": " ", "\\\\;": " ", "\\\\ ": " "
    };
    Object.keys(cmds).forEach(function (k) {
      t = t.replace(new RegExp(k, "g"), cmds[k]);
    });
    // potências ^{n} ou ^n e subscritos _{n} ou _n
    t = t.replace(/\^\{([^{}]*)\}/g, "^$1");
    t = t.replace(/_\{([^{}]*)\}/g, "$1");
    // remove barras invertidas restantes de comandos desconhecidos
    t = t.replace(/\\([a-zA-Z]+)/g, "$1");
    t = t.replace(/[ \t]{2,}/g, " ");
    return t;
  }

  // Remove o rótulo "Resposta" do início e corta qualquer seção "Dica" do final.
  function cleanHelp(text) {
    var t = String(text).replace(/\r/g, "");
    t = t.replace(/^\s*#{1,6}\s*resposta\s*\n+/i, "");
    t = t.replace(/\n+\s*#{1,6}\s*dica\b[\s\S]*$/i, "");
    t = t.replace(/\n+\s*\*\*dica\b[\s\S]*$/i, "");
    return cleanMath(t).trim();
  }

  function mdToHtml(text) {
    var lines = String(text).replace(/\r/g, "").split("\n");
    var html = "", list = null;
    function closeList() { if (list) { html += "</" + list + ">"; list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { closeList(); return; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { closeList(); html += (h[1].length <= 2 ? "<h3>" : "<h4>") + inline(h[2]) + (h[1].length <= 2 ? "</h3>" : "</h4>"); return; }
      var ol = line.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        if (list !== "ol") { closeList(); list = "ol"; html += "<ol>"; }
        html += "<li>" + inline(ol[1]) + "</li>";
        return;
      }
      var ul = line.match(/^[-*•]\s+(.*)$/);
      if (ul) {
        if (list !== "ul") { closeList(); list = "ul"; html += "<ul>"; }
        html += "<li>" + inline(ul[1]) + "</li>";
        return;
      }
      closeList();
      html += "<p>" + inline(line) + "</p>";
    });
    closeList();
    return html;
  }
  function toPlain(text) {
    return String(text)
      .replace(/\r/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* ---------------- aplicar resposta na questão ---------------- */
  function numberedAnswers(plain) {
    var out = [];
    String(plain).split("\n").forEach(function (line) {
      var m = line.trim().match(/^(\d+)\s*[).:-]\s*(.+)$/);
      if (m) out[parseInt(m[1], 10) - 1] = m[2].trim().replace(/[.;]+$/, "");
    });
    return out;
  }
  function setSelect(el, value) {
    var d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    if (d && d.set) d.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function cleanAnswer(v) {
    return String(v == null ? "" : v)
      .replace(/^\s*(lacuna|gap)\s*\d+\s*[:.)-]\s*/i, "")
      .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
      .replace(/[.;,]+$/, "")
      .trim();
  }

  function fillAnswers(plain, count) {
    var lines = String(plain).split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var out = [];

    // 1) linhas numeradas ("1) x", "1. x", "1 - x")
    lines.forEach(function (line) {
      var m = line.match(/^\[?(\d{1,2})\]?\s*[).:\-–]\s*(.+)$/);
      if (m) {
        var i = parseInt(m[1], 10) - 1;
        if (i >= 0 && i < count && !out[i]) out[i] = cleanAnswer(m[2]);
      }
    });
    if (out.filter(Boolean).length >= count) return out;

    // 2) marcadores [[n]] no texto
    var re = /\[\[\s*(\d{1,2})\s*\]\]\s*[:=-]?\s*([^\n\[]+)/g, m2;
    while ((m2 = re.exec(plain))) {
      var k = parseInt(m2[1], 10) - 1;
      if (k >= 0 && k < count && !out[k]) out[k] = cleanAnswer(m2[2]);
    }
    if (out.filter(Boolean).length >= count) return out;

    // 3) palavras entre aspas
    var quoted = (plain.match(/["“']([^"“”']{1,60})["”']/g) || []).map(function (s) { return cleanAnswer(s); }).filter(Boolean);
    if (quoted.length >= count) {
      for (var q = 0; q < count; q++) if (!out[q]) out[q] = quoted[q];
      return out;
    }

    // 4) lista simples de linhas curtas
    var plainLines = lines.filter(function (l) { return !/^[#>*-]/.test(l) && l.length <= 80; }).map(cleanAnswer).filter(Boolean);
    if (plainLines.length >= count) {
      for (var p = 0; p < count; p++) if (!out[p]) out[p] = plainLines[p];
      return out;
    }

    // 5) uma linha só, separada por vírgula/ponto e vírgula
    if (count > 1 && lines.length) {
      var parts = lines.join(" ").split(/[;,]| \/ /).map(cleanAnswer).filter(Boolean);
      if (parts.length >= count) for (var r = 0; r < count; r++) if (!out[r]) out[r] = parts[r];
    }
    if (count === 1 && !out[0] && plainLines.length) out[0] = plainLines[plainLines.length - 1];
    return out;
  }

  function matchOption(gap, value) {
    var opts = Array.prototype.slice.call(gap.options).filter(function (o) {
      return (o.value || "") !== "" && (o.textContent || "").trim() !== "—";
    });
    var v = norm(value);
    if (!v) return null;
    var exact = opts.filter(function (o) { return norm(o.textContent) === v; })[0];
    if (exact) return exact;
    var contains = opts.filter(function (o) {
      var t = norm(o.textContent);
      return t && (t.indexOf(v) >= 0 || v.indexOf(t) >= 0);
    })[0];
    if (contains) return contains;
    // melhor sobreposição de palavras
    var words = v.split(" ").filter(Boolean);
    var best = null, bestScore = 0;
    opts.forEach(function (o) {
      var t = norm(o.textContent).split(" ").filter(Boolean);
      var score = words.filter(function (w) { return t.indexOf(w) >= 0; }).length;
      if (score > bestScore) { bestScore = score; best = o; }
    });
    return bestScore > 0 ? best : null;
  }

  function applyFill(card, plain) {
    var gaps = gapsOf(card);
    if (!gaps.length) return false;
    var answers = fillAnswers(plain, gaps.length);
    var filled = 0;
    gaps.forEach(function (gap, i) {
      var value = cleanAnswer(answers[i]);
      if (!value) return;
      if (gap.tagName === "SELECT") {
        var match = matchOption(gap, value);
        if (match) { setSelect(gap, match.value); filled++; }
      } else {
        setValue(gap, value);
        filled++;
      }
    });
    if (filled) {
      persist(card);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return filled === gaps.length;
  }


  function applyOrder(card, plain) {
    var rows = orderRows(card);
    if (!rows.length) return false;
    var seq = (plain.match(/\d+/g) || []).map(Number).filter(function (n) { return n >= 1 && n <= rows.length; });
    var wanted = [];
    seq.forEach(function (n) { if (wanted.indexOf(n) < 0) wanted.push(n); });
    if (wanted.length < rows.length) return false;

    // ordem atual = textos originais (numeração inicial 1..n na primeira leitura)
    var byText = {};
    orderRows(card).forEach(function (row, i) {
      var t = row.querySelector(".sdf-order-text");
      byText[i] = norm(t ? t.innerText : row.innerText);
    });
    var original = card.__sdfOrderOriginal;
    if (!original) {
      original = Object.keys(byText).map(function (k) { return byText[k]; });
      card.__sdfOrderOriginal = original;
    }
    // move item desejado para cada posição usando os botões ↑
    for (var pos = 0; pos < wanted.length; pos++) {
      var targetText = original[wanted[pos] - 1];
      var current = orderRows(card);
      var from = -1;
      for (var j = pos; j < current.length; j++) {
        var t2 = current[j].querySelector(".sdf-order-text");
        if (norm(t2 ? t2.innerText : current[j].innerText) === targetText) { from = j; break; }
      }
      if (from < 0) continue;
      while (from > pos) {
        var rowsNow = orderRows(card);
        var up = rowsNow[from].querySelectorAll(".sdf-order-move")[0];
        if (!up || up.disabled) break;
        up.click();
        from--;
      }
    }
    persist(card);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  function applyTrueFalse(card, plain) {
    var rows = tfRows(card);
    if (!rows.length) return false;
    var answers = numberedAnswers(plain);
    var hits = 0;
    rows.forEach(function (row, i) {
      var a = norm(answers[i]);
      if (!a) return;
      var isTrue = /^(v|verdadeir|true|certo|sim)/.test(a);
      var inputs = Array.prototype.slice.call(row.querySelectorAll("input"));
      var el = inputs[isTrue ? 0 : 1] || inputs[0];
      if (el && !el.checked) el.click();
      hits++;
    });
    if (hits) persist(card);
    return hits > 0;
  }

  function applyAnswer(card, text) {
    var plain = toPlain(text);
    if (gapsOf(card).length) return applyFill(card, plain);
    if (orderRows(card).length) return applyOrder(card, plain);
    if (tfRows(card).length) return applyTrueFalse(card, plain);

    var area = card.querySelector(".task-answer-textarea") || card.querySelector("textarea");
    if (area) {
      setValue(area, plain);
      persist(card);
      area.scrollIntoView({ behavior: "smooth", block: "center" });
      try { area.focus({ preventScroll: true }); } catch (e) { area.focus(); }
      return true;
    }
    // alternativas: tenta identificar a opção indicada pela IA
    var opts = Array.prototype.slice.call(card.querySelectorAll(".question-option"));
    if (!opts.length) return false;
    var target = null;
    var letter = plain.match(/\b(?:alternativa|letra|op[çc][ãa]o)\s*([A-Ea-e1-9])\b/);
    if (letter) {
      var k = letter[1].toUpperCase();
      var idx = /[1-9]/.test(k) ? parseInt(k, 10) - 1 : k.charCodeAt(0) - 65;
      target = opts[idx] || null;
    }
    if (!target) {
      var head = norm(plain.slice(0, 400));
      target = opts.filter(function (o) {
        var t = norm(o.innerText);
        return t.length > 3 && head.indexOf(t.slice(0, 40)) >= 0;
      })[0] || null;
    }
    if (!target) return false;
    var input = target.querySelector("input");
    (input || target).click();
    persist(card);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }


  function msgOf(data, status) {
    var d = data && (data.detalhe || data.erro || data.message);
    if (d && typeof d === "object") d = d.message || d.error || JSON.stringify(d);
    return String(d || "A IA não respondeu (HTTP " + status + ").");
  }

  function askGroq(q, mode) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, mode: mode || "answer" }),
    }).then(function (resp) {
      return resp.json().catch(function () { return null; }).then(function (data) {
        if (!resp.ok || !data || !data.help) {
          var err = new Error(msgOf(data, resp.status));
          err.status = resp.status;
          throw err;
        }
        return String(data.help).trim();
      });
    });
  }

  function askGroqRetry(q, mode, tries) {
    var max = tries || 4;
    function attempt(n) {
      return askGroq(q, mode).catch(function (err) {
        if (n >= max) throw err;
        var wait = err && err.status === 429 ? 3000 + n * 2000 : 1200;
        return new Promise(function (r) { setTimeout(r, wait); }).then(function () { return attempt(n + 1); });
      });
    }
    return attempt(1);
  }

  async function askAI(card, mode, out, btns) {
    var q = questionData(card);
    if (!q.statement) {
      out.className = "sdf-ai-out show error";
      out.textContent = "Não consegui ler o enunciado desta questão.";
      return;
    }
    btns.forEach(function (b) { b.disabled = true; });
    out.className = "sdf-ai-out show";
    out.textContent = "Resolvendo a questão…";
    try {
      var help = cleanHelp(await askGroqRetry(q, mode));
      out.className = "sdf-ai-out show";
      out.innerHTML = mdToHtml(help);
      applyAnswer(card, help);
    } catch (err) {
      out.className = "sdf-ai-out show error";
      out.textContent = (err && err.message) || "Falha ao consultar a IA.";
    } finally {
      btns.forEach(function (b) { b.disabled = false; });
    }
  }

  /* ---------------- injeção ---------------- */
  function enhanceCard(card) {
    if (card.dataset.sdfAi || card.classList.contains("info")) return;
    card.dataset.sdfAi = "1";

    var box = document.createElement("div");
    box.className = "sdf-ai-box";
    var actions = document.createElement("div");
    actions.className = "sdf-ai-actions";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sdf-ai-btn";
    btn.textContent = "✨ Resposta provável";
    var out = document.createElement("div");
    out.className = "sdf-ai-out";
    btn.addEventListener("click", function () { askAI(card, "answer", out, [btn]); });
    actions.appendChild(btn);
    box.appendChild(actions);
    box.appendChild(out);
    card.appendChild(box);

    setTimeout(function () { restore(card); }, 60);
  }


  function answerCards(btn, status) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("." + CARD)).filter(function (c) {
      return !c.classList.contains("info");
    });
    if (!cards.length) {
      status.className = "sdf-ai-out show error";
      status.textContent = "Nenhuma questão encontrada nesta atividade.";
      return;
    }
    btn.disabled = true;
    status.className = "sdf-ai-out show";
    status.textContent = "Lendo a atividade…";

    var i = 0, done = 0, failed = 0;

    function askOnce(q) {
      return askGroqRetry(q, "answer").catch(function () { return ""; });
    }

    function next() {
      if (i >= cards.length) {
        btn.disabled = false;
        status.textContent =
          "Concluído: " + done + " de " + cards.length + " questões respondidas" +
          (failed ? " (" + failed + " sem resposta)" : "") + ".";
        return;
      }
      var card = cards[i];
      var n = i + 1;
      i++;
      status.textContent = "Respondendo questão " + n + " de " + cards.length + "…";
      var q = questionData(card);
      if (!q.statement) { failed++; return next(); }

      // até 3 tentativas: erro de rede/cota da IA ou resposta em formato não aplicável
      (function attempt(t) {
        askOnce(q).then(function (help) {
          var ok = help ? applyAnswer(card, help) : false;
          if (ok) { done++; return setTimeout(next, 1200); }
          if (t < 3) {
            status.textContent = "Refazendo questão " + n + " de " + cards.length + "…";
            return setTimeout(function () { attempt(t + 1); }, 2500);
          }
          failed++;
          setTimeout(next, 1200);
        });
      })(0);
    }
    next();
  }





  function enhanceHeader() {
    var header = document.querySelector(".task-reader-header");
    if (!header || header.dataset.sdfDraft) return;
    header.dataset.sdfDraft = "1";

    var bar = document.createElement("div");
    bar.className = "sdf-draft-bar";
    var note = document.createElement("span");
    note.className = "sdf-draft-note";
    note.textContent = "Rascunho vazio";
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "sdf-ai-btn ghost";
    saveBtn.textContent = "Salvar rascunho";
    saveBtn.addEventListener("click", function () {
      document.querySelectorAll("." + CARD).forEach(function (c) { persist(c); });
      note.textContent = "Rascunho salvo agora";
    });
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "sdf-ai-btn ghost";
    clearBtn.textContent = "Descartar";
    clearBtn.addEventListener("click", function () {
      var db = load();
      delete db[taskKey()];
      save(db);
      note.textContent = "Rascunho descartado";
    });

    var aiBtn = document.createElement("button");
    aiBtn.type = "button";
    aiBtn.className = "sdf-ai-btn";
    aiBtn.textContent = "✨ Resposta provável (atividade toda)";
    var status = document.createElement("div");
    status.className = "sdf-ai-out";
    aiBtn.addEventListener("click", function () { answerCards(aiBtn, status); });

    bar.appendChild(aiBtn);
    bar.appendChild(note);
    bar.appendChild(saveBtn);
    bar.appendChild(clearBtn);
    header.appendChild(bar);
    header.appendChild(status);
    markSaved((load()[taskKey()] || {}).updatedAt);
  }


  function scan() {
    if (!document.querySelector(".task-reader-modal")) return;
    enhanceHeader();
    document.querySelectorAll("." + CARD).forEach(enhanceCard);
  }

  var timer = null;
  function autosave(event) {
    var card = event.target && event.target.closest ? event.target.closest("." + CARD) : null;
    if (!card) return;
    clearTimeout(timer);
    timer = setTimeout(function () { persist(card); }, 400);
  }
  document.addEventListener("input", autosave, true);
  document.addEventListener("change", autosave, true);

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
