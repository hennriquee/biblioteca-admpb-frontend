import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../components/Toast.jsx";
import {
  adminPushActive,
  adminPushErrorMessage,
  disableAdminPush,
  enableAdminPush,
  permissionState,
  pushSupport,
  removeAdminDevice,
  sendAdminTest,
} from "../utils/adminPush.js";
import { formatDate } from "../utils/dates.js";

/**
 * CONFIGURAÇÕES > NOTIFICAÇÕES: o que ESTE administrador quer receber como
 * notificacao do app da biblioteca, no celular ou no computador (o mesmo
 * tipo de aviso do "Avise-me quando voltar" do catalogo - nada vai pelo
 * WhatsApp). Duas partes:
 *
 * 1. "Neste aparelho": ligar ou desligar as notificacoes aqui (cada aparelho
 *    pede a permissao do navegador uma vez) e mandar um teste;
 * 2. "O que você quer receber": os assuntos. Valem para todos os aparelhos
 *    ligados nesta conta. Nada vem marcado.
 *
 * Quem envia e o servidor (backend/src/services/adminPush.js).
 */
const KINDS = [
  {
    id: "requests",
    title: "Novas solicitações de empréstimo",
    detail: "Quando alguém pede um livro pelo catálogo. A notificação traz o botão “Registrar solicitação”.",
  },
  {
    id: "loans",
    title: "Novos empréstimos",
    detail: "Quando outro administrador registra um empréstimo.",
  },
  {
    id: "suggestions",
    title: "Livros sugeridos",
    detail: "Quando alguém sugere um livro pelo catálogo.",
  },
  {
    id: "messages",
    title: "Mensagens no WhatsApp da biblioteca",
    detail: "Quando uma pessoa escreve para a biblioteca (no máximo uma a cada 10 minutos por conversa).",
  },
];

// O que este navegador consegue: "ready" | "ios-install" | "ios-old" | "unsupported"
function supportText(support) {
  if (support === "ios-install") {
    return "No iPhone/iPad, as notificações só funcionam com o app instalado: no Safari, toque em Compartilhar › “Adicionar à Tela de Início” e abra o painel pelo ícone.";
  }
  if (support === "ios-old") {
    return "Este iPhone/iPad precisa do iOS 16.4 ou mais novo para receber notificações.";
  }
  return "Este navegador não recebe notificações. Use o Chrome, o Edge ou o Firefox.";
}

