
import {
  Heart,
  Wallet,
  Smartphone,
  Stethoscope,
  FlaskConical,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Info,
  BadgeCheck,
  CreditCard,
  UserRound,
  Calculator,
} from 'lucide-react'

import familia from '../assets/comparativo-fundo.png'

function EtapaNecessidade({ onAvancar, onVoltar }) {
  return (
    <main className="necessidade-pagina">

      {/* 1. APRESENTAÇÃO */}
      <section className="necessidade-faixa">
  <div className="necessidade-faixa-imagem">
    <img src={familia} alt="Família" />
  </div>

  <div className="necessidade-faixa-conteudo">

          <span className="necessidade-etiqueta">
            <Sparkles size={16} />
            Cuidar da saúde pode caber no seu bolso
          </span>

          <h1>
            E se você pudesse economizar nas consultas e nos exames?
          </h1>

          <p>
            Muitas pessoas acabam adiando os cuidados com a saúde
            por causa dos custos. O Doutor de Todos oferece uma
            alternativa: um cartão de descontos para ajudar você
            a encontrar condições especiais na rede participante.
          </p>

          <button
            type="button"
            className="necessidade-botao"
            onClick={() =>
              document.getElementById('como-funciona')?.scrollIntoView({
                behavior: 'smooth',
              })
            }
          >
            ENTENDA COMO FUNCIONA
            <ArrowRight size={19} />
          </button>

          <span className="necessidade-faixa-observacao">
            Conheça o funcionamento, os exemplos e as modalidades.
          </span>

        </div>
      </section>

      {/* 2. O QUE É O CARTÃO */}
      <section
        className="necessidade-apresentacao"
        id="como-funciona"
      >
        <div className="necessidade-secao-cabecalho">

          <span className="necessidade-mini-etiqueta">
            PRIMEIRO, VAMOS ENTENDER
          </span>

          <h2 className="necessidade-titulo-secao">
            O que é o Doutor de Todos?
          </h2>

          <p>
            O Doutor de Todos é um cartão de descontos em serviços
            de saúde. Ao contratar uma modalidade, você passa a ter
            acesso à Descontos oferecidos pela rede participante.
          </p>

          <p>
            Na prática, você utiliza sua carteirinha para se
            identificar e aproveitar os valores diferenciados
            disponíveis para o seu cadastro.
          </p>

        </div>

        <div className="necessidade-explicacao-grid">

          <article className="necessidade-explicacao-card">
            <div className="necessidade-explicacao-icone">
              <Stethoscope size={26} />
            </div>

            <h3>Consultas médicas</h3>

            <p>
              Você encontra consultas com valores especiais
              nas clínicas e especialidades participantes de R$ 9,90 no Plus e R$ 39,90 a 99,90 no plano Light.
            </p>
          </article>

          <article className="necessidade-explicacao-card">
            <div className="necessidade-explicacao-icone">
              <FlaskConical size={26} />
            </div>

            <h3>Exames</h3>

            <p>
              Pode aproveitar descontos em exames de 70% disponíveis
              na rede participante.
            </p>
          </article>

          <article className="necessidade-explicacao-card">
            <div className="necessidade-explicacao-icone">
              <Users size={26} />
            </div>

            <h3>Opções para a família</h3>

            <p>
              O plano Light permite incluir dependentes.
              Confira as diferenças entre as modalidades.
            </p>
          </article>

        </div>

        <div/>

      </section>

      
      {/* 4. EXEMPLOS PRÁTICOS */}
      <section className="necessidade-beneficios">

        <div className="necessidade-secao-cabecalho">

          <span className="necessidade-mini-etiqueta">
            
          </span>

          <h2 className="necessidade-titulo-secao">
            Veja como os descontos funcionam na prática
          </h2>

          <p>
          </p>

        </div>

        <div className="necessidade-beneficios-grid">

          <article className="necessidade-beneficio-card">
            <div className="necessidade-beneficio-icone">
              <UserRound size={27} />
            </div>

            <h3>Plano Light</h3>

            <p>
              Imagine que você precise marcar uma consulta.
              No Light, os valores ficam entre R$ 39,90 e
              R$ 99,90, conforme a especialidade e a clínica.
            </p>

            <strong></strong>
          </article>

          <article className="necessidade-beneficio-card">
            <div className="necessidade-beneficio-icone">
              <BadgeCheck size={27} />
            </div>

            <h3>Plano Plus</h3>

            <p>
              Se você for o titular do Plus, poderá realizar
              consultas por R$ 9,90 nas dez especialidades
              participantes, respeitando as condições do serviço.
            </p>

            <strong></strong>
          </article>

          <article className="necessidade-beneficio-card">
            <div className="necessidade-beneficio-icone">
              <FlaskConical size={27} />
            </div>

            <h3>Exames</h3>

            <p>
              Imagine um exame que custa R$ 200,00 na tabela
              normal da Clinica. Com 50% de desconto,
              ele sairia por R$ 100,00. Com 70%, por R$ 60,00.
            </p>

            <strong></strong>
          </article>


        </div>

      </section>

      {/* 5. ESPECIALIDADES DO PLUS */}
      <section className="necessidade-apresentacao">

        <div className="necessidade-secao-cabecalho">

          <span className="necessidade-mini-etiqueta">
            ESPECIALIDADES PARTICIPANTES
          </span>

          <h2 className="necessidade-titulo-secao">
            Quais especialidades são o valor de R$ 9,90?
          </h2>

          <p>
            No plano Plus, o titular tem acesso ao valor de
            R$ 9,90 por consulta nas especialidades participantes
            abaixo, conforme disponibilidade da rede.
          </p>

        </div>

        <div className="necessidade-explicacao-grid">

          {[
            'Clínica geral',
            'Ginecologia',
            'Pediatria',
            'Cardiologia',
            'Otorrinolaringologia',
            'Ortopedia',
            'Geriatria',
            'Gastroenterologia',
            'Urologia',
            'Dermatologia',
          ].map((especialidade) => (
            <article
              className="necessidade-explicacao-card"
              key={especialidade}
            >
              <div className="necessidade-explicacao-icone">
                <CheckCircle2 size={24} />
              </div>

              <h3>{especialidade}</h3>
            </article>
          ))}

        </div>

        <div className="necessidade-aviso">
          <Info size={21} />

          <span>
            O valor de R$ 9,90 é exclusivo para o titular do
            plano Plus. Não se aplica automaticamente aos
            dependentes ou a outras especialidades.
          </span>
        </div>

      </section>

      {/* 6. DIFERENÇAS ENTRE OS PLANOS */}
      <section className="necessidade-economia">

        <div className="necessidade-secao-cabecalho">

          <span className="necessidade-mini-etiqueta">
            AGORA, VAMOS ÀS MODALIDADES
          </span>

          <h2 className="necessidade-titulo-secao">
            Qual plano combina com você?
          </h2>

          <p>
            As duas modalidades oferecem acesso às condições
            do cartão. A principal diferença está no valor
            das consultas e na possibilidade de incluir familiares.
          </p>

        </div>

        <div className="necessidade-economia-grid">

          <article className="necessidade-economia-card">

            <div className="necessidade-plano-icone">
              <Users size={25} />
            </div>

            <h3>Plano Light</h3>

            <strong>R$ 39,90/mês</strong>

            <p>
              Uma opção para quem deseja ter acesso a condições
              especiais em consultas e exames e também incluir
              familiares.
            </p>

            <div className="necessidade-carteirinha-lista">
              <div>
                <CheckCircle2 size={19} />
                <span>Titular + até 4 dependentes.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Consultas de R$ 39,90 a R$ 99,90.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Descontos em exames participantes.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Valores conforme especialidade e clínica.</span>
              </div>
            </div>

          </article>

          <article className="necessidade-economia-card">

            <div className="necessidade-plano-icone">
              <BadgeCheck size={25} />
            </div>

            <h3>Plano Plus</h3>

            <strong>R$ 79,90/mês</strong>

            <p>
              Uma opção individual para quem deseja aproveitar
              o valor especial de R$ 9,90 nas consultas do titular
              nas especialidades participantes.
            </p>

            <div className="necessidade-carteirinha-lista">
              <div>
                <CheckCircle2 size={19} />
                <span>Plano individual, para o titular.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Consultas do titular por R$ 9,90.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Dez especialidades participantes.</span>
              </div>

              <div>
                <CheckCircle2 size={19} />
                <span>Descontos em exames participantes.</span>
              </div>
            </div>

          </article>

        </div>

      </section>

      {/* 7. CHAMADA FINAL */}
      <section className="necessidade-convite">

        <div className="necessidade-convite-icone">
          <Heart size={30} />
        </div>

        <span className="necessidade-mini-etiqueta">
          ESCOLHA SUA MODALIDADE
        </span>

        <h2>
          Agora você já sabe como funciona!
        </h2>

        <p>
          Você conheceu o cartão, entendeu para que serve
          a carteirinha e viu exemplos das condições oferecidas.
          Agora, compare as modalidades e escolha a que faz
          mais sentido para você.
        </p>

        <button
          type="button"
          className="necessidade-botao"
          onClick={onAvancar}
        >
          ESCOLHER MEU PLANO
          <ArrowRight size={19} />
        </button>

      </section>

      {/* VOLTAR */}
      <div className="necessidade-voltar">

        <button
          type="button"
          onClick={onVoltar}
        >
          <ArrowLeft size={17} />
          Voltar
        </button>

      </div>

    </main>
  )
}

export default EtapaNecessidade
