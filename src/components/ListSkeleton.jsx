/**
 * Esqueleto de lista: aparece NO LUGAR da lista assim que um filtro muda.
 * Assim a pessoa nunca ve itens do filtro anterior enquanto o novo carrega.
 *
 * `children` troca o texto de espera (ex.: aviso de servidor acordando).
 * `variant`: "books" (padrao) desenha a capa retangular do acervo; "people"
 * desenha a foto redonda e o numero da tela de Usuarios - a mesma forma do
 * `.personrow` de verdade, para a lista nao "pular" quando ele chega.
 */
export default function ListSkeleton({
  label = "Carregando…",
  children,
  variant = "books",
}) {
  if (variant === "people") {
    return (
      <>
        <ul className="peoplelist" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className="personrow pub__skelrow">
              <span className="pubskel pubskel__code" />
              <span className="pubskel pubskel__avatar" />
              <span className="personrow__text">
                <span className="pubskel pubskel__line pubskel__line--lg" />
                <span className="pubskel pubskel__line" />
              </span>
            </li>
          ))}
        </ul>
        <p className="muted pub__wait" role="status">
          {children || label}
        </p>
      </>
    );
  }

  return (
    <>
      <ul className="booklist" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <li key={index} className="bookrow pub__skelrow">
            <span className="pubskel pubskel__cover" />
            <span className="bookrow__text">
              <span className="pubskel pubskel__line pubskel__line--lg" />
              <span className="pubskel pubskel__line" />
              <span className="pubskel pubskel__line pubskel__line--sm" />
            </span>
          </li>
        ))}
      </ul>
      <p className="muted pub__wait" role="status">
        {children || label}
      </p>
    </>
  );
}
