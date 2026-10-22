import { useEffect, useId, useRef, useState } from "react";
import { IconBell, IconCheck } from "./Icons.jsx";
import { useToast } from "./Toast.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import {
  ReturnAlertError,
  disableReturnAlert,
  enableReturnAlert,
  isAppleMobile,
  isBookAvailableError,
  isReadableError,
  loadPushKey,
  pushSupport,
  returnAlertActive,
} from "../utils/returnAlert.js";

/**
 * "Avise-me quando voltar": aparece nos detalhes de um livro do acervo
 * publico que esta com TODOS os exemplares emprestados (ver PublicBook.jsx).
 * Um toque e o celular recebe uma notificacao quando a devolucao for
 * confirmada no painel - sem cadastro e sem login (ver utils/returnAlert.js).
 *
 * onStale(bookId): chamado quando o servidor diz que o livro ja voltou para a
 * estante (a tela estava velha), para a pagina buscar a situacao de agora.
 */

function Dots() {
  return (
    <span className="loadingdots" aria-hidden="true">
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

// O que dizer em cada problema. Quase todos a pessoa resolve sozinha, entao
// a mensagem diz o que fazer, nao so o que deu errado.
function problemFor(error) {
  switch (error?.kind) {
    case "ios-install":
      return { tone: "info", steps: true };
    case "ios-old":
      return {
        tone: "info",
        text: "No iPhone, os avisos precisam do iOS 16.4 ou mais novo. Atualize em Ajustes › Geral › Atualização de Software e tente de novo.",
      };
    case "unsupported":
      return {
        tone: "info",
        text: "Este navegador não recebe notificações de sites (acontece nos navegadores que abrem dentro de outros apps e em algumas janelas privadas). Abra o catálogo numa janela normal do Chrome, Safari, Edge, Firefox ou Samsung Internet e tente de novo.",
      };
    case "denied":
      // No app do catalogo instalado no iPhone nao ha barra de endereco: a
      // permissao fica nos Ajustes do aparelho.
      return {
        tone: "info",
        text: isAppleMobile()
          ? "As notificações do Catálogo estão desligadas. Para ligar, vá em Ajustes › Notificações › Catálogo, permita as notificações e toque de novo no botão."
          : "As notificações estão bloqueadas para este site. Para liberar, toque no ícone à esquerda do endereço do site (ou abra as configurações do navegador), permita as notificações e toque de novo no botão.",
      };
    case "dismissed":
      return {
        tone: "info",
        text: "Para receber o aviso, toque em “Permitir” quando o navegador perguntar sobre notificações. (No Chrome, a pergunta às vezes aparece como um sininho na barra de endereço.)",
      };
    case "worker":
      return {
        tone: "error",
        text: "Não foi possível preparar as notificações agora. Recarregue a página e tente de novo.",
      };
    case "push":
      return {
        tone: "error",
        text: "Este navegador não conseguiu ativar as notificações. Em aba anônima elas não funcionam: abra o catálogo numa aba normal. Se não for o caso, tente de novo ou use outro navegador (no Brave, ligue “Usar os serviços do Google para mensagens push” nas configurações).",
      };
    default:
      // Mensagem do servidor (ja em portugues, para a pessoa). Erro inesperado
      // do navegador nao vai para a tela como veio.
      return {
        tone: "error",
        text:
          isReadableError(error) && error.message
            ? error.message
            : "Não foi possível concluir agora. Tente de novo.",
      };
  }
}

export default function ReturnAlert({ book, onStale }) {
  const { notify } = useToast();
  const [support] = useState(pushSupport);
  // checking: conferindo se este aparelho ja pediu aviso deste livro
  // off | enabling | on | cancelling
  const [status, setStatus] = useState(() =>
    support === "ready" && Notification.permission === "granted"
      ? "checking"
      : "off",
  );
  const [problem, setProblem] = useState(null);

  const rootRef = useRef(null);
  const enableRef = useRef(null);
  const cancelRef = useRef(null);
  const problemRef = useRef(null);
  // Qual botao recebe o foco depois de trocar de estado (o botao tocado sai
  // da tela e o foco do teclado nao pode se perder).
  const focusNext = useRef(null);
  const statusId = useId();

  // A chave do servidor ja vem agora: no toque, sobra menos espera entre a
  // permissao e o pedido.
  useEffect(() => {
    if (support === "ready") loadPushKey().catch(() => {});
  }, [support]);

  // Roda uma vez: o componente e recriado a cada livro (key em PublicBook.jsx).
  // A resposta so vale se a pessoa ainda nao tocou no botao: enquanto confere,
  // o botao ja funciona (pedir de novo so renova o aviso que ja existir).
  useEffect(() => {
    if (status !== "checking") return undefined;
    let active = true;
    const settle = (next) => {
      if (active) setStatus((current) => (current === "checking" ? next : current));
    };
    returnAlertActive(book.id)
      .then((on) => settle(on ? "on" : "off"))
      .catch(() => settle("off"));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const target =
      focusNext.current === "cancel"
        ? cancelRef.current
        : focusNext.current === "enable"
          ? enableRef.current
          : null;
    focusNext.current = null;
    if (target) target.focus({ preventScroll: true });
  }, [status]);

  // A mensagem aparece embaixo do botao: no celular deitado (ou numa tela
  // baixa) ela ficaria pela metade, abaixo da dobra. Rola so o corpo do modal
  // (o scrollIntoView rolaria tambem a lista atras dele, e ao fechar a pessoa
  // estaria em outro ponto do catalogo).
  useEffect(() => {
    const box = problemRef.current;
    const scroller = box?.closest(".modal__body");
    if (!scroller) return;
    const boxRect = box.getBoundingClientRect();
    const area = scroller.getBoundingClientRect();
    const visibleBottom = Math.min(area.bottom, window.innerHeight);
    const hidden = boxRect.bottom - visibleBottom;
    // Mensagem mais alta que a area visivel: o comeco dela fica a vista.
    if (hidden > 0) scroller.scrollTop += Math.min(hidden + 8, boxRect.top - area.top);
  }, [problem]);

  // So puxa o foco se ele estava aqui (ou se perdeu com o botao que saiu).
  function focusWasHere() {
    const active = document.activeElement;
    return (
      !active || active === document.body || rootRef.current?.contains(active)
    );
  }

  async function enable() {
    if (status !== "off" && status !== "checking") return;
    setProblem(null);
    if (support !== "ready") {
      setProblem(problemFor(new ReturnAlertError(support)));
      return;
    }
    setStatus("enabling");
    try {
      await enableReturnAlert(book, formatBookTitle(book.title));
      if (focusWasHere()) focusNext.current = "cancel";
      setStatus("on");
    } catch (error) {
      setStatus("off");
      if (isBookAvailableError(error)) {
        // A tela estava velha: o livro ja voltou. O aviso vai num toast
        // porque, com a lista atualizada, este bloco sai da tela.
        notify(error.message, "success");
        if (onStale) onStale(book.id);
        return;
      }
      setProblem(problemFor(error));
    }
  }

  async function cancel() {
    if (status !== "on") return;
    setProblem(null);
    setStatus("cancelling");
    try {
      await disableReturnAlert(book.id);
      if (focusWasHere()) focusNext.current = "enable";
      setStatus("off");
    } catch (error) {
      setStatus("on");
      setProblem(problemFor(error));
    }
  }

  const on = status === "on" || status === "cancelling";

  return (
    <div className="returnalert" ref={rootRef}>
      {on ? (
        <div className="returnalert__on">
          <p className="returnalert__status" id={statusId} role="status">
            <IconCheck width={16} height={16} aria-hidden="true" />
            <span>
              <strong>Aviso ativado.</strong> Você recebe uma notificação neste
              aparelho quando o livro voltar para a estante.
            </span>
          </p>
          {/* aria-disabled (e nao disabled) enquanto espera: um botao
              desabilitado perde o foco do teclado. */}
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--ghost btn--sm"
            aria-disabled={status === "cancelling" || undefined}
            aria-describedby={statusId}
            onClick={cancel}
          >
            {status === "cancelling" ? (
              <span>
                Cancelando
                <Dots />
              </span>
            ) : (
              "Cancelar aviso"
            )}
          </button>
        </div>
      ) : (
        <>
          <button
            ref={enableRef}
            type="button"
            className="btn btn--primary btn--sm"
            aria-disabled={status === "enabling" || undefined}
            onClick={enable}
          >
            <IconBell width={16} height={16} aria-hidden="true" />
            {status === "enabling" ? (
              <span>
                Ativando
                <Dots />
              </span>
            ) : (
              "Avise-me quando voltar"
            )}
          </button>
          <p className="returnalert__hint">
            Receba uma notificação neste aparelho quando ele voltar para a
            estante. Não precisa de cadastro. O aviso não reserva o livro.
          </p>
        </>
      )}

      {problem ? (
        <div
          ref={problemRef}
          className={"returnalert__problem returnalert__problem--" + problem.tone}
          role="alert"
        >
          {problem.steps ? (
            <>
              <p>
                <strong>No iPhone e no iPad, o aviso chega pelo app do catálogo:</strong>
              </p>
              <ol>
                <li>
                  toque em <strong>Compartilhar</strong> (o quadrado com a
                  seta para cima);
                </li>
                <li>
                  escolha <strong>Adicionar à Tela de Início</strong>;
                </li>
                <li>
                  abra o <strong>Catálogo</strong> pela tela de início, procure
                  este livro e toque de novo em “Avise-me quando voltar”.
                </li>
              </ol>
            </>
          ) : (
            <p>{problem.text}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
