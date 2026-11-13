/*
 * Notificacoes do app (Web Push):
 * - do "Avise-me quando voltar" do acervo publico (/catalogo): o livro
 *   voltou para a estante (backend/src/services/returnAlerts.js);
 * - dos ADMINISTRADORES (Configurações > Notificações): solicitacao nova,
 *   emprestimo novo, livro sugerido, mensagem no WhatsApp da biblioteca
 *   (backend/src/services/adminPush.js). Estas trazem botoes ("Registrar
 *   solicitação", "Responder"...), cada um com o seu endereco.
 *
 * Este arquivo e carregado DENTRO do service worker do app (o sw.js que o
 * vite-plugin-pwa gera; ver "importScripts" em vite.config.js). E ele que
 * recebe a mensagem do servidor e a mostra - mesmo com o site fechado.
 *
 * Fica em public/ (e nao em src/) porque o service worker nao passa pelo
 * Vite: este arquivo vai para o site exatamente como esta.
 */

// So enderecos deste mesmo site, comecando com "/" (nunca "//outro-site").
function localPath(value, fallback) {
  return typeof value === "string" && value.charAt(0) === "/" && value.charAt(1) !== "/"
    ? value
    : fallback;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  // Do painel (tem "kind") ou do acervo publico.
  const admin = typeof data.kind === "string" && data.kind !== "";
  const fallback = admin ? "/inicio" : "/catalogo";
  const url = localPath(data.url, fallback);
  // Botoes (o Chrome/Edge/Android mostram ate 2; os outros ignoram e o
  // toque na notificacao abre "url").
  const actions = Array.isArray(data.actions)
    ? data.actions
        .filter((a) => a && typeof a.action === "string" && typeof a.title === "string")
        .slice(0, 2)
    : [];
  const links = {};
  actions.forEach((a) => {
    links[a.action] = localPath(a.url, url);
  });

  const title = data.title || "Biblioteca ADMP Brasil";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: admin ? "/icons/icon-192.png" : "/icons/catalogo-192.png",
      // Icone pequeno da barra de status do Android (so a silhueta conta).
      badge: "/icons/catalogo-badge.png",
      lang: "pt-BR",
      // Mesmo assunto avisado de novo substitui a notificacao antiga.
      tag: data.tag || undefined,
      renotify: Boolean(admin && data.tag),
      actions: actions.map((a) => ({ action: a.action, title: a.title })),
      data: { url, links },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const info = event.notification.data || {};
  const path =
    (event.action && info.links && info.links[event.action]) || info.url || "/catalogo";
  const target = new URL(path, self.location.origin);
  if (target.origin !== self.location.origin) return;
  const toCatalog = target.pathname.startsWith("/catalogo");

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Uma janela do mesmo lado ja aberta (catalogo ou painel): traz para a
      // frente e mostra o endereco nela.
      const open = windows.find(
        (client) => new URL(client.url).pathname.startsWith("/catalogo") === toCatalog,
      );
      if (open) {
        try {
          await open.focus();
          await open.navigate(target.href);
          return;
        } catch {
          /* aba que este service worker nao controla: abre uma nova */
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
