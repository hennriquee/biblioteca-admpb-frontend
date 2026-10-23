import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ApiError,
  SITE_PASS_EVENT,
  getSitePass,
  publicApi,
  setSitePass,
} from "../api/client.js";
import WelcomeScene from "./WelcomeScene.jsx";
import { applyCatalogIdentity } from "../utils/catalogIdentity.js";
import { loadRecaptcha } from "../utils/recaptcha.js";

/**
 * Entrada do SITE inteiro (acervo publico, login e painel): antes de ver
 * qualquer pagina, a pessoa marca o "Nao sou um robo" do Google. A animacao de
 * boas-vindas (a logo que vira livro e depois a pomba) roda em cima, para a
 * espera nao parecer uma barreira.
 *
 * Fica ACIMA de tudo (ver main.jsx), ate do AuthProvider: o app so comeca a
 * falar com o servidor (restaurar o login, carregar o acervo) depois do passe,
 * porque o servidor recusa qualquer pedido sem ele.
 *
 * O servidor confere a caixa com o Google e devolve um passe que vale algumas
 * horas neste aparelho (ver api/client.js e backend/src/services/captcha.js):
 * com o passe valido, esta tela nem aparece. Se o servidor recusar o passe no
 * meio do uso (venceu, ou o servidor trocou de chave), a pagina sai da tela e
 * esta entrada volta - o login do painel continua guardado, entao depois da
 * caixa a pessoa segue logada.
 *
 * Com o reCAPTCHA desligado no servidor (sem as chaves no ambiente), a
 * entrada so pergunta isso ao servidor e abre o site direto.
 */

// Largura fixa da caixa do Google. Em celular estreito ela e reduzida (em
// escala) para nao vazar da tela.
const WIDGET_WIDTH = 304;
const WIDGET_HEIGHT = 78;
// O servidor gratuito dorme quando ninguem usa; depois deste tempo a tela
// explica a demora.
const SLOW_AFTER_MS = 5000;
// Muita gente entrando pela mesma rede ao mesmo tempo (o Wi-Fi da igreja): o
// servidor responde 429 SEM falar com o Google, entao a caixa marcada ainda
// vale (por 2 minutos). Em vez de desmarcar, tenta de novo sozinho.
const BUSY_RETRY_MS = 8000;
const BUSY_MAX_TRIES = 8;

