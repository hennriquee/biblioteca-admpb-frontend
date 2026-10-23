/**
 * Carrega o script do reCAPTCHA do Google (a caixa "Nao sou um robo") uma vez
 * so, sob demanda: so quem chega a entrada do acervo sem passe baixa o script
 * (ver components/CatalogGate.jsx).
 *
 * Devolve uma promessa com o window.grecaptcha. Falha (sem internet,
 * bloqueador de anuncios, Google fora do ar ou lento demais) rejeita a
 * promessa; chamar de novo tenta outra vez.
 */

const SCRIPT_ID = "recaptcha-script";
const READY_CALLBACK = "__bibliotecaRecaptchaPronto";
// Sem resposta nesse tempo, a tela oferece "Tentar de novo" (o script que
// estava a caminho ainda pode chegar e e aproveitado).
const LOAD_TIMEOUT_MS = 20 * 1000;

let pending = null;

function ready() {
  return Boolean(window.grecaptcha?.render);
}

export function loadRecaptcha() {
  if (ready()) return Promise.resolve(window.grecaptcha);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    let timer = null;
    const done = (error) => {
      clearTimeout(timer);
      pending = null;
      if (error) reject(error);
      else resolve(window.grecaptcha);
    };

    // O Google chama esta funcao quando o script esta pronto para desenhar
    // (render=explicit). Trocada a cada tentativa: so a da vez responde.
    window[READY_CALLBACK] = () => done();

    timer = setTimeout(() => done(new Error("recaptcha-timeout")), LOAD_TIMEOUT_MS);

    // Um script que ja foi pedido e ainda esta a caminho e aproveitado:
    // pedir de novo faria o Google carregar duas vezes.
    let script = document.getElementById(SCRIPT_ID);
    if (script && script.dataset.failed) {
      script.remove();
      script = null;
    }
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src =
        "https://www.google.com/recaptcha/api.js?onload=" +
        READY_CALLBACK +
        "&render=explicit&hl=pt-BR";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        script.dataset.failed = "1";
        done(new Error("recaptcha-script"));
      };
      document.head.appendChild(script);
    }
  });
  return pending;
}
