import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import Confirm from "./Confirm.jsx";
import PixQr from "./PixQr.jsx";
import { useToast } from "./Toast.jsx";
import { IconWhatsapp } from "./Icons.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";

/**
 * A ligacao com o WhatsApp da biblioteca, no topo das Conversas. Mostra a
 * situacao e, quando falta conectar, o QR code (ou um codigo, para quem esta
 * no proprio celular do numero). O QR so e lido UMA vez: depois o servidor
 * guarda a sessao e reconecta sozinho (ver backend/src/services/whatsapp).
 *
 * Props:
 * - status: o que vem de GET /api/whatsapp/status (undefined = carregando,
 *   null = nao deu para carregar)
 * - onChange(status): uma acao (conectar, desconectar) devolveu a situacao nova
 * - onRetry(): tentar carregar a situacao de novo
 * - autoConnect: ao abrir a tela sem conexao, ja pede o QR (uma vez)
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

function prettyCode(code) {
  const text = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return text.length === 8 ? text.slice(0, 4) + "-" + text.slice(4) : text;
}

export default function WhatsappConnect({
  status,
  onChange,
  onRetry,
  autoConnect = false,
}) {
  const { notify } = useToast();
  const [busy, setBusy] = useState("");
  const busyRef = useRef("");
  const [code, setCode] = useState("");
  const [askDisconnect, setAskDisconnect] = useState(false);
  const autoRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const state = status?.state;
  const number = status?.number ? formatStoredPhone(status.number) : "";

  // O codigo so vale enquanto o QR esta na tela.
  useEffect(() => {
    if (state !== "qr") setCode("");
  }, [state]);

  async function run(kind, task) {
    if (busyRef.current) return null;
    busyRef.current = kind;
    setBusy(kind);
    try {
      return await task();
    } catch (error) {
      notify(error.message, "error");
      return null;
    } finally {
      busyRef.current = "";
      if (mountedRef.current) setBusy("");
    }
  }

  function connect() {
    return run("connect", async () => {
      const next = await api("/api/whatsapp/connect", { method: "POST" });
      onChange?.(next);
      return next;
    });
  }

  function askForCode() {
    return run("code", async () => {
      const result = await api("/api/whatsapp/pairing-code", { method: "POST" });
      setCode(result.code);
    });
  }

  function disconnect({ thenConnect = false } = {}) {
    return run("disconnect", async () => {
      const next = await api("/api/whatsapp/disconnect", { method: "POST" });
      onChange?.(next);
      notify("WhatsApp desconectado.", "success");
      return next;
    }).then(async (next) => {
      if (next && thenConnect && mountedRef.current) await connect();
    });
  }

  // Abriu a tela sem conexao: ja gera o QR (uma vez por visita).
  useEffect(() => {
    if (!autoConnect || autoRef.current) return;
    if (state === "idle" || state === "logged-out") {
      autoRef.current = true;
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, state]);

  if (status === undefined) {
    return (
      <div className="waconn waconn--strip" role="status">
        <span>
          Verificando o WhatsApp
          <Dots />
        </span>
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="waconn waconn--strip waconn--warn" role="alert">
        <span>Não foi possível verificar o WhatsApp agora.</span>
        <button type="button" className="linkish" onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (state === "disabled") {
    return (
      <div className="waconn waconn--strip waconn--warn" role="status">
        <span>
          O WhatsApp está desligado neste servidor. As conversas salvas aparecem,
          mas não dá para enviar nem receber.
        </span>
      </div>
    );
  }

  if (state === "open") {
    return (
      <>
        <div className="waconn waconn--strip waconn--ok" role="status">
          <span className="waconn__dot" aria-hidden="true" />
          <span>
            WhatsApp conectado
            {number ? (
              <>
                {" · "}
                <strong className="nowrap">{number}</strong>
              </>
            ) : null}
          </span>
          <button
            type="button"
            className="linkish"
            onClick={() => setAskDisconnect(true)}
            disabled={Boolean(busy)}
          >
            Desconectar
          </button>
        </div>
        <Confirm
          open={askDisconnect}
          title="Desconectar o WhatsApp?"
          message="O aparelho será desvinculado e será preciso ler o QR code de novo para voltar. As conversas continuam salvas aqui."
          confirmLabel="Desconectar"
          tone="danger"
          onCancel={() => setAskDisconnect(false)}
          onConfirm={() => {
            setAskDisconnect(false);
            disconnect();
          }}
        />
      </>
    );
  }

  if (state === "connecting" || state === "reconnecting" || state === "standby") {
    return (
      <div className="waconn waconn--strip" role="status">
        <span>
          {state === "standby" ? "Aguardando a conexão do WhatsApp" : "Conectando ao WhatsApp"}
          <Dots />
        </span>
        {status.notice ? <small>{status.notice}</small> : null}
      </div>
    );
  }

  if (state === "qr") {
    return (
      <section className="waconn waconn--card waconn--qr" aria-labelledby="waconn-title">
        <h2 id="waconn-title">Conectar o WhatsApp da biblioteca</h2>
        <p className="waconn__lead">
          Faça isto no celular do número <strong className="nowrap">{number}</strong>. É só
          uma vez: depois o painel reconecta sozinho.
        </p>

        {code ? (
          <div className="wacode">
            <p>Digite este código no WhatsApp:</p>
            <strong className="wacode__value" aria-label={"Código " + code.split("").join(" ")}>
              {prettyCode(code)}
            </strong>
            <ol className="waconn__steps">
              <li>Abra o WhatsApp no celular do número {number}.</li>
              <li>
                Vá em <strong>Aparelhos conectados</strong> e toque em{" "}
                <strong>Conectar um aparelho</strong>.
              </li>
              <li>
                Escolha <strong>Conectar com número de telefone</strong> e digite o código.
              </li>
            </ol>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCode("")}>
              Voltar ao QR code
            </button>
          </div>
        ) : (
          <>
            <div className="waconn__qrbox">
              {status.qr ? (
                <PixQr
                  value={status.qr}
                  label="QR code para conectar o WhatsApp da biblioteca"
                />
              ) : (
                <p className="muted">Gerando o QR code…</p>
              )}
            </div>
            <ol className="waconn__steps">
              <li>Abra o WhatsApp no celular do número {number}.</li>
              <li>
                Toque em <strong>Aparelhos conectados</strong> (no Android, nos três pontinhos;
                no iPhone, em Configurações).
              </li>
              <li>
                Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o código acima.
              </li>
            </ol>
            <button
              type="button"
              className="linkish"
              onClick={askForCode}
              disabled={busy === "code"}
            >
              {busy === "code"
                ? "Gerando o código…"
                : "Está usando o mesmo celular? Conectar com um código"}
            </button>
          </>
        )}

        <small className="waconn__safe">
          Só administradores veem este código. O WhatsApp só aceita o número {number}: lido por
          outro número, a conexão é desfeita na hora.
        </small>
      </section>
    );
  }

  // idle, logged-out, wrong-number, unreadable, error
  const danger = state === "wrong-number" || state === "unreadable" || state === "error";
  const resetFirst = state === "unreadable";
  return (
    <>
      <section
        className={"waconn waconn--card" + (danger ? " waconn--danger" : "")}
        aria-labelledby="waconn-title"
      >
        <span className="waconn__icon" aria-hidden="true">
          <IconWhatsapp width={34} height={34} />
        </span>
        <div className="waconn__text">
          <h2 id="waconn-title">WhatsApp da biblioteca desconectado</h2>
          <p>
            {status.notice ||
              "Conecte o número " + number + " para conversar com as pessoas por aqui."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => (resetFirst ? setAskDisconnect(true) : connect())}
          disabled={Boolean(busy)}
        >
          {busy === "connect" || busy === "disconnect"
            ? "Conectando…"
            : resetFirst
              ? "Apagar a sessão e conectar de novo"
              : state === "idle" || state === "logged-out"
                ? "Gerar o QR code"
                : "Conectar"}
        </button>
      </section>
      <Confirm
        open={askDisconnect}
        title="Apagar a sessão salva?"
        message="A sessão guardada não pôde ser lida. Ela será apagada e será preciso ler o QR code de novo. As conversas continuam salvas."
        confirmLabel="Apagar e conectar"
        tone="danger"
        onCancel={() => setAskDisconnect(false)}
        onConfirm={() => {
          setAskDisconnect(false);
          disconnect({ thenConnect: true });
        }}
      />
    </>
  );
}
