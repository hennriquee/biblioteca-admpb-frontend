import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client.js";
import PersonFormModal from "./PersonFormModal.jsx";
import Avatar from "./Avatar.jsx";
import { IconClose, IconPlus } from "./Icons.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";

/**
 * "Quem e a pessoa": busca no cadastro conforme digita e, no fim da lista,
 * "Cadastrar nova pessoa" (o mesmo formulario da tela de Usuarios, aberto
 * aqui dentro). Usado no Novo emprestimo e no registro de uma solicitacao.
 *
 * A pessoa so conta como escolhida quando e tocada na lista (ou acabou de ser
 * cadastrada): digitar o nome NAO basta, e de proposito - sem isso, um nome
 * sem cadastro nenhum levaria um livro sem ficha para cobrar a devolucao.
 *
 * Props:
 * - picked: a ficha escolhida (null = ainda digitando)
 * - onPick(pessoa, como): escolheu na lista ("list") ou cadastrou ("created")
 * - onClear(): tocou no "x" para trocar
 * - initialQuery: texto que ja vem digitado (ex.: o nome que veio no link do
 *   WhatsApp), com a lista aberta
 * - locked: sem o "x" (a pessoa nao muda aqui)
 */
export default function PersonPicker({
  picked,
  onPick,
  onClear,
  initialQuery = "",
  inputId,
  locked = false,
}) {
  const [query, setQuery] = useState(initialQuery);
  // Resultados guardam o texto a que respondem ("term"): so aparecem quando
  // batem com o que esta digitado agora.
  const [suggestions, setSuggestions] = useState({ term: "", items: [] });
  const [showSuggestions, setShowSuggestions] = useState(Boolean(initialQuery));
  const [creating, setCreating] = useState(false);
  const blurTimer = useRef(null);

  const term = query.trim();

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  useEffect(() => {
    if (term.length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      let items = [];
      try {
        items = await api("/api/people?search=" + encodeURIComponent(term));
      } catch {
        items = [];
      }
      if (active) setSuggestions({ term, items });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  // Enquanto o termo digitado ainda nao tem resposta: "Buscando…" no lugar da
  // lista, para nunca dar para clicar no "Cadastrar nova pessoa" (ou numa lista
  // de uma busca ANTERIOR) antes da busca de agora terminar - o risco seria
  // cadastrar alguem que, no instante seguinte, apareceria na lista.
  const searching = term.length >= 2 && suggestions.term !== term;
  const showDropdown = showSuggestions && term.length >= 2;
  const items =
    showDropdown && suggestions.term === term ? suggestions.items : [];

  function handleCreated(created) {
    setCreating(false);
    setQuery(created.fullName);
    onPick({ ...created, activeLoans: [] }, "created");
  }

  if (picked) {
    return (
      <div className="picked">
        <Avatar src={picked.photo} name={picked.fullName} size={44} />
        <div>
          <strong title={picked.fullName}>
            {(picked.code ? "#" + picked.code + " " : "") + picked.fullName}
          </strong>
          <small>
            {picked.phone ? formatStoredPhone(picked.phone) : "sem WhatsApp"}
            {picked.activeLoans
              ? " · " +
                (picked.activeLoans.length > 0
                  ? "está com " + picked.activeLoans.join(", ")
                  : (picked.loansCount || 0) + " empréstimo(s) no histórico")
              : ""}
          </small>
        </div>
        {picked.isAdmin ? <span className="chip chip--admin">admin</span> : null}
        {locked ? null : (
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setQuery("");
              onClear();
            }}
            aria-label="Trocar pessoa"
          >
            <IconClose width={18} height={18} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="combo">
      <input
        id={inputId}
        type="text"
        value={query}
        placeholder="Ex.: Maria Eduarda Nogueira"
        maxLength={80}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setShowSuggestions(false), 150);
        }}
        autoComplete="off"
        required
      />

      {showDropdown && searching ? (
        <p className="combo__wait" role="status">
          Buscando pessoas…
        </p>
      ) : null}

      {showDropdown && !searching && items.length === 0 ? (
        <p className="combo__wait">Pessoa não encontrada.</p>
      ) : null}

      {/* So aparece com a busca ja respondida (nunca durante o "Buscando…"). */}
      {showDropdown && !searching ? (
        <ul className="combo__list">
          {items.map((person) => (
            <li key={person._id}>
              <button
                type="button"
                className="combo__item combo__item--person"
                onMouseDown={() => clearTimeout(blurTimer.current)}
                onClick={() => {
                  setQuery(person.fullName);
                  setShowSuggestions(false);
                  onPick(person, "list");
                }}
              >
                {/* A foto (ou as iniciais) de quem ja esta cadastrado: e o
                    que diferencia duas pessoas de nome parecido. */}
                <Avatar src={person.photo} name={person.fullName} size={36} />
                <span>
                  <strong>
                    {(person.code ? "#" + person.code + " " : "") +
                      person.fullName}
                    {person.isAdmin ? (
                      <span className="chip chip--admin">admin</span>
                    ) : null}
                  </strong>
                  <small>
                    {person.phone
                      ? formatStoredPhone(person.phone)
                      : "sem WhatsApp"}
                  </small>
                  <small>
                    {person.activeLoans.length > 0
                      ? "está com " + person.activeLoans.join(", ")
                      : person.loansCount + " empréstimo(s) no histórico"}
                  </small>
                </span>
              </button>
            </li>
          ))}
          {/* Sempre no fim da lista (ja respondida), ache ou nao ache alguem
              parecido: quem nao esta cadastrado precisa de um caminho para
              entrar no sistema. */}
          <li>
            <button
              type="button"
              className="combo__item combo__item--create"
              onMouseDown={() => clearTimeout(blurTimer.current)}
              onClick={() => {
                setShowSuggestions(false);
                setCreating(true);
              }}
            >
              <span className="combo__create-icon" aria-hidden="true">
                <IconPlus width={18} height={18} />
              </span>
              <span>
                <strong>Cadastrar nova pessoa</strong>
                <small>{'"' + term + '"'}</small>
              </span>
            </button>
          </li>
        </ul>
      ) : null}

      {/* Mesmo formulario da tela de Usuarios, aberto aqui dentro: o resto da
          tela continua preenchido por baixo. Vai para o fim da pagina (portal)
          porque este seletor costuma estar DENTRO de outro formulario (Novo
          emprestimo, solicitacao): o "Salvar" do cadastro nao pode enviar o
          formulario de fora - dai o stopPropagation do envio. */}
      {creating
        ? createPortal(
            <div onSubmit={(event) => event.stopPropagation()}>
              <PersonFormModal
                open
                person={null}
                initialFullName={term}
                onClose={() => setCreating(false)}
                onSaved={handleCreated}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
