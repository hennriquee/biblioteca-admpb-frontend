import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import PersonFormModal from "../components/PersonFormModal.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { IconEdit, IconPlus, IconSearch } from "../components/Icons.jsx";
import { hasAllWords, normalizeText } from "../utils/bookFilter.js";
import { formatBookTitle } from "../utils/bookTitle.js";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { useRefresh } from "../utils/refresh.js";

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
 *
 * O formulario de cadastrar/editar (foto, nome, WhatsApp) e o PersonFormModal -
 * o mesmo que o "Cadastrar nova pessoa" do Novo emprestimo usa, para as duas
 * telas pedirem os mesmos dados da mesma forma (ver components/PersonFormModal.jsx).
 */

// Quanto a tela baixa de uma vez (o servidor nao manda mais que isso num
// pedido). A busca roda aqui no navegador, sobre essa lista.
const PAGE_LIMIT = 1000;

function matchesPerson(person, term) {
  if (!term) return true;
  if (term.startsWith("#")) {
    return String(person.code || "") === term.slice(1);
  }
  // Os digitos do termo (se houver) sao comparados com o WhatsApp. Termo sem
  // nenhum digito (a busca por nome, a mais comum) vira string vazia aqui -
  // e toda string "contem" uma string vazia, o que faria esta condicao bater
  // SEMPRE e a busca por nome nunca filtrar nada. Por isso so entra no "ou"
  // quando sobrou pelo menos um digito para comparar.
  const digits = term.replace(/\D/g, "");
  return (
    hasAllWords(person.fullName, term) ||
    (digits.length > 0 && String(person.phone || "").includes(digits)) ||
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

  const [modalOpen, setModalOpen] = useState(false);
  // null = cadastrando uma pessoa nova; objeto = editando essa pessoa.
  const [editingPerson, setEditingPerson] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const requestRef = useRef(0);

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

  // Puxar para atualizar (ver utils/refresh.js).
  useRefresh(load);

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
    setEditingPerson(null);
    setModalOpen(true);
  }

  function openEdit(person) {
    setEditingPerson(person);
    setModalOpen(true);
  }

  async function handleDelete() {
    const person = confirmDelete;
    setConfirmDelete(null);
    try {
      await api("/api/people/" + person._id, { method: "DELETE" });
      // Excluir so acontece de dentro do formulario de edicao: fecha-o
      // tambem, a pessoa nao existe mais para continuar editando.
      setModalOpen(false);
      await load();
    } catch (err) {
      notify(err.message, "error");
    }
  }

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
        <ListSkeleton label="Carregando os cadastros…" variant="people" />
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
                  </small>
                  {/* Quantas vezes a pessoa ja pegou livro (conta o que esta
                      em andamento tambem). Linha propria, como no Novo
                      emprestimo: no celular a linha do telefone e cortada com
                      reticencias e esconderia o numero. Ele vem antes do "esta
                      com" porque um titulo comprido tambem e cortado. */}
                  <small>
                    {(person.loansCount || 0) + " empréstimo(s)"}
                    {person.activeLoans.length
                      ? " · está com " +
                        person.activeLoans.map(formatBookTitle).join(", ")
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
      <PersonFormModal
        open={modalOpen}
        person={editingPerson}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
        onRequestDelete={(person) => setConfirmDelete(person)}
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
