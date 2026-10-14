/**
 * Esqueleto de FORMULARIO: entra no lugar de uma tela de EDICAO enquanto os
 * dados dela nao chegam (ex.: Configuracoes > Minha conta).
 *
 * Por que nao serve o ListSkeleton: ele desenha linhas com capa e espaco de
 * titulo, ou seja, promete uma LISTA de itens - e o que aparece depois e um
 * formulario, que nao tem nada a ver. O esqueleto precisa ter a forma do que
 * esta chegando: a foto redonda, os campos e o botao de salvar.
 *
 * As classes .pubskel e .pub__wait sao as mesmas do esqueleto de lista (o
 * brilho e o texto de espera): o prefixo nasceu no acervo publico, mas as duas
 * valem para qualquer tela - e melhor reaproveitar do que ter dois brilhos
 * parecidos para manter.
 *
 * Props:
 *  - label: o texto de espera que fica embaixo
 *  - fields: quantos campos desenhar (padrao 4)
 *  - hints: indices dos campos (0 = o primeiro) que levam uma linha de dica
 *    embaixo, como os de verdade - e o que faz o formulario entrar no lugar
 *    sem a tela dar um salto
 *  - photo: desenhar a foto redonda no topo (padrao sim)
 */
export default function FormSkeleton({
  label = "Carregando…",
  fields = 4,
  hints = [],
  photo = true,
}) {
  return (
    <>
      <div className="card form formskel" aria-hidden="true">
        {photo ? (
          <div className="formskel__photo">
            <span className="pubskel formskel__avatar" />
          </div>
        ) : null}

        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="formskel__field">
            <span className="pubskel formskel__label" />
            <span className="pubskel formskel__input" />
            {hints.includes(index) ? (
              <span className="pubskel formskel__hint" />
            ) : null}
          </div>
        ))}

        <span className="pubskel formskel__button" />
      </div>
      <p className="muted pub__wait" role="status">
        {label}
      </p>
    </>
  );
}
