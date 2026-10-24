import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import AppSplash from './components/AppSplash.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Books from './pages/Books.jsx';
import Loans from './pages/Loans.jsx';
import NewLoan from './pages/NewLoan.jsx';
import Catalog from './pages/Catalog.jsx';
import NewBooks from './pages/NewBooks.jsx';
import Account from './pages/Account.jsx';
import People from './pages/People.jsx';
import Suggestions from './pages/Suggestions.jsx';
import DevConsole from './pages/DevConsole.jsx';

function Booting() {
  return (
    <div className="boot">
      <img src="/img/logo-admpb-fire.png" alt="" width="52" height="52" />
      <span>Abrindo a biblioteca…</span>
    </div>
  );
}

// Painel da biblioteca: so para quem entrou com conta de administrador. Quem
// entrou pelo login de manutencao nao administra o acervo - vai direto para a
// tela dele (ver pages/DevConsole.jsx).
// Quem chega sem login vai para o login e, depois de entrar, volta para onde
// queria ir (ex.: o link de uma solicitacao vindo do WhatsApp).
function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Booting />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role === 'dev') return <Navigate to="/manutencao" replace />;
  return children;
}

// Tela de manutencao: so a sessao do login reservado. Administrador que
// digitar o endereco na mao volta para o painel.
function DevOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Booting />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'dev') return <Navigate to="/" replace />;
  return children;
}

// Link do fim da mensagem de "Solicitar empréstimo" (/solicitacao/<id>): abre
// Emprestimos > Solicitados com o "Registrar solicitação" ja preenchido (ver
// pages/Loans.jsx). Quem nao e administrador para no login - o link sozinho
// nao mostra nem registra nada. (Na Vercel, quem abre o link pelo navegador
// ja chega em /emprestimos?solicitacao=... direto: ver api/solicitacao.js.)
function RequestLink() {
  const { token } = useParams();
  return (
    <Navigate
      to={'/emprestimos?filtro=solicitados&solicitacao=' + encodeURIComponent(token || '')}
      replace
    />
  );
}

export default function App() {
  // Quem abre direto o acervo publico (ou a tela de novidades dele) e
  // recebido pela animacao de boas-vindas de la; a tela de abertura do app
  // ficaria por cima dela.
  const [showSplash] = useState(
    () => !window.location.pathname.startsWith('/catalogo'),
  );

  return (
    <>
      {showSplash ? <AppSplash /> : null}
      <Routes>
      <Route path="/login" element={<Login />} />
      {/* Unicas telas abertas ao publico: ficam de fora do Protected e do
          Layout do admin. Toda rota nova de admin deve ficar DENTRO do
          Protected. (O "Nao sou um robo" vale para o site inteiro: ver
          components/SiteGate.jsx, em main.jsx.) */}
      <Route path="/catalogo" element={<Catalog />} />
      <Route path="/catalogo/novidades" element={<NewBooks />} />
      <Route
        path="/solicitacao/:token"
        element={
          <Protected>
            <RequestLink />
          </Protected>
        }
      />
      {/* Manutencao: fora do Layout do painel (sem abas nem engrenagem), porque
          esta sessao nao cuida de livro nem de emprestimo. */}
      <Route
        path="/manutencao"
        element={
          <DevOnly>
            <DevConsole />
          </DevOnly>
        }
      />
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
        {/* Configuracoes: cadastro de gente (engrenagem do painel) */}
        <Route path="/configuracoes/conta" element={<Account />} />
        <Route path="/configuracoes/usuarios" element={<People />} />
        <Route path="/configuracoes/sugestoes" element={<Suggestions />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
