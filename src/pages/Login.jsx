import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ReadingScene from "../components/ReadingScene.jsx";

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Nao foi possivel entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit}>
          <img
            className="login__logo"
            src="/img/logo-biblioteca.png"
            alt="Biblioteca ADMP Brasil"
          />

          <h1>Entrar na biblioteca</h1>
          <p className="login__hint">
            Acesso restrito a quem administra o acervo.
          </p>

          <label className="field">
            <span>Usuario</span>
            <input
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={submitting}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

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
