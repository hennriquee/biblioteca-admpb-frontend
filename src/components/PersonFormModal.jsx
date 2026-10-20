import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useToast } from "./Toast.jsx";
import Modal from "./Modal.jsx";
import Confirm from "./Confirm.jsx";
import PhoneInput from "./PhoneInput.jsx";
import PhotoPicker from "./PhotoPicker.jsx";
import { formatBookTitle } from "../utils/bookTitle.js";
import { isValidPhoneNumber } from "libphonenumber-js";

const emptyForm = {
  fullName: "",
  phone: "",
  photo: "", // data URI de uma foto nova, ainda nao enviada
  savedPhoto: "", // foto que ja esta salva
  removePhoto: false,
};

/**
 * Formulario de cadastrar/editar pessoa (foto, nome, WhatsApp). E O MESMO
 * formulario em dois lugares: a tela "Usuarios" (Configuracoes) e o
 * "Cadastrar nova pessoa" de dentro do Novo emprestimo - para as duas telas
 * pedirem exatamente os mesmos dados, da mesma forma, com as mesmas regras
 * (nome e sobrenome, WhatsApp valido, aviso de nome/telefone repetido).
 *
 * person = null: cadastra uma pessoa nova (POST). person = {...}: edita essa
 * pessoa (PUT). onSaved(pessoa) recebe o registro salvo, do jeito que a API
 * devolve - quem chama decide o que fazer com ele (fechar e recarregar a
 * lista, ou selecionar a pessoa recem-criada num emprestimo).
 */
export default function PersonFormModal({
  open,
  person,
  initialFullName = "",
  onClose,
  onSaved,
  onRequestDelete,
}) {
  const { notify } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // Aviso de nome/WhatsApp repetido vindo do servidor; "Confirmar" reenvia
  // com force = true.
  const [warning, setWarning] = useState(null);
  // Trava contra o clique duplo: dois toques rapidos no "Salvar" disparam duas
  // vezes antes do botao desabilitar, e cadastrariam a pessoa duas vezes.
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      person
        ? {
            ...emptyForm,
            fullName: person.fullName,
            phone: person.phone || "",
            savedPhoto: person.photo || "",
          }
        : { ...emptyForm, fullName: initialFullName },
    );
    setWarning(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person]);

  async function save(force) {
    if (!form.fullName.trim().split(/\s+/).filter(Boolean)[1]) {
      notify("Digite o nome completo (nome e sobrenome).", "error");
      return;
    }
    if (form.phone && !isValidPhoneNumber("+" + form.phone)) {
      notify("WhatsApp inválido. Confira o país, o DDD e o número.", "error");
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone,
        force: Boolean(force),
      };
      if (form.photo) body.photo = form.photo;
      if (form.removePhoto) body.removePhoto = true;

      const saved = person
        ? await api("/api/people/" + person._id, { method: "PUT", body })
        : await api("/api/people", { method: "POST", body });

      notify(person ? "Cadastro atualizado." : "Pessoa cadastrada.", "success");
      setWarning(null);
      onSaved(saved);
    } catch (err) {
      if (
        err instanceof ApiError &&
        ["PERSON_NAME_EXISTS", "PERSON_PHONE_EXISTS"].includes(
          err.payload?.code,
        )
      ) {
        setWarning(err.payload);
      } else {
        notify(err.message, "error");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const photoNow = form.removePhoto ? "" : form.photo || form.savedPhoto;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          person ? "Editar pessoa #" + (person.code || "") : "Cadastrar pessoa"
        }
        size="sm"
        footer={
          <>
            {person && onRequestDelete ? (
              <button
                type="button"
                className="btn btn--danger modal__foot-left"
                disabled={saving}
                onClick={() => onRequestDelete(person)}
              >
                Excluir
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              form="person-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? (form.photo ? "Enviando foto…" : "Salvando…") : "Salvar"}
            </button>
          </>
        }
      >
        <form
          id="person-form"
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <PhotoPicker
            src={photoNow}
            name={form.fullName}
            notify={notify}
            onPhoto={(dataUri) =>
              setForm((f) => ({ ...f, photo: dataUri, removePhoto: false }))
            }
            onRemove={() =>
              setForm((f) => ({ ...f, photo: "", removePhoto: true }))
            }
          />

          {/* Situacao da pessoa: com quais livros ela esta agora e quantos
              emprestimos ja fez. So ao editar - quem esta sendo cadastrada
              ainda nao pegou nada. Os dados vem da lista de Usuarios
              (activeLoans = titulos dos emprestimos em andamento). */}
          {person ? (
            <dl className="detail__data personform__loans">
              <div className="detail__wide">
                <dt>Está com</dt>
                <dd>
                  {person.activeLoans?.length
                    ? person.activeLoans.map((title, index) => (
                        <span key={index}>{formatBookTitle(title)}</span>
                      ))
                    : "Nenhum livro no momento"}
                </dd>
              </div>
              <div className="detail__wide">
                <dt>Empréstimos já feitos</dt>
                <dd>{person.loansCount || 0}</dd>
              </div>
            </dl>
          ) : null}

          <label className="field">
            <span>Nome completo</span>
            <input
              value={form.fullName}
              placeholder="Ex.: Maria Eduarda Nogueira"
              maxLength={80}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
              autoFocus
              required
            />
          </label>

          <div className="field">
            <label className="field__label" htmlFor="person-phone">
              WhatsApp (opcional)
            </label>
            <PhoneInput
              id="person-phone"
              value={form.phone}
              onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            />
            <small className="field__hint">
              Usado só para lembrar a pessoa da devolução do livro. Se ela
              trocou de número, basta corrigir aqui.
            </small>
          </div>
        </form>
      </Modal>

      <Confirm
        open={Boolean(warning)}
        title={
          warning?.code === "PERSON_PHONE_EXISTS"
            ? "Esse WhatsApp já está em uso"
            : "Esse nome já está no cadastro"
        }
        message={
          (warning?.error || "") +
          (warning?.code === "PERSON_PHONE_EXISTS"
            ? ""
            : " Se for outra pessoa de nome igual, ela entra no cadastro com um número próprio.")
        }
        confirmLabel={
          warning?.code === "PERSON_PHONE_EXISTS"
            ? "Salvar assim mesmo"
            : "É outra pessoa"
        }
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          save(true);
        }}
      />
    </>
  );
}
