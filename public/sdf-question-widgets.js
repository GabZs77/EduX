/* Questões de lacuna (fill) e ordenação de frases (order) + CAPTCHA no envio.
   Enhancement externo consumido pelo bundle das atividades:
   - window.__sdfQuestionWidget(host, question, value, onChange)
   - window.__sdfBuildAnswers(questions, values)  -> payload no formato do EduSP
   - window.__sdfConfirmCaptcha()                 -> Promise<{token, sessionKey}>
*/
(function () {
  if (window.__sdfQuestionWidgets) return;
  window.__sdfQuestionWidgets = true;

  var API = "/api/public/sdf";

  var css = document.createElement("style");
  css.textContent = [
    ".sdf-fill-phrase{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:500 15px/2 'DM Sans',sans-serif;color:#e8f0fb;margin-top:12px}",
    ".sdf-fill-gap{min-width:120px;border-radius:10px;border:2px solid rgba(74,222,128,.75);background:rgba(15,23,42,.65);color:#eafff2;font:600 14px/1.2 'DM Sans',sans-serif;padding:8px 10px}",
    ".sdf-fill-gap:focus{outline:none;border-color:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.22)}",
    ".sdf-order-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}",
    ".sdf-order-item{display:flex;align-items:center;gap:12px;background:rgba(248,250,252,.96);color:#0f172a;border-radius:14px;padding:12px 14px;font:600 14px/1.45 'DM Sans',sans-serif}",
    ".sdf-order-index{min-width:26px;height:26px;border-radius:999px;display:grid;place-items:center;background:#16a34a;color:#fff;font:800 12px/1 'Manrope',sans-serif}",
    ".sdf-order-text{flex:1}",
    ".sdf-order-moves{display:flex;gap:6px}",
    ".sdf-order-move{width:30px;height:30px;border-radius:999px;border:1px solid rgba(15,23,42,.18);background:#fff;color:#0f172a;font:700 14px/1 sans-serif;cursor:pointer}",
    ".sdf-order-move[disabled]{opacity:.35;cursor:default}",
    ".sdf-cap-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.78);display:grid;place-items:center;padding:18px}",
    ".sdf-cap-card{width:100%;max-width:380px;background:#0f172a;border:1px solid rgba(148,163,184,.25);border-radius:20px;padding:20px;color:#e8f0fb;font-family:'DM Sans',sans-serif}",
    ".sdf-cap-card h3{font:800 17px/1.3 'Manrope',sans-serif;margin:0 0 6px}",
    ".sdf-cap-card p{font:500 13px/1.5 'DM Sans',sans-serif;margin:0 0 14px;color:#a8bed4}",
    ".sdf-cap-img{width:100%;border-radius:12px;background:#fff;margin-bottom:12px}",
    ".sdf-cap-input{width:100%;padding:11px 13px;border-radius:12px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.7);color:#fff;font:700 15px/1.2 'DM Sans',sans-serif;letter-spacing:.14em;text-transform:uppercase}",
    ".sdf-cap-row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}",
    ".sdf-cap-btn{flex:1;min-width:110px;border-radius:999px;padding:11px 14px;border:1px solid rgba(56,189,248,.5);background:rgba(56,189,248,.2);color:#e2f4ff;font:700 13px/1 'Manrope',sans-serif;cursor:pointer}",
    ".sdf-cap-btn.ghost{border-color:rgba(148,163,184,.35);background:rgba(148,163,184,.14);color:#dbe6f2}",
    ".sdf-cap-msg{margin-top:10px;font:600 12px/1.5 'DM Sans',sans-serif;color:#fecaca;min-height:18px}",
  ].join("");
  document.head.appendChild(css);

  /* ------------------------- leitura da questão ------------------------- */
  function raw(question) {
    return (question && question.raw) || {};
  }
  function rawOptions(question) {
    var o = raw(question).options;
    return o && typeof o === "object" ? o : {};
  }
  function text(item, fallback) {
    if (item == null) return fallback || "";
    if (typeof item === "string" || typeof item === "number") return String(item);
    return String(item.value != null ? item.value
      : item.text != null ? item.text
      : item.statement != null ? item.statement
      : item.label != null ? item.label
      : fallback || "");
  }
  function stripTags(s) {
    var d = document.createElement("div");
    d.innerHTML = String(s == null ? "" : s);
    return (d.textContent || "").trim();
  }

  // Lista de itens da frase: aceita array ou objeto indexado ({"0":{...}})
  function indexedList(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === "object") {
      var keys = Object.keys(value).filter(function (k) { return /^\d+$/.test(k); });
      if (keys.length) {
        keys.sort(function (a, b) { return Number(a) - Number(b); });
        return keys.map(function (k) { return value[k]; });
      }
    }
    return null;
  }

  function isGapItem(item, t) {
    if (item && typeof item === "object") {
      if (item.answer === true || item.gap === true || item.blank === true || item.fixed === false || item.type === "blank") return true;
      if (item.answer === false || item.fixed === true) return false;
    }
    return t === "" || /^_{2,}$/.test(t);
  }

  function phraseList(question) {
    var opts = rawOptions(question);
    var candidates = [opts.phrase, opts.sentences, opts.words, opts.items, raw(question).phrase];
    for (var i = 0; i < candidates.length; i++) {
      var list = indexedList(candidates[i]);
      if (list && list.length) return list;
    }
    var self = indexedList(opts);
    if (self && self.length) return self;
    return null;
  }

  // Segmentos da frase com lacunas: [{gap:false,text}, {gap:true,key}]
  function phraseSegments(question) {
    var arr = phraseList(question);
    if (!arr) {
      // fallback: lacunas marcadas no enunciado com ___ ou [[...]]
      var statement = stripTags(question.statement);
      var parts = statement.split(/_{2,}|\[\[.*?\]\]/g);
      if (parts.length < 2) return null;
      var segs = [];
      parts.forEach(function (p, i) {
        segs.push({ gap: false, text: p });
        if (i < parts.length - 1) segs.push({ gap: true, key: String(segs.length) });
      });
      return segs;
    }
    return arr.map(function (item, i) {
      var t = stripTags(text(item, ""));
      return isGapItem(item, t) ? { gap: true, key: String(i) } : { gap: false, text: t };
    });
  }

  // Banco de palavras da questão. A API do EduSP guarda as palavras em chaves
  // que mudam de questão para questão (answers, words, distractors, ...), então
  // varremos toda a estrutura e descartamos os trechos fixos da frase.
  function collectStrings(node, out, depth) {
    if (out.length > 80 || depth > 6) return;
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number") {
      var s = stripTags(String(node));
      if (s && s.length <= 80) out.push(s);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(function (item) { collectStrings(item, out, depth + 1); });
      return;
    }
    if (typeof node !== "object") return;
    Object.keys(node).forEach(function (k) {
      if (/^(id|type|question_type|max_text_count|score|comment|correct|answer|fixed|gap|blank)$/i.test(k)) {
        if (typeof node[k] === "object") collectStrings(node[k], out, depth + 1);
        return;
      }
      collectStrings(node[k], out, depth + 1);
    });
  }

  function gapChoices(question) {
    var opts = rawOptions(question);
    var words = [];

    var explicit = [opts.options, opts.choices, opts.alternativas, opts.answers, opts.words, opts.distractors, opts.bank]
      .map(indexedList)
      .find(function (a) { return a && a.length; });
    if (explicit) {
      explicit.forEach(function (item, i) { words.push(stripTags(text(item, "Opção " + (i + 1)))); });
    }

    // palavras que aparecem como resposta dentro da própria frase
    var arr = phraseList(question) || [];
    var fixed = {};
    arr.forEach(function (item) {
      var t = stripTags(text(item, ""));
      if (!t) return;
      if (isGapItem(item, t)) words.push(t);
      else fixed[t.toLowerCase()] = true;
    });

    if (!words.filter(Boolean).length) {
      var deep = [];
      collectStrings(opts, deep, 0);
      collectStrings(raw(question).answers, deep, 0);
      collectStrings(raw(question).words, deep, 0);
      deep.forEach(function (s) {
        if (!s || fixed[s.toLowerCase()]) return;
        if (s.length > 60) return;
        if (/^\d+$/.test(s)) return;
        words.push(s);
      });
    }

    var seen = {};
    words = words.filter(function (w) {
      if (!w || fixed[w.toLowerCase()] || seen[w.toLowerCase()]) return false;
      seen[w.toLowerCase()] = true;
      return true;
    });
    words.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    return words;
  }


  function orderItems(question) {
    var opts = rawOptions(question);
    var arr = [opts.sentences, opts.phrase, opts.items, opts.options, opts.choices]
      .find(function (a) { return Array.isArray(a) && a.length; });
    if (!arr && Array.isArray(question.options) && question.options.length) {
      return question.options.map(function (o, i) { return { key: String(o.id != null ? o.id : i), text: stripTags(o.text) }; });
    }
    if (!arr) return [];
    return arr.map(function (item, i) { return { key: String(i), text: stripTags(text(item, "Frase " + (i + 1))) }; });
  }

  /* ------------------------- renderização ------------------------- */
  function renderFill(host, question, value, onChange) {
    var segs = phraseSegments(question) || [];
    var choices = gapChoices(question);
    var current = value && typeof value === "object" && !Array.isArray(value) ? value : {};

    var wrap = document.createElement("div");
    wrap.className = "sdf-fill-phrase";
    segs.forEach(function (seg) {
      if (!seg.gap) {
        if (!seg.text) return;
        var span = document.createElement("span");
        span.textContent = seg.text;
        wrap.appendChild(span);
        return;
      }
      var field;
      if (choices.length) {
        field = document.createElement("select");
        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "—";
        field.appendChild(empty);
        choices.forEach(function (c) {
          var op = document.createElement("option");
          op.value = c;
          op.textContent = c;
          field.appendChild(op);
        });
      } else {
        field = document.createElement("input");
        field.type = "text";
        field.placeholder = "lacuna";
      }
      field.className = "sdf-fill-gap";
      field.dataset.sdfGap = seg.key;
      field.value = current[seg.key] != null ? current[seg.key] : "";
      field.addEventListener("change", commit);
      field.addEventListener("input", commit);
      wrap.appendChild(field);
    });

    function commit() {
      var next = {};
      wrap.querySelectorAll("[data-sdf-gap]").forEach(function (el) {
        next[el.dataset.sdfGap] = el.value;
      });
      host.__sdfValue = next;
      host.__sdfChange(next);
    }

    host.appendChild(wrap);
  }

  function renderOrder(host, question, value, onChange) {
    var items = orderItems(question);
    var order = Array.isArray(value) && value.length === items.length
      ? value.slice()
      : items.map(function (_, i) { return i; });

    var list = document.createElement("div");
    list.className = "sdf-order-list";
    host.appendChild(list);

    function commit() {
      var next = order.slice();
      host.__sdfValue = next;
      host.__sdfChange(next);
      draw();
    }

    function draw() {
      list.innerHTML = "";
      order.forEach(function (idx, pos) {
        var item = items[idx] || { text: "" };
        var row = document.createElement("div");
        row.className = "sdf-order-item";

        var n = document.createElement("span");
        n.className = "sdf-order-index";
        n.textContent = String(pos + 1);

        var t = document.createElement("span");
        t.className = "sdf-order-text";
        t.textContent = item.text;

        var moves = document.createElement("div");
        moves.className = "sdf-order-moves";
        var up = document.createElement("button");
        up.type = "button";
        up.className = "sdf-order-move";
        up.textContent = "↑";
        up.disabled = pos === 0;
        up.addEventListener("click", function () {
          var tmp = order[pos - 1]; order[pos - 1] = order[pos]; order[pos] = tmp; commit();
        });
        var down = document.createElement("button");
        down.type = "button";
        down.className = "sdf-order-move";
        down.textContent = "↓";
        down.disabled = pos === order.length - 1;
        down.addEventListener("click", function () {
          var tmp = order[pos + 1]; order[pos + 1] = order[pos]; order[pos] = tmp; commit();
        });
        moves.appendChild(up);
        moves.appendChild(down);

        row.appendChild(n);
        row.appendChild(t);
        row.appendChild(moves);
        list.appendChild(row);
      });
    }

    host.__sdfItems = items;
    draw();
    host.__sdfValue = order.slice();
    host.__sdfChange(order.slice());
  }

  window.__sdfQuestionWidget = function (host, question, value, onChange) {
    if (!host) return;
    host.__sdfChange = function (v) { try { onChange(v); } catch (e) { /* noop */ } };
    if (host.dataset.sdfWidget) return; // já montado: preserva o DOM entre re-renders
    host.dataset.sdfWidget = question.type;
    host.innerHTML = "";
    if (question.type === "order") renderOrder(host, question, value, onChange);
    else renderFill(host, question, value, onChange);
  };

  /* ------------------------- payload das respostas ------------------------- */
  function optionKeys(question) {
    return (question.options || []).map(function (o) { return String(o.id); });
  }

  function buildAnswer(question, value) {
    var type = String(question.type || "");
    if (type === "fill") {
      var out = {};
      var src = value && typeof value === "object" ? value : {};
      Object.keys(src).forEach(function (k) { out[k] = String(src[k] == null ? "" : src[k]); });
      return out;
    }
    if (type === "order") {
      var items = orderItems(question);
      var seq = Array.isArray(value) ? value : items.map(function (_, i) { return i; });
      var ordered = {};
      seq.forEach(function (idx, pos) {
        var item = items[idx];
        ordered[String(pos)] = item ? item.text : "";
      });
      return ordered;
    }
    if (type === "true-false") {
      var tf = {};
      var obj = value && typeof value === "object" ? value : {};
      optionKeys(question).forEach(function (k) { tf[k] = obj[k] === true; });
      return tf;
    }
    if (type === "single" || type === "multi") {
      var picked = Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)];
      var sel = {};
      optionKeys(question).forEach(function (k) { sel[k] = picked.indexOf(k) >= 0; });
      return sel;
    }
    return { 0: String(value == null ? "" : value) };
  }

  window.__sdfBuildAnswers = function (questions, values) {
    var payload = {};
    (questions || []).forEach(function (q) {
      payload[q.id] = {
        question_id: q.id,
        question_type: q.rawType || q.type,
        answer: buildAnswer(q, values ? values[q.id] : undefined),
      };
    });
    return payload;
  };

  /* ------------------------- CAPTCHA no envio ------------------------- */
  function sessionHeaders() {
    var h = { Accept: "application/json", "Content-Type": "application/json" };
    var s = null;
    try { s = JSON.parse(localStorage.getItem("sed_sessao") || "null"); } catch (e) { s = null; }
    if (!s) return h;
    if (s.token2) h["X-Token2"] = s.token2;
    if (s.token) h["X-Token"] = s.token;
    if (s.cdUsuarioCurto) h["X-Cd-Usuario"] = s.cdUsuarioCurto;
    if (s.apelido) h["X-Task-User"] = s.apelido;
    if (s.usuario) h["X-Usuario"] = s.usuario;
    return h;
  }

  async function challenge() {
    var resp = await fetch(API + "/captcha/challenge", {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({ realm: "edusp", type: "image" }),
    });
    var data = await resp.json().catch(function () { return null; });
    if (!resp.ok || !data) throw new Error((data && (data.erro || data.detalhe)) || "Não foi possível gerar o CAPTCHA.");
    var c = data.challenge && typeof data.challenge === "object" ? data.challenge : {};
    var id = String(data.challengeId || data.challenge_id || data.id || c.challengeId || c.challenge_id || "");
    var image = String(data.image || c.image || "");
    if (!id || !image) throw new Error("O CAPTCHA não retornou uma imagem válida.");
    return {
      challengeId: id,
      image: image.indexOf("data:") === 0 ? image : "data:image/png;base64," + image,
      sessionKey: String(data.sessionKey || data.session_key || c.sessionKey || ""),
      captchaCookie: String(data.captchaCookie || data.captcha_cookie || data.cookie || c.captchaCookie || ""),
    };
  }

  async function verify(ch, answer) {
    var resp = await fetch(API + "/captcha/verify", {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify({
        type: "image",
        realm: "edusp",
        sessionKey: ch.sessionKey,
        captchaCookie: ch.captchaCookie,
        payload: { challengeId: ch.challengeId, answer: String(answer).trim().toUpperCase() },
      }),
    });
    var data = await resp.json().catch(function () { return null; });
    var token = data && (data.token || data.captchaToken || data.captcha_token || (data.data && data.data.token));
    if (!resp.ok || !token) throw new Error((data && (data.erro || data.detalhe)) || "CAPTCHA incorreto. Tente novamente.");
    return String(token);
  }

  window.__sdfConfirmCaptcha = function () {
    return new Promise(function (resolve, reject) {
      var backdrop = document.createElement("div");
      backdrop.className = "sdf-cap-backdrop";
      backdrop.innerHTML =
        '<div class="sdf-cap-card" role="dialog" aria-modal="true">' +
        "<h3>Confirme o envio</h3>" +
        "<p>Resolva o CAPTCHA para finalizar o envio da atividade.</p>" +
        '<img class="sdf-cap-img" alt="CAPTCHA" />' +
        '<input class="sdf-cap-input" maxlength="12" autocomplete="off" placeholder="Digite o código" />' +
        '<div class="sdf-cap-row">' +
        '<button type="button" class="sdf-cap-btn" data-act="ok">Enviar atividade</button>' +
        '<button type="button" class="sdf-cap-btn ghost" data-act="new">Outro código</button>' +
        '<button type="button" class="sdf-cap-btn ghost" data-act="cancel">Cancelar</button>' +
        "</div>" +
        '<div class="sdf-cap-msg"></div>' +
        "</div>";
      document.body.appendChild(backdrop);

      var img = backdrop.querySelector(".sdf-cap-img");
      var input = backdrop.querySelector(".sdf-cap-input");
      var msg = backdrop.querySelector(".sdf-cap-msg");
      var okBtn = backdrop.querySelector('[data-act="ok"]');
      var ch = null;

      function close() { backdrop.remove(); }

      async function load() {
        msg.textContent = "";
        img.removeAttribute("src");
        okBtn.disabled = true;
        try {
          ch = await challenge();
          img.src = ch.image;
          okBtn.disabled = false;
          input.value = "";
          input.focus();
        } catch (err) {
          msg.textContent = err.message || "Falha ao carregar o CAPTCHA.";
        }
      }

      async function submit() {
        if (!ch || !input.value.trim()) { msg.textContent = "Digite o código da imagem."; return; }
        okBtn.disabled = true;
        msg.textContent = "";
        try {
          var token = await verify(ch, input.value);
          close();
          resolve({ token: token, sessionKey: ch.sessionKey });
        } catch (err) {
          msg.textContent = err.message || "CAPTCHA inválido.";
          okBtn.disabled = false;
          load();
        }
      }

      backdrop.addEventListener("click", function (e) {
        var act = e.target && e.target.dataset ? e.target.dataset.act : null;
        if (act === "ok") submit();
        else if (act === "new") load();
        else if (act === "cancel") { close(); reject(new Error("Envio cancelado: o CAPTCHA não foi concluído.")); }
      });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      load();
    });
  };
})();
