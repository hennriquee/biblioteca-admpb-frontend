/*
 * Notificacoes do "Avise-me quando voltar" do acervo publico (/catalogo).
 *
 * Este arquivo e carregado DENTRO do service worker do app (o sw.js que o
 * vite-plugin-pwa gera; ver "importScripts" em vite.config.js). E ele que
 * recebe a mensagem que o servidor manda quando o livro e devolvido (ver
 * backend/src/services/returnAlerts.js) e a mostra no celular - mesmo com o
 * site fechado.
 *
 * Fica em public/ (e nao em src/) porque o service worker nao passa pelo
 * Vite: este arquivo vai para o site exatamente como esta.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Biblioteca ADMP Brasil";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/catalogo-192.png",
      // Icone pequeno da barra de status do Android (so a silhueta conta).
      badge: "/icons/catalogo-badge.png",
      lang: "pt-BR",
      // Mesmo livro avisado de novo substitui a notificacao antiga.
      tag: data.tag || undefined,
      data: { url: data.url || "/catalogo" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // So abre enderecos deste mesmo site.
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/catalogo",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Catalogo ja aberto: traz para a frente e mostra o livro nele.
      const open = windows.find(
        (client) => new URL(client.url).pathname.startsWith("/catalogo"),
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
