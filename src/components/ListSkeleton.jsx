/**
 * Esqueleto de lista: aparece NO LUGAR da lista assim que um filtro muda.
 * Assim a pessoa nunca ve itens do filtro anterior enquanto o novo carrega.
 *
 * `children` troca o texto de espera (ex.: aviso de servidor acordando).
 */
export default function ListSkeleton({ label = "Carregando…", children }) {
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
