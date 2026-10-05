import { useEffect, useRef, useState } from "react";
import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import examples from "libphonenumber-js/examples.mobile.json";
import {
  AO, AR, BO, BR, CL, CO, DE, EC, ES, FR, GB, IT, JP, MX, MZ, PE, PT, PY, US, UY, VE,
} from "country-flag-icons/react/3x2";

// Paises da lista (Brasil primeiro e como padrao). Para incluir outro pais,
// importe a bandeira acima e adicione uma linha aqui.
export const COUNTRIES = [
  { iso: "BR", name: "Brasil", Flag: BR },
  { iso: "PT", name: "Portugal", Flag: PT },
  { iso: "US", name: "Estados Unidos / Canadá", Flag: US },
  { iso: "AR", name: "Argentina", Flag: AR },
  { iso: "PY", name: "Paraguai", Flag: PY },
  { iso: "UY", name: "Uruguai", Flag: UY },
  { iso: "BO", name: "Bolívia", Flag: BO },
  { iso: "CL", name: "Chile", Flag: CL },
  { iso: "PE", name: "Peru", Flag: PE },
  { iso: "CO", name: "Colômbia", Flag: CO },
  { iso: "VE", name: "Venezuela", Flag: VE },
  { iso: "EC", name: "Equador", Flag: EC },
  { iso: "MX", name: "México", Flag: MX },
  { iso: "ES", name: "Espanha", Flag: ES },
  { iso: "IT", name: "Itália", Flag: IT },
  { iso: "FR", name: "França", Flag: FR },
  { iso: "DE", name: "Alemanha", Flag: DE },
  { iso: "GB", name: "Reino Unido", Flag: GB },
  { iso: "JP", name: "Japão", Flag: JP },
  { iso: "AO", name: "Angola", Flag: AO },
  { iso: "MZ", name: "Moçambique", Flag: MZ },
].map((c) => ({ ...c, dial: getCountryCallingCode(c.iso) }));

const byIso = (iso) => COUNTRIES.find((c) => c.iso === iso) || COUNTRIES[0];

// "5534997885466" -> { iso: "BR", national: "34997885466" }
function splitDigits(digits) {
  const parsed = digits ? parsePhoneNumberFromString("+" + digits) : null;
  if (!parsed || !parsed.country) return null;
  if (!COUNTRIES.some((c) => c.iso === parsed.country)) return null;
  return { iso: parsed.country, national: String(parsed.nationalNumber) };
}

/**
 * Campo de WhatsApp com bandeira e DDI.
 * value    -> so digitos com DDI (ex.: "5534997885466") ou "".
 * onChange -> recebe o mesmo formato.
 */
export default function PhoneInput({ value, onChange, id }) {
  const [iso, setIso] = useState("BR");
  const [national, setNational] = useState(""); // so digitos, sem DDI
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const lastEmitted = useRef("");

  // Se o valor mudar de fora (ex.: escolheu uma pessoa ja cadastrada),
  // reflete no campo. Ignora o que o proprio campo acabou de emitir.
  useEffect(() => {
    if ((value || "") === lastEmitted.current) return;
    lastEmitted.current = value || "";
    if (!value) {
      setNational("");
      return;
    }
    const parts = splitDigits(value);
    if (parts) {
      setIso(parts.iso);
      setNational(parts.national);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const country = byIso(iso);

  function emit(nextIso, nextNational) {
    const digits = nextNational ? byIso(nextIso).dial + nextNational : "";
    lastEmitted.current = digits;
    onChange(digits);
  }

  function handleInput(event) {
    const raw = event.target.value;

    // Colou um numero completo com "+" (ex.: +351 912 345 678): detecta o pais.
    if (raw.trim().startsWith("+")) {
      const typer = new AsYouType();
      typer.input(raw);
      const detected = typer.getCountry();
      const parts = detected && splitDigits(raw.replace(/\D/g, ""));
      if (parts) {
        setIso(parts.iso);
        setNational(parts.national);
        emit(parts.iso, parts.national);
        return;
      }
    }

    const digits = raw.replace(/\D/g, "").slice(0, 15);
    setNational(digits);
    emit(iso, digits);
  }

  function pickCountry(next) {
    setIso(next.iso);
    setOpen(false);
    emit(next.iso, national);
  }

  const formatted = national ? new AsYouType(iso).input(national) : "";
  const example = getExampleNumber(iso, examples);
  const placeholder = example ? example.formatNational() : "";

  return (
    <div className="phone" ref={rootRef}>
      <button
        type="button"
        className="phone__country"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={"País: " + country.name + ", +" + country.dial}
      >
        <country.Flag className="phone__flag" aria-hidden="true" />
        <span className="phone__dial">+{country.dial}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        className="phone__input"
        value={formatted}
        placeholder={placeholder}
        onChange={handleInput}
      />

      {open ? (
        <ul className="phone__list" role="listbox">
          {COUNTRIES.map((item) => (
            <li key={item.iso}>
              <button
                type="button"
                role="option"
                aria-selected={item.iso === iso}
                className={"phone__option" + (item.iso === iso ? " is-active" : "")}
                onClick={() => pickCountry(item)}
              >
                <item.Flag className="phone__flag" aria-hidden="true" />
                <span className="phone__name">{item.name}</span>
                <span className="phone__code">+{item.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
