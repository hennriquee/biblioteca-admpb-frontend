import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import {
  IconExit,
  IconEye,
  IconEyeOff,
  IconSearch,
  IconShield,
  IconUser,
} from "../components/Icons.jsx";
import { normalizeText } from "../utils/bookFilter.js";
import { formatStoredPhone } from "../utils/whatsapp.js";

/**
 * MANUTENCAO. Esta tela so abre com o login reservado (digitado na propria
 * tela de entrada); nenhum administrador chega aqui, nem digitando o endereco.
 *
 * E o unico lugar do sistema que mexe em QUEM ENTRA NO PAINEL:
 *  - tornar administrador alguem do cadastro (pedindo login E senha, os dois
 *    obrigatorios: sem eles a pessoa ficaria administradora sem como entrar);
 *  - desfazer administrador (login e senha voltam a ser nada; a ficha, o
 *    numero, a foto e o historico de emprestimos continuam intactos);
 *  - trocar o login ou a senha de um administrador.
 *
 * O que NAO se faz aqui: livro, emprestimo, nome, WhatsApp e foto. Isso e
 * trabalho do painel, com conta de administrador.
 */

const MIN_PASSWORD = 6;

function matchesPerson(person, term) {
  if (!term) return true;
  if (term.startsWith("#")) return String(person.code || "") === term.slice(1);
  return (
    normalizeText(person.fullName).includes(term) ||
    String(person.username || "").includes(term) ||
    String(person.phone || "").includes(term.replace(/\D/g, "")) ||
    String(person.code || "") === term
  );
}

// Campo de senha com o olhinho de mostrar/ocultar (o mesmo da tela de entrada).
function PasswordField({ label, hint, value, onChange, required }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field__input-wrap">
        <input
          type={visible ? "text" : "password"}
          value={value}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
        <button
          type="button"
          className="field__toggle"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? (
            <IconEyeOff width={18} height={18} />
          ) : (
            <IconEye width={18} height={18} />
          )}
        </button>
      </div>
      {hint ? <small className="field__hint">{hint}</small> : null}
    </label>
  );
}

