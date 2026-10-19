/**
 * Controla, no proprio navegador, o que esta pessoa ja viu de livro novo no
 * acervo publico (/catalogo). Quem so visita o catalogo nao tem conta nem
 * login (ver models/Person.js no backend) - nao ha onde guardar isso no
 * servidor, entao fica no localStorage deste navegador e deste aparelho.
 *
 * Chave separada da de boas-vindas (WELCOME_KEY, em pages/Catalog.jsx):
 * marcam coisas diferentes, em momentos diferentes.
 */
const SEEN_KEY = "biblioteca_admpb_livros_vistos_em";

// Data (texto ISO) da ultima vez que a pessoa viu a tela de novidades, ou
// null quando: nunca visitou, limpou os dados do navegador, esta em modo
// privado (localStorage bloqueado), ou o que estava guardado nao e uma data
// valida (alguem editou a chave na mao, extensao de navegador, bug futuro
// que grave outro formato aqui). Em qualquer um desses casos, quem chama
// trata como "comecando agora" (ver markBooksSeenNow) - nunca como "desde
// sempre", que inundaria a pessoa com o acervo inteiro como novidade.
export function getLastSeenBooksAt() {
  let value;
  try {
    value = localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return value;
}

// Marca "visto agora". Sem localStorage disponivel, so deixa de lembrar da
// visita na proxima vez - nao trava a tela.
export function markBooksSeenNow() {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    /* modo privado ou sem armazenamento: sem problema, so nao vai lembrar */
  }
}
