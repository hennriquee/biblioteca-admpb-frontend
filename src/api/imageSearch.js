// Busca de capa na internet, tentando rodar DIRETO NO NAVEGADOR de quem
// esta usando o site (nao no backend no Render). Isso e proposital: o
// problema original era o IP do SERVIDOR sendo bloqueado por fontes
// nao-oficiais. Fazendo a chamada aqui, quem bate na DuckDuckGo e o
// navegador da pessoa, com IP residencial normal.
//
// Aviso importante: isso usa o mesmo endpoint interno que a aba "Imagens"
// do duckduckgo.com usa - nao e uma API oficial nem documentada, e o
// navegador pode bloquear a leitura da resposta por CORS (o duckduckgo.com
// nao necessariamente libera pedidos vindos de outros sites). Quando isso
// acontece, nao tem contorno possivel do lado do navegador - por isso
// sempre oferecemos, ao lado, um jeito que funciona sem excecao: abrir a
// busca de imagens do Google numa aba nova para copiar o link manualmente
// (ver googleImagesSearchUrl, usado no CoverSearchModal).

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCoverImages(query) {
  if (!query || !query.trim()) {
    throw new Error("Digite algo para buscar.");
  }
  const q = query.trim();

  // Passo 1: abre a pagina normal de busca de imagens so para conseguir o
  // token "vqd" que a DuckDuckGo exige nas chamadas seguintes.
  let html;
  try {
    const htmlResponse = await fetchWithTimeout(
      "https://duckduckgo.com/?q=" +
        encodeURIComponent(q) +
        "&iax=images&ia=images",
    );
    html = await htmlResponse.text();
  } catch {
    throw new Error(
      'O navegador bloqueou essa busca (provavelmente CORS). Use o botao "Abrir no Google" abaixo.',
    );
  }

  const vqdMatch = html.match(/vqd=['"]?([\d-]+)['"&]/);
  const vqd = vqdMatch && vqdMatch[1];
  if (!vqd) {
    throw new Error(
      'Nao foi possivel iniciar essa busca agora. Use o botao "Abrir no Google" abaixo.',
    );
  }

  // Passo 2: usa o token para pegar os resultados de imagem de verdade.
  let data;
  try {
    const jsonResponse = await fetchWithTimeout(
      "https://duckduckgo.com/i.js?l=br-pt&o=json&q=" +
        encodeURIComponent(q) +
        "&vqd=" +
        vqd +
        "&f=,,,&p=1",
    );
    data = await jsonResponse.json();
  } catch {
    throw new Error(
      'O navegador bloqueou essa busca (provavelmente CORS). Use o botao "Abrir no Google" abaixo.',
    );
  }

  const results = data && Array.isArray(data.results) ? data.results : [];
  return results.slice(0, 24).map((item) => ({
    thumbnail: item.thumbnail || item.image,
    link: item.image,
    title: item.title || "",
  }));
}

// Caminho garantido, sem excecao: abre a busca de imagens do Google numa
// aba nova. Nao ha bloqueio de CORS aqui porque nao e uma chamada de API,
// e so um link normal - o navegador abre a pagina do jeito que abriria
// para qualquer site. A pessoa copia o link da imagem escolhida (botao
// direito > "Copiar endereco da imagem") e cola no campo "Link da capa".
export function googleImagesSearchUrl(query) {
  return (
    "https://www.google.com/search?tbm=isch&q=" +
    encodeURIComponent((query || "").trim())
  );
}
