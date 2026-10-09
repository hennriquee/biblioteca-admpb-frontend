import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconEdit, IconSearch, IconTag } from "./Icons.jsx";
import { findCategory, normalizeCategory } from "../utils/categories.js";

const MAX_LENGTH = 40;

/**
 * Seletor de categoria, usado em dois lugares:
 * - no cadastro do livro (allowCreate): lista as categorias do acervo e, no
 *   fim, a opcao com lapis para escrever uma que ainda nao existe;
 * - no filtro do acervo (searchable): lista com busca, e a primeira opcao
 *   ("Todas as categorias") limpa o filtro.
 *
 * Props:
 *  - value: categoria escolhida ("" = nenhuma)
 *  - onChange(value)
 *  - options: [{ name, count }] vindo de /api/books/categories
 *  - emptyLabel: texto da opcao que limpa a escolha
 *  - placeholder: texto do botao quando nada esta escolhido
 *  - searchable / allowCreate / showCounts / variant ("field" | "filter")
 */
export default function CategoryPicker({
  id,
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  searchable = false,
  allowCreate = false,
  showCounts = false,
  variant = "field",
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [query, setQuery] = useState("");

  // Categoria escolhida que ainda nao existe no acervo (sugerida pela busca
  // do ISBN ou recem-escrita) tambem aparece na lista.
  const list = useMemo(() => {
    const base = [...options];
    if (
      value &&
      !base.some((o) => normalizeCategory(o.name) === normalizeCategory(value))
    ) {
      base.push({ name: value, count: null });
    }
    return base.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [options, value]);

  const visible = useMemo(() => {
    const key = normalizeCategory(query);
    if (!key) return list;
    // Quem começa com o que foi digitado vem primeiro ("oração" antes de "adoração").
    const starts = (o) => (normalizeCategory(o.name).startsWith(key) ? 0 : 1);
    return list
      .filter((o) => normalizeCategory(o.name).includes(key))
      .sort((a, b) => starts(a) - starts(b));
  }, [list, query]);

  // Fecha ao tocar fora ou com Esc (so a lista, sem fechar o modal junto).
  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    // "capture" para rodar antes do Esc do Modal.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (writing) inputRef.current?.focus();
  }, [writing]);

  function toggle() {
    setOpen((current) => !current);
    setQuery("");
  }

  function choose(name) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  function startWriting() {
    setOpen(false);
    setQuery("");
    // Se a escolha atual ja e uma categoria do acervo, o campo comeca vazio
    // para a pessoa digitar a nova; se era uma sugestao nova, ela e editada.
    const isKnown = options.some(
      (o) => normalizeCategory(o.name) === normalizeCategory(value),
    );
    if (isKnown) onChange("");
    setWriting(true);
  }

  function finishWriting() {
    // Se o que foi digitado ja existe (ex.: "ficcao"), usa a grafia do acervo.
    onChange(findCategory(options, value));
  }

  function backToList() {
    finishWriting();
    setWriting(false);
    setOpen(true);
  }

  if (writing) {
    return (
      <div className="catpicker" ref={rootRef}>
        <input
          id={id}
          ref={inputRef}
          className="catpicker__input"
          value={value}
          maxLength={MAX_LENGTH}
          placeholder="Digite o nome da categoria"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onBlur={finishWriting}
        />
        <button
          type="button"
          className="catpicker__back"
          onMouseDown={(e) => e.preventDefault()}
          onClick={backToList}
        >
          Escolher da lista
        </button>
      </div>
    );
  }

  return (
    <div className={"catpicker catpicker--" + variant} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="catpicker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
      >
        {variant === "filter" ? <IconTag width={18} height={18} /> : null}
        <span
          className={
            "catpicker__value" + (value ? "" : " catpicker__value--empty")
          }
        >
          {value || placeholder}
        </span>
        <IconChevronDown
          width={18}
          height={18}
          className={"catpicker__chevron" + (open ? " is-open" : "")}
        />
      </button>

      {open ? (
        <div className="catpicker__panel">
          {searchable ? (
            <div className="searchbar">
              <IconSearch width={18} height={18} />
              <input
                type="search"
                autoFocus={!window.matchMedia("(pointer: coarse)").matches}
                placeholder="Buscar categoria"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}

          <ul className="combo__list" role="listbox">
            {!query ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className={
                    "combo__item catpicker__item" + (!value ? " is-selected" : "")
                  }
                  onClick={() => choose("")}
                >
                  <span className="catpicker__name">{emptyLabel}</span>
                </button>
              </li>
            ) : null}

            {visible.map((option) => {
              const selected = option.name === value;
              return (
                <li key={option.name} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      "combo__item catpicker__item" +
                      (selected ? " is-selected" : "")
                    }
                    onClick={() => choose(option.name)}
                  >
                    <span className="catpicker__name">{option.name}</span>
                    {showCounts && option.count ? (
                      <small className="catpicker__count">{option.count}</small>
                    ) : null}
                  </button>
                </li>
              );
            })}

            {query && visible.length === 0 ? (
              <li className="catpicker__none" role="presentation">Nenhuma categoria encontrada.</li>
            ) : null}

            {allowCreate ? (
              <li role="presentation">
                <button
                  type="button"
                  className="combo__item catpicker__item catpicker__create"
                  onClick={startWriting}
                >
                  <IconEdit width={17} height={17} />
                  <span className="catpicker__name">
                    Escrever outra categoria
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
