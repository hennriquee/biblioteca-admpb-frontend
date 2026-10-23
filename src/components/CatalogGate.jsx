import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  ApiError,
  CATALOG_PASS_EVENT,
  getCatalogPass,
  publicApi,
  setCatalogPass,
} from "../api/client.js";
import WelcomeScene from "./WelcomeScene.jsx";
import { applyCatalogIdentity } from "../utils/catalogIdentity.js";
import { loadRecaptcha } from "../utils/recaptcha.js";

/**
 * Entrada do acervo publico (/catalogo e /catalogo/novidades): antes de ver
 * os livros, a pessoa marca o "Nao sou um robo" do Google. A animacao de
 * boas-vindas (a logo que vira livro e depois a pomba) roda em cima, para a
 * espera nao parecer uma barreira.
 *
 * O servidor confere a caixa com o Google e devolve um passe que vale algumas
 * horas neste aparelho (ver api/client.js e backend/src/services/captcha.js):
 * com o passe valido, esta tela nem aparece. Se o servidor recusar o passe no
 * meio do uso (venceu, ou o servidor trocou de chave), o catalogo sai da tela
 * e esta entrada volta.
 *
 * Com o reCAPTCHA desligado no servidor (sem as chaves no ambiente), a
 * entrada so pergunta isso ao servidor e abre o catalogo direto.
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
  return "Não foi possível abrir o acervo agora. Tente de novo.";
}

export default function CatalogGate() {
  const [passed, setPassed] = useState(() => Boolean(getCatalogPass()));
  // Cada nova tentativa (botao "Tentar de novo", passe recusado) recomeca.
  const [attempt, setAttempt] = useState(0);
  // undefined = perguntando ao servidor | { enabled, siteKey }
  const [config, setConfig] = useState(undefined);
  const [grecaptcha, setGrecaptcha] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [problem, setProblem] = useState(null);
  const [slow, setSlow] = useState(false);
  const [scale, setScale] = useState(1);

  const boxRef = useRef(null);
  const slotRef = useRef(null);
  const widgetRef = useRef(null);
  const titleRef = useRef(null);
  // Leva o foco ao titulo do catalogo depois de passar pela caixa (sem isso
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
      setPassed(false);
      setAttempt((current) => current + 1);
    }
    window.addEventListener(CATALOG_PASS_EVENT, onPassRefused);
    return () => window.removeEventListener(CATALOG_PASS_EVENT, onPassRefused);
  }, []);

  // Enquanto a entrada esta na tela, ela e a pagina do acervo: titulo da aba
  // e "cara" de app do catalogo (o catalogo faz o mesmo quando abre).
  useEffect(() => {
    if (passed) return undefined;
    const previous = document.title;
    document.title = "Acervo · Biblioteca ADMP Brasil";
    const undoIdentity = applyCatalogIdentity();
    return () => {
      document.title = previous;
      undoIdentity();
    };
  }, [passed]);

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
      setCatalogPass(data.pass, data.expiresIn);
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
  // elemento do catalogo que sumiu).
  useEffect(() => {
    if (!passed && attempt > 0) titleRef.current?.focus();
  }, [passed, attempt]);

  // Passou pela caixa: o foco vai para o titulo da pagina que abriu. Se uma
  // janela (as boas-vindas) abrir por cima, ela pega o foco depois.
  useEffect(() => {
    if (!passed || !focusAfterPass.current) return;
    focusAfterPass.current = false;
    const heading = document.querySelector("#root h1");
    if (!heading || document.activeElement !== document.body) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [passed]);

  if (passed) return <Outlet />;

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
        Aguarde um tempo, o acervo está abrindo
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
          <p className="gate__lead">
            Para ver o acervo da biblioteca, confirme que você não é um robô.
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
            Essa verificação do Google protege o acervo contra acessos
            automáticos. Neste aparelho, ela vale por algumas horas.
          </p>
        </div>
      </div>
    </main>
  );
}
