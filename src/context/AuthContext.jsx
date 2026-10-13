import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, getToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        // Sem redirecionar: se o token venceu, o "Protected" manda para o
        // login so as telas privadas; o /catalogo (publico) continua abrindo.
        const data = await api('/api/auth/me', { redirectOnExpired: false });
        if (active) setUser(data.user);
      } catch (error) {
        // So descarta o token quando o servidor DIZ que ele nao vale mais.
        // Falha de internet (ou servidor acordando) nao deve apagar a sessao:
        // da proxima vez que abrir, ela ainda esta valendo.
        if (error?.status === 401) setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function login(username, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  // Quem editou o proprio nome ou a propria foto (em Configuracoes >
  // Administradores) ve a mudanca na hora, sem precisar sair e entrar.
  const refreshUser = useCallback(async () => {
    try {
      const data = await api('/api/auth/me', { redirectOnExpired: false });
      setUser(data.user);
    } catch {
      /* se falhar, a sessao continua com o que ja estava na tela */
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return context;
}
