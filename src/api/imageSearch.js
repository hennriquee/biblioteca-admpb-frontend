import { api } from "./client.js";

// Busca de capa na internet. Tentamos antes fazer isso automaticamente via
// DuckDuckGo direto do navegador, mas o duckduckgo.com bloqueia por CORS
// (confirmado na pratica) - o navegador nem deixa a gente ler a resposta.
// Nao ha contorno possivel pra isso do lado do cliente sem um servidor
// intermediario, entao desistimos dessa rota.
//
// O caminho que sobra e simples e 100% confiavel: um link de verdade
// (nao window.open() via JS, que pop-up blocker pode bloquear silenciosamente
// em alguns navegadores/celulares) para a busca de imagens do Google. A
// pessoa abre, escolhe a foto, copia o endereco da imagem e cola no campo
// "Link da capa" do formulario.
export function googleImagesSearchUrl(query) {
  return (
    "https://www.google.com/search?tbm=isch&q=" +
    encodeURIComponent((query || "").trim())
  );
}

// O Google mudou o que "Copiar endereco da imagem" devolve: em vez do link
// direto do arquivo, agora vem um link da PROPRIA pagina de resultados
// (https://www.google.com/imgres?...&imgurl=<link real>&imgrefurl=...&...).
// Colar esse link direto no <img src> nao funciona - o navegador tenta
// carregar a pagina de busca do Google como se fosse a foto. O link de
// verdade fica guardado dentro do parametro "imgurl".
//
// No celular acontece um caso pior: o app do Google abre a busca em
// .../search?q=...&udm=2 (o "udm=2" e o modo "Imagens" da busca unificada)
// e nao existe link de foto nenhum pra copiar - so o endereco dessa pagina
// de busca, com o texto pesquisado no parametro "q". Nesse caso nao ha
// nada pra "consertar" (nao tem imagem escondida no link), entao avisamos
// que e preciso buscar essa capa pelo texto em vez de colar um link.
//
// parseCoverInput() reconhece os tres casos: link direto de foto (devolve
// como veio), link de resultado do Google com imgurl (extrai a foto de
// dentro dele) e link de pagina de busca do Google sem foto nenhuma
// (devolve o texto pesquisado, para a busca por texto assumir dali).
export function parseCoverInput(rawValue) {
  const value = (rawValue || "").trim();
  if (!value) return { type: "empty", value: "" };

  let url;
  try {
    url = new URL(value);
  } catch {
    // Nao e uma URL valida (texto digitado a mao, ou ainda incompleto) -
    // devolve como veio, sem tentar "consertar" texto que nao e um link.
    return { type: "text", value };
  }

  const isGoogleHost = /(^|\.)google\.[a-z.]+$/i.test(url.hostname);

  if (isGoogleHost && url.searchParams.has("imgurl")) {
    const imgUrl = url.searchParams.get("imgurl");
    if (imgUrl) return { type: "url", value: imgUrl };
  }

  if (isGoogleHost && url.pathname === "/search" && url.searchParams.has("q")) {
    return { type: "query", value: url.searchParams.get("q") };
  }

  return { type: "url", value };
}

// Busca capas por texto livre no backend (que faz a busca de imagens do
// lado do servidor, sem esbarrar em CORS). Usada tanto pelo modal "Buscar
// foto na internet" quanto automaticamente quando detectamos um link de
// busca do Google sem foto nenhuma dentro dele.
export async function searchCoverImages(query) {
  const q = (query || "").trim();
  if (!q) return [];
  const data = await api("/api/books/cover-search?q=" + encodeURIComponent(q));
  return (data && data.results) || [];
}
