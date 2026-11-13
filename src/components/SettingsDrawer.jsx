import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Avatar from "./Avatar.jsx";
// (IconChat era do item "Conversas", que saiu daqui)
import { IconBell, IconBookPlus, IconExit, IconUser, IconUsers } from "./Icons.jsx";

/**
 * Menu de configuracoes que entra pela esquerda (botao de engrenagem do
 * painel). Leva ao cadastro de gente, aos livros sugeridos pelo acervo
 * publico e a conta de quem esta logado, e tem a saida do app.
 *
 * Fecha com Esc, tocando fora ou ao escolher uma opcao. Enquanto esta aberto,
 * a pagina de tras nao rola e o Tab fica dando a volta dentro do menu.
 */
export default function SettingsDrawer({ open, onClose, user, onLogout }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll("a, button"),
      ].filter((node) => !node.disabled && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement;
    // O primeiro item recebe o foco: quem usa teclado ja esta dentro do menu.
    panelRef.current?.querySelector("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Configurações"
        ref={panelRef}
      >
        <header className="drawer__head">
          <Avatar src={user?.photo} name={user?.name} size={48} />
          <div className="drawer__who">
            <strong>{user?.name || "Administrador"}</strong>
            <small>{user?.username ? "@" + user.username : ""}</small>
          </div>
        </header>

        <nav className="drawer__nav" aria-label="Configurações">
          {/* As CONVERSAS sairam daqui (12/11/2026): agora ficam no sininho
              (Notificações), junto com as solicitações e os livros sugeridos.
                        <Link to="/conversas" className="drawer__item" onClick={onClose}>
                          <IconChat width={20} height={20} />
                          <span>
                            <strong>Conversas</strong>
                            <small>
                              {unread > 0
                                ? unread === 1
                                  ? "1 mensagem não lida"
                                  : unread + " mensagens não lidas"
                                : "WhatsApp da biblioteca"}
                            </small>
                          </span>
                          {unread > 0 ? (
                            <span className="drawer__count" aria-hidden="true">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          ) : null}
                        </Link> */}
          <Link
            to="/configuracoes/usuarios"
            className="drawer__item"
            onClick={onClose}
          >
            <IconUsers width={20} height={20} />
            <span>
              <strong>Usuários</strong>
              <small>Quem pega livros emprestados</small>
            </span>
          </Link>
          <Link
            to="/configuracoes/sugestoes"
            className="drawer__item"
            onClick={onClose}
          >
            <IconBookPlus width={20} height={20} />
            <span>
              <strong>Livros sugeridos</strong>
              <small>Pedidos do catálogo público</small>
            </span>
          </Link>
          <Link
            to="/configuracoes/notificacoes"
            className="drawer__item"
            onClick={onClose}
          >
            <IconBell width={20} height={20} />
            <span>
              <strong>Notificações</strong>
              <small>Escolha o que receber no aparelho</small>
            </span>
          </Link>
          <Link
            to="/configuracoes/conta"
            className="drawer__item"
            onClick={onClose}
          >
            <IconUser width={20} height={20} />
            <span>
              <strong>Minha conta</strong>
              <small>Foto, nome e senha</small>
            </span>
          </Link>
        </nav>

        <footer className="drawer__foot">
          <button
            type="button"
            className="drawer__item drawer__item--exit"
            onClick={() => {
              onClose();
              onLogout();
            }}
          >
            <IconExit width={20} height={20} />
            <span>
              <strong>Sair da biblioteca</strong>
            </span>
          </button>
        </footer>
      </aside>
    </div>
  );
}