export default function DevConsole() {
  const { logout } = useAuth();
  const { notify } = useToast();

  // null = ainda carregando a lista (a tela mostra o esqueleto).
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Um modal de cada vez: subir alguem a administrador, trocar login/senha de
  // um administrador ou confirmar o desfazer.
  const [promote, setPromote] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [confirmDemote, setConfirmDemote] = useState(null);
  const [saving, setSaving] = useState(false);

  const requestRef = useRef(0);
  // Trava contra o clique duplo (dois toques rapidos no "Salvar" disparam duas
  // vezes antes de o botao desabilitar).
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const data = await api("/api/dev/people");
      if (requestId !== requestRef.current) return;
      setPeople(data);
      setError("");
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const term = normalizeText(search);
  const { admins, users } = useMemo(() => {
    const shown = (people || []).filter((person) =>
      matchesPerson(person, term),
    );
    return {
      admins: shown.filter((person) => person.isAdmin),
      users: shown.filter((person) => !person.isAdmin),
    };
  }, [people, term]);

  // Roda a acao, avisa na tela e recarrega as duas listas.
  async function run(action, successMessage) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await action();
      notify(successMessage, "success");
      await load();
      return true;
    } catch (err) {
      notify(err.message, "error");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function savePromote(event) {
    event.preventDefault();
    const { person, username, password } = promote;
    // Os dois sao obrigatorios: sem login e senha a pessoa viraria
    // administradora sem forma de entrar. O servidor recusa do mesmo jeito.
    if (!username.trim() || !password) {
      notify(
        "Para tornar " +
          person.fullName +
          " administrador(a) é obrigatório definir um usuário e uma senha.",
        "error",
      );
      return;
    }
    if (password.length < MIN_PASSWORD) {
      notify("A senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }
    const done = await run(
      () =>
        api("/api/dev/people/" + person._id + "/admin", {
          method: "POST",
          body: { username, password },
        }),
      person.fullName + " agora é administrador(a).",
    );
    if (done) setPromote(null);
  }

  async function saveCredentials(event) {
    event.preventDefault();
    const { person, username, password } = credentials;
    if (password && password.length < MIN_PASSWORD) {
      notify("A senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }
    if (username === person.username && !password) {
      notify("Nada mudou: informe o novo usuário ou a nova senha.", "error");
      return;
    }
    const body = { username };
    if (password) body.password = password;
    const done = await run(
      () =>
        api("/api/dev/people/" + person._id + "/credentials", {
          method: "PUT",
          body,
        }),
      password ? "Senha trocada." : "Usuário trocado.",
    );
    if (done) setCredentials(null);
  }

  async function demote() {
    const person = confirmDemote;
    setConfirmDemote(null);
    await run(
      () =>
        api("/api/dev/people/" + person._id + "/admin", { method: "DELETE" }),
      person.fullName + " não é mais administrador(a).",
    );
  }

  const total = people?.length || 0;

  return (
    <div className="devshell">
      <div className="page devpage">
        <header className="devpage__head">
          <div>
            <span className="devpage__badge">Manutenção</span>
            <h1>Administradores e usuários</h1>
            <p className="page__sub">
              {people === null
                ? "Carregando…"
                : error
                  ? "Não foi possível carregar"
                  : total + " pessoa(s) no cadastro"}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={logout}>
            <IconExit width={18} height={18} />
            Sair
          </button>
        </header>

        <p className="muted">
          Esta tela é a única que mexe em quem entra no painel. Os
          administradores, na sessão deles, não conseguem tornar alguém
          administrador, desfazer isso nem trocar a senha de outra pessoa — só
          cuidar da própria conta.
        </p>

        <div className="searchbar">
          <IconSearch width={18} height={18} />
          <input
            type="search"
            placeholder="Buscar por nome, usuário, WhatsApp ou #número"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {people === null && !error ? (
          <ListSkeleton label="Carregando o cadastro…" />
        ) : null}

        {error && people === null ? (
          <div className="empty" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--ghost" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : null}

        {people !== null && error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {people !== null ? (
          <>
            <section className="devgroup">
              <h2>
                <IconShield width={18} height={18} />
                Administradores
                <small>{admins.length}</small>
              </h2>
              {admins.length === 0 ? (
                <p className="muted">
                  {term
                    ? "Nenhum administrador nesta busca."
                    : "Ninguém com acesso ao painel."}
                </p>
              ) : (
                <ul className={"peoplelist" + (refreshing ? " is-refreshing" : "")}>
                  {admins.map((person) => (
                    <li key={person._id} className="personrow">
                      <span className="personrow__code">
                        {person.code ? "#" + person.code : "—"}
                      </span>
                      <Avatar
                        src={person.photo}
                        name={person.fullName}
                        size={40}
                      />
                      <span className="personrow__text">
                        <strong title={person.fullName}>
                          <span className="personrow__name">
                            {person.fullName}
                          </span>
                          <span className="chip chip--admin">admin</span>
                        </strong>
                        <small>
                          @{person.username}
                          {person.phone
                            ? " · " + formatStoredPhone(person.phone)
                            : ""}
                        </small>
                      </span>
                      <span className="devrow__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() =>
                            setCredentials({
                              person,
                              username: person.username || "",
                              password: "",
                            })
                          }
                        >
                          Login e senha
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => setConfirmDemote(person)}
                        >
                          Desfazer admin
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="devgroup">
              <h2>
                <IconUser width={18} height={18} />
                Usuários
                <small>{users.length}</small>
              </h2>
              <p className="muted">
                Quem pega livros emprestados. Tornar alguém administrador não
                cria um cadastro novo: a mesma ficha (com o mesmo número, foto e
                histórico) passa a ter um login e uma senha.
              </p>
              {users.length === 0 ? (
                <p className="muted">
                  {term
                    ? "Nenhum usuário nesta busca."
                    : "Ninguém cadastrado ainda."}
                </p>
              ) : (
                <ul className={"peoplelist" + (refreshing ? " is-refreshing" : "")}>
                  {users.map((person) => (
                    <li key={person._id} className="personrow">
                      <span className="personrow__code">
                        {person.code ? "#" + person.code : "—"}
                      </span>
                      <Avatar
                        src={person.photo}
                        name={person.fullName}
                        size={40}
                      />
                      <span className="personrow__text">
                        <strong title={person.fullName}>
                          <span className="personrow__name">
                            {person.fullName}
                          </span>
                        </strong>
                        <small>
                          {person.phone
                            ? formatStoredPhone(person.phone)
                            : "sem WhatsApp"}
                          {" · "}
                          {person.loansCount} empréstimo(s)
                        </small>
                      </span>
                      <span className="devrow__actions">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() =>
                            setPromote({ person, username: "", password: "" })
                          }
                        >
                          Tornar admin
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>

      {/* Tornar administrador: login e senha sao obrigatorios */}
      <Modal
        open={Boolean(promote)}
        onClose={() => setPromote(null)}
        title="Tornar administrador(a)"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPromote(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="promote-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? "Salvando…" : "Tornar admin"}
            </button>
          </>
        }
      >
        {promote ? (
          <form id="promote-form" className="form" onSubmit={savePromote}>
            <p className="confirm__text">
              {(promote.person.code ? "#" + promote.person.code + " " : "") +
                promote.person.fullName}{" "}
              passa a entrar no painel. A ficha é a mesma: número, foto e
              histórico de empréstimos continuam como estão.
            </p>

            <label className="field">
              <span>Usuário (para entrar no painel)</span>
              <input
                value={promote.username}
                placeholder="Ex.: maria"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck="false"
                onChange={(event) =>
                  setPromote((form) => ({
                    ...form,
                    username: event.target.value.toLowerCase().trim(),
                  }))
                }
                autoFocus
                required
              />
              <small className="field__hint">
                De 3 a 20 caracteres: letras, números, ponto, hífen ou _.
              </small>
            </label>

            <PasswordField
              label="Senha"
              hint="Pelo menos 6 caracteres. Combine com a pessoa e peça para ela trocar depois, na própria conta."
              value={promote.password}
              onChange={(password) =>
                setPromote((form) => ({ ...form, password }))
              }
              required
            />

            <p className="field__hint">
              Os dois campos são obrigatórios: sem usuário e senha a pessoa
              ficaria administradora sem conseguir entrar.
            </p>
          </form>
        ) : null}
      </Modal>

      {/* Trocar login/senha de quem ja e administrador */}
      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="Login e senha"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setCredentials(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="credentials-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {credentials ? (
          <form
            id="credentials-form"
            className="form"
            onSubmit={saveCredentials}
          >
            <p className="confirm__text">
              {(credentials.person.code
                ? "#" + credentials.person.code + " "
                : "") + credentials.person.fullName}
            </p>

            <label className="field">
              <span>Usuário</span>
              <input
                value={credentials.username}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck="false"
                onChange={(event) =>
                  setCredentials((form) => ({
                    ...form,
                    username: event.target.value.toLowerCase().trim(),
                  }))
                }
                required
              />
            </label>

            <PasswordField
              label="Nova senha (opcional)"
              hint="Deixe em branco para manter a senha atual."
              value={credentials.password}
              onChange={(password) =>
                setCredentials((form) => ({ ...form, password }))
              }
            />
          </form>
        ) : null}
      </Modal>

      <Confirm
        open={Boolean(confirmDemote)}
        title="Desfazer administrador"
        message={
          (confirmDemote?.fullName || "") +
          " perde o usuário e a senha (os dois voltam a ser nada) e deixa de entrar no painel. A ficha continua no cadastro, com o mesmo número, a foto e todo o histórico de empréstimos."
        }
        confirmLabel="Desfazer admin"
        tone="danger"
        onCancel={() => setConfirmDemote(null)}
        onConfirm={demote}
      />
    </div>
  );
}
