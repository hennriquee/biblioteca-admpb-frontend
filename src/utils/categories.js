// Compara categorias sem diferenciar maiuscula/minuscula nem acento:
// "ficcao" e "Ficção" sao a mesma categoria.
export function normalizeCategory(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Se a categoria ja existe no acervo, devolve a grafia dela; senao, o texto
// sem espacos sobrando. "options" e a lista [{ name, count }] do servidor.
export function findCategory(options, text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const key = normalizeCategory(clean);
  const match = options.find((option) => normalizeCategory(option.name) === key);
  return match ? match.name : clean;
}
