import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Confirm from "./Confirm.jsx";
import SettingsDrawer from "./SettingsDrawer.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { prefetchBookList } from "../hooks/useBookList.js";
import { loadPanelBooks } from "../api/panelBooks.js";
import {
  IconBooks,
  IconChevronLeft,
  IconHome,
  IconLoans,
  IconSettings,
} from "./Icons.jsx";

const links = [
  { to: "/", label: "Início", Icon: IconHome, end: true },
  { to: "/livros", label: "Livros", Icon: IconBooks },
  { to: "/emprestimos", label: "Empréstimos", Icon: IconLoans },
];

// Navegacao no estilo de app: sem barra no topo. No celular a barra de abas
// fica embaixo; no computador, a Inicio e o hub e as telas internas mostram
// um "voltar" no topo.
//
// always: o "voltar" aparece tambem no celular. E o caso das telas de
// configuracao, que nao tem aba embaixo para se voltar.
const PARENTS = {
  "/livros": { to: "/", label: "Início" },
  "/emprestimos": { to: "/", label: "Início" },
  "/emprestimos/novo": { to: "/emprestimos", label: "Empréstimos" },
  "/configuracoes/conta": {
    to: "/",
    label: "Início",
    always: true,
  },
  "/configuracoes/usuarios": { to: "/", label: "Início", always: true },
  "/configuracoes/sugestoes": { to: "/", label: "Início", always: true },
};

export default function Layout() {
  const { logout, user } = useAuth();
  const { pathname } = useLocation();
  const [confirmExit, setConfirmExit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isHome = pathname === "/";

  // O Acervo (lista e primeiras capas) vai sendo baixado enquanto a pessoa
  // esta em outra tela: tocando em "Livros", ele ja aparece com as capas.
  // Espera um pouco para nao disputar com o que a tela atual esta buscando.
  // (Na propria tela Livros quem busca e ela.)
  useEffect(() => {
    if (pathname === "/livros") return undefined;
    const timer = setTimeout(() => prefetchBookList(loadPanelBooks), 1200);
    return () => clearTimeout(timer);
  }, [pathname]);
  const parent = PARENTS[pathname.replace(/\/$/, "")] || {
    to: "/",
    label: "Início",
  };

  // A engrenagem fica sempre no canto esquerdo do topo e o sininho no
  // direito: flutuando na Inicio (onde nao ha "voltar") e na linha do
  // "voltar" nas telas internas. (Sair da biblioteca fica nas configuracoes.)
  const gear = (
    <button
      type="button"
      className="icon-button"
      onClick={() => setSettingsOpen(true)}
      title="Configurações"
      aria-haspopup="dialog"
    >
      <IconSettings width={20} height={20} />
      <span className="sr-only">Configurações</span>
    </button>
  );

  return (
    <div className="shell">
      {isHome ? (
        <>
          <div className="appgear">{gear}</div>
          <div className="appbell">
            <NotificationBell />
          </div>
        </>
      ) : null}

      <main className="content" key={pathname}>
        {!isHome ? (
          <div className="pagetop">
            {gear}
            <Link
              to={parent.to}
              className={
                "backlink" +
                (parent.to === "/" && !parent.always ? " backlink--desktop" : "")
              }
            >
              <IconChevronLeft width={18} height={18} />
              {parent.label}
            </Link>
            <div className="pagetop__end">
              <NotificationBell />
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Páginas">
        {links.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__link">
            <Icon width={21} height={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onLogout={() => setConfirmExit(true)}
      />

      <Confirm
        open={confirmExit}
        title="Sair da biblioteca?"
        message="Você precisará entrar de novo com usuário e senha."
        confirmLabel="Sair"
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          logout();
        }}
      />
    </div>
  );
}
