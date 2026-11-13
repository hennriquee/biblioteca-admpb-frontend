import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Confirm from "./Confirm.jsx";
import SettingsDrawer from "./SettingsDrawer.jsx";
import NotificationBell from "./NotificationBell.jsx";
import PickupReminders from "./PickupReminders.jsx";
import { prefetchBookList } from "../hooks/useBookList.js";
import { useWhatsappUnread } from "../hooks/useWhatsappStatus.js";
import { loadPanelBooks } from "../api/panelBooks.js";
import { forgetThisDevice } from "../utils/adminPush.js";
import {
  IconBooks,
  IconChat,
  IconChevronLeft,
  IconHome,
  IconLoans,
  IconSettings,
} from "./Icons.jsx";

const links = [
  { to: "/inicio", label: "Início", Icon: IconHome, end: true },
  { to: "/livros", label: "Livros", Icon: IconBooks },
  { to: "/emprestimos", label: "Empréstimos", Icon: IconLoans },
  { to: "/conversas", label: "Conversas", Icon: IconChat, badge: true },
];

// Navegacao no estilo de app: sem barra no topo. No celular a barra de abas
// fica embaixo; no computador, a Inicio e o hub e as telas internas mostram
// um "voltar" no topo.
//
// always: o "voltar" aparece tambem no celular. E o caso das telas de
// configuracao, que nao tem aba embaixo para se voltar.
const PARENTS = {
  "/livros": { to: "/inicio", label: "Início" },
  "/emprestimos": { to: "/inicio", label: "Início" },
  "/emprestimos/novo": { to: "/emprestimos", label: "Empréstimos" },
  "/configuracoes/conta": {
    to: "/inicio",
    label: "Início",
    always: true,
  },
  "/configuracoes/usuarios": { to: "/inicio", label: "Início", always: true },
  "/configuracoes/sugestoes": { to: "/inicio", label: "Início", always: true },
  "/configuracoes/notificacoes": { to: "/inicio", label: "Início", always: true },
};

export default function Layout() {
  const { logout, user } = useAuth();
  const { pathname } = useLocation();
  const [confirmExit, setConfirmExit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isHome = pathname === "/inicio";
  // Mensagens do WhatsApp ainda nao lidas (a bolinha da aba "Conversas").
  const unreadChats = useWhatsappUnread();

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
    to: "/inicio",
    label: "Início",
  };

  // A engrenagem (canto esquerdo) e o sininho (direito) ficam FORA da tela
  // que troca a cada aba, sempre no mesmo lugar: na Inicio e nas telas
  // internas, no celular e no computador (no computador, nos cantos da
  // coluna do conteudo). Antes cada tela desenhava os seus e eles pulavam de
  // posicao ao trocar de aba. O "voltar" das telas internas fica ao lado da
  // engrenagem. (Sair da biblioteca fica nas configuracoes.)
  return (
    <div className="shell">
      <div className="apptop">
        <div className="apptop__bar">
          {/* As Conversas sairam das Configuracoes (12/11/2026): a porta
              para elas no computador e o sininho, que soma as nao lidas. */}
          <button
            type="button"
            className="icon-button gearbtn"
            onClick={() => setSettingsOpen(true)}
            title="Configurações"
            aria-haspopup="dialog"
          >
            <IconSettings width={20} height={20} />
            {/* (antes: bolinha verde com as mensagens nao lidas do WhatsApp)
            {unreadChats > 0 ? (
              <span className="gearbtn__badge" aria-hidden="true">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            ) : null} */}
            <span className="sr-only">Configurações</span>
          </button>
          <NotificationBell unreadChats={unreadChats} />
        </div>
      </div>

      {/* A chave refaz a tela a cada endereco novo; nas Conversas, trocar de
          conversa muda o endereco mas NAO deve refazer a tela (perderia a lista
          e os rascunhos). */}
      <main
        className="content"
        key={pathname.startsWith("/conversas") ? "/conversas" : pathname}
      >
        {!isHome ? (
          <div className="pagetop">
            <Link
              to={parent.to}
              className={
                "backlink" +
                (parent.to === "/inicio" && !parent.always ? " backlink--desktop" : "")
              }
            >
              <IconChevronLeft width={18} height={18} />
              {parent.label}
            </Link>
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Páginas">
        {links.map(({ to, label, Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__link">
            <span className="tabbar__icon">
              <Icon width={21} height={21} />
              {badge && unreadChats > 0 ? (
                <span className="tabbar__badge">
                  <span aria-hidden="true">{unreadChats > 99 ? "99+" : unreadChats}</span>
                  <span className="sr-only">
                    {unreadChats === 1
                      ? "1 mensagem não lida"
                      : unreadChats + " mensagens não lidas"}
                  </span>
                </span>
              ) : null}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Ao entrar no painel: "entregas de hoje" e "solicitacoes em atraso". */}
      <PickupReminders />

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
        onConfirm={async () => {
          setConfirmExit(false);
          // Este aparelho deixa de receber as notificacoes desta conta (o
          // pedido sai com o token de agora; espera no maximo ~2 s).
          await forgetThisDevice();
          logout();
        }}
      />
    </div>
  );
}
