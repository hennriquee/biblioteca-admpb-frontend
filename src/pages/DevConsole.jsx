import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import {
  IconEdit,
  IconExit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconShield,
  IconUser,
} from "../components/Icons.jsx";
import { normalizeText } from "../utils/bookFilter.js";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useRefresh } from "../utils/refresh.js";

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
 * E TAMBEM e a tela que cuida do CADASTRO de gente: cadastrar uma pessoa nova
 * e editar nome, WhatsApp e foto - de usuario e de administrador. As regras
 * sao as mesmas da tela "Usuarios" do painel (no servidor sao os MESMOS
 * tratadores, ver backend/src/routes/dev.js), com uma diferenca: aqui a ficha
 * de um administrador tambem pode ser corrigida, o que no painel so a propria
 * pessoa faz.
 *
 * O que NAO se faz aqui: livro e emprestimo - registrar, confirmar devolucao
 * ou apagar e trabalho do painel, com conta de administrador. (Corrigir o nome
 * ou o WhatsApp de alguem aqui muda o que o emprestimo em andamento mostra
 * dela, porque o emprestimo guarda uma copia dos dois.)
 */

// Ficha em branco do formulario de pessoa (igual ao da tela "Usuarios").
const emptyPerson = {
  fullName: "",
  phone: "",
  photo: "", // data URI de uma foto nova, ainda nao enviada
  savedPhoto: "", // foto que ja esta salva
  removePhoto: false,
};

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

  // Um modal de cada vez: cadastrar/editar uma ficha, subir alguem a
  // administrador, trocar login/senha de um administrador ou confirmar o
  // desfazer.
  const [personForm, setPersonForm] = useState(null);
  const [promote, setPromote] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [confirmDemote, setConfirmDemote] = useState(null);
  const [saving, setSaving] = useState(false);
  // Aviso de nome/WhatsApp repetido vindo do servidor; "Confirmar" reenvia
  // com force = true.
  const [warning, setWarning] = useState(null);

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

  // Puxar para atualizar (ver utils/refresh.js).
  useRefresh(load);

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

  function openCreatePerson() {
    setPersonForm({ ...emptyPerson });
  }

  function openEditPerson(person) {
    setPersonForm({
      ...emptyPerson,
      _id: person._id,
      code: person.code,
      fullName: person.fullName,
      phone: person.phone || "",
      savedPhoto: person.photo || "",
    });
  }

  // Cadastra ou edita a ficha (nome, WhatsApp e foto). Nao mexe em login nem
  // em senha: isso e dos outros dois modais.
  // force = true: quem esta usando confirmou o aviso de nome/WhatsApp repetido.
  async function savePerson(force) {
    const form = personForm;
    if (!form.fullName.trim().split(/\s+/).filter(Boolean)[1]) {
      notify("Digite o nome completo (nome e sobrenome).", "error");
      return;
    }
    if (form.phone && !isValidPhoneNumber("+" + form.phone)) {
      notify("WhatsApp inválido. Confira o país, o DDD e o número.", "error");
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone,
        force: Boolean(force),
      };
      if (form.photo) body.photo = form.photo;
      if (form.removePhoto) body.removePhoto = true;

      if (form._id) {
        await api("/api/dev/people/" + form._id, { method: "PUT", body });
        notify("Ficha atualizada.", "success");
      } else {
        await api("/api/dev/people", { method: "POST", body });
        notify("Pessoa cadastrada.", "success");
      }
      setPersonForm(null);
      setWarning(null);
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.payload?.code : null;
      if (["PERSON_NAME_EXISTS", "PERSON_PHONE_EXISTS"].includes(code)) {
        setWarning(err.payload);
      } else {
        notify(err.message, "error");
      }
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
  const photoNow = personForm
    ? personForm.removePhoto
      ? ""
      : personForm.photo || personForm.savedPhoto
    : "";

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
          <div className="devpage__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreatePerson}
            >
              <IconPlus width={18} height={18} />
              Cadastrar pessoa
            </button>
            <button type="button" className="btn btn--ghost" onClick={logout}>
              <IconExit width={18} height={18} />
              Sair
            </button>
          </div>
        </header>

        <p className="muted">
          Esta tela é a única que mexe em quem entra no painel. Os
          administradores, na sessão deles, não conseguem tornar alguém
          administrador, desfazer isso nem trocar a senha de outra pessoa — só
          cuidar da própria conta. Daqui você também cadastra uma pessoa nova e
          corrige nome, WhatsApp e foto de qualquer uma, administrador incluído.
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
                          onClick={() => openEditPerson(person)}
                        >
                          <IconEdit width={15} height={15} />
                          Editar ficha
                        </button>
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
                histórico) passa a ter um login e uma senha. "Editar ficha"
                muda nome, WhatsApp e foto — nunca o número, que é o que
                identifica a pessoa.
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
                          className="btn btn--ghost btn--sm"
                          onClick={() => openEditPerson(person)}
                        >
                          <IconEdit width={15} height={15} />
                          Editar ficha
                        </button>
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

      {/* Cadastrar / editar a ficha de uma pessoa: nome, WhatsApp e foto.
          Login e senha nao entram aqui - sao os dois modais de baixo. */}
      <Modal
        open={Boolean(personForm)}
        onClose={() => setPersonForm(null)}
        title={
          personForm?._id
            ? "Editar ficha" +
              (personForm.code ? " #" + personForm.code : "")
            : "Cadastrar pessoa"
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setPersonForm(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="dev-person-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving
                ? personForm?.photo
                  ? "Enviando foto…"
                  : "Salvando…"
                : "Salvar"}
            </button>
          </>
        }
      >
        {personForm ? (
          <form
            id="dev-person-form"
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              savePerson(false);
            }}
          >
            <PhotoPicker
              src={photoNow}
              name={personForm.fullName}
              notify={notify}
              dev
              onPhoto={(dataUri) =>
                setPersonForm((form) => ({
                  ...form,
                  photo: dataUri,
                  removePhoto: false,
                }))
              }
              onRemove={() =>
                setPersonForm((form) => ({
                  ...form,
                  photo: "",
                  removePhoto: true,
                }))
              }
            />

            <label className="field">
              <span>Nome completo</span>
              <input
                value={personForm.fullName}
                placeholder="Ex.: Maria Eduarda Nogueira"
                maxLength={80}
                onChange={(event) =>
                  setPersonForm((form) => ({
                    ...form,
                    fullName: event.target.value,
                  }))
                }
                autoFocus
                required
              />
            </label>

            <div className="field">
              <label className="field__label" htmlFor="dev-person-phone">
                WhatsApp (opcional)
              </label>
              <PhoneInput
                id="dev-person-phone"
                value={personForm.phone}
                onChange={(phone) =>
                  setPersonForm((form) => ({ ...form, phone }))
                }
              />
              <small className="field__hint">
                Usado só para lembrar a pessoa da devolução do livro. O acervo
                público não mostra o número.
              </small>
            </div>

            {personForm._id ? (
              <p className="field__hint">
                Login e senha não mudam por aqui: para isso são os botões
                "Login e senha" e "Tornar admin".
              </p>
            ) : (
              <p className="field__hint">
                A pessoa entra no cadastro como usuária da biblioteca, com um
                número próprio. Para ela entrar no painel, use depois o
                "Tornar admin".
              </p>
            )}
          </form>
        ) : null}
      </Modal>

      {/* Nome ou WhatsApp que ja existe no cadastro: so um aviso, porque dois
          homonimos e um WhatsApp de familia sao normais (ver o comentario em
          backend/src/models/Person.js). */}
      <Confirm
        open={Boolean(warning)}
        title={
          warning?.code === "PERSON_PHONE_EXISTS"
            ? "Esse WhatsApp já está em uso"
            : "Esse nome já está no cadastro"
        }
        message={
          (warning?.error || "") +
          (warning?.code === "PERSON_PHONE_EXISTS"
            ? ""
            : " Se for outra pessoa de nome igual, ela entra no cadastro com um número próprio.")
        }
        confirmLabel={
          warning?.code === "PERSON_PHONE_EXISTS"
            ? "Salvar assim mesmo"
            : "É outra pessoa"
        }
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          savePerson(true);
        }}
      />

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
