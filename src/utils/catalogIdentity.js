/**
 * A "cara" do acervo publico como app: o livro da logo com "Catalogo" embaixo.
 *
 * O painel e o acervo vivem no mesmo site, entao o navegador so conhece um app
 * (manifesto, icone do celular). Ao abrir /catalogo trocamos essas pecas pelas
 * do acervo: quem instala a partir dali, ou adiciona a tela inicial, leva o
 * icone certo (e a abertura do app, no Android, sai dele). Ao sair da tela,
 * volta tudo como estava.
 *
 * O favicon da aba (o "foguinho") NAO troca: e sempre o mesmo, em todas as
 * telas.
 *
 * Devolve a funcao que desfaz a troca (serve de retorno de useEffect).
 */
const CATALOG = {
  manifest: "/manifest-catalogo.webmanifest",
  appleIcon: "/icons/catalogo-apple-touch-icon.png",
  appTitle: "Catálogo",
};

// Acha o elemento do <head> (ou cria, se a pagina ainda nao tem) e devolve
// como desfazer a troca do atributo.
function swap(selector, create, attribute, value) {
  let element = document.head.querySelector(selector);
  let created = false;
  if (!element) {
    element = create();
    document.head.appendChild(element);
    created = true;
  }
  const previous = element.getAttribute(attribute);
  element.setAttribute(attribute, value);
  return () => {
    if (created) element.remove();
    else if (previous === null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, previous);
  };
}

function make(tag, attributes) {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

export function applyCatalogIdentity() {
  const undo = [
    swap('link[rel="manifest"]', () => make("link", { rel: "manifest" }), "href", CATALOG.manifest),
    swap(
      'link[rel="apple-touch-icon"]',
      () => make("link", { rel: "apple-touch-icon" }),
      "href",
      CATALOG.appleIcon,
    ),
    swap(
      'meta[name="apple-mobile-web-app-title"]',
      () => make("meta", { name: "apple-mobile-web-app-title" }),
      "content",
      CATALOG.appTitle,
    ),
  ];
  return () => undo.forEach((restore) => restore());
}
