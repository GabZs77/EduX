import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { loadSavedAccounts, saveSavedAccounts, type SavedAccount } from "@/lib/sed/client";
import { useStudent } from "./student-context";

export function LoginPage() {
  const { login, startDemo, loading, error } = useStudent();
  const [numero, setNumero] = useState("");
  const [digito, setDigito] = useState("");
  const [uf, setUf] = useState("SP");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState("");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const accounts = useMemo(() => loadSavedAccounts(), [accountsOpen, loading]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    const usuario = `${numero.trim()}${digito.trim()}${uf.trim().toUpperCase()}`;
    if (!numero.trim() || !digito.trim() || !uf.trim() || !senha) {
      setLocalError("Preencha o RA, o dígito, a UF e a senha.");
      return;
    }
    try {
      await login(usuario, senha, { numero: numero.trim(), digito: digito.trim(), uf: uf.trim().toUpperCase() });
    } catch {
      /* error already stored */
    }
  }

  function applyAccount(account: SavedAccount) {
    setNumero(account.numero);
    setDigito(account.digito);
    setUf(account.uf || "SP");
    setSenha(account.senha);
    setAccountsOpen(false);
  }

  function removeAccount(index: number) {
    const next = loadSavedAccounts().filter((_, i) => i !== index);
    saveSavedAccounts(next);
    setAccountsOpen(true);
  }

  return (
    <div className="login-page">
      <div className="login-surface">
        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />
        {accounts.length > 0 ? (
          <button className="saved-trigger" type="button" onClick={() => setAccountsOpen(true)}>
            Contas salvas
          </button>
        ) : null}
        <div className="login-brand">
          <div className="login-mark-wrap">
            <img src="/logo.svg" alt="EduX" />
          </div>
          <span>
            EduX <em>Aluno</em>
          </span>
        </div>
        <div className="login-copy">
          <span className="eyebrow">Acesso do aluno</span>
          <h1>Suas notas escolares em um só lugar.</h1>
          <p>Entre para consultar suas notas por disciplina e bimestre.</p>
          <div className="login-utility-list" aria-label="Recursos acadêmicos">
            <span>Notas</span>
          </div>
        </div>
        <form className="login-form" onSubmit={onSubmit}>
          <div className="field-group">
            <label htmlFor="ra-numero">RA do aluno</label>
            <div className="ra-fields">
              <input
                id="ra-numero"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
                placeholder="Número"
                autoComplete="username"
              />
              <input
                aria-label="Dígito do RA"
                inputMode="text"
                maxLength={2}
                value={digito}
                onChange={(e) => setDigito(e.target.value.toUpperCase().replace(/[^0-9X]/g, ""))}
                placeholder="Díg."
              />
              <input
                aria-label="UF do RA"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                placeholder="UF"
              />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="senha">Senha</label>
            <div className="password-field">
              <KeyRound size={17} />
              <input
                id="senha"
                type={show ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {(localError || error) && (
            <div className="login-error" role="alert">
              {localError || error}
            </div>
          )}
          <button type="submit" disabled={loading} className="login-submit">
            {loading ? "Verificando acesso..." : "Entrar na minha conta"}
            <ArrowRight size={18} />
          </button>
          <button type="button" className="login-demo" onClick={startDemo}>
            Explorar demonstração
          </button>
        </form>
        <p className="login-note">
          <ShieldCheck size={16} />
          <span>Seus dados acadêmicos só são consultados após a autenticação.</span>
        </p>
      </div>
      {accountsOpen ? (
        <div className="sa-overlay" onClick={() => setAccountsOpen(false)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Contas salvas</h3>
            <p className="sa-sub">Toque em uma conta para preencher o acesso.</p>
            {accounts.length === 0 ? (
              <p className="sa-empty">Nenhuma conta salva ainda. Faça login uma vez e ela aparecerá aqui.</p>
            ) : (
              accounts.map((acc, i) => (
                <button key={`${acc.numero}-${i}`} type="button" className="sa-item" onClick={() => applyAccount(acc)}>
                  <div>
                    <div className="sa-ra">
                      {acc.numero}
                      {acc.digito ? `-${acc.digito}` : ""} {acc.uf}
                    </div>
                    <div className="sa-meta">{acc.nome || "Aluno"}</div>
                  </div>
                  <span
                    className="sa-del"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAccount(i);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))
            )}
            <button type="button" className="sa-close" onClick={() => setAccountsOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
