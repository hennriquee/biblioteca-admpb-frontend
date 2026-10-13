// Filtro de livros feito no proprio navegador (ver hooks/useBookList.js).
// Segue as mesmas regras do servidor (routes/books.js e routes/public.js),
// para o resultado ser o mesmo que a API devolveria.

// Minusculas e sem acento: "Oração" e "oracao" sao o mesmo texto.
export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// filters: { search, category, status }
// - search: titulo, autor ou ISBN (ISBN com hifens tambem acha o sem hifens)
// - category: nome exato da categoria
// - status: "disponivel" (tem unidade na estante) | "emprestado" (todas as
//   unidades emprestadas) | "" (todos)
export function matchesBook(book, filters) {
  const { search, category, status } = filters;

  if (category && !(book.categories || []).includes(category)) return false;
  if (status === "disponivel" && !(book.available > 0)) return false;
  if (status === "emprestado" && book.available > 0) return false;

  const term = normalizeText(search);
  if (!term) return true;

  const isbn = String(book.isbn || "").toLowerCase();
  if (normalizeText(book.title).includes(term)) return true;
  if (isbn.includes(term)) return true;
  if ((book.authors || []).some((name) => normalizeText(name).includes(term)))
    return true;

  const digits = term.replace(/[\s-]/g, "");
  return digits !== term && /^[0-9x]+$/.test(digits) && isbn.includes(digits);
}
