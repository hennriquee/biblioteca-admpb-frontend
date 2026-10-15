import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Confirm from "../components/Confirm.jsx";
import PhoneInput from "../components/PhoneInput.jsx";
import PhotoPicker from "../components/PhotoPicker.jsx";
import FormSkeleton from "../components/FormSkeleton.jsx";
import { IconEye, IconEyeOff } from "../components/Icons.jsx";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Minha conta (Configuracoes > Minha conta).
 *
 * Cada administrador edita AQUI so a propria conta: foto, nome, WhatsApp,
 * usuario e senha. Os outros administradores nao aparecem nesta tela (quem
 * quiser ve-los os encontra na lista de Usuarios, com o selo "admin"), e dar ou
 * tirar acesso ao painel nao se faz daqui: e da tela de manutencao.
 *
 * Cai direto na edicao, sem lista no meio. O numero (#code) da pessoa nao
 * aparece: aqui ela edita o que e dela, nao se identifica para ninguem.
 *
 * A espera usa o esqueleto de FORMULARIO (nao o de lista): o que vem depois e
 * a foto redonda com os campos, e nao uma lista de itens.
 */
export default function Account() {
  const { notify } = useToast();
  const { refreshUser } = useAuth();

  // null = ainda carregando.
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  // Aviso de nome/WhatsApp repetido vindo do servidor; "Confirmar" reenvia
  // com force = true.
  const [warning, setWarning] = useState(null);
  // Trava contra o clique duplo (ver People.jsx).
  const savingRef = useRef(false);

  function toForm(me) {
    return {
      fullName: me.fullName,
      phone: me.phone || "",
      username: me.username || "",
      password: "",
      photo: "", // data URI de uma foto nova, ainda nao enviada
      savedPhoto: me.photo || "", // foto que ja esta salva
      removePhoto: false,
    };
  }

  async function load() {
    setError("");
    try {
      setForm(toForm(await api("/api/admins/me")));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

      const saved = await api("/api/admins/me", { method: "PUT", body });
      notify(
        form.password ? "Conta e senha atualizadas." : "Conta atualizada.",
        "success",
      );
      setForm(toForm(saved));
      setWarning(null);
      // O menu de configuracoes passa a mostrar o nome e a foto novos.
      await refreshUser();
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
          <h1>Minha conta</h1>
          <p className="page__sub">Foto, nome, WhatsApp, usuário e senha</p>
        </div>
      </div>

      {form === null && !error ? (
        // A mesma forma do formulario que entra no lugar dele: 4 campos
        // (nome, WhatsApp, usuario e senha), com dica embaixo do 2o e do 4o.
        <FormSkeleton
          label="Carregando a sua conta…"
          fields={4}
          hints={[1, 3]}
        />
      ) : null}

      {error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={load}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      {form ? (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
        >
          <PhotoPicker
            src={photoNow}
            name={form.fullName}
            notify={notify}
            chooseBackground
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
            <label className="field__label" htmlFor="account-phone">
              WhatsApp (opcional)
            </label>
            <PhoneInput
              id="account-phone"
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

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={saving}
          >
            {saving ? (form.photo ? "Enviando foto…" : "Salvando…") : "Salvar"}
          </button>
        </form>
      ) : null}

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
