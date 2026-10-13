import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import SamePersonDialog from "../components/SamePersonDialog.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import {
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
} from "../components/Icons.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Administradores: quem entra no painel (Configuracoes > Administradores).
 *
 * O nome e o telefone do administrador sao os da PESSOA ligada a conta - a
 * mesma pessoa que pode pegar um livro emprestado. Por isso o numero que
 * aparece aqui (#1, #2...) e o mesmo da tela Usuarios, e um emprestimo feito
 * para ela ganha o selo "admin".
 *
 * Todo administrador pode cadastrar, editar e excluir administradores (numa
 * biblioteca de igreja sao poucas pessoas, todas de confianca, e alguem precisa
 * poder socorrer quem esqueceu a senha). Ninguem exclui a propria conta e a
 * ultima conta nao pode ser excluida.
 *
 * A foto fica no Cloudinary pelo mesmo caminho da capa de livro: ao trocar ou
 * remover, o servidor apaga a antiga de la.
 */

const emptyForm = {
  fullName: "",
  phone: "",
  username: "",
  password: "",
  photo: "", // data URI de uma foto nova, ainda nao enviada
  savedPhoto: "", // foto que ja esta salva
  removePhoto: false,
};

export default function Admins() {
  const { notify } = useToast();
  const { refreshUser } = useAuth();

  // null = ainda carregando a lista (a tela mostra o esqueleto).
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState(null); // null = modal fechado
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Nome repetido: o servidor devolve as pessoas candidatas e o app pergunta
  // se e a mesma pessoa (ver SamePersonDialog).
  const [samePerson, setSamePerson] = useState(null);
  const [phoneWarning, setPhoneWarning] = useState(null);

  const requestRef = useRef(0);
  // Trava contra o clique duplo (ver People.jsx).
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setRefreshing(true);
    try {
      const data = await api("/api/admins");
      if (requestId !== requestRef.current) return;
      setAdmins(data);
      setError("");
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm({ ...emptyForm });
    setShowPassword(false);
  }

  function openEdit(admin) {
    setForm({
      ...emptyForm,
      _id: admin._id,
      code: admin.person?.code || null,
      fullName: admin.person?.fullName || "",
      phone: admin.person?.phone || "",
      username: admin.username,
      savedPhoto: admin.photo || "",
      isMe: admin.isMe,
    });
    setShowPassword(false);
  }

  // extra: { force } quando a pessoa confirmou um aviso, ou { personId }
  // quando escolheu uma pessoa que ja existe no cadastro.
  async function save(extra = {}) {
    if (!form.fullName.trim().split(/\s+/).filter(Boolean)[1]) {
      notify("Digite o nome completo (nome e sobrenome).", "error");
      return;
    }
    if (form.phone && !isValidPhoneNumber("+" + form.phone)) {
      notify("WhatsApp inválido. Confira o país, o DDD e o número.", "error");
      return;
    }
    if (!form._id && form.password.length < 6) {
      notify("A senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone,
        username: form.username,
        ...extra,
      };
      if (form.password) body.password = form.password;
      if (form.photo) body.photo = form.photo;
      if (form.removePhoto) body.removePhoto = true;

      if (form._id) {
        await api("/api/admins/" + form._id, { method: "PUT", body });
        notify("Administrador atualizado.", "success");
        // Editou a si mesmo: o menu de configuracoes mostra o nome/foto novos.
        if (form.isMe) await refreshUser();
      } else {
        await api("/api/admins", { method: "POST", body });
        notify("Administrador cadastrado.", "success");
      }
      setForm(null);
      setSamePerson(null);
      setPhoneWarning(null);
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.payload?.code : null;
      if (code === "PERSON_NAME_EXISTS") {
        setSamePerson(err.payload);
      } else if (code === "PERSON_PHONE_EXISTS") {
        setPhoneWarning(err.payload);
      } else {
        notify(err.message, "error");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete() {
    const admin = confirmDelete;
    setConfirmDelete(null);
    try {
      await api("/api/admins/" + admin._id, { method: "DELETE" });
      notify("Conta de administrador excluída.", "success");
      await load();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  const photoNow = form ? (form.removePhoto ? "" : form.photo || form.savedPhoto) : "";

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Administradores</h1>
          <p className="page__sub">
            {admins === null
              ? "Carregando…"
              : error
                ? "Não foi possível carregar"
                : admins.length + " conta(s) com acesso ao painel"}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <IconPlus width={18} height={18} />
          Novo administrador
        </button>
      </div>

      <p className="muted">
        Quem entra no painel com usuário e senha. O nome, o WhatsApp e a foto
        aparecem no acervo público, em “Com quem falar?”, para a pessoa saber
        quem procurar na igreja — o WhatsApp não é mostrado lá.
      </p>

      {admins === null && !error ? (
        <ListSkeleton label="Carregando os administradores…" />
      ) : null}

      {error && admins === null ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {admins !== null && error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {admins?.length ? (
        <ul className={"adminlist" + (refreshing ? " is-refreshing" : "")}>
          {admins.map((admin) => (
            <li key={admin._id} className="admincard">
              <Avatar
                src={admin.photo}
                name={admin.person?.fullName || admin.username}
                size={56}
              />
              <span className="admincard__text">
                <strong>
                  <span className="personrow__name">
                    {admin.person?.code ? "#" + admin.person.code + " " : ""}
                    {admin.person?.fullName || admin.username}
                  </span>
                  {admin.isMe ? (
                    <span className="chip chip--me">você</span>
                  ) : null}
                </strong>
                <small>@{admin.username}</small>
                <small>
                  {admin.person?.phone
                    ? formatStoredPhone(admin.person.phone)
                    : "sem WhatsApp"}
                </small>
              </span>
              <span className="personrow__actions">
                <button
                  type="button"
                  className="icon-button"
                  title={"Editar " + (admin.person?.fullName || admin.username)}
                  onClick={() => openEdit(admin)}
                >
                  <IconEdit width={18} height={18} />
                  <span className="sr-only">Editar</span>
                </button>
                {!admin.isMe ? (
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    title={
                      "Excluir a conta de " +
                      (admin.person?.fullName || admin.username)
                    }
                    onClick={() => setConfirmDelete(admin)}
                  >
                    <IconTrash width={18} height={18} />
                    <span className="sr-only">Excluir conta</span>
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Cadastro / edicao */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?._id ? "Editar administrador" : "Novo administrador"}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {/* O rodape e montado mesmo com o modal fechado (form = null),
                  por isso o "?." aqui. */}
              {saving
                ? form?.photo
                  ? "Enviando foto…"
                  : "Salvando…"
                : "Salvar"}
            </button>
          </>
        }
      >
        {form ? (
          <form
            id="admin-form"
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
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

            <label className="field">
              <span>Nome completo</span>
              <input
                value={form.fullName}
                placeholder="Ex.: Bruno Henrique Moreira"
                maxLength={80}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullName: e.target.value }))
                }
                required
              />
            </label>

            <div className="field">
              <label className="field__label" htmlFor="admin-phone">
                WhatsApp (opcional)
              </label>
              <PhoneInput
                id="admin-phone"
                value={form.phone}
                onChange={(phone) => setForm((f) => ({ ...f, phone }))}
              />
              <small className="field__hint">
                Fica só no painel: o acervo público não mostra o número.
              </small>
            </div>

            <label className="field">
              <span>Usuário (para entrar no painel)</span>
              <input
                value={form.username}
                placeholder="Ex.: bruno"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck="false"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().trim(),
                  }))
                }
                required
              />
            </label>

            <label className="field">
              <span>{form._id ? "Nova senha (opcional)" : "Senha"}</span>
              <div className="field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  autoComplete="new-password"
                  placeholder={
                    form._id ? "Deixe em branco para manter a atual" : ""
                  }
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required={!form._id}
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <IconEyeOff width={18} height={18} />
                  ) : (
                    <IconEye width={18} height={18} />
                  )}
                </button>
              </div>
              <small className="field__hint">
                Pelo menos 6 caracteres.
              </small>
            </label>
          </form>
        ) : null}
      </Modal>

      <SamePersonDialog
        open={Boolean(samePerson)}
        warning={samePerson}
        onCancel={() => setSamePerson(null)}
        onUsePerson={(person) => {
          setSamePerson(null);
          save({ personId: person._id });
        }}
        onCreateNew={() => {
          setSamePerson(null);
          save({ force: true });
        }}
      />

      <Confirm
        open={Boolean(phoneWarning)}
        title="Esse WhatsApp já está em uso"
        message={phoneWarning?.error || ""}
        confirmLabel="Salvar assim mesmo"
        onCancel={() => setPhoneWarning(null)}
        onConfirm={() => {
          setPhoneWarning(null);
          save({ force: true });
        }}
      />

      <Confirm
        open={Boolean(confirmDelete)}
        title="Excluir conta de administrador"
        message={
          (confirmDelete?.person?.fullName || confirmDelete?.username || "") +
          " perde o acesso ao painel. A pessoa continua no cadastro, com o histórico de empréstimos, e a foto de perfil é apagada."
        }
        confirmLabel="Excluir conta"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
