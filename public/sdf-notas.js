/*
 * EduX — aba "Notas" (avaliações do aluno) + Boletim redesenhado
 * ---------------------------------------------------------------
 * Este script é independente do bundle do app. Ele injeta um item de menu
 * "Notas" na barra lateral e desenha as telas de Notas e Boletim dentro da
 * área de conteúdo (.app-main), sem alterar o código das atividades.
 */
(function () {
  "use strict";
  if (window.__sdfNotasReady) return;
  window.__sdfNotasReady = true;

  var API = "/api/public/sdf";
  var SESSION_KEY = "sed_sessao";
  var cache = null;
  var loading = null;
  var mode = null; // 'notas' | 'boletim' | null
  var boletimTab = "evolucao";
  var openRow = null;
  var notasFiltro = 0;

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }

  function headers() {
    var s = session() || {};
    var h = { Accept: "application/json" };
    if (s.token) h["X-Token"] = s.token;
    if (s.token2) h["X-Token2"] = s.token2;
    if (s.cdUsuarioCurto) h["X-Cd-Usuario"] = s.cdUsuarioCurto;
    if (s.apelido) h["X-Task-User"] = s.apelido;
    if (s.usuario) h["X-Usuario"] = s.usuario;
    return h;
  }

  function load(force) {
    if (cache && !force) return Promise.resolve(cache);
    if (loading && !force) return loading;
    loading = Promise.all([
      fetch(API + "/notas", { headers: headers() }).then(function (r) { return r.json(); }),
      fetch(API + "/turma", { headers: headers() }).then(function (r) { return r.json(); }),
    ])
      .then(function (responses) {
        var json = responses[0] || {};
        var turma = responses[1] || {};
        cache = {
          avaliacoes: Array.isArray(json.data) ? json.data : [],
          boletim: Array.isArray(json.boletim) ? json.boletim : [],
          turma: Array.isArray(turma.data) ? turma.data : [],
          turmaOk: !!turma.ok,
          ok: !!json.ok,
        };
        return cache;
      })
      .catch(function () {
        cache = { avaliacoes: [], boletim: [], turma: [], ok: false, turmaOk: false, erro: true };
        return cache;
      })
      .finally(function () { loading = null; });
    return loading;
  }

  // ---------------------------------------------------------------- utilidades
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtData(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var p = function (n) { return n < 10 ? "0" + n : String(n); };
    return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1);
  }
  function fmtNota(n) {
    if (n === null || n === undefined || n === "") return null;
    var v = Number(n);
    if (!isFinite(v)) return null;
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  }
  function notaTom(n) {
    var v = Number(n);
    if (!isFinite(v)) return "vazio";
    if (v >= 7) return "bom";
    if (v >= 5) return "medio";
    return "baixo";
  }

  // ------------------------------------------------------------------- estilos
  var CSS = ""
    + "#sdf-custom-view{padding:22px 16px 100px}"
    + "@media(min-width:721px){#sdf-custom-view{padding:26px 28px 40px}}"
    + ".sdf-view{display:flex;flex-direction:column;gap:18px;color:var(--foreground);animation:sdfFade .25s ease}"

    + "@keyframes sdfFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"
    + ".sdf-view-head h1{margin:0;font-size:1.45rem;letter-spacing:-.02em;color:var(--foreground)}"
    + ".sdf-view-head p{margin:4px 0 0;color:var(--muted);font-size:.9rem}"
    + ".sdf-segment{display:flex;gap:0;border-bottom:1px solid var(--border)}"
    + ".sdf-segment button{flex:1;padding:12px 8px;border:0;background:none;font:inherit;font-weight:600;font-size:1rem;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent}"
    + ".sdf-segment button.is-active{color:var(--primary-strong);border-bottom-color:var(--primary)}"
    + ".sdf-card{background:var(--card);border:1px solid var(--border-soft);border-radius:var(--radius,17px);box-shadow:var(--shadow-soft);overflow:hidden}"
    + ".sdf-table-wrap{overflow-x:auto}"
    + ".sdf-table{width:100%;border-collapse:collapse;min-width:420px;font-size:.9rem;color:var(--card-foreground)}"
    + ".sdf-table thead th{background:var(--primary);color:var(--primary-foreground);font-weight:600;padding:14px 12px;text-align:center;white-space:nowrap}"
    + ".sdf-table thead th:first-child{text-align:left}"
    + ".sdf-table tbody td{padding:12px;text-align:center;border-top:1px solid var(--border-soft)}"
    + ".sdf-table tbody td:first-child{text-align:left;font-weight:600;max-width:190px}"
    + ".sdf-table tbody tr{cursor:pointer}"
    + ".sdf-table tbody tr.is-open{background:var(--card-soft)}"
    + ".sdf-chev{display:inline-block;margin-right:8px;color:var(--muted);transition:transform .18s ease}"
    + ".sdf-table tbody tr.is-open .sdf-chev{transform:rotate(90deg)}"
    + ".sdf-pill{display:inline-block;min-width:52px;padding:6px 10px;border-radius:999px;font-weight:700}"
    + ".sdf-pill.bom{background:var(--green-soft);color:var(--green)}"
    + ".sdf-pill.medio{background:color-mix(in oklab,var(--amber) 18%,transparent);color:var(--amber)}"
    + ".sdf-pill.baixo{background:color-mix(in oklab,var(--red) 18%,transparent);color:var(--red)}"
    + ".sdf-pill.vazio{background:transparent;color:var(--muted);border:1px dashed var(--border)}"
    + ".sdf-detail{padding:18px;border-top:1px solid var(--border-soft);display:flex;flex-direction:column;gap:16px}"
    + ".sdf-detail h3{margin:0;text-align:center;color:var(--primary-strong);font-size:1rem;letter-spacing:.03em;text-transform:uppercase}"
    + ".sdf-detail .sdf-bim{text-align:center;font-weight:700;color:var(--muted);font-size:.82rem;letter-spacing:.08em}"
    + ".sdf-box{background:var(--card-soft);border:1px solid var(--border-soft);border-radius:14px;padding:16px}"
    + ".sdf-box h4{margin:0 0 10px;text-align:right;font-size:.9rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted-strong)}"
    + ".sdf-bar-label{font-size:.85rem;color:var(--muted);margin-bottom:4px}"
    + ".sdf-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px}"
    + ".sdf-bar-track{flex:1;height:7px;border-radius:999px;background:var(--border);overflow:hidden}"
    + ".sdf-bar-fill{height:100%;border-radius:999px;background:var(--primary)}"
    + ".sdf-bar b{font-size:1rem;color:var(--foreground)}"
    + ".sdf-mini{width:100%;border-collapse:collapse;font-size:.85rem;color:var(--card-foreground)}"
    + ".sdf-mini th{text-align:right;padding:4px 6px;color:var(--muted);font-weight:700}"
    + ".sdf-mini th:first-child{text-align:left}"
    + ".sdf-mini td{padding:6px;border-top:1px dotted var(--border);text-align:right}"
    + ".sdf-mini td:first-child{text-align:left}"
    + ".sdf-freq-row{display:flex;align-items:center;gap:12px;margin-bottom:12px}"
    + ".sdf-donut{width:38px;height:38px;border-radius:50%;flex:0 0 38px}"
    + ".sdf-empty{padding:26px;text-align:center;color:var(--muted)}"
    + ".sdf-chips{display:flex;gap:8px;flex-wrap:wrap}"
    + ".sdf-chips button{padding:7px 14px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--muted-strong);font:inherit;font-size:.85rem;cursor:pointer}"
    + ".sdf-chips button.is-active{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}"
    + ".sdf-nota-item{display:flex;align-items:center;gap:14px;padding:14px 16px;border-top:1px solid var(--border-soft)}"
    + ".sdf-nota-item:first-child{border-top:0}"
    + ".sdf-nota-item .sdf-nota-copy{flex:1;min-width:0}"
    + ".sdf-turma-list{overflow:hidden}.sdf-turma-item{display:flex;align-items:center;gap:12px;padding:14px 16px;border-top:1px solid var(--border-soft)}.sdf-turma-item:first-child{border-top:0}.sdf-turma-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(139,92,246,.24);color:#c4b5fd;font-weight:800}.sdf-turma-copy{min-width:0}.sdf-turma-copy strong{display:block;color:var(--foreground);font-size:.96rem}.sdf-turma-copy span{display:block;color:var(--muted);font-size:.82rem;margin-top:3px}"
    + ".sdf-nota-item strong{display:block;font-size:.96rem;color:var(--foreground)}"
    + ".sdf-nota-item span{display:block;font-size:.82rem;color:var(--muted);margin-top:2px}"
    + ".sdf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}"
    + ".sdf-kpi{padding:14px 16px}"
    + ".sdf-kpi b{display:block;font-size:1.4rem;color:var(--foreground)}"
    + ".sdf-kpi span{font-size:.8rem;color:var(--muted)}";


  function injectCss() {
    if (document.getElementById("sdf-notas-css")) return;
    var tag = document.createElement("style");
    tag.id = "sdf-notas-css";
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  // -------------------------------------------------------------- montar/tirar
  function appMain() { return document.querySelector(".app-main"); }

  // Barra superior (com o botão de menu) e navegação inferior continuam visíveis.
  function isChrome(child) {
    return child.classList && (child.classList.contains("topbar") || child.classList.contains("bottom-nav"));
  }

  function root() {
    var main = appMain();
    if (!main) return null;
    var el = main.querySelector(":scope > #sdf-custom-view");
    if (!el) {
      el = document.createElement("div");
      el.id = "sdf-custom-view";
      var nav = main.querySelector(":scope > .bottom-nav");
      if (nav) main.insertBefore(el, nav);
      else main.appendChild(el);
    }
    Array.prototype.forEach.call(main.children, function (child) {
      if (child === el || isChrome(child)) return;
      if (child.dataset.sdfHidden === undefined) {
        child.dataset.sdfHidden = child.style.display || "";
        child.style.display = "none";
      }
    });
    return el;
  }


  function unmount() {
    var main = appMain();
    mode = null;
    openRow = null;
    if (!main) return;
    var el = main.querySelector(":scope > #sdf-custom-view");
    if (el) el.remove();
    Array.prototype.forEach.call(main.children, function (child) {
      if (child.dataset && child.dataset.sdfHidden !== undefined) {
        child.style.display = child.dataset.sdfHidden;
        delete child.dataset.sdfHidden;
      }
    });
    syncNav();
  }

  function render(next) {
    injectCss();
    if (next) mode = next;
    var el = root();
    if (!el) return;
    el.innerHTML = '<div class="sdf-view"><div class="sdf-empty">Carregando…</div></div>';
    load().then(function (data) {
      if (!mode) return;
      var target = root();
      if (!target) return;
      target.innerHTML = mode === "notas" ? viewNotas(data) : mode === "turma" ? viewTurma(data) : viewBoletim(data);
      wire(target, data);
    });
    syncNav();
  }

  // ------------------------------------------------------------------ boletim
  function disciplinas(data) {
    var map = new Map();
    data.boletim.forEach(function (row) {
      if (row.bimestre === "Média final") return;
      var key = String(row.disciplinaId || row.nomeDisciplina);
      if (!map.has(key)) {
        map.set(key, { key: key, nome: row.nomeDisciplina, bim: {}, linhas: {} });
      }
      var item = map.get(key);
      var b = row.bimestreNumero;
      if (b) { item.bim[b] = row.nota; item.linhas[b] = row; }
    });
    data.boletim.forEach(function (row) {
      if (row.bimestre !== "Média final") return;
      var key = String(row.disciplinaId || row.nomeDisciplina);
      if (map.has(key)) map.get(key).mediaFinal = row.nota;
    });
    return Array.from(map.values()).sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
  }

  function pill(nota) {
    var txt = fmtNota(nota);
    return '<span class="sdf-pill ' + notaTom(nota) + '">' + (txt || "-") + "</span>";
  }

  function viewBoletim(data) {
    var lista = disciplinas(data);
    var head = ""
      + '<div class="sdf-view-head"><h1>Boletim e Avaliações</h1>'
      + "<p>Suas notas por bimestre, com detalhes de avaliações e frequência.</p></div>"
      + '<div class="sdf-segment">'
      + '<button data-tab="evolucao" class="' + (boletimTab === "evolucao" ? "is-active" : "") + '">Evolução</button>'
      + '<button data-tab="comparativo" class="' + (boletimTab === "comparativo" ? "is-active" : "") + '">Comparativo</button>'
      + "</div>";

    if (!lista.length) {
      return '<div class="sdf-view">' + head + '<div class="sdf-card"><div class="sdf-empty">'
        + (data.ok ? "Nenhuma nota lançada até agora." : "Não foi possível carregar o boletim agora.")
        + "</div></div></div>";
    }

    var body;
    if (boletimTab === "comparativo") {
      body = '<div class="sdf-card">' + lista.map(function (item) {
        var barras = [1, 2, 3, 4].map(function (b) {
          var n = item.bim[b];
          var v = Number(n);
          var pct = isFinite(v) ? Math.max(4, Math.min(100, v * 10)) : 0;
          return '<div class="sdf-bar"><span class="sdf-bar-label" style="width:52px;margin:0">' + b + "º Bim.</span>"
            + '<span class="sdf-bar-track"><span class="sdf-bar-fill" style="width:' + pct + '%"></span></span>'
            + "<b>" + (fmtNota(n) || "-") + "</b></div>";
        }).join("");
        return '<div class="sdf-detail" style="border-top:1px solid var(--border-soft)"><h3>' + esc(item.nome) + "</h3>" + barras + "</div>";
      }).join("") + "</div>";
    } else {
      var rows = lista.map(function (item) {
        var cells = [1, 2, 3, 4].map(function (b) { return "<td>" + pill(item.bim[b]) + "</td>"; }).join("");
        var tr = '<tr data-row="' + esc(item.key) + '" class="' + (openRow === item.key ? "is-open" : "") + '">'
          + '<td><span class="sdf-chev">›</span>' + esc(item.nome) + "</td>" + cells + "</tr>";
        if (openRow === item.key) {
          tr += '<tr class="is-open"><td colspan="5" style="padding:0">' + detalhe(item, data) + "</td></tr>";
        }
        return tr;
      }).join("");
      body = '<div class="sdf-card sdf-table-wrap"><table class="sdf-table"><thead><tr>'
        + "<th>Componente</th><th>1º Bim.</th><th>2º Bim.</th><th>3º Bim.</th><th>4º Bim.</th>"
        + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    }
    return '<div class="sdf-view">' + head + body + "</div>";
  }

  function ultimoBimestre(item) {
    for (var b = 4; b >= 1; b--) if (item.linhas[b]) return b;
    return 1;
  }

  function detalhe(item, data) {
    var b = ultimoBimestre(item);
    var linha = item.linhas[b] || {};
    var nota = item.bim[b];
    var notaPct = isFinite(Number(nota)) ? Math.max(3, Math.min(100, Number(nota) * 10)) : 0;
    var avaliacoes = data.avaliacoes.filter(function (a) {
      return String(a.disciplinaId) === String(item.linhas[b] && item.linhas[b].disciplinaId) && (!a.bimestre || a.bimestre === b);
    });
    var linhasAv = avaliacoes.length
      ? avaliacoes.map(function (a) {
          return "<tr><td>" + esc(a.prova) + "</td><td>" + fmtData(a.data) + "</td><td>"
            + (fmtNota(a.nota) || "-") + "</td><td>" + (a.peso != null ? fmtNota(a.peso) + "%" : "-") + "</td></tr>";
        }).join("")
      : '<tr><td colspan="4" style="opacity:.6">Nenhuma avaliação lançada.</td></tr>';

    var freq = linha.frequencia;
    var faltas = linha.faltas || 0;
    var comp = linha.faltasCompensadas || 0;
    var donut = function (pct, cor) {
      var p = Math.max(0, Math.min(100, Number(pct) || 0));
      return '<span class="sdf-donut" style="background:conic-gradient(' + cor + " " + p + "%, var(--border) 0);"
        + 'mask:radial-gradient(circle,transparent 52%,#000 53%);-webkit-mask:radial-gradient(circle,transparent 52%,#000 53%)"></span>';
    };

    return '<div class="sdf-detail">'
      + "<h3>" + esc(item.nome) + "</h3>"
      + '<div class="sdf-bim">' + b + "º BIMESTRE</div>"
      + '<div class="sdf-box"><h4>Notas</h4>'
      + '<div class="sdf-bar-label">Sua nota foi:</div>'
      + '<div class="sdf-bar"><span class="sdf-bar-track"><span class="sdf-bar-fill" style="width:' + notaPct + '%"></span></span><b>' + (fmtNota(nota) || "-") + "</b></div>"
      + (item.mediaFinal != null ? '<div class="sdf-bar-label">Média final:</div><div class="sdf-bar"><span class="sdf-bar-track"><span class="sdf-bar-fill" style="width:' + Math.min(100, Number(item.mediaFinal) * 10) + '%"></span></span><b>' + fmtNota(item.mediaFinal) + "</b></div>" : "")
      + '<h4 style="margin-top:14px">Avaliações</h4>'
      + '<table class="sdf-mini"><thead><tr><th>Avaliação</th><th>Data</th><th>Nota</th><th>Peso</th></tr></thead><tbody>'
      + linhasAv + "</tbody></table></div>"
      + '<div class="sdf-box freq"><h4>Frequência</h4>'
      + '<div class="sdf-freq-row">' + donut(freq, "var(--green)") + "<div><b>" + (freq != null ? fmtNota(freq) + "%" : "-") + "</b> de frequência</div></div>"
      + '<div class="sdf-freq-row">' + donut(comp ? 100 : 0, "var(--amber)") + "<div>" + (comp ? "<b>" + comp + "</b> ausência(s) compensada(s)" : "<b>Nenhuma</b> ausência foi compensada") + "</div></div>"
      + '<div class="sdf-freq-row">' + donut(faltas ? Math.min(100, faltas * 10) : 0, "var(--primary)") + "<div>Faltou em <b>" + faltas + "</b> aulas nesse bimestre</div></div>"
      + "</div></div>";
  }

  // -------------------------------------------------------------------- turma
  function viewTurma(data) {
    var alunos = Array.isArray(data.turma) ? data.turma.slice().sort(function (a, b) {
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    }) : [];
    var rows = alunos.map(function (aluno) {
      // O Worker já remove qualquer campo sensível; aqui também usamos somente nome e RA.
      return '<div class="sdf-turma-item"><div class="sdf-turma-avatar">' + esc(String(aluno.nome || "Aluno").slice(0, 1).toUpperCase()) + '</div><div class="sdf-turma-copy"><strong>' + esc(aluno.nome || "Aluno") + '</strong><span>RA: ' + esc(aluno.ra || "não informado") + '</span></div></div>';
    }).join("");
    return '<div class="sdf-view sdf-turma-view"><div class="sdf-view-head"><h1>Turma</h1><p>Alunos da sua turma, com nome completo e RA.</p></div>'
      + '<div class="sdf-card sdf-kpi"><b>' + alunos.length + '</b><span>alunos encontrados</span></div>'
      + '<div class="sdf-card sdf-turma-list">' + (rows || '<div class="sdf-empty">' + (data.turmaOk ? "Nenhum aluno encontrado." : "Não foi possível carregar os alunos da turma agora.") + '</div>') + '</div></div>';
  }

  // -------------------------------------------------------------------- notas
  function viewNotas(data) {
    var todas = data.avaliacoes;
    var comNota = todas.filter(function (a) { return a.nota != null; });
    var media = comNota.length
      ? Math.round((comNota.reduce(function (acc, a) { return acc + Number(a.nota); }, 0) / comNota.length) * 10) / 10
      : null;
    var lista = notasFiltro ? todas.filter(function (a) { return a.bimestre === notasFiltro; }) : todas;

    var chips = [0, 1, 2, 3, 4].map(function (b) {
      return '<button data-bim="' + b + '" class="' + (notasFiltro === b ? "is-active" : "") + '">'
        + (b === 0 ? "Todos" : b + "º bimestre") + "</button>";
    }).join("");

    var itens = lista.length
      ? lista.map(function (a) {
          return '<div class="sdf-nota-item"><div class="sdf-nota-copy"><strong>' + esc(a.prova) + "</strong><span>"
            + esc(a.disciplina || "Disciplina") + " · " + fmtData(a.data)
            + (a.bimestre ? " · " + a.bimestre + "º bim." : "")
            + (a.peso != null ? " · peso " + fmtNota(a.peso) + "%" : "") + "</span></div>"
            + pill(a.nota) + "</div>";
        }).join("")
      : '<div class="sdf-empty">' + (data.ok ? "Nenhuma prova encontrada para este filtro." : "Não foi possível carregar suas notas agora.") + "</div>";

    return '<div class="sdf-view">'
      + '<div class="sdf-view-head"><h1>Notas</h1><p>Todas as provas e atividades avaliadas, com data e nota.</p></div>'
      + '<div class="sdf-kpis">'
      + '<div class="sdf-card sdf-kpi"><b>' + todas.length + "</b><span>avaliações lançadas</span></div>"
      + '<div class="sdf-card sdf-kpi"><b>' + comNota.length + "</b><span>já com nota</span></div>"
      + '<div class="sdf-card sdf-kpi"><b>' + (media != null ? fmtNota(media) : "-") + "</b><span>média das notas</span></div>"
      + "</div>"
      + '<div class="sdf-chips">' + chips + "</div>"
      + '<div class="sdf-card">' + itens + "</div></div>";
  }

  // -------------------------------------------------------------------- eventos
  function wire(el, data) {
    el.querySelectorAll(".sdf-segment button").forEach(function (btn) {
      btn.addEventListener("click", function () { boletimTab = btn.dataset.tab; openRow = null; render(); });
    });
    el.querySelectorAll(".sdf-chips button").forEach(function (btn) {
      btn.addEventListener("click", function () { notasFiltro = Number(btn.dataset.bim) || 0; render(); });
    });
    el.querySelectorAll("tr[data-row]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        openRow = openRow === tr.dataset.row ? null : tr.dataset.row;
        render();
      });
    });
    void data;
  }

  // ----------------------------------------------------------------------- nav
  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>';

  function syncNav() {
    var link = document.querySelector("[data-sdf-notas]");
    if (link) link.classList.toggle("is-active", mode === "notas");
    var bottomLink = document.querySelector("[data-sdf-notas-bottom]");
    if (bottomLink) bottomLink.classList.toggle("active", mode === "notas");
    var turmaLink = document.querySelector("[data-sdf-turma]");
    if (turmaLink) turmaLink.classList.toggle("is-active", mode === "turma");
    var turmaBottomLink = document.querySelector("[data-sdf-turma-bottom]");
    if (turmaBottomLink) turmaBottomLink.classList.toggle("active", mode === "turma");
    var nav = document.querySelector(".rail-nav");
    if (nav && mode === "notas") {
      nav.querySelectorAll("a:not([data-sdf-notas])").forEach(function (a) { a.classList.remove("is-active"); });
    }
    var bottomNav = document.querySelector(".bottom-nav");
    if (bottomNav && mode === "notas") {
      bottomNav.querySelectorAll("a:not([data-sdf-notas-bottom])").forEach(function (a) { a.classList.remove("active"); });
    }
  }

  function configureNotesLink(link, bottom) {
    link.setAttribute(bottom ? "data-sdf-notas-bottom" : "data-sdf-notas", "1");
    link.setAttribute("href", "#notas");
    link.classList.remove("active", "is-active");
    var count = link.querySelector(".nav-count");
    if (count) count.remove();
    var svg = link.querySelector("svg");
    if (svg) svg.outerHTML = ICON;
    var labels = link.querySelectorAll("span");
    if (labels.length) {
      if (bottom) {
        labels[labels.length - 1].textContent = "Notas";
      } else {
        for (var i = 0; i < labels.length; i++) labels[i].textContent = "Notas";
      }
    } else {
      link.appendChild(document.createTextNode("Notas"));
    }
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      render("notas");
    });
    return link;
  }

  function ensureNav() {
    var nav = document.querySelector(".rail-nav");
    if (!nav || nav.querySelector("[data-sdf-notas]")) return;
    var ref = nav.querySelector('a[href="/boletim"]') || nav.querySelector("a");
    if (!ref) return;
    var link = configureNotesLink(ref.cloneNode(true), false);
    if (ref.nextSibling) nav.insertBefore(link, ref.nextSibling);
    else nav.appendChild(link);
  }

  function ensureBottomNav() {
    var nav = document.querySelector(".bottom-nav");
    if (!nav || nav.querySelector("[data-sdf-notas-bottom]")) return;
    var ref = nav.querySelector('a[href="/boletim"]') || nav.querySelector("a");
    if (!ref) return;
    var link = configureNotesLink(ref.cloneNode(true), true);
    if (ref.nextSibling) nav.insertBefore(link, ref.nextSibling);
    else nav.appendChild(link);
  }

  function configureTurmaLink(link, bottom) {
    link.setAttribute(bottom ? "data-sdf-turma-bottom" : "data-sdf-turma", "1");
    link.setAttribute("href", "#turma");
    link.classList.remove("active", "is-active");
    var svg = link.querySelector("svg");
    if (svg) svg.outerHTML = ICON;
    var labels = link.querySelectorAll("span");
    if (labels.length) {
      if (bottom) labels[labels.length - 1].textContent = "Turma";
      else for (var i = 0; i < labels.length; i++) labels[i].textContent = "Turma";
    } else {
      link.appendChild(document.createTextNode("Turma"));
    }
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      render("turma");
    });
    return link;
  }
  function ensureTurmaNav() {
    var nav = document.querySelector(".rail-nav");
    if (nav && !nav.querySelector("[data-sdf-turma]")) {
      var ref = nav.querySelector('a[data-sdf-notas]') || nav.querySelector('a[href="/boletim"]') || nav.querySelector("a");
      if (ref) nav.insertBefore(configureTurmaLink(ref.cloneNode(true), false), ref.nextSibling);
    }
    var bottom = document.querySelector(".bottom-nav");
    if (bottom && !bottom.querySelector("[data-sdf-turma-bottom]")) {
      var bottomRef = bottom.querySelector('a[data-sdf-notas-bottom]') || bottom.querySelector('a[href="/boletim"]') || bottom.querySelector("a");
      if (bottomRef) bottom.insertBefore(configureTurmaLink(bottomRef.cloneNode(true), true), bottomRef.nextSibling);
    }
  }

  // ------------------------------------------------------------- rota do boletim
  function onRoute() {
    ensureNav();
    ensureBottomNav();
    ensureTurmaNav();
    var isBoletim = location.pathname.replace(/\/+$/, "") === "/boletim";
    if (isBoletim) {
      if (mode !== "boletim") { openRow = null; render("boletim"); }
      return;
    }
    if (mode) unmount();
  }

  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var out = original.apply(this, arguments);
      setTimeout(onRoute, 30);
      return out;
    };
  });
  window.addEventListener("popstate", function () { setTimeout(onRoute, 30); });

  var observer = new MutationObserver(function () {
    ensureNav();
    ensureBottomNav();
    ensureTurmaNav();
    if (location.pathname.replace(/\/+$/, "") === "/boletim" && mode !== "boletim") {
      var main = appMain();
      if (main && !main.querySelector("#sdf-custom-view")) render("boletim");
    }
  });

  function boot() {
    injectCss();
    observer.observe(document.body, { childList: true, subtree: true });
    onRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
