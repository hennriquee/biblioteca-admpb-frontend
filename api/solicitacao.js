/**
 * Funcao da Vercel para o LINK DA SOLICITACAO (/solicitacao/<id>), o que vai
 * no fim da mensagem de "Solicitar empréstimo" do acervo publico. O
 * vercel.json manda esse endereco para ca.
 *
 * Quem abre o link e de dois tipos:
 *
 * - O WHATSAPP (e outros aplicativos que mostram previa de link): ele busca a
 *   pagina para montar a previa que aparece acima da mensagem. Recebe um HTML
 *   pequeno so com as etiquetas "og:" - titulo e autor do livro e a CAPA,
 *   num quadro deitado de 1200 x 630 (o formato da imagem grande do
 *   WhatsApp). Os dados vem do backend (GET /og/requests/<id>, ver
 *   backend/src/routes/requests.js), que nunca diz quem pediu o livro.
 * - Uma PESSOA no navegador (o administrador que tocou no link): vai direto
 *   para o painel, em Empréstimos > Solicitados, com o "Registrar
 *   solicitação" ja preenchido (ver src/pages/Loans.jsx). Sem login, o painel
 *   pede o "Não sou um robô" e o login antes; o link sozinho nao mostra nem
 *   registra nada.
 *
 * Se o backend nao responder a tempo, a previa sai com a logo da biblioteca.
 * Quem ja tem o app instalado nem passa por aqui: o proprio app trata o
 * endereco (rota /solicitacao/:token em src/App.jsx).
 */
import { formatBookTitle } from "../src/utils/bookTitle.js";

const API_URL = (
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  "https://bibliotecaadmpbapi.onrender.com"
).replace(/\/$/, "");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
// Quem busca previa de link. (O Signal e o iMessage tambem se apresentam com
// um destes nomes.)
// (So robos de previa: nada que apareca no navegador de uma pessoa.)
const PREVIEW_BOTS =
  /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|pinterestbot|redditbot|applebot|embedly|iframely|vkshare|googlebot|bingbot|snap url preview/i;
const BACKEND_TIMEOUT_MS = 5000;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinNames(names) {
  const list = (Array.isArray(names) ? names : [])
    .map((name) => String(name).trim())
    .filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  return list.slice(0, -1).join(", ") + " e " + list[list.length - 1];
}

function readToken(req) {
  const fromQuery = req.query && req.query.token;
  if (typeof fromQuery === "string") return fromQuery;
  try {
    return new URL(req.url, "http://x").searchParams.get("token") || "";
  } catch {
    return "";
  }
}

async function fetchPreview(token) {
  try {
    const response = await fetch(API_URL + "/og/requests/" + encodeURIComponent(token), {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function previewHtml({ origin, token, preview }) {
  const url = origin + "/solicitacao/" + encodeURIComponent(token);
  const title = preview?.title
    ? formatBookTitle(preview.title)
    : "Solicitação de empréstimo";
  const authors = joinNames(preview?.authors);
  const description =
    (authors ? "de " + authors + " · " : "") +
    "Solicitação de empréstimo na Biblioteca ADMP Brasil";
  const image =
    preview?.image && /^https:\/\//i.test(preview.image)
      ? preview.image
      : origin + "/img/logo-biblioteca.png";
  // So a capa montada pelo Cloudinary tem o tamanho certo garantido.
  const framed = image.startsWith("https://res.cloudinary.com/");

  const meta = [
    ["og:type", "website"],
    ["og:site_name", "Biblioteca ADMP Brasil"],
    ["og:locale", "pt_BR"],
    ["og:title", title],
    ["og:description", description],
    ["og:url", url],
    ["og:image", image],
    ["og:image:secure_url", image],
    ["og:image:alt", "Capa do livro " + title],
    ...(framed
      ? [
          ["og:image:type", "image/jpeg"],
          ["og:image:width", "1200"],
          ["og:image:height", "630"],
        ]
      : []),
  ]
    .map(
      ([property, content]) =>
        '<meta property="' + property + '" content="' + escapeHtml(content) + '" />',
    )
    .join("\n    ");

  return (
    "<!doctype html>\n" +
    '<html lang="pt-BR">\n  <head>\n' +
    '    <meta charset="utf-8" />\n' +
    "    <title>" + escapeHtml(title + " · Biblioteca ADMP Brasil") + "</title>\n" +
    '    <meta name="description" content="' + escapeHtml(description) + '" />\n' +
    "    " + meta + "\n" +
    '    <meta name="twitter:card" content="' + (framed ? "summary_large_image" : "summary") + '" />\n' +
    '    <meta name="twitter:title" content="' + escapeHtml(title) + '" />\n' +
    '    <meta name="twitter:image" content="' + escapeHtml(image) + '" />\n' +
    '    <meta name="robots" content="noindex" />\n' +
    "  </head>\n  <body>\n" +
    "    <p>Solicitação de empréstimo: " + escapeHtml(title) + ".</p>\n" +
    '    <p><a href="' + escapeHtml(url) + '">Abrir na Biblioteca ADMP Brasil</a></p>\n' +
    "  </body>\n</html>\n"
  );
}

export default async function handler(req, res) {
  const token = readToken(req);
  const valid = TOKEN_PATTERN.test(token);
  const userAgent = String(req.headers["user-agent"] || "");
  // A mesma URL responde diferente para o WhatsApp e para a pessoa: nada
  // pode ficar guardado no meio do caminho.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "User-Agent");

  if (!PREVIEW_BOTS.test(userAgent)) {
    res.statusCode = 302;
    res.setHeader(
      "Location",
      "/emprestimos?filtro=solicitados" +
        (valid ? "&solicitacao=" + encodeURIComponent(token) : ""),
    );
    res.end();
    return;
  }

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const origin = "https://" + host.split(",")[0].trim();
  const preview = valid ? await fetchPreview(token) : null;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(previewHtml({ origin, token: valid ? token : "", preview }));
}