export default function NotificationSettings() {
  const { notify } = useToast();
  const [support] = useState(() => pushSupport());
  // null = conferindo | true/false
  const [active, setActive] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [deviceError, setDeviceError] = useState("");
  const mountedRef = useRef(true);
  // A ultima escolha enviada (respostas atrasadas de toques antigos nao
  // desfazem a escolha mais nova).
  const saveRef = useRef(0);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const data = await api("/api/notifications/prefs");
      if (mountedRef.current) setPrefs(data);
    } catch (error) {
      if (mountedRef.current) setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    if (support === "ready") {
      adminPushActive()
        .then((value) => mountedRef.current && setActive(value))
        .catch(() => mountedRef.current && setActive(false));
    } else {
      setActive(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [load, support]);

  async function turnOn() {
    if (busy) return;
    setBusy("on");
    setDeviceError("");
    try {
      // (direto do toque: o navegador so mostra a pergunta logo depois dele)
      const data = await enableAdminPush();
      if (!mountedRef.current) return;
      setActive(true);
      if (data?.kinds) setPrefs({ kinds: data.kinds, devices: data.devices || [] });
      notify("Notificações ativadas neste aparelho.", "success");
    } catch (error) {
      if (mountedRef.current) setDeviceError(adminPushErrorMessage(error));
    } finally {
      if (mountedRef.current) setBusy("");
    }
  }

  async function turnOff() {
    if (busy) return;
    setBusy("off");
    setDeviceError("");
    try {
      const data = await disableAdminPush();
      if (!mountedRef.current) return;
      setActive(false);
      if (data?.kinds) setPrefs({ kinds: data.kinds, devices: data.devices || [] });
      notify("Este aparelho não recebe mais as notificações.", "success");
    } catch (error) {
      if (mountedRef.current) setDeviceError(error.message);
    } finally {
      if (mountedRef.current) setBusy("");
    }
  }

  async function test() {
    if (busy) return;
    setBusy("test");
    try {
      const result = await sendAdminTest();
      if (!mountedRef.current) return;
      if (!result.devices) notify("Nenhum aparelho ativado nesta conta.", "error");
      else if (!result.sent) notify("O teste não chegou a nenhum aparelho. Ative de novo neste aparelho.", "error");
      else notify("Teste enviado para " + result.sent + (result.sent === 1 ? " aparelho." : " aparelhos."), "success");
    } catch (error) {
      if (mountedRef.current) notify(error.message, "error");
    } finally {
      if (mountedRef.current) setBusy("");
    }
  }

  async function removeDevice(device) {
    if (busy) return;
    setBusy("device-" + device._id);
    try {
      const data = await removeAdminDevice(device._id);
      if (!mountedRef.current) return;
      if (data?.kinds) setPrefs({ kinds: data.kinds, devices: data.devices || [] });
      // Pode ter sido este aparelho: confere de novo.
      if (support === "ready") adminPushActive().then((v) => mountedRef.current && setActive(v)).catch(() => {});
    } catch (error) {
      if (mountedRef.current) notify(error.message, "error");
    } finally {
      if (mountedRef.current) setBusy("");
    }
  }

  async function toggle(kind, value) {
    const ticket = ++saveRef.current;
    const previous = prefs;
    // Muda na tela na hora; se o servidor recusar, volta.
    setPrefs((current) => ({ ...current, kinds: { ...current.kinds, [kind]: value } }));
    try {
      const data = await api("/api/notifications/prefs", {
        method: "PUT",
        body: { kinds: { [kind]: value } },
      });
      if (mountedRef.current && ticket === saveRef.current) setPrefs(data);
    } catch (error) {
      if (!mountedRef.current) return;
      if (ticket === saveRef.current) setPrefs(previous);
      notify(error.message, "error");
    }
  }

  const kinds = prefs?.kinds || {};
  const devices = prefs?.devices || [];
  const anyKind = KINDS.some((kind) => kinds[kind.id]);
  const blocked = support === "ready" && permissionState() === "denied";

  return (
    <div className="page notifset">
      <div className="page__head">
        <div>
          <h1>Notificações</h1>
          <p className="page__sub">
            O que você quer receber do app da biblioteca, no celular ou no computador
          </p>
        </div>
      </div>

      <section className="card notifset__card" aria-labelledby="notif-device">
        <h2 id="notif-device">Neste aparelho</h2>
        {support !== "ready" ? (
          <p className="notifset__note" role="status">
            {supportText(support)}
          </p>
        ) : active === null ? (
          <p className="muted" role="status">
            Conferindo
            <span className="loadingdots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : (
          <>
            <p className={"notifset__state" + (active ? " is-on" : "")} role="status">
              {active
                ? "Ligadas: este aparelho recebe o que você marcar abaixo."
                : blocked
                  ? "As notificações deste site estão bloqueadas no navegador. Libere nas configurações do navegador (cadeado ao lado do endereço) e toque em “Ativar” de novo."
                  : "Desligadas neste aparelho."}
            </p>
            <div className="notifset__actions">
              {active ? (
                <>
                  <button type="button" className="btn btn--ghost" onClick={test} disabled={Boolean(busy)}>
                    {busy === "test" ? "Enviando…" : "Enviar um teste"}
                  </button>
                  <button type="button" className="btn btn--ghost-danger" onClick={turnOff} disabled={Boolean(busy)}>
                    {busy === "off" ? "Desligando…" : "Desligar neste aparelho"}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary" onClick={turnOn} disabled={Boolean(busy)}>
                  {busy === "on" ? "Ativando…" : "Ativar neste aparelho"}
                </button>
              )}
            </div>
          </>
        )}
        {deviceError ? (
          <p className="form-error" role="alert">
            {deviceError}
          </p>
        ) : null}
        <small className="field__hint">
          Ao sair da biblioteca neste aparelho, ele deixa de receber as notificações da sua conta.
        </small>
      </section>

      <section className="card notifset__card" aria-labelledby="notif-kinds">
        <h2 id="notif-kinds">O que você quer receber</h2>
        {loadError ? (
          <div className="notices__error" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn btn--ghost" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : !prefs ? (
          <p className="muted" role="status">
            Carregando
            <span className="loadingdots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : (
          <>
            <ul className="notifset__kinds">
              {KINDS.map((kind) => (
                <li key={kind.id}>
                  <label className="notifkind">
                    <input
                      type="checkbox"
                      className="notifkind__check"
                      checked={Boolean(kinds[kind.id])}
                      onChange={(event) => toggle(kind.id, event.target.checked)}
                    />
                    <span className="notifkind__text">
                      <strong>{kind.title}</strong>
                      <small>{kind.detail}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {!anyKind ? (
              <p className="notifset__note">Nada marcado: você não recebe nenhuma notificação.</p>
            ) : !devices.length ? (
              <p className="notifset__note">
                Falta ativar em um aparelho (acima) para as notificações chegarem.
              </p>
            ) : null}
          </>
        )}
      </section>

      {devices.length ? (
        <section className="card notifset__card" aria-labelledby="notif-devices">
          <h2 id="notif-devices">Aparelhos ativados nesta conta</h2>
          <ul className="notifset__devices">
            {devices.map((device) => (
              <li key={device._id}>
                <span>
                  <strong>{device.label}</strong>
                  <small>desde {formatDate(device.createdAt)}</small>
                </span>
                <button
                  type="button"
                  className="btn btn--ghost-danger btn--sm"
                  onClick={() => removeDevice(device)}
                  disabled={Boolean(busy)}
                >
                  {busy === "device-" + device._id ? "Tirando…" : "Tirar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
