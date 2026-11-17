
import { ArrowRight, Heart, ShieldCheck, Stethoscope, FlaskConical } from 'lucide-react'

import fundo from '../assets/fundosessao.png'

export default function EtapaBoasVindas({ onAvancar }) {
  return (
    <main className="boas-vindas-pagina">

      <section className="boas-vindas-container">

        {/* CONTEÚDO */}
        <div className="boas-vindas-texto">

          <span className="boas-vindas-etiqueta">
            <Heart size={16} />
            Cuidado e economia para sua família
          </span>

          <h1>
            Você sabia que pode realizar consultas por apenas{' '}
            <strong>R$ 9,90?</strong>
          </h1>

          <p className="boas-vindas-descricao">
            Conheça uma maneira mais acessível de cuidar da sua saúde,
            com descontos em consultas e exames na rede participante.
          </p>

          <div className="hero-destaques">

            <span>
              <ShieldCheck size={18} />
              Carteirinha digital
            </span>

            <span>
              <Stethoscope size={18} />
              Rede de clínicas parceiras
            </span>

            <span>
              <FlaskConical size={18} />
              Descontos em exames
            </span>

          </div>

          <p className="boas-vindas-informacao">
            Vamos explicar como funciona, quais são os benefícios
            e qual modalidade combina com o que você procura.
          </p>

          <button
            type="button"
            className="boas-vindas-botao"
            onClick={onAvancar}
          >
            QUERO DESCOBRIR COMO
            <ArrowRight size={20} />
          </button>

          <p className="boas-vindas-observacao">
            Consulte as condições e especialidades participantes.
          </p>

        </div>

        {/* IMAGEM */}
        <div className="boas-vindas-imagem">

          <img
            src={fundo}
            alt="Mãe e filha sorrindo"
          />

          <div className="boas-vindas-imagem-legenda">
            <Heart size={20} />
            <span>
              Mais cuidado para quem você ama.
            </span>
          </div>

        </div>

      </section>

    </main>
  )
}
