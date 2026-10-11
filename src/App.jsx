import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import AppSplash from './components/AppSplash.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Books from './pages/Books.jsx';
import Loans from './pages/Loans.jsx';
import NewLoan from './pages/NewLoan.jsx';
import Catalog from './pages/Catalog.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="boot">
        <img src="/img/logo-admpb-fire.png" alt="" width="52" height="52" />
        <span>Abrindo a biblioteca…</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  // Quem abre direto o acervo publico e recebido pela animacao de
  // boas-vindas de la; a tela de abertura do app ficaria por cima dela.
  const [showSplash] = useState(
    () => !['/catalogo', '/catalogo/'].includes(window.location.pathname),
  );

  return (
    <>
      {showSplash ? <AppSplash /> : null}
      <Routes>
      <Route path="/login" element={<Login />} />
      {/* Unica tela aberta ao publico: fica de fora do Protected e do Layout
          do admin. Toda rota nova de admin deve ficar DENTRO do Protected. */}
      <Route path="/catalogo" element={<Catalog />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/livros" element={<Books />} />
        <Route path="/emprestimos" element={<Loans />} />
        <Route path="/emprestimos/novo" element={<NewLoan />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
