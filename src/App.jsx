import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Books from './pages/Books.jsx';
import Loans from './pages/Loans.jsx';
import NewLoan from './pages/NewLoan.jsx';

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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
  );
}
