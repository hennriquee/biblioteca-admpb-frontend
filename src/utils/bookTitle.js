// Padrao de escrita do nome do livro, usado em TODA tela que mostra um titulo
// (acervo, catalogo publico, emprestimos, mensagem de WhatsApp...).
//
// Regra: a primeira letra de cada palavra fica maiuscula, menos nos conectores
// curtos (de, da, e, por, com...), que ficam em minusculo no meio do titulo.
// A primeira palavra, a ultima e a primeira depois de ":" ou " - " sempre
// ficam em maiuscula ("O Pequeno Principe", "Dom Casmurro: Um Romance",
// "Plano A").
//
// So muda a EXIBICAO. O que esta salvo no banco nao e alterado.

// Conectores com ate 3 letras: artigos, preposicoes e conjuncoes. Uma palavra
// curta que NAO e conector ("Rei", "Dom", "Mar", "Paz") continua maiuscula.
const CONNECTORS = new Set([
  // portugues
  "a", "as", "o", "os", "um", "uma", "uns", "dum", "e", "ou", "nem", "mas",
  "que", "se", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "num", "ao", "aos", "à", "às", "por", "com", "sem", "sob", "até", "pra",
  "vs",
  // ingles (alguns livros do acervo vem com o titulo original)
  "the", "of", "and", "to", "in", "on", "at", "by", "or", "an", "for", "but",
  "nor",
]);

// Pronomes que vem colados por hifen ao verbo e ficam minusculos:
// "Diga-me", "Vence-la", "Amar-te".
const CLITICS = new Set([
  "me", "te", "se", "lhe", "lhes", "o", "a", "os", "as", "lo", "la", "los",
  "las", "no", "na", "nos", "nas", "vos",
]);

// Siglas conhecidas do acervo. So importam quando o titulo inteiro vem em
// CAIXA ALTA (ai tudo e baixado, menos o que e sigla).
const ACRONYMS = new Set([
  "AT", "NT", "NVI", "NVT", "ARA", "ARC", "ACF", "NTLH", "KJV", "NIV", "ADMP",
  "EBD", "CPAD", "ONU", "EUA", "DNA", "DVD", "PDF",
]);

// Numeral romano com 2+ letras (II, IV, XIV). Uma letra so (I, V, X) e
// ambigua demais para ser tratada como numeral.
const ROMAN = /^(?=[IVXLCDM]{2,}$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

const VOWEL = /[AEIOUYÁÉÍÓÚÂÊÔÃÕÀÜ]/;

// Palavra = letras/numeros (acentos inclusos), podendo ter apostrofo no meio
// ("d'agua", "don't"). O hifen separa: "cara-de-pau" -> "Cara-de-Pau".
const WORD = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

// O que, antes da palavra, abre uma frase nova dentro do titulo: subtitulo
// (":" ou " - "), ponto final seguido de espaco e aspas/parenteses de abertura.
// A aspa reta so abre se estiver colada na palavra seguinte (a que fecha vem
// colada na anterior).
const PHRASE_BREAK = /[:;!?—–(“«‘‹]|\.\s|\s-\s|"$/;

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

// Em titulo todo em CAIXA ALTA, o que deve continuar assim: siglas conhecidas,
// palavras sem vogal (TV, SQL, HTML) e numeral romano no fim ("Joao Paulo II").
function keepsCapitals(upperWord, isLast) {
  if (upperWord.length < 2) return false;
  if (ACRONYMS.has(upperWord)) return true;
  if (isLast && ROMAN.test(upperWord)) return true;
  return !VOWEL.test(upperWord);
}

export function formatBookTitle(value) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  // Titulo inteiro em CAIXA ALTA (vem assim de algumas fontes de ISBN).
  const shouting =
    text.length > 3 && text === text.toUpperCase() && text !== text.toLowerCase();

  const matches = [...text.matchAll(WORD)];
  let result = "";
  let cursor = 0;
  let previous = "";

  matches.forEach((match, index) => {
    const gap = text.slice(cursor, match.index);
    const original = match[0];
    const isFirst = index === 0;
    const isLast = index === matches.length - 1;
    const opensPhrase = isFirst || PHRASE_BREAK.test(gap);
    const afterHyphen = gap === "-";
    const isUpper =
      original.length >= 2 &&
      original === original.toUpperCase() &&
      original !== original.toLowerCase();
    // Sigla que deve continuar em caixa alta: num titulo normal, qualquer
    // palavra escrita assim (AT, NVI, II); num titulo todo em caixa alta, so as
    // que keepsCapitals() reconhece.
    const keepAsIs = shouting ? keepsCapitals(original, isLast) : isUpper;
    const word = shouting && !keepAsIs ? original.toLowerCase() : original;
    const lower = word.toLowerCase();
    const apostrophe = word.search(/['’]/);
    let out;

    if (keepAsIs) {
      out = original;
    } else if (apostrophe > 0) {
      // d'Agua, O'Toole, Don't, It's
      const head = word.slice(0, apostrophe);
      const rest = word.slice(apostrophe + 1);
      const mark = word.charAt(apostrophe);
      if (head.length === 1) {
        const keepsLower = head.toLowerCase() === "d" && !opensPhrase;
        out = (keepsLower ? "d" : head.toUpperCase()) + mark + capitalize(rest);
      } else {
        out = capitalize(head) + mark + rest;
      }
    } else if (afterHyphen && !opensPhrase && previous === "e") {
      // "e-books", "e-mail": o prefixo "e-" e a palavra seguem juntos.
      out = word;
    } else if (afterHyphen && !opensPhrase && CLITICS.has(lower)) {
      out = lower;
    } else if (!opensPhrase && !isLast && CONNECTORS.has(lower)) {
      out = lower;
    } else {
      out = capitalize(word);
    }

    result += gap + out;
    cursor = match.index + original.length;
    previous = lower;
  });

  return result + text.slice(cursor);
}
