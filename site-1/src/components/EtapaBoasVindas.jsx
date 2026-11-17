
import './EtapaBoasVindas.css'
import hero from '../assets/carteirinha-whatsapp.png'

export default function EtapaBoasVindas({ onContinuar }) {
  return (
    <div className="landing-basic">

      {/* CONTEÚDO PRINCIPAL */}
      <main className="basic-main">

        <section className="basic-copy">

          <div className="basic-tag">
            <span>♡</span>
            Cuidado e economia para sua família
          </div>

          <h1>
            Sua família pode ter mais acesso à saúde por apenas
            <span> R$ 39,90 por mês!</span>
          </h1>

          <p className="basic-description">
            Com a Carteirinha Doutor de Todos, você economiza
            em consultas, exames e ainda pode incluir até
            quatro dependentes.
          </p>

          {/* BENEFÍCIOS */}
          <div className="basic-features">

            <div>
              <span>✓</span>
              Consultas de R$ 39,90 a R$ 99,90
            </div>

            <div>
              <span>✓</span>
              Até 4 dependentes associados
            </div>

            <div>
              <span>✓</span>
              Até 70% de desconto em exames
            </div>

            <div>
              <span>✓</span>
              Benefícios para toda a família
            </div>

          </div>

          <p className="basic-observation">
            Uma maneira mais econômica de cuidar de quem você ama,
            com benefícios que ajudam a economizar no dia a dia.
          </p>

          {/* BOTÃO */}
          <button
            type="button"
            className="basic-cta"
            onClick={onContinuar}
          >
            QUERO CONHECER O PLANO
            <span>→</span>
          </button>

          <small className="basic-cta-note">
            Conheça as condições e avance para sua contratação.
          </small>

        </section>

        {/* IMAGEM DA FAMÍLIA */}
        <section className="basic-visual">

          <div className="basic-image-decoration"></div>

          <img
            src={hero}
            alt="Família com a carteirinha Doutor de Todos"
            loading="eager"
          />

          

        </section>

      </main>

    </div>
  )
}
