import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Lista de livros com filtros (Acervo e Catalogo publico).
 *
 * Cada ida ao servidor custa perto de 1 segundo (as vezes bem mais), entao a
 * lista inteira e baixada UMA vez e os filtros rodam no proprio navegador:
 * trocar de filtro e instantaneo, sem tela de carregamento.
 *
 * Tres situacoes ("mode"):
 * - "starting": baixando o acervo pela primeira vez (a tela mostra o esqueleto);
 * - "local": acervo inteiro na memoria; busca, categoria, situacao e "carregar
 *   mais" nao chamam o servidor;
 * - "server": acervo grande demais para baixar inteiro (mais de LOCAL_MAX
 *   livros). Cada filtro vai ao servidor e, enquanto a resposta nao chega,
 *   entra o esqueleto: os itens do filtro anterior nunca ficam na tela.
 *
 * Parametros:
 * - load(page, limit, filters): busca uma pagina. filters = null traz sem
 *   filtro. Precisa ser uma funcao fixa (declarada fora do componente).
 * - filters: { search, category, status } ja "limpos" (busca sem espacos nas
 *   pontas).
 * - matches(book, filters): o filtro local (utils/bookFilter.js).
 */

export const PAGE_SIZE = 10;
// Ate LOCAL_MAX livros o acervo vem inteiro, num pedido so. (Um servidor que
// entregue menos por pedido tambem funciona: o resto vem em mais pedidos.)
const LOCAL_MAX = 300;
const SNAPSHOT_PAGE = LOCAL_MAX;
// Lista baixada ha mais tempo que isso e atualizada (em silencio) na proxima
// troca de filtro, para a situacao dos livros nao ficar velha.
const STALE_AFTER_MS = 60 * 1000;

const NO_ITEMS = [];
const NO_SERVER_LIST = {
  key: null,
  items: NO_ITEMS,
  total: 0,
  page: 1,
  hasMore: false,
  error: "",
};

