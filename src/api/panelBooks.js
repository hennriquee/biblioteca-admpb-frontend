import { api } from "./client.js";

// Uma pagina do Acervo do painel. filters = null traz sem filtro (ver
// hooks/useBookList.js). Fica num arquivo proprio porque duas partes usam a
// MESMA funcao: a tela Livros (pages/Books.jsx) e o painel, que baixa o
// acervo antes da hora (components/Layout.jsx) - a lista guardada e achada
// por ela.
export function loadPanelBooks(pageNumber, limit, filters) {
  const params = new URLSearchParams({
    page: String(pageNumber),
    limit: String(limit),
  });
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.status) params.set("status", filters.status);
  return api("/api/books?" + params.toString());
}
