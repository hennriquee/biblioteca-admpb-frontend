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
// verdade fica guardado dentro do parametro "imgurl", entao extraimos ele
// aqui sempre que detectamos esse formato.
export function extractDirectImageUrl(rawUrl) {
  const value = (rawUrl || "").trim();
  if (!value) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    // Nao e uma URL valida (ex: a pessoa ainda esta digitando) - devolve
    // como veio, sem tentar "consertar" texto que nao e um link.
    return value;
  }

  const isGoogleResultLink =
    /(^|\.)google\.[a-z.]+$/i.test(url.hostname) &&
    url.searchParams.has("imgurl");

  if (isGoogleResultLink) {
    const imgUrl = url.searchParams.get("imgurl");
    if (imgUrl) return imgUrl;
  }

  return value;
}