function uniqueById(books) {
  const seen = new Set();
  return books.filter((book) => {
    const id = book.id ?? book._id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function useBookList({ load, filters, matches }) {
  // Identifica "qual filtro" esta marcado agora.
  const key = JSON.stringify(filters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const [mode, setMode] = useState("starting");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [all, setAll] = useState(NO_ITEMS);
  // error: nao ha lista para mostrar. notice: a lista continua na tela, mas a
  // ultima atualizacao (ou o "carregar mais") falhou.
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Modo local: quantos itens o "carregar mais" ja abriu, e para qual filtro.
  const [shown, setShown] = useState({ key: "", count: PAGE_SIZE });
  // Modo servidor: a lista carregada e o filtro (key) a que ela responde.
  const [server, setServer] = useState(NO_SERVER_LIST);
  const [serverBusy, setServerBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // So a resposta do ultimo pedido vale: as antigas, atrasadas, sao descartadas.
  const snapshotRequest = useRef(0);
  const serverRequest = useRef(0);
  const snapshotAt = useRef(0);
  // Filtro (key) cuja primeira tela ja veio junto com o download inicial.
  const seededKey = useRef(null);

  // Baixa o acervo inteiro. silent: sem esmaecer a lista e sem avisar se falhar.
  const loadSnapshot = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++snapshotRequest.current;
      if (!silent) {
        setRefreshing(true);
        setError("");
        setNotice("");
      }
      try {
        const first = await load(1, SNAPSHOT_PAGE, null);
        if (requestId !== snapshotRequest.current) return;
        let books = first.items;

        if (first.total > books.length && books.length > 0) {
          if (first.total > LOCAL_MAX) {
            // Acervo grande: o filtro passa a ser feito no servidor. O que
            // acabou de chegar ja serve de primeira tela (lista sem filtro).
            const blank = {};
            Object.keys(filtersRef.current).forEach((name) => {
              blank[name] = "";
            });
            seededKey.current = JSON.stringify(blank);
            setServer((prev) =>
              prev.key === null
                ? {
                    key: JSON.stringify(blank),
                    items: books.slice(0, PAGE_SIZE),
                    total: first.total,
                    page: 1,
                    hasMore: true,
                    error: "",
                  }
                : prev,
            );
            setMode("server");
            return;
          }
          // O que nao coube no primeiro pedido vem junto, em paralelo.
          const size = books.length;
          const pages = Math.ceil(first.total / size);
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, index) =>
              load(index + 2, size, null),
            ),
          );
          if (requestId !== snapshotRequest.current) return;
          books = uniqueById(books.concat(...rest.map((part) => part.items)));
        }

        snapshotAt.current = Date.now();
        setAll(books);
        setMode("local");
        // Chegou lista nova: um aviso de falha anterior ja nao vale.
        setNotice("");
      } catch (err) {
        if (requestId !== snapshotRequest.current) return;
        if (modeRef.current === "starting") setError(err.message);
        else if (!silent) setNotice(err.message);
      } finally {
        if (requestId === snapshotRequest.current) setRefreshing(false);
      }
    },
    [load],
  );

  // Modo servidor: busca uma pagina do filtro "f". background: recarga
  // silenciosa (se falhar, a lista que esta na tela continua).
  const loadServer = useCallback(
    async (pageToLoad, f, { background = false } = {}) => {
      const requestId = ++serverRequest.current;
      const listKey = JSON.stringify(f);
      const isFirstPage = pageToLoad === 1;
      if (!isFirstPage) setLoadingMore(true);
      else if (!background) setServerBusy(true);
      setNotice("");

      try {
        let data = await load(pageToLoad, PAGE_SIZE, f);
        if (requestId !== serverRequest.current) return;
        let received = data.items;

        // Restam menos que uma pagina inteira: busca o resto ja, para a lista
        // aparecer completa de uma vez, sem botao.
        const left = data.total - pageToLoad * PAGE_SIZE;
        if (left > 0 && left < PAGE_SIZE) {
          try {
            const rest = await load(pageToLoad + 1, PAGE_SIZE, f);
            if (requestId !== serverRequest.current) return;
            received = [...received, ...rest.items];
            data = rest;
          } catch {
            // Os primeiros ja chegaram: se o resto falhar, o botao
            // "Carregar mais" tenta de novo.
            if (requestId !== serverRequest.current) return;
          }
        }

        setServer((prev) => ({
          key: listKey,
          items: isFirstPage ? received : [...prev.items, ...received],
          total: data.total,
          page: data.page,
          hasMore: data.hasMore,
          error: "",
        }));
      } catch (err) {
        if (requestId !== serverRequest.current) return;
        if (background) return;
        if (isFirstPage) {
          // Sem lista para esse filtro: o erro fica no lugar dela, em vez de
          // a lista de outro filtro parecer ser a resposta.
          setServer({ ...NO_SERVER_LIST, key: listKey, error: err.message });
        } else {
          setNotice(err.message);
        }
      } finally {
        if (requestId === serverRequest.current) {
          setServerBusy(false);
          setLoadingMore(false);
        }
      }
    },
    [load],
  );

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Modo servidor: recarrega do comeco quando o filtro muda. So a digitacao
  // espera um instante (para nao chamar o servidor a cada letra).
  useEffect(() => {
    if (mode !== "server") return undefined;
    // A lista sem filtro acabou de chegar com o download inicial: nao repete.
    const alreadyHere = seededKey.current === key;
    seededKey.current = null;
    if (alreadyHere) return undefined;
    const f = filtersRef.current;
    const timer = setTimeout(() => loadServer(1, f), f.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [mode, key, loadServer]);

  // Modo local: o filtro responde na hora com o que esta na memoria; se a
  // lista ja esta velha, uma copia nova e buscada em silencio.
  useEffect(() => {
    if (mode !== "local") return;
    if (Date.now() - snapshotAt.current > STALE_AFTER_MS) {
      // Marca ja, para digitar varias letras nao disparar um pedido por letra.
      snapshotAt.current = Date.now();
      loadSnapshot({ silent: true });
    }
  }, [mode, key, loadSnapshot]);

  const filtered = useMemo(
    () =>
      mode === "local"
        ? all.filter((book) => matchesRef.current(book, filtersRef.current))
        : NO_ITEMS,
    // "key" representa os filtros (filtersRef muda a cada desenho da tela).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, all, key],
  );

  // "Carregar mais" so existe quando ainda restam PAGE_SIZE livros ou mais.
  // Se sobrar menos que isso, eles aparecem junto com o bloco anterior.
  const opened = shown.key === key ? shown.count : PAGE_SIZE;
  const visible =
    filtered.length - opened < PAGE_SIZE ? filtered.length : opened;
  const localItems = useMemo(
    () => filtered.slice(0, visible),
    [filtered, visible],
  );

  const serverReady = server.key === key;

  let items = NO_ITEMS;
  let total = 0;
  let hasMore = false;
  let waiting = false;
  let shownError = "";
  let busy = false;

  if (mode === "local") {
    items = localItems;
    total = filtered.length;
    hasMore = visible < filtered.length;
    busy = refreshing;
  } else if (mode === "server") {
    waiting = !serverReady;
    if (serverReady) {
      items = server.items;
      total = server.total;
      hasMore = server.hasMore;
      shownError = server.error;
      busy = serverBusy;
    }
  } else {
    waiting = !error;
    shownError = error;
  }

  // Quantos vem no proximo clique: um bloco de PAGE_SIZE ou, se o que sobra
  // cabe em menos de dois blocos, tudo.
  const remaining = Math.max(0, total - items.length);
  const nextCount = remaining < PAGE_SIZE * 2 ? remaining : PAGE_SIZE;

  function loadMore() {
    if (mode === "local") setShown({ key, count: visible + PAGE_SIZE });
    else if (mode === "server" && serverReady) {
      loadServer(server.page + 1, filtersRef.current);
    }
  }

  // Depois de salvar/excluir, ou no "Tentar de novo": a lista fica esmaecida
  // ate a copia nova chegar.
  function reload() {
    if (mode === "server") {
      // "Tentar de novo" depois de um erro: volta o esqueleto enquanto tenta.
      if (serverReady && server.error) setServer(NO_SERVER_LIST);
      return loadServer(1, filtersRef.current);
    }
    return loadSnapshot();
  }

  // Atualizacao silenciosa (ex.: a pessoa voltou para a aba depois de um tempo).
  function revalidate() {
    if (mode === "server") {
      return loadServer(1, filtersRef.current, {
        background: serverReady && server.items.length > 0,
      });
    }
    return loadSnapshot({ silent: mode === "local" });
  }

  return {
    items,
    total,
    hasMore,
    nextCount,
    // waiting: ainda nao ha lista para o filtro atual (mostrar o esqueleto).
    waiting,
    error: shownError,
    notice,
    // refreshing: a lista na tela esta sendo recarregada (esmaecer).
    refreshing: busy,
    loadingMore,
    loadMore,
    reload,
    revalidate,
  };
}
