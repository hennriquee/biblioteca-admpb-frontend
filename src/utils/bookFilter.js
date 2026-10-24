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

// Quantos exemplares estao fora: o acervo publico manda "loaned"/"requested",
// o painel manda "loanedCount"/"requestedCount".
export function outCounts(book) {
  return {
    loaned: book.loaned ?? book.loanedCount ?? 0,
    requested: book.requested ?? book.requestedCount ?? 0,
  };
}

function matchesSearch(book, search) {
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

// ACERVO PUBLICO. filters: { search, category, status }
// - search: titulo, autor ou ISBN (ISBN com hifens tambem acha o sem hifens)
// - category: nome exato da categoria
// - status: "disponivel" (tem unidade na estante) | "emprestado" (nenhuma na
//   estante, alguma emprestada) | "solicitado" (nenhuma na estante, alguma
//   solicitada) | "" (todos). Um livro com um exemplar emprestado e outro
//   solicitado aparece nos dois.
export function matchesBook(book, filters) {
  const { search, category, status } = filters;
  const { loaned, requested } = outCounts(book);

  if (category && !(book.categories || []).includes(category)) return false;
  if (status === "disponivel" && !(book.available > 0)) return false;
  if (status === "emprestado" && (book.available > 0 || !(loaned > 0)))
    return false;
  if (status === "solicitado" && (book.available > 0 || !(requested > 0)))
    return false;

  return matchesSearch(book, search);
}

// ACERVO DO PAINEL: aqui interessa saber de qualquer exemplar fora.
// - "disponivel": tem exemplar livre | "emprestado": algum emprestado |
//   "solicitado": alguma solicitacao registrada.
export function matchesPanelBook(book, filters) {
  const { search, category, status } = filters;
  const { loaned, requested } = outCounts(book);

  if (category && !(book.categories || []).includes(category)) return false;
  if (status === "disponivel" && !(book.available > 0)) return false;
  if (status === "emprestado" && !(loaned > 0)) return false;
  if (status === "solicitado" && !(requested > 0)) return false;

  return matchesSearch(book, search);
}
