import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { IconEdit, IconPlus, IconSearch } from "../components/Icons.jsx";
import { normalizeText } from "../utils/bookFilter.js";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Usuarios: as pessoas do cadastro (Configuracoes > Usuarios).
 *
 * Cada pessoa tem um NUMERO (#1, #2, #3...) que e o que a identifica no
 * sistema - nao o nome nem o telefone, que podem repetir e podem mudar. E por
 * isso que:
 *  - trocar de numero de WhatsApp e so editar a pessoa aqui (o emprestimo em
 *    andamento passa a avisar no numero novo);
 *  - duas pessoas de nome igual convivem, cada uma com o seu numero;
 *  - duas pessoas podem dividir o mesmo WhatsApp (familia), com aviso.
 *
 * A lista vem na ordem do numero (#1, #2, #3...), que e a ordem em que as
 * pessoas entraram no cadastro.
 *
 * TODA pessoa tem os mesmos campos de um administrador, foto de perfil
 * inclusive: administrador e so uma pessoa que tambem tem login e senha. Sem
 * foto, o app mostra as iniciais do nome.
 *
 * Quem tem o selo "admin" aparece aqui so para ser visto: sem editar e sem
 * excluir. A propria pessoa edita a sua ficha em Configuracoes > Minha conta
 * (o servidor recusa o resto). Dar ou tirar o acesso ao painel e so na tela
 * de manutencao.
 */

// Quanto a tela baixa de uma vez (o servidor nao manda mais que isso num
// pedido). A busca roda aqui no navegador, sobre essa lista.
const PAGE_LIMIT = 1000;

const emptyForm = {
  fullName: "",
  phone: "",
  photo: "", // data URI de uma foto nova, ainda nao enviada
  savedPhoto: "", // foto que ja esta salva
  removePhoto: false,
};

function matchesPerson(person, term) {
  if (!term) return true;
  if (term.startsWith("#")) {
    return String(person.code || "") === term.slice(1);
  }
  return (
    normalizeText(person.fullName).includes(term) ||
    String(person.phone || "").includes(term.replace(/\D/g, "")) ||
    String(person.code || "") === term
  );
}

export default function People() {
  const { notify } = useToast();
  const { user } = useAuth();

  // null = ainda carregando a lista (a tela mostra o esqueleto).
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(null); // null = modal fechado
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Aviso de nome/WhatsApp repetido vindo do servidor; "Confirmar" reenvia
  // com force = true.
  const [warning, setWarning] = useState(null);

  const requestRef = useRef(0);
  // Trava contra o clique duplo: dois toques rapidos no "Salvar" disparam duas
  // vezes antes do botao desabilitar, e cadastrariam a pessoa duas vezes.
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      // sort=code: a lista sai na ordem dos numeros (#1, #2, #3...).
      const data = await api("/api/people?limit=" + PAGE_LIMIT + "&sort=code");
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
  const shown = useMemo(
    () => (people || []).filter((person) => matchesPerson(person, term)),
    [people, term],
  );

  // Administrador aparece aqui so para ser VISTO (a trava de verdade esta no
  // servidor; aqui e so para nao oferecer botao que vai dar erro). A propria
  // pessoa edita a sua ficha em "Minha conta".
  const isMe = (person) => String(person._id) === String(user?.id);

  function openCreate() {
    setForm({ ...emptyForm });
  }

  function openEdit(person) {
    setForm({
      ...emptyForm,
      _id: person._id,
      code: person.code,
      fullName: person.fullName,
      phone: person.phone || "",
      savedPhoto: person.photo || "",
    });
  }

  // force = true: a pessoa confirmou o aviso de nome/WhatsApp repetido.
  async function save(force) {
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
        await api("/api/people/" + form._id, { method: "PUT", body });
        notify("Cadastro atualizado.", "success");
      } else {
        await api("/api/people", { method: "POST", body });
        notify("Pessoa cadastrada.", "success");
      }
      setForm(null);
      setWarning(null);
      await load();
    } catch (err) {
      if (
        err instanceof ApiError &&
        ["PERSON_NAME_EXISTS", "PERSON_PHONE_EXISTS"].includes(
          err.payload?.code,
        )
      ) {
        setWarning(err.payload);
      } else {
        notify(err.message, "error");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete() {
    const person = confirmDelete;
    setConfirmDelete(null);
    try {
      await api("/api/people/" + person._id, { method: "DELETE" });
      notify("Pessoa excluída.", "success");
      // Pedido de dentro do proprio formulario de edicao: fecha-o tambem, a
      // pessoa nao existe mais para continuar editando.
      setForm((f) => (f && f._id === person._id ? null : f));
      await load();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  const photoNow = form
    ? form.removePhoto
      ? ""
      : form.photo || form.savedPhoto
    : "";

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Usuários</h1>
          <p className="page__sub">
            {people === null
              ? "Carregando…"
              : error
                ? "Não foi possível carregar"
                : people.length === 0
                  ? "Ninguém cadastrado ainda"
                  : shown.length +
                    (term ? " de " + people.length : "") +
                    " pessoa(s)"}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <IconPlus width={18} height={18} />
          Cadastrar pessoa
        </button>
      </div>

      <p className="muted">
        Quem pega livros emprestados. O número (#1, #2…) é o que identifica cada
        pessoa: dois nomes iguais podem existir, e trocar de WhatsApp é só
        editar aqui. A lista segue a ordem dos números.
      </p>

      <div className="searchbar">
        <IconSearch width={18} height={18} />
        <input
          type="search"
          placeholder="Buscar por nome, WhatsApp ou #número"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {people === null && !error ? (
        <ListSkeleton label="Carregando os cadastros…" />
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

      {/* Cadastro maior que o que cabe num pedido: melhor dizer do que deixar
          a conta da tela mentir. (Com o acervo de uma biblioteca de igreja
          isso nao deve acontecer.) */}
      {people !== null && people.length >= PAGE_LIMIT ? (
        <p className="muted" role="status">
          Mostrando as primeiras {PAGE_LIMIT} pessoas, na ordem dos números. Use
          a busca para encontrar quem está depois delas.
        </p>
      ) : null}

      {people !== null && shown.length === 0 ? (
        <div className="empty">
          <p>
            {people.length === 0
              ? "Ninguém cadastrado ainda. Quem pega um livro emprestado entra aqui automaticamente."
              : "Nenhuma pessoa corresponde a essa busca."}
          </p>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul className={"peoplelist" + (refreshing ? " is-refreshing" : "")}>
          {shown.map((person) => {
            const mine = isMe(person);
            // Nome + telefone em uma linha so cada: o conteudo que vai dentro
            // da area clicavel (ou do span estatico, para admin que nao e eu).
            const cardContent = (
              <>
                <span className="personrow__code">
                  {person.code ? "#" + person.code : "—"}
                </span>
                <Avatar src={person.photo} name={person.fullName} size={40} />
                <span
                  className={
                    "personrow__text" +
                    (person.isAdmin ? " personrow__text--tagged" : "")
                  }
                >
                  <strong title={person.fullName}>
                    <span className="personrow__name">
                      {person.fullName}
                    </span>
                  </strong>
                  <small>
                    {person.phone
                      ? formatStoredPhone(person.phone)
                      : "sem WhatsApp"}
                    {person.activeLoans.length
                      ? " · está com " + person.activeLoans.join(", ")
                      : ""}
                  </small>
                </span>
              </>
            );

            return (
              <li key={person._id} className="personrow">
                {person.isAdmin ? (
                  <span className="chip chip--admin personrow__tag">
                    admin
                  </span>
                ) : null}

                {/* O cartao inteiro abre a edicao - so quem tem o selo admin
                    e nao sou eu fica so para ver (o servidor recusa o resto). */}
                {mine ? (
                  <Link
                    to="/configuracoes/conta"
                    className="personrow__hit"
                    aria-label="Editar a minha conta"
                  >
                    {cardContent}
                  </Link>
                ) : person.isAdmin ? (
                  <span className="personrow__static">{cardContent}</span>
                ) : (
                  <button
                    type="button"
                    className="personrow__hit"
                    aria-label={"Editar " + person.fullName}
                    onClick={() => openEdit(person)}
                  >
                    {cardContent}
                  </button>
                )}

                {!person.isAdmin ? (
                  <span className="personrow__actions">
                    {/* So abre a edicao - excluir agora e so de dentro do
                        modal, para um toque errado aqui nao arriscar apagar
                        ninguem (ver botao "Excluir" no rodape do formulario). */}
                    <button
                      type="button"
                      className="icon-button"
                      title={"Editar " + person.fullName}
                      onClick={() => openEdit(person)}
                    >
                      <IconEdit width={18} height={18} />
                      <span className="sr-only">Editar</span>
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Cadastro / edicao */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?._id ? "Editar pessoa #" + (form.code || "") : "Cadastrar pessoa"}
        size="sm"
        footer={
          <>
            {/* So existe para quem ja esta cadastrado (nao no "Cadastrar
                pessoa"). Abre a mesma confirmacao do botao de excluir da
                lista - nao exclui direto, para nao haver engano. */}
            {form?._id ? (
              <button
                type="button"
                className="btn btn--danger modal__foot-left"
                disabled={saving}
                onClick={() => setConfirmDelete(form)}
              >
                Excluir
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="person-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? (form?.photo ? "Enviando foto…" : "Salvando…") : "Salvar"}
            </button>
          </>
        }
      >
        {form ? (
          <form
            id="person-form"
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
          >
            <PhotoPicker
              src={photoNow}
              name={form.fullName}
              notify={notify}
              onPhoto={(dataUri) =>
                setForm((f) => ({ ...f, photo: dataUri, removePhoto: false }))
              }
              onRemove={() =>
                setForm((f) => ({ ...f, photo: "", removePhoto: true }))
              }
            />

            <label className="field">
              <span>Nome completo</span>
              <input
                value={form.fullName}
                placeholder="Ex.: Maria Eduarda Nogueira"
                maxLength={80}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullName: e.target.value }))
                }
                autoFocus
                required
              />
            </label>

            <div className="field">
              <label className="field__label" htmlFor="person-phone">
                WhatsApp (opcional)
              </label>
              <PhoneInput
                id="person-phone"
                value={form.phone}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
              />
              <small className="field__hint">
                Usado só para lembrar a pessoa da devolução do livro. Se ela
                trocou de número, basta corrigir aqui.
              </small>
            </div>
          </form>
        ) : null}
      </Modal>

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
          save(true);
        }}
      />

      <Confirm
        open={Boolean(confirmDelete)}
        title="Excluir pessoa"
        message={
          "Excluir " +
          (confirmDelete?.code ? "#" + confirmDelete.code + " " : "") +
          (confirmDelete?.fullName || "") +
          " do cadastro? Os empréstimos já devolvidos continuam no histórico."
        }
        confirmLabel="Excluir"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
