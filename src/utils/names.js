// Ligacoes do nome ("Joao DA Silva"): nao contam como nome.
const PARTICLES = new Set(["de", "da", "do", "das", "dos"]);

/**
 * O PRIMEIRO E O SEGUNDO NOME. As ligacoes de/da/do/das/dos nao contam como
 * nome: entram junto com o nome que vem depois.
 *   "Maria Eduarda Nogueira" -> "Maria Eduarda"
 *   "Joao da Silva Santos"   -> "Joao da Silva"
 *   "Ana dos Anjos"          -> "Ana dos Anjos"
 * (A mesma regra existe no servidor: backend/src/services/people.js.)
 */
export function shortName(fullName) {
  const words = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= 1) return words[0] || "";
  const out = [words[0]];
  for (let i = 1; i < words.length; i += 1) {
    out.push(words[i]);
    if (!PARTICLES.has(words[i].toLocaleLowerCase("pt-BR"))) break;
  }
  // Terminou numa ligacao ("Maria de"): ela sai.
  while (out.length > 1 && PARTICLES.has(out[out.length - 1].toLocaleLowerCase("pt-BR"))) {
    out.pop();
  }
  return out.join(" ");
}
