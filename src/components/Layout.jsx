import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { IconHome, IconBooks, IconLoans, IconExit } from "./Icons.jsx";

const links = [
  { to: "/", label: "Inicio", Icon: IconHome, end: true },
  { to: "/livros", label: "Livros", Icon: IconBooks },
  { to: "/emprestimos", label: "Empréstimos", Icon: IconLoans },
];

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <img src="/img/logo-admpb-fire.png" alt="" width="34" height="34" />
          <div>
            <strong>Biblioteca</strong>
            <span>ADMP Brasil</span>
          </div>
        </div>

        <nav className="topbar__nav" aria-label="Paginas">
          {links.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="topbar__link">
              <Icon width={18} height={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="icon-button topbar__exit"
          onClick={logout}
          title={"Sair de " + (user?.username || "")}
        >
          <IconExit width={20} height={20} />
          <span className="sr-only">Sair</span>
        </button>
      </header>

      <main className="content" key={location.pathname}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Paginas">
        {links.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__link">
            <Icon width={21} height={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
