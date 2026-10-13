import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Modal from "../components/Modal.jsx";
import Confirm from "../components/Confirm.jsx";
import Avatar from "../components/Avatar.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import ListSkeleton from "../components/ListSkeleton.jsx";
import { IconEdit, IconEye, IconEyeOff } from "../components/Icons.jsx";
import { formatStoredPhone } from "../utils/whatsapp.js";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Administradores: quem entra no painel (Configuracoes > Administradores).
 *
 * AQUI SO SE EDITA A PROPRIA CONTA: nome, WhatsApp, foto, usuario e senha. A
 * lista dos outros e so para ver quem e a equipe.
 *
 * Criar administrador, desfazer administrador e trocar a senha de outra pessoa
 * nao se faz no painel, de proposito: isso e da tela de manutencao, aberta
 * pelo login reservado. Assim nenhum administrador pode se promover, se
 * blindar ou tirar o acesso de outro.
 *
 * Administrador e so uma pessoa do cadastro que tambem tem login e senha: o
 * numero que aparece aqui (#1, #2...) e o mesmo da tela Usuarios, e um
 * emprestimo feito para ela ganha o selo "admin".
 */

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
  // Aviso de nome/WhatsApp repetido vindo do servidor; "Confirmar" reenvia
  // com force = true.
  const [warning, setWarning] = useState(null);

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

  const me = admins?.find((admin) => admin.isMe) || null;

  function openMyProfile() {
    if (!me) return;
    setForm({
      code: me.code,
      fullName: me.fullName,
      phone: me.phone || "",
      username: me.username || "",
      password: "",
      photo: "", // data URI de uma foto nova, ainda nao enviada
      savedPhoto: me.photo || "",
      removePhoto: false,
    });
    setShowPassword(false);
  }

  // force = true: a pessoa confirmou o aviso de nome/WhatsApp repetido.
  async function save(force) {
    if (!form.fullName.trim().split(/\s+/).filter(Boolean)[1]) {
      notify("Digite o nome completo (nome e sobrenome).", "error");
      return;
    }
    if (form.phone && !isValidPhoneNumber("+" + form.phone)) {
      notify("WhatsApp inválido. Confira o país, o DDD e o número.", "error");
      return;
    }
    if (form.password && form.password.length < 6) {
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
        force: Boolean(force),
      };
      if (form.password) body.password = form.password;
      if (form.photo) body.photo = form.photo;
      if (form.removePhoto) body.removePhoto = true;

      await api("/api/admins/me", { method: "PUT", body });
      notify(
        form.password ? "Perfil e senha atualizados." : "Perfil atualizado.",
        "success",
      );
      setForm(null);
      setWarning(null);
      // O menu de configuracoes passa a mostrar o nome e a foto novos.
      await refreshUser();
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.payload?.code : null;
      if (["PERSON_NAME_EXISTS", "PERSON_PHONE_EXISTS"].includes(code)) {
        setWarning(err.payload);
      } else {
        notify(err.message, "error");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const photoNow = form
    ? form.removePhoto
      ? ""
      : form.photo || form.savedPhoto
    : "";

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
        {me ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={openMyProfile}
          >
            <IconEdit width={18} height={18} />
            Editar meu perfil
          </button>
        ) : null}
      </div>

      <p className="muted">
        Quem entra no painel com usuário e senha. O nome e a foto aparecem no
        acervo público, em “Com quem falar?”, para a pessoa saber quem procurar
        na igreja — o WhatsApp não é mostrado lá.
      </p>

      <p className="muted">
        Cada um edita só a própria conta. Incluir um novo administrador, desfazer
        um administrador ou trocar a senha de outra pessoa não se faz por aqui.
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
              <Avatar src={admin.photo} name={admin.fullName} size={56} />
              <span className="admincard__text">
                <strong>
                  <span className="personrow__name">
                    {admin.code ? "#" + admin.code + " " : ""}
                    {admin.fullName}
                  </span>
                  {admin.isMe ? (
                    <span className="chip chip--me">você</span>
                  ) : null}
                </strong>
                <small>@{admin.username}</small>
                <small>
                  {admin.phone
                    ? formatStoredPhone(admin.phone)
                    : "sem WhatsApp"}
                </small>
              </span>
              {admin.isMe ? (
                <span className="personrow__actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Editar meu perfil"
                    onClick={openMyProfile}
                  >
                    <IconEdit width={18} height={18} />
                    <span className="sr-only">Editar meu perfil</span>
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Meu perfil */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Meu perfil"
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
              <span>Nova senha (opcional)</span>
              <div className="field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  autoComplete="new-password"
                  placeholder="Deixe em branco para manter a atual"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
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
              <small className="field__hint">Pelo menos 6 caracteres.</small>
            </label>
          </form>
        ) : null}
      </Modal>

      <Confirm
        open={Boolean(warning)}
        title={
          warning?.code === "PERSON_PHONE_EXISTS"
            ? "Esse WhatsApp já está em uso"
            : "Esse nome já está no cadastro"
        }
        message={warning?.error || ""}
        confirmLabel="Salvar assim mesmo"
        onCancel={() => setWarning(null)}
        onConfirm={() => {
          setWarning(null);
          save(true);
        }}
      />
    </div>
  );
}
