export default function Progresso({ etapa, totalEtapas = 3 }) {
  const porcentagem = (etapa / totalEtapas) * 100

  return (
    <section className="progresso-container">
      <div className="progresso-informacoes">
        <span>Conheça a Doutor de Todos</span>

        <strong>
          Etapa {etapa} de {totalEtapas}
        </strong>
      </div>

      <div
        className="progresso-trilho"
        role="progressbar"
        aria-label="Progresso da apresentação"
        aria-valuemin={0}
        aria-valuemax={totalEtapas}
        aria-valuenow={etapa}
      >
        <div
          className="progresso-preenchimento"
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      <span className="progresso-legenda">
        Você está a caminho de conhecer todos os benefícios!
      </span>
    </section>
  )
}