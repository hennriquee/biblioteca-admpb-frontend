import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "./Icons.jsx";

/**
 * Filtro de lista suspensa (um botao que abre as opcoes), no mesmo desenho do
 * filtro de categoria (ver CategoryPicker.jsx, variant "filter"). Usado na
 * situacao dos emprestimos: Em andamento, Atrasados, Devolvidos, Solicitados
 * e Todos.
 *
 * Props: value (key escolhida), onChange(key), options [{ key, label, count? }],
 * icon (componente de icone), label (nome do filtro, para leitor de tela).
 */
export default function OptionFilter({ value, onChange, options, icon: Icon, label }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.key === value) || options[0];

  // Fecha ao tocar fora ou com Esc (so a lista, sem fechar um modal junto).
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
        rootRef.current?.querySelector(".catpicker__trigger")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function choose(key) {
    onChange(key);
    setOpen(false);
    rootRef.current?.querySelector(".catpicker__trigger")?.focus();
  }

  return (
    <div className="catpicker catpicker--filter optfilter" ref={rootRef}>
      <button
        type="button"
        className="catpicker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label + ": " + current.label}
        onClick={() => setOpen((v) => !v)}
      >
        {Icon ? <Icon width={18} height={18} /> : null}
        <span className="catpicker__value">{current.label}</span>
        {typeof current.count === "number" ? (
          <small className="catpicker__count">{current.count}</small>
        ) : null}
        <IconChevronDown
          width={18}
          height={18}
          className={"catpicker__chevron" + (open ? " is-open" : "")}
        />
      </button>

      {open ? (
        <div className="catpicker__panel">
          <ul className="combo__list" role="listbox" aria-label={label}>
            {options.map((option) => {
              const selected = option.key === current.key;
              return (
                <li key={option.key} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      "combo__item catpicker__item" +
                      (selected ? " is-selected" : "")
                    }
                    onClick={() => choose(option.key)}
                  >
                    <span className="catpicker__name">{option.label}</span>
                    {typeof option.count === "number" ? (
                      <small className="catpicker__count">{option.count}</small>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
