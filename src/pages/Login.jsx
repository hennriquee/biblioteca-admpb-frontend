import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ReadingScene from "../components/ReadingScene.jsx";
import {
  IconBooks,
  IconChevronLeft,
  IconEye,
  IconEyeOff,
  IconShield,
} from "../components/Icons.jsx";

/**
 * Entrada do site. Dois jeitos de abrir:
 *
 * - start="choose" (a tela inicial, "/"): so os dois botoes - "Sou
 *   administrador", que abre os campos do login, e "Ver catálogo", que leva
 *   ao acervo publico (sem login);
 * - start="form" (/login): ja com os campos. E para onde o painel manda quem
 *   chega sem sessao (ex.: o link de uma solicitacao) e onde "Sou
 *   administrador" leva. Vindo da escolha, tem o "Voltar".
 */
export default function Login({ start = "form" }) {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Para onde a pessoa queria ir antes de cair no login (ver Protected, em
  // App.jsx) - por exemplo, o link de uma solicitacao vindo do WhatsApp.
  const from = location.state?.from;
  const fromPath =
    from?.pathname && from.pathname !== "/login" && from.pathname !== "/"
      ? from.pathname + (from.search || "")
      : "";
  const fromRequest =
    fromPath.startsWith("/solicitacao/") ||
    /[?&]solicitacao=/.test(from?.search || "");
  // Link de uma conversa do WhatsApp (botao "Copiar link" em Conversas).
  const fromChat = fromPath.startsWith("/conversas/");
  // Veio do "Sou administrador" da tela inicial: mostra o "Voltar".
  const fromChooser = location.state?.chooser === true;
  const choosing = start === "choose";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // A partir da 3a tentativa errada, a tela sugere falar com o suporte: pode
  // ser senha esquecida, caps lock, conta desativada etc.
  const [failCount, setFailCount] = useState(0);
  const usernameRef = useRef(null);

  // Abriu os campos pelo "Sou administrador": o cursor ja vai para o usuario.
  useEffect(() => {
    if (!choosing && fromChooser) usernameRef.current?.focus();
  }, [choosing, fromChooser]);

  // Para onde a sessao leva: o painel da biblioteca ou, no caso do login
  // reservado, a tela de manutencao (ver backend/src/services/devAccess.js).
  const homeFor = (session) =>
    session?.role === "dev" ? "/manutencao" : fromPath || "/inicio";

  if (!loading && user) return <Navigate to={homeFor(user)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const session = await login(username.trim(), password);
      navigate(homeFor(session), { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível entrar.");
      // So conta como tentativa de senha errada quando o servidor realmente
      // recusou as credenciais (401) - falha de rede/servidor acordando nao
      // deve empurrar a pessoa para o aviso de "fale com o desenvolvedor".
      if (err.status === 401) setFailCount((count) => count + 1);
    } finally {
      setSubmitting(false);
    }
  }

  const logo = (
    <img
      className="login__logo"
      src="/img/logo-biblioteca.svg"
      alt="Biblioteca ADMP Brasil"
    />
  );

  return (
    <div className="login">
      <section className="login__panel">
        {choosing ? (
          <div className="login__form login__choose">
            {logo}
            <h1>Bem-vindo à biblioteca</h1>
            <p className="login__hint">Como você quer entrar?</p>

            <div className="choose">
              {/* Leva ao /login (com os campos): o "voltar" do celular
                  devolve a esta escolha. */}
              <button
                type="button"
                className="choose__btn choose__btn--admin"
                onClick={() => navigate("/login", { state: { chooser: true } })}
              >
                <span className="choose__icon" aria-hidden="true">
                  <IconShield width={24} height={24} />
                </span>
                <span className="choose__text">
                  <strong>Sou administrador</strong>
                  <small>Entrar com usuário e senha</small>
                </span>
              </button>
              <Link to="/catalogo" className="choose__btn">
                <span className="choose__icon" aria-hidden="true">
                  <IconBooks width={24} height={24} />
                </span>
                <span className="choose__text">
                  <strong>Ver catálogo</strong>
                  <small>Os livros do acervo, sem login</small>
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <form className="login__form" onSubmit={handleSubmit}>
            {fromChooser ? (
              <button
                type="button"
                className="linkish login__back"
                onClick={() => navigate(-1)}
              >
                <IconChevronLeft width={16} height={16} aria-hidden="true" />
                Voltar
              </button>
            ) : null}
            {logo}

            <h1>Entrar na biblioteca</h1>
            <p className="login__hint">
              {fromRequest
                ? "Entre com a sua conta de administrador para registrar a solicitação de empréstimo."
                : fromChat
                  ? "Entre com a sua conta de administrador para abrir a conversa."
                  : "Acesso restrito a quem administra o acervo."}
            </p>

            <label className="field">
              <span>Usuário</span>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                required
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <div className="field__input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
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
              {failCount >= 3 ? (
                <small className="field__hint">
                  Em caso de problemas com senha, contate um de nossos
                  desenvolvedores.
                </small>
              ) : null}
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={submitting}
            >
              {submitting ? "Entrando…" : "Entrar"}
            </button>

            {/* Quem nao administra e so quer ver os livros: o acervo publico
                abre sem login. */}
            <div className="login__public">
              <span>Só quer ver os livros?</span>
              <Link to="/catalogo" className="btn btn--ghost btn--block">
                <IconBooks width={18} height={18} />
                Ver o catálogo
              </Link>
            </div>
          </form>
        )}

        <footer className="login__footer">
          © {new Date().getFullYear()} ADMP Brasil — Todos os direitos
          reservados.
        </footer>
      </section>

      <aside className="login__aside">
        <img
          className="login__mark"
          src="/img/logo-admpb-white.png"
          alt="ADMP Bairro Brasil"
        />
        <ReadingScene className="login__scene" />
        <p className="login__quote">
          Um acervo que circula entre a nossa gente.
        </p>
      </aside>
    </div>
  );
}
