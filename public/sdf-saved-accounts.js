/* Contas Salvas: guarda contas usadas no login e permite entrar com um toque. */
(function () {
  var KEY = "sdf.saved-accounts.v1";

  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) {}
  }
  function upsert(acc) {
    if (!acc.numero || !acc.senha) return;
    var list = load().filter(function (a) {
      return !(a.numero === acc.numero && a.digito === acc.digito && a.uf === acc.uf);
    });
    list.unshift(acc);
    save(list);
  }

  var style = document.createElement("style");
  style.textContent = [
    ".sa-btn{margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;",
    "padding:12px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);",
    "color:inherit;font:inherit;font-weight:600;cursor:pointer;transition:background .2s}",
    ".sa-btn:hover{background:rgba(255,255,255,.12)}",
    ".sa-overlay{position:fixed;inset:0;background:rgba(4,8,14,.72);backdrop-filter:blur(6px);z-index:9999;",
    "display:flex;align-items:center;justify-content:center;padding:20px}",
    ".sa-modal{width:100%;max-width:420px;background:#0f1720;color:#f4f7fb;border:1px solid rgba(255,255,255,.12);",
    "border-radius:20px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.5);max-height:80vh;overflow:auto}",
    ".sa-modal h3{margin:0 0 4px;font-size:18px}",
    ".sa-modal p.sa-sub{margin:0 0 16px;font-size:13px;opacity:.65}",
    ".sa-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;margin-bottom:10px;",
    "border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:inherit;",
    "font:inherit;cursor:pointer}",
    ".sa-item:hover{background:rgba(255,255,255,.1)}",
    ".sa-item .sa-ra{font-weight:700;font-size:14px}",
    ".sa-item .sa-meta{font-size:12px;opacity:.6}",
    ".sa-del{margin-left:auto;background:none;border:none;color:inherit;opacity:.5;cursor:pointer;font-size:16px;padding:4px 6px}",
    ".sa-del:hover{opacity:1;color:#ff8080}",
    ".sa-close{width:100%;margin-top:6px;padding:11px;border-radius:14px;border:none;background:rgba(255,255,255,.12);",
    "color:inherit;font:inherit;font-weight:600;cursor:pointer}",
    ".sa-empty{font-size:13px;opacity:.7;margin:8px 0 16px}",
  ].join("");
  document.head.appendChild(style);

  function setValue(input, value) {
    var setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fields() {
    return {
      numero: document.getElementById("ra-numero"),
      digito: document.querySelector('input[aria-label="Dígito do RA"]'),
      uf: document.querySelector('input[aria-label="UF do RA"]'),
      senha: document.getElementById("senha"),
    };
  }

  function closeModal() {
    var o = document.querySelector(".sa-overlay");
    if (o) o.remove();
  }

  function login(acc) {
    var f = fields();
    if (!f.numero || !f.senha) return;
    setValue(f.numero, acc.numero);
    if (f.digito) setValue(f.digito, acc.digito || "");
    if (f.uf) setValue(f.uf, acc.uf || "");
    setValue(f.senha, acc.senha);
    closeModal();
    setTimeout(function () {
      var btn = document.querySelector(".login-submit");
      if (btn) btn.click();
    }, 120);
  }

  function openModal() {
    closeModal();
    var list = load();
    var overlay = document.createElement("div");
    overlay.className = "sa-overlay";
    var modal = document.createElement("div");
    modal.className = "sa-modal";
    var title = document.createElement("h3");
    title.textContent = "Contas Salvas";
    var sub = document.createElement("p");
    sub.className = "sa-sub";
    sub.textContent = "Toque em uma conta para entrar automaticamente.";
    modal.appendChild(title);
    modal.appendChild(sub);

    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "sa-empty";
      empty.textContent =
        "Nenhuma conta salva ainda. Faça login uma vez e ela aparecerá aqui.";
      modal.appendChild(empty);
    }

    list.forEach(function (acc, i) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "sa-item";
      var info = document.createElement("div");
      var ra = document.createElement("div");
      ra.className = "sa-ra";
      ra.textContent =
        acc.numero + (acc.digito ? "-" + acc.digito : "") + " " + (acc.uf || "");
      var meta = document.createElement("div");
      meta.className = "sa-meta";
      meta.textContent = acc.nome || "Aluno";
      info.appendChild(ra);
      info.appendChild(meta);
      item.appendChild(info);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "sa-del";
      del.textContent = "×";
      del.title = "Remover conta";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        var l = load();
        l.splice(i, 1);
        save(l);
        openModal();
      });
      item.appendChild(del);
      item.addEventListener("click", function () {
        login(acc);
      });
      modal.appendChild(item);
    });

    var close = document.createElement("button");
    close.type = "button";
    close.className = "sa-close";
    close.textContent = "Fechar";
    close.addEventListener("click", closeModal);
    modal.appendChild(close);

    overlay.appendChild(modal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }

  function inject() {
    var form = document.querySelector("form.login-form");
    if (!form || form.querySelector(".sa-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sa-btn";
    btn.textContent = "Contas Salvas";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
    form.appendChild(btn);

    form.addEventListener("submit", function () {
      var f = fields();
      if (!f.numero || !f.senha) return;
      var acc = {
        numero: f.numero.value,
        digito: f.digito ? f.digito.value : "",
        uf: f.uf ? f.uf.value : "",
        senha: f.senha.value,
      };
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (!document.querySelector("form.login-form")) {
          upsert(acc);
          clearInterval(timer);
        } else if (tries > 40) {
          clearInterval(timer);
        }
      }, 300);
    });
  }

  var obs = new MutationObserver(inject);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  inject();
})();
