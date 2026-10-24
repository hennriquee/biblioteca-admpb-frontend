import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preloadCovers } from "../utils/coverPreload.js";

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
// Capas baixadas em segundo plano: as da tela e as dos proximos "Carregar
// mais" (ver utils/coverPreload.js).
const PRELOAD_AHEAD = 2 * PAGE_SIZE;

// ---------- Lista guardada entre uma tela e outra ----------
//
// O primeiro pedido do acervo (a lista sem filtro) fica guardado aqui, por
// funcao de busca (Acervo e Catalogo tem a sua). Serve para duas coisas:
// - prefetchBookList: o painel baixa o Acervo antes de a pessoa tocar em
//   "Livros" (ver components/Layout.jsx), com as primeiras capas;
// - voltar para a tela: a lista aparece na hora, com as capas, e uma copia
//   nova e buscada em silencio.
// Mais velha que isso, a lista guardada nao aparece (espera a copia nova).
const SAVED_FRESH_MS = 2 * 60 * 1000;
// funcao load -> { at, first, promise }
const saved = new Map();

/**
 * Esquece as listas guardadas. Chamado pelo api/client.js quando um livro,
 * emprestimo ou solicitacao muda no painel: a proxima abertura do Acervo nao
 * mostra a situacao antiga (ex.: "disponivel" de um livro que acabou de sair).
 */
export function forgetSavedBookLists() {
  saved.clear();
  forgottenAt = Date.now();
}
let forgottenAt = 0;

function remember(load, first) {
  saved.set(load, { at: Date.now(), first, promise: null });
}

function freshSaved(load) {
  const entry = saved.get(load);
  return entry?.first && Date.now() - entry.at < SAVED_FRESH_MS ? entry : null;
}

// A lista guardada so aparece direto quando veio inteira num pedido so.
function completeSaved(load) {
  const entry = freshSaved(load);
  return entry && entry.first.total <= entry.first.items.length ? entry : null;
}

/**
 * Baixa em segundo plano a primeira lista (sem filtro) e as primeiras capas.
 * Nao faz nada se ja ha uma copia recente ou um pedido andando.
 */
export function prefetchBookList(load) {
  const entry = saved.get(load);
  if (freshSaved(load) || entry?.promise) return;
  const promise = load(1, SNAPSHOT_PAGE, null).then(
    (first) => {
      // Esquecida no meio do caminho (algo mudou): esta copia ja e velha.
      if (saved.get(load)?.promise !== promise) return first;
      remember(load, first);
      preloadCovers(
        (first.items || []).slice(0, PAGE_SIZE + PRELOAD_AHEAD).map((book) => book.cover),
      );
      return first;
    },
    (error) => {
      if (saved.get(load)?.promise === promise) saved.delete(load);
      throw error;
    },
  );
  // Ninguem esperando: a falha nao vira erro solto no console.
  promise.catch(() => {});
  saved.set(load, { at: 0, first: entry?.first || null, promise });
}
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

  // Lista guardada recente e inteira: aparece ja no primeiro desenho.
  const [initial] = useState(() => completeSaved(load));
  const [mode, setMode] = useState(initial ? "local" : "starting");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [all, setAll] = useState(initial ? initial.first.items : NO_ITEMS);
  // error: nao ha lista para mostrar. notice: a lista continua na tela, mas a
  // ultima atualizacao (ou o "carregar mais") falhou.
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Modo local: quantos itens o "carregar mais" ja abriu, e para qual filtro.
  const [shown, setShown] = useState({ key: "", count: PAGE_SIZE });
  // Modo servidor: a lista carregada e o filtro (key) a que ela responde.
  const [server, setServer] = useState(NO_SERVER_LIST);
  // Qual livro do acervo leva a coroinha de mais emprestado (quem responde e
  // o servidor, olhando o acervo inteiro; null quando ha empate no primeiro
  // lugar). Vem em toda pagina de resultado, entao acompanha a lista.
  const [mostLoanedId, setMostLoanedId] = useState(
    initial?.first.mostLoanedId || null,
  );
  const [serverBusy, setServerBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // So a resposta do ultimo pedido vale: as antigas, atrasadas, sao descartadas.
  const snapshotRequest = useRef(0);
  const serverRequest = useRef(0);
  // Com a lista guardada, a copia nova ja e pedida ao abrir (logo abaixo):
  // conta como recente, para a troca de filtro nao pedir outra junto.
  const snapshotAt = useRef(initial ? Date.now() : 0);
  // Filtro (key) cuja primeira tela ja veio junto com o download inicial.
  const seededKey = useRef(null);

  // Baixa o acervo inteiro. silent: sem esmaecer a lista e sem avisar se falhar.
  // useSaved: na abertura da tela, aproveita a lista que o painel ja baixou
  // antes (ou o pedido dela que ainda esta andando).
  const loadSnapshot = useCallback(
    async ({ silent = false, useSaved = false, reportFailure = false } = {}) => {
      const requestId = ++snapshotRequest.current;
      if (!silent) {
        setRefreshing(true);
        setError("");
        setNotice("");
      }
      try {
        // So o pedido que o painel ja deixou andando (e de agora). Uma lista
        // guardada pronta so aparece pelo "initial" la em cima, e mesmo assim
        // com a conferida logo em seguida.
        let first = null;
        const entry = useSaved ? saved.get(load) : null;
        if (entry?.promise) first = await entry.promise.catch(() => null);
        if (!first) {
          const startedAt = Date.now();
          first = await load(1, SNAPSHOT_PAGE, null);
          // So guarda se nada mudou no painel enquanto esta copia vinha.
          if (!(forgottenAt > startedAt)) remember(load, first);
        }
        if (requestId !== snapshotRequest.current) return;
        let books = first.items;
        setMostLoanedId(first.mostLoanedId || null);

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
        else if (!silent || reportFailure) setNotice(err.message);
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

        setMostLoanedId(data.mostLoanedId || null);
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

  // Abrindo com a lista guardada na tela: so confere, em silencio, se mudou.
  useEffect(() => {
    // (Se a conferida falhar, avisa: a lista na tela pode estar velha.)
    if (initial) loadSnapshot({ silent: true, reportFailure: true });
    else loadSnapshot({ useSaved: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Capas: as da tela e as dos proximos dois "Carregar mais", ja baixando.
  const preloadList = useMemo(() => {
    if (mode === "local") return filtered.slice(0, visible + PRELOAD_AHEAD);
    if (mode === "server" && serverReady) return server.items;
    return NO_ITEMS;
  }, [mode, filtered, visible, serverReady, server.items]);
  useEffect(() => {
    preloadCovers(preloadList.map((book) => book.cover));
  }, [preloadList]);

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
    mostLoanedId,
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