function Dots() {
  return (
    <span className="loadingdots" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

// Mensagem para a pessoa, a partir do erro de qualquer etapa.
function messageFor(error) {
  if (error instanceof ApiError) return error.message;
  if (error?.message === "recaptcha-script" || error?.message === "recaptcha-timeout") {
    return "Não foi possível carregar a verificação do Google. Confira a internet (ou desligue o bloqueador de anúncios para este site) e tente de novo.";
  }
  return "Não foi possível abrir o site agora. Tente de novo.";
}

export default function SiteGate({ children }) {
  // O acervo publico tem a "cara" propria (titulo da aba, icone do app e o
  // texto que fala em "acervo"); o resto do site, a do painel.
  const isCatalog = useLocation().pathname.startsWith("/catalogo");
  const [passed, setPassed] = useState(() => Boolean(getSitePass()));
  // Cada nova tentativa (botao "Tentar de novo", passe recusado) recomeca.
  const [attempt, setAttempt] = useState(0);
  // undefined = perguntando ao servidor | { enabled, siteKey }
  const [config, setConfig] = useState(undefined);
  const [grecaptcha, setGrecaptcha] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [problem, setProblem] = useState(null);
  // A entrada voltou no meio do uso (o servidor recusou o passe): a pessoa
  // precisa saber que o que estava fazendo nao foi enviado.
  const [expired, setExpired] = useState(false);
  const [slow, setSlow] = useState(false);
  const [scale, setScale] = useState(1);

  const boxRef = useRef(null);
  const slotRef = useRef(null);
  const widgetRef = useRef(null);
  const titleRef = useRef(null);
  // Leva o foco ao titulo da pagina depois de passar pela caixa (sem isso
  // ele fica perdido no <body>: a caixa saiu da tela).
  const focusAfterPass = useRef(false);
  const passedRef = useRef(passed);
  passedRef.current = passed;

  // Passe recusado pelo servidor no meio do uso: volta para a entrada. Com a
  // entrada ja na tela, nao recomeca: a pessoa pode estar no meio das imagens
  // do Google, e recriar a caixa jogaria isso fora.
  useEffect(() => {
    function onPassRefused() {
      if (!passedRef.current) return;
      setExpired(true);
      setPassed(false);
      setAttempt((current) => current + 1);
    }
    window.addEventListener(SITE_PASS_EVENT, onPassRefused);
    return () => window.removeEventListener(SITE_PASS_EVENT, onPassRefused);
  }, []);

  // Passou de novo: o aviso de passe vencido ja cumpriu o papel.
  useEffect(() => {
    if (passed) setExpired(false);
  }, [passed]);

  // Entrando pelo acervo, a entrada e a pagina do acervo: titulo da aba e
  // "cara" de app do catalogo (o catalogo faz o mesmo quando abre). Nas outras
  // paginas ela fica com o titulo e o icone de sempre.
  useEffect(() => {
    if (passed || !isCatalog) return undefined;
    const previous = document.title;
    document.title = "Acervo · Biblioteca ADMP Brasil";
    const undoIdentity = applyCatalogIdentity();
    return () => {
      document.title = previous;
      undoIdentity();
    };
  }, [passed, isCatalog]);

  // Pergunta ao servidor se a caixa esta ligada e, ao mesmo tempo, ja vai
  // baixando o script do Google (quase sempre ele vai ser preciso).
  useEffect(() => {
    if (passed) return undefined;
    let active = true;
    setConfig(undefined);
    setGrecaptcha(null);
    setProblem(null);
    setVerifying(false);

    const script = loadRecaptcha();
    // Sem isto, uma falha do script antes da resposta do servidor viraria
    // "promessa rejeitada sem tratamento" no console.
    script.catch(() => {});

    (async () => {
      try {
        const data = await publicApi("/api/public/captcha");
        if (!active) return;
        if (!data?.enabled) {
          setPassed(true);
          return;
        }
        setConfig(data);
        const api = await script;
        if (active) setGrecaptcha(() => api);
      } catch (error) {
        if (active) setProblem(messageFor(error));
      }
    })();

    return () => {
      active = false;
    };
  }, [passed, attempt]);

  const waiting = !passed && !problem && (config === undefined || !grecaptcha);
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  // Desligado ao sair da entrada: a nova tentativa depois de um 429 nao
  // continua com a tela ja fechada.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async (token) => {
    setVerifying(true);
    setProblem(null);
    try {
      let data;
      for (let tries = 1; ; tries += 1) {
        try {
          data = await publicApi("/api/public/captcha", {
            method: "POST",
            body: { token },
          });
          break;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 429 || tries >= BUSY_MAX_TRIES) {
            throw error;
          }
          setBusy(true);
          await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
          if (!mountedRef.current) return;
        }
      }
      setBusy(false);
      setSitePass(data.pass, data.expiresIn);
      focusAfterPass.current = true;
      setPassed(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setBusy(false);
      setVerifying(false);
      setProblem(messageFor(error));
      // A resposta do Google so vale uma vez: a caixa volta desmarcada.
      try {
        if (widgetRef.current !== null) window.grecaptcha?.reset(widgetRef.current);
      } catch {
        /* caixa ja saiu da tela */
      }
    }
  }, []);

  // Desenha a caixa do Google. Num elemento novo a cada vez: o Google nao
  // desenha duas vezes no mesmo (e o StrictMode roda este efeito duas vezes).
  useEffect(() => {
    const slot = slotRef.current;
    if (!grecaptcha || !config?.siteKey || !slot) return undefined;
    const holder = document.createElement("div");
    slot.appendChild(holder);
    try {
      widgetRef.current = grecaptcha.render(holder, {
        sitekey: config.siteKey,
        hl: "pt-BR",
        callback: verify,
        // A marcacao vale 2 minutos; passado isso sem conferir, marca de novo.
        "expired-callback": () =>
          setProblem("A verificação expirou. Marque a caixa de novo."),
        "error-callback": () =>
          setProblem(
            "A verificação perdeu a conexão com o Google. Confira a internet e marque a caixa de novo.",
          ),
      });
    } catch {
      setProblem(messageFor(null));
    }
    return () => {
      widgetRef.current = null;
      holder.remove();
    };
  }, [grecaptcha, config, verify]);

  // A caixa do Google tem largura fixa: em tela estreita, encolhe por inteiro.
  // (Mede a faixa onde ela fica, e nao a propria caixa, que tem sempre a
  // mesma largura.)
  useEffect(() => {
    const box = boxRef.current;
    if (passed || !box || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(width > 0 ? Math.min(1, width / WIDGET_WIDTH) : 1);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [passed]);

  // Foco no titulo quando a entrada volta no meio do uso (o foco estava num
  // elemento da pagina que sumiu).
  useEffect(() => {
    if (!passed && attempt > 0) titleRef.current?.focus();
  }, [passed, attempt]);

  // Passou pela caixa: o foco vai para o titulo da pagina que abriu. Se uma
  // janela (as boas-vindas) abrir por cima, ela pega o foco depois. (Titulo
  // com foco por programa nao desenha moldura: ver "h1[tabindex]" no app.css.)
  useEffect(() => {
    if (!passed || !focusAfterPass.current) return;
    focusAfterPass.current = false;
    const heading = document.querySelector("#root h1");
    if (!heading || document.activeElement !== document.body) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [passed]);

  if (passed) return children;

  const showWidget = Boolean(grecaptcha && config?.siteKey);

  let status = null;
  if (verifying) {
    status = busy ? (
      <>
        Muita gente entrando agora, aguarde
        <Dots />
      </>
    ) : (
      <>
        Conferindo
        <Dots />
      </>
    );
  } else if (waiting && !problem) {
    status = slow ? (
      <>
        Aguarde um tempo, {isCatalog ? "o acervo" : "o site"} está abrindo
        <Dots />
      </>
    ) : (
      <>
        Preparando a verificação
        <Dots />
      </>
    );
  }

  return (
    <main className="gate">
      <div className="gate__card">
        <div className="welcome__stage gate__stage">
          <WelcomeScene />
        </div>

        <div className="gate__body">
          <h1 className="gate__title" ref={titleRef} tabIndex={-1}>
            Boas-vindas!
          </h1>
          {expired ? (
            <p className="gate__expired" role="alert">
              A verificação deste aparelho venceu. Marque a caixa de novo para
              continuar: o que você estava fazendo não foi enviado.
            </p>
          ) : null}
          <p className="gate__lead">
            {isCatalog
              ? "Para ver o acervo da biblioteca, confirme que você não é um robô."
              : "Para entrar no site da biblioteca, confirme que você não é um robô."}
          </p>

          <div
            ref={boxRef}
            className="gate__captcha"
            style={{ height: showWidget ? WIDGET_HEIGHT * scale : 0 }}
          >
            <div
              ref={slotRef}
              className="gate__slot"
              style={{
                width: WIDGET_WIDTH,
                transform: scale < 1 ? "scale(" + scale + ")" : undefined,
              }}
              aria-busy={verifying || undefined}
            />
          </div>

          {status ? (
            <p className="gate__status" role="status">
              {status}
            </p>
          ) : null}

          {problem ? (
            <div className="gate__problem" role="alert">
              <p>{problem}</p>
              {!showWidget ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setAttempt((current) => current + 1)}
                >
                  Tentar de novo
                </button>
              ) : null}
            </div>
          ) : null}

          <p className="gate__note">
            Essa verificação do Google protege o site contra acessos
            automáticos. Neste aparelho, ela vale por algumas horas.
          </p>
        </div>
      </div>
    </main>
  );
}
