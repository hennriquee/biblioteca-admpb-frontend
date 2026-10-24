/**
 * CAPAS PRONTAS ANTES DE APARECER.
 *
 * 1) Tamanho: a capa enviada pelo app fica no Cloudinary com ate 800 x 1200,
 *    mas na tela ela nunca passa de 132 x 190 (o maior card). coverDisplayUrl
 *    pede ao Cloudinary uma copia de ate 400 x 600 (nitida ate em tela de
 *    celular com 3x de densidade) - um quarto dos pixels, bem mais leve.
 *    Capa que e link de outro site fica como esta. Se a copia reduzida falhar
 *    por algum motivo, components/BookCover.jsx volta para o endereco
 *    original antes de dizer "Sem imagem".
 *
 * 2) Antes da hora: preloadCovers baixa capas em segundo plano (poucas por
 *    vez, com prioridade baixa, para nao disputar com o resto da tela). A
 *    lista de livros (hooks/useBookList.js) pede as que estao na tela e as
 *    dos proximos "Carregar mais"; quando o card aparece, a capa ja esta no
 *    navegador e entra sem o brilho de "carregando".
 */

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;
const THUMB = "c_limit,w_400,h_600/";
// A copia reduzida falhou e o original abriu: o Cloudinary esta recusando
// copias feitas na hora. Dali em diante usa o original direto.
let thumbsRefused = false;

export function thumbnailRefused() {
  thumbsRefused = true;
}

export function coverDisplayUrl(src) {
  if (typeof src !== "string") return "";
  const match = thumbsRefused ? null : CLOUDINARY_UPLOAD.exec(src);
  if (!match) return src;
  // Ja reduzida (por aqui mesmo): nao repete.
  if (match[2].startsWith(THUMB)) return src;
  return match[1] + THUMB + match[2];
}

const MAX_PARALLEL = 4;
// Uma capa que nao responde em tanto tempo libera a vaga (continua baixando).
const SLOT_TIMEOUT_MS = 15000;
// Quantas capas ficam seguras na memoria (as mais recentes): o resto continua
// no cache normal do navegador.
const MAX_KEPT = 150;

// url -> "queued" | "loading" | "ready" | "blank"
const state = new Map();
// copia reduzida -> endereco original (para testar o original se ela falhar)
const originals = new Map();
// Uma copia reduzida falhou e o original esta sendo testado: as outras copias
// esperam a resposta (para nao pedir dezenas que vao falhar do mesmo jeito).
let probing = false;
const queue = [];
const kept = new Map();
let active = 0;

/** A capa ja foi baixada inteira (pode aparecer direto, sem o brilho)? */
export function isCoverReady(url) {
  return state.get(url) === "ready";
}

/** A capa baixou, mas e um pixel vazio (a fonte nao tinha a capa). */
export function isCoverBlank(url) {
  return state.get(url) === "blank";
}

function keep(url, img) {
  kept.delete(url);
  kept.set(url, img);
  if (kept.size > MAX_KEPT) kept.delete(kept.keys().next().value);
}

function start(url) {
  active += 1;
  state.set(url, "loading");
  const img = new Image();
  img.decoding = "async";
  try {
    img.fetchPriority = "low";
  } catch {
    /* navegador sem prioridade: tudo bem */
  }
  let freed = false;
  function free() {
    if (freed) return;
    freed = true;
    clearTimeout(timer);
    active -= 1;
    pump();
  }
  const timer = setTimeout(() => {
    // Demorou: libera a vaga e deixa tentar de novo numa proxima vez.
    if (state.get(url) === "loading") state.delete(url);
    free();
  }, SLOT_TIMEOUT_MS);
  img.onload = () => {
    const finish = () => {
      state.set(url, img.naturalWidth > 1 ? "ready" : "blank");
      keep(url, img);
      free();
    };
    if (typeof img.decode === "function") img.decode().then(finish, finish);
    else finish();
  };
  img.onerror = () => {
    // Falhou aqui: a tela tenta do jeito normal (e mostra "Sem imagem" se
    // falhar la tambem). Nao conta como "pronta".
    state.delete(url);
    // Era a copia reduzida: se o original abrir, o Cloudinary esta recusando
    // as copias, e as proximas capas vao direto ao original.
    const original = originals.get(url);
    if (original && !thumbsRefused && !probing) {
      probing = true;
      const probe = new Image();
      const done = (ok) => {
        if (!probing) return;
        probing = false;
        if (ok) thumbnailRefused();
        pump();
      };
      probe.onload = () => done(probe.naturalWidth > 1);
      probe.onerror = () => done(false);
      setTimeout(() => done(false), SLOT_TIMEOUT_MS);
      probe.src = original;
    }
    free();
  };
  img.src = url;
}

function pump() {
  while (active < MAX_PARALLEL && queue.length) {
    if (probing && originals.has(queue[0])) break;
    const url = queue.shift();
    if (state.get(url) !== "queued") continue;
    const original = thumbsRefused ? originals.get(url) : null;
    if (original) {
      // Copias recusadas: baixa o original no lugar desta.
      state.delete(url);
      if (state.get(original) === undefined) start(original);
    } else start(url);
  }
}

/**
 * Baixa estas capas em segundo plano, na ordem dada. O pedido mais recente
 * passa na frente dos anteriores (a tela que a pessoa esta vendo agora vem
 * primeiro). Recebe os enderecos como estao no livro (book.cover).
 */
export function preloadCovers(covers) {
  if (typeof Image === "undefined") return;
  const urls = [];
  const seen = new Set();
  (covers || []).forEach((cover) => {
    const url = coverDisplayUrl(cover);
    if (!url || seen.has(url) || !/^https?:\/\//i.test(url)) return;
    if (url !== cover) originals.set(url, cover);
    seen.add(url);
    const current = state.get(url);
    if (current === undefined || current === "queued") urls.push(url);
  });
  if (!urls.length) return;
  const wanted = new Set(urls);
  const rest = queue.filter((url) => !wanted.has(url));
  queue.length = 0;
  queue.push(...urls, ...rest);
  urls.forEach((url) => state.set(url, "queued"));
  pump();
}
