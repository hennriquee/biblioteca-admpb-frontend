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

// Busca por PALAVRAS: cada palavra do termo precisa aparecer no texto, em
// qualquer ordem e em qualquer ponto. "Maria Alessandra Dias" acha "Maria
// Alessandra Arantes Dias" (pulou um sobrenome); "senhor aneis" acha "O Senhor
// dos Anéis". Tudo o que o texto inteiro, junto, achava continua achando.
// (A mesma regra existe no servidor: backend/src/services/search.js.)
export function hasAllWords(text, term) {
  // Mesmo teto do servidor: 200 caracteres, 12 palavras diferentes.
  const words = [
    ...new Set(normalizeText(term).slice(0, 200).split(/\s+/).filter(Boolean)),
  ].slice(0, 12);
  if (!words.length) return true;
  const haystack = normalizeText(text);
  return words.every((word) => haystack.includes(word));
}

// Quao bem o texto bate com o termo. Menor = melhor: 0 igual | 1 comeca com
// o digitado | 2 tem o digitado junto | 3 cada palavra no comeco de uma
// palavra | 4 o resto. Usado nas listas curtas de sugestoes, para o que foi
// digitado inteiro nao ficar de fora do corte.
// (A mesma regra existe no servidor: backend/src/services/search.js.)
export function matchRank(text, term) {
  const words = normalizeText(term).split(/\s+/).filter(Boolean);
  const joined = words.join(" ");
  const value = normalizeText(text).replace(/\s+/g, " ");
  if (!joined) return 4;
  if (value === joined) return 0;
  if (value.startsWith(joined)) return 1;
  if (value.includes(joined)) return 2;
  const tokens = value.split(/[\s'’.-]+/);
  if (words.every((word) => tokens.some((token) => token.startsWith(word)))) {
    return 3;
  }
  return 4;
}

// Livros na ordem de quao bem batem (titulo ou autor, o melhor dos dois);
// empate mantem a ordem que ja tinham (a alfabetica).
export function rankBooks(books, term) {
  return books
    .map((book, index) => ({
      book,
      index,
      rank: Math.min(
        matchRank(book.title, term),
        ...(book.authors || []).map((name) => matchRank(name, term)),
      ),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.book);
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
  // Titulo e autor por palavras (todas no titulo, ou todas no MESMO autor);
  // o ISBN, pelo termo inteiro.
  if (hasAllWords(book.title, term)) return true;
  if (isbn.includes(term)) return true;
  if ((book.authors || []).some((name) => hasAllWords(name, term)))
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
