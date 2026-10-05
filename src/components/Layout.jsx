import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Confirm from "./Confirm.jsx";
import {
  IconBooks,
  IconChevronLeft,
  IconExit,
  IconHome,
  IconLoans,
} from "./Icons.jsx";

const links = [
  { to: "/", label: "Início", Icon: IconHome, end: true },
  { to: "/livros", label: "Livros", Icon: IconBooks },
  { to: "/emprestimos", label: "Empréstimos", Icon: IconLoans },
];

// Navegacao no estilo de app: sem barra no topo. No celular a barra de abas
// fica embaixo; no computador, a Inicio e o hub e as telas internas mostram
// um "voltar" no topo.
const PARENTS = {
  "/livros": { to: "/", label: "Início" },
  "/emprestimos": { to: "/", label: "Início" },
  "/emprestimos/novo": { to: "/emprestimos", label: "Empréstimos" },
};

export default function Layout() {
  const { logout, user } = useAuth();
  const { pathname } = useLocation();
  const [confirmExit, setConfirmExit] = useState(false);

  const isHome = pathname === "/";
  const parent = PARENTS[pathname.replace(/\/$/, "")] || { to: "/", label: "Início" };

  return (
    <div className="shell">
      {isHome ? (
        <button
          type="button"
          className="icon-button appexit"
          onClick={() => setConfirmExit(true)}
          title={"Sair de " + (user?.username || "")}
        >
          <IconExit width={20} height={20} />
          <span className="sr-only">Sair</span>
        </button>
      ) : null}

      <main className="content" key={pathname}>
        {!isHome ? (
          <Link
            to={parent.to}
            className={"backlink" + (parent.to === "/" ? " backlink--desktop" : "")}
          >
            <IconChevronLeft width={18} height={18} />
            {parent.label}
          </Link>
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
