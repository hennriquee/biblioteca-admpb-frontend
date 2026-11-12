import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api/client.js";

/**
 * "Respostas do robô": a base de conhecimento do atendimento automático do
 * WhatsApp (GET/POST/PUT/DELETE /api/whatsapp/answers).
 *
 * O administrador ensina: "quando a mensagem tiver estas palavras-chave,
 * responda isto". O robô tolera plural e erro de digitação, e sorteia entre
 * os jeitos de responder (texto sempre igual é um dos sinais que o WhatsApp
 * usa para desconfiar de automação). As perguntas que o robô NÃO soube
 * responder aparecem embaixo, para virarem respostas com um toque.
 *
 * Duas telas na mesma janela: a lista e o formulário.
 */

const EMPTY = { _id: null, title: "", keywords: "", answers: [""], enabled: true };

// "horário, que horas abre\nfuncionamento" -> ["horário", "que horas abre", ...]
function splitKeywords(text) {
  return String(text || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function BotAnswersModal({ open, onClose, notify }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Formulário com algo escrito: fechar pergunta antes de descartar.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initialRef = useRef("");
  const [probe, setProbe] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  // Só a resposta do pedido mais novo vale (abrir/fechar rápido, salvar e
  // recarregar ao mesmo tempo).
  const requestRef = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    setError("");
    try {
      const result = await api("/api/whatsapp/answers");
      if (id === requestRef.current) setData(result);
    } catch (loadError) {
      if (id === requestRef.current) setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setForm(null);
    setConfirmDelete(false);
    setConfirmDiscard(false);
    setProbeResult(null);
    load();
    return () => {
      requestRef.current += 1;
    };
  }, [open, load]);

  function openForm(next) {
    setConfirmDelete(false);
    setConfirmDiscard(false);
    initialRef.current = JSON.stringify(next);
    setForm(next);
  }

  function edit(answer) {
    openForm({
      _id: answer._id,
      title: answer.title,
      keywords: answer.keywords.join(", "),
      answers: answer.answers.length ? [...answer.answers] : [""],
      enabled: answer.enabled,
    });
  }

  function createFrom(unknown) {
    openForm({ ...EMPTY, answers: [""], title: unknown ? unknown.text.slice(0, 80) : "", fromUnknown: unknown?._id || null });
  }

  const dirty = Boolean(form) && JSON.stringify(form) !== initialRef.current;

  // Esc, o "x" e o Voltar: no formulário, voltam para a lista (perguntando
  // antes se há algo escrito); na lista, fecham a janela.
  function handleClose() {
    if (savingRef.current) return;
    if (!form) {
      onClose();
      return;
    }
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    setForm(null);
  }

  function setAnswer(index, value) {
    setForm((current) => ({
      ...current,
      answers: current.answers.map((item, i) => (i === index ? value : item)),
    }));
  }

  async function save(event) {
    event.preventDefault();
    if (savingRef.current || !form) return;
    const body = {
      title: form.title,
      keywords: splitKeywords(form.keywords),
      answers: form.answers.map((item) => item.trim()).filter(Boolean),
      enabled: form.enabled,
    };
    if (!body.title.trim()) return notify("Dê um nome para a resposta.", "error");
    if (!body.keywords.length) return notify("Informe pelo menos uma palavra-chave.", "error");
    if (!body.answers.length) return notify("Escreva a resposta.", "error");
    savingRef.current = true;
    setSaving(true);
    try {
      await api(form._id ? "/api/whatsapp/answers/" + form._id : "/api/whatsapp/answers", {
        method: form._id ? "PUT" : "POST",
        body,
      });
      // A pergunta que deu origem à resposta sai da lista.
      if (form.fromUnknown) {
        await api("/api/whatsapp/unknowns/" + form.fromUnknown, { method: "DELETE" }).catch(() => {});
      }
      notify("Resposta salva. O robô já usa a partir de agora.", "success");
      setForm(null);
      await load();
    } catch (saveError) {
      notify(saveError.message, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    return undefined;
  }

  async function remove() {
    if (savingRef.current || !form?._id) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await api("/api/whatsapp/answers/" + form._id, { method: "DELETE" });
      notify("Resposta excluída.", "success");
      setForm(null);
      await load();
    } catch (removeError) {
      notify(removeError.message, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  async function dismiss(unknown) {
    setData((current) =>
      current ? { ...current, unknown: current.unknown.filter((item) => item._id !== unknown._id) } : current,
    );
    try {
      await api("/api/whatsapp/unknowns/" + unknown._id, { method: "DELETE" });
    } catch (dismissError) {
      notify(dismissError.message, "error");
      load();
    }
  }

  async function runProbe(event) {
    event.preventDefault();
    if (probing || !probe.trim()) return;
    setProbing(true);
    setProbeResult(null);
    try {
      setProbeResult(await api("/api/whatsapp/answers/test", { method: "POST", body: { text: probe } }));
    } catch (probeError) {
      notify(probeError.message, "error");
    } finally {
      setProbing(false);
    }
  }

  const limits = data?.limits || { variants: 5, length: 900 };

  const footer = form && confirmDiscard ? (
    <>
      <span className="botans__discard" role="status">
        Descartar o que foi escrito?
      </span>
      <button type="button" className="btn btn--ghost" onClick={() => setConfirmDiscard(false)}>
        Continuar editando
      </button>
      <button type="button" className="btn btn--danger" onClick={handleClose}>
        Descartar
      </button>
    </>
  ) : form ? (
    <>
      {form._id ? (
        confirmDelete ? (
          <button type="button" className="btn btn--danger" onClick={remove} disabled={saving}>
            Confirmar exclusão
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(true)} disabled={saving}>
            Excluir
          </button>
        )
      ) : null}
      <button type="button" className="btn btn--ghost" onClick={handleClose} disabled={saving}>
        Voltar
      </button>
      <button type="submit" form="botanswer-form" className="btn btn--primary" disabled={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn--ghost" onClick={onClose}>
        Fechar
      </button>
      <button type="button" className="btn btn--primary" onClick={() => createFrom(null)} disabled={!data}>
        Nova resposta
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnBackdrop={!form}
      title={form ? (form._id ? "Editar resposta" : "Nova resposta") : "Respostas do robô"}
      size="md"
      footer={footer}
    >
      {form ? (
        <form id="botanswer-form" className="botans" onSubmit={save}>
          <label className="field">
            <span>Nome (só para você achar depois)</span>
            <input
              type="text"
              value={form.title}
              maxLength={80}
              placeholder="Ex.: Horário de funcionamento"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Palavras-chave (separe por vírgula ou uma por linha)</span>
            <textarea
              rows={3}
              value={form.keywords}
              placeholder={"horário, que horas abre, funcionamento"}
              onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
            />
          </label>
          <p className="botans__hint">
            Uma expressão (“que horas abre”) vale quando <strong>todas</strong> as palavras dela
            aparecem na mensagem, em qualquer ordem. Acento, maiúscula, plural e um erro de
            digitação não atrapalham.
          </p>

          {form.answers.map((answer, index) => (
            <label className="field" key={index}>
              <span>
                {index === 0 ? "Resposta" : "Outro jeito de dizer a mesma coisa (" + (index + 1) + ")"}
              </span>
              <textarea
                rows={3}
                value={answer}
                maxLength={limits.length}
                placeholder={index === 0 ? "O que o robô responde" : "Mesma informação, com outras palavras"}
                onChange={(event) => setAnswer(index, event.target.value)}
              />
            </label>
          ))}
          <div className="botans__row">
            {form.answers.length < limits.variants ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm((current) => ({ ...current, answers: [...current.answers, ""] }))}
              >
                + Outro jeito de responder
              </button>
            ) : null}
            {form.answers.length > 1 ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm((current) => ({ ...current, answers: current.answers.slice(0, -1) }))}
              >
                Tirar o último
              </button>
            ) : null}
          </div>
          <p className="botans__hint">
            Com dois ou três jeitos, o robô varia o texto a cada pessoa: fica mais natural e
            protege o número.
          </p>

          <label className="botans__check">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
            />
            <span>Resposta ativa</span>
          </label>
        </form>
      ) : (
        <div className="botans">
          <p className="botans__lead">
            Ensine o atendimento automático: quando a mensagem de alguém tiver uma das
            palavras-chave, o robô responde com o texto que você escreveu.
          </p>

          <form className="botans__probe" onSubmit={runProbe}>
            <label className="field">
              <span>Testar: escreva como se fosse a pessoa</span>
              <input
                type="text"
                value={probe}
                maxLength={400}
                placeholder="Ex.: que horas vocês abrem?"
                onChange={(event) => {
                  setProbe(event.target.value);
                  setProbeResult(null);
                }}
              />
            </label>
            <button type="submit" className="btn btn--ghost btn--sm" disabled={probing || !probe.trim()}>
              {probing ? "Testando…" : "Testar"}
            </button>
          </form>
          <div className="botans__result" role="status" aria-live="polite">
            {probeResult ? (
              <p className={probeResult.understood ? "is-ok" : "is-miss"}>
                <strong>{probeResult.understood ? "Entendeu: " : ""}</strong>
                {probeResult.label}
                {probeResult.answer ? <span className="botans__answer">{probeResult.answer}</span> : null}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="botans__state" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={load}>
                Tentar de novo
              </button>
            </div>
          ) : null}

          {!data && !error ? (
            <p className="muted botans__state" role="status">
              Carregando
              <span className="loadingdots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          ) : null}

          {data ? (
            <>
              <h3 className="botans__title">Respostas cadastradas ({data.items.length})</h3>
              {data.items.length === 0 ? (
                <p className="muted">
                  Nenhuma ainda. Comece pelas perguntas que mais chegam: horário, endereço, como
                  devolver um livro.
                </p>
              ) : (
                <ul className="botans__list">
                  {data.items.map((answer) => (
                    <li key={answer._id}>
                      <button type="button" className="botans__item" onClick={() => edit(answer)}>
                        <span className="botans__name">
                          {answer.title}
                          {answer.enabled ? null : <span className="chip chip--out">desligada</span>}
                        </span>
                        <span className="botans__keys">{answer.keywords.join(" · ")}</span>
                        <span className="botans__meta">
                          {answer.hits
                            ? "Usada " + answer.hits + (answer.hits === 1 ? " vez" : " vezes")
                            : "Ainda não foi usada"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {data.unknown.length ? (
                <>
                  <h3 className="botans__title">O robô não soube responder</h3>
                  <p className="botans__hint">
                    Mensagens que caíram no “Não entendi” (as mais repetidas primeiro; somem em 30
                    dias).
                  </p>
                  <ul className="botans__list">
                    {data.unknown.map((unknown) => (
                      <li key={unknown._id} className="botans__unknown">
                        <span className="botans__question">
                          “{unknown.text}”
                          {unknown.count > 1 ? <span className="botans__count">{unknown.count}×</span> : null}
                        </span>
                        <span className="botans__row">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => createFrom(unknown)}>
                            Criar resposta
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => dismiss(unknown)}
                            aria-label={"Dispensar a pergunta: " + unknown.text}
                          >
                            Dispensar
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
