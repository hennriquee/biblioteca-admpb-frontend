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
