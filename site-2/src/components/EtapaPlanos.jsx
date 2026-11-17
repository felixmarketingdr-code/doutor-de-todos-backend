
import { useState } from 'react'

import {
  Check,
  CreditCard,
  Zap,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  LockKeyhole,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react'

// ======================================================
// PLANOS DISPONÍVEIS
// ======================================================

const planos = [
  {
    id: 'light',
    nome: 'LIGHT',
    preco: '39,90',
    adesao: '99,90',
    
    totalAnual: '578,70',
    parcelas: null,
    descricao: 'Uma opção econômica para cuidar da saúde.',
    beneficios: [
      'Titular + até 4 dependentes',
      'Consultas de R$ 39,90 a R$ 99,90',
      'Descontos em exames participantes',
      'Acesso à rede credenciada',
    ],
  },
  {
    id: 'plus',
    nome: 'PLUS',
    preco: '79,90',
    adesao: null,
    totalAnual: '958,80',
    parcelas: '12x de R$ 79,90',
    descricao: 'Mais economia nas consultas do titular.',
    destaque: true,
    beneficios: [
      'Plano individual para o titular',
      'Consultas por R$ 9,90 para o titular nas especialidades participantes',
      'Descontos em exames participantes',
      'Acesso à rede credenciada',
    ],
  },
]

// ======================================================
// FORMAS DE PAGAMENTO
// ======================================================

const pagamentos = [
  {
    id: 'cartao',
    nome: 'Cartão de crédito',
    descricao: 'Pagamento rápido, simples e seguro.',
    Icone: CreditCard,
  },
  {
    id: 'energia',
    nome: 'Conta de energia',
    descricao: 'Consulte a disponibilidade para sua região.',
    Icone: Zap,
  },
]

// ======================================================
// COMPONENTE
// ======================================================

export default function EtapaPlanos({
  onVoltar,
  onAvancar,
  dados,
  onDadosChange,
}) {
  const [avancando, setAvancando] = useState(false)

  const planoSelecionado = dados?.plano || ''
  const pagamentoSelecionado = dados?.pagamento || ''

  const planoAtual = planos.find(
    (plano) => plano.id === planoSelecionado
  )

  const pagamentoAtual = pagamentos.find(
    (pagamento) => pagamento.id === pagamentoSelecionado
  )

  // ====================================================
  // SELECIONAR PLANO
  // ====================================================

  const selecionarPlano = (plano) => {
    setAvancando(false)

    onDadosChange({
      plano: plano.id,
    })
  }

  // ====================================================
  // SELECIONAR FORMA DE PAGAMENTO
  // ====================================================

  const selecionarPagamento = (pagamentoId) => {
    setAvancando(false)

    onDadosChange({
      pagamento: pagamentoId,
    })
  }

  // ====================================================
  // AVANÇAR PARA CADASTRO
  // ====================================================

  const continuarParaCadastro = () => {
    if (!planoAtual || !pagamentoAtual || avancando) {
      return
    }

    onDadosChange({
      plano: planoAtual.id,
      pagamento: pagamentoAtual.id,
    })

    setAvancando(true)

    onAvancar()
  }

  // ====================================================
  // RENDERIZAÇÃO
  // ====================================================

  return (
    <main className="planos-pagina">
      <div className="planos-container">

        {/* CABEÇALHO */}

        <header className="planos-cabecalho">
          <span className="planos-etiqueta">
            SUA ESCOLHA COMEÇA AQUI
          </span>

          <h1>Escolha o plano ideal para você</h1>

          <p>
            Compare as opções, escolha seu plano e a forma de pagamento.
            Em seguida, você preencherá seus dados para concluir a contratação.
          </p>
        </header>

        {/* ESCOLHA DOS PLANOS */}

        <section className="planos-lista">

          {planos.map((plano) => {
            const selecionado = planoSelecionado === plano.id

            return (
              <article
                key={plano.id}
                className={[
                  'plano-card',
                  plano.destaque ? 'plano-card-destaque' : '',
                  selecionado ? 'selecionado' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >

                {plano.destaque && (
                  <span className="plano-selo">
                    MAIS ECONOMIA
                  </span>
                )}

                <span className="plano-nome">
                  PLANO {plano.nome}
                </span>

                <p className="plano-descricao">
                  {plano.descricao}
                </p>

                <div className="plano-preco">
                  <span className="plano-preco-moeda">
                    R$
                  </span>

                  <strong className="plano-preco-valor">
                    {plano.preco}
                  </strong>

                  <span className="plano-preco-periodo">
                    / mês
                  </span>
                </div>

                {/* TAXA DE ADESÃO LIGHT */}

                {plano.adesao && (
                  <div className="plano-adesao">
                    <span>Taxa única de adesão </span>

                    <strong>
                      R$ {plano.adesao}
                    </strong>

                    <small>
                      
                    </small>
                  </div>
                )}

                {/* VALOR DA CONTRATAÇÃO */}

                <div className="plano-primeira-cobranca">
                  <span>
                    {plano.id === 'light'
                      ? ''
                      : ''}
                  </span>

                  <strong>
                     {plano.primeiraCobranca}
                  </strong>

                  <small>
                    {plano.id === 'light'
                      ? ''
                      : ''}
                  </small>
                </div>

                <div className="plano-divisor" />

                <span className="plano-beneficios-titulo">
                  O que está incluído:
                </span>

                <ul className="plano-beneficios">
                  {plano.beneficios.map((beneficio) => (
                    <li key={beneficio}>
                      <Check size={17} />
                      <span>{beneficio}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="plano-botao"
                  onClick={() => selecionarPlano(plano)}
                  aria-pressed={selecionado}
                >
                  {selecionado ? (
                    <>
                      <Check size={17} />
                      PLANO SELECIONADO
                    </>
                  ) : (
                    'ESCOLHER ESTE PLANO'
                  )}
                </button>

              </article>
            )
          })}

        </section>

        {/* FORMA DE PAGAMENTO */}

        <section className="pagamento-secao">

          <div className="pagamento-cabecalho">
            <span className="pagamento-etiqueta">
              PRÓXIMA ESCOLHA
            </span>

            <h2>Como deseja realizar o pagamento?</h2>

            <p>
              Escolha uma das modalidades disponíveis.
              Depois, você preencherá seus dados para continuar.
            </p>
          </div>

          <div className="pagamento-opcoes">

            {pagamentos.map((pagamento) => {
              const selecionado =
                pagamentoSelecionado === pagamento.id

              const Icone = pagamento.Icone

              return (
                <button
                  key={pagamento.id}
                  type="button"
                  className={[
                    'pagamento-opcao',
                    selecionado ? 'selecionado' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    selecionarPagamento(pagamento.id)
                  }
                  aria-pressed={selecionado}
                >
                  <div className="pagamento-icone">
                    <Icone size={25} />
                  </div>

                  <div className="pagamento-texto">
                    <strong>{pagamento.nome}</strong>
                    <span>{pagamento.descricao}</span>
                  </div>

                  <div className="pagamento-selecao">
                    {selecionado && <Check size={16} />}
                  </div>
                </button>
              )
            })}

          </div>

          {/* MENSAGEM DO CARTÃO */}

          {pagamentoSelecionado === 'cartao' && (
            <div className="pagamento-mensagem-cartao">
              <div className="pagamento-mensagem-icone">
                <LockKeyhole size={23} />
              </div>

              <div>
                <strong>
                  Pagamento seguro pelo Pagar.me
                </strong>

                <p>
                  Primeiro você preencherá seu cadastro.
                  Depois, realizará o pagamento diretamente
                  no checkout seguro do nosso site.
                </p>
              </div>
            </div>
          )}

          {/* MENSAGEM DA CONTA DE ENERGIA */}

          {pagamentoSelecionado === 'energia' && (
            <div className="pagamento-mensagem-energia">
              <div className="pagamento-mensagem-icone">
                <MessageCircle size={23} />
              </div>

              <div>
                <strong>
                  Prefere pagar pela conta de energia?
                </strong>

                <p>
                  Após preencher seus dados, será realizada
                  a análise de disponibilidade e elegibilidade
                  para essa modalidade.
                </p>
              </div>
            </div>
          )}

          <p className="pagamento-observacao">
            A contratação pela conta de energia depende
            de disponibilidade e critérios de elegibilidade.
          </p>

        </section>

        {/* RESUMO DA ESCOLHA */}

        <section className="resumo-escolha">

          <div className="resumo-cabecalho">
            <ShieldCheck size={22} />

            <div>
              <h3>Resumo da sua escolha</h3>
              <p>Confira as opções selecionadas.</p>
            </div>
          </div>

          <div className="resumo-linha">
            <span>Plano</span>

            <strong>
              {planoAtual
                ? `Plano ${planoAtual.nome}`
                : 'Nenhum plano selecionado'}
            </strong>
          </div>

          <div className="resumo-linha">
            <span>Mensalidade</span>

            <strong>
              {planoAtual
                ? `R$ ${planoAtual.preco}`
                : 'Aguardando escolha'}
            </strong>
          </div>

          {planoAtual?.adesao && (
            <div className="resumo-linha">
              <span>Taxa única de adesão</span>
              <strong>R$ {planoAtual.adesao}</strong>
            </div>
          )}

          {planoAtual && (
            <>
              <div className="resumo-linha">
                <span>
                  {}
                </span>

                <strong>
                   
                </strong>
              </div>

              <div className="resumo-linha">
                <span>
                  {planoAtual.id === 'light'
                    ? 'Total correspondente aos primeiros 12 meses'
                    : 'Parcelamento no cartão'}
                </span>

                <strong>
                  {planoAtual.id === 'light'
                    ? `R$ ${planoAtual.totalAnual}`
                    : planoAtual.parcelas}
                </strong>
              </div>
            </>
          )}

          <div className="resumo-linha">
            <span>Pagamento</span>

            <strong>
              {pagamentoAtual
                ? pagamentoAtual.nome
                : 'Aguardando escolha'}
            </strong>
          </div>

        </section>

        {/* CONTINUAR PARA CADASTRO */}

        <section className="planos-finalizar">

          <button
            type="button"
            className="planos-botao-whatsapp"
            onClick={continuarParaCadastro}
            disabled={
              !planoAtual ||
              !pagamentoAtual ||
              avancando
            }
          >
            CONTINUAR PARA CADASTRO
            <ArrowRight size={18} />
          </button>

          {(!planoAtual || !pagamentoAtual) && (
            <p className="planos-ajuda">
              Selecione um plano e uma forma de pagamento
              para continuar.
            </p>
          )}

         
{/* AVISO DO CARTÃO */}
{pagamentoSelecionado === 'cartao' && planoAtual && (
  <div className="planos-aviso-anual">

    <div className="planos-aviso-cabecalho">
      <div className="planos-aviso-icone">
        <ShieldCheck size={23} />
      </div>

      <div>
        <strong>
          Confira as condições da sua contratação
        </strong>

        <span>
          Transparência antes de confirmar o pagamento
        </span>
      </div>
    </div>

    <div className="planos-aviso-identificacao">
      Você selecionou o{' '}
      <strong>Plano {planoAtual.nome}</strong>.
    </div>

    <div className="planos-aviso-valores">

      {planoAtual.id === 'light' ? (
        <>
          <div className="planos-aviso-valor">
            <span>Primeiro pagamento</span>
            <strong>R$ 139,80</strong>
          </div>

          <div className="planos-aviso-valor">
            <span>Primeira mensalidade</span>
            <strong>R$ 39,90</strong>
          </div>

          <div className="planos-aviso-valor">
            <span>Taxa única de adesão</span>
            <strong>R$ 99,90</strong>
          </div>

          <div className="planos-aviso-valor planos-aviso-total">
            <span>Demais mensalidades</span>
            <strong>R$ 39,90/mês</strong>
          </div>
        </>
      ) : (
        <div className="planos-aviso-valor planos-aviso-total">
          <span>Valor total no cartão</span>
          <strong>R$ 958,80</strong>
        </div>
      )}

    </div>

    <div className="planos-aviso-duracao">
      <CheckCircle2 size={19} />

      <p>
        {planoAtual.id === 'light' ? (
          <>
            Na contratação do Plano Light, o primeiro
            pagamento será de <strong>R$ 139,80</strong>,
            composto por R$ 39,90 da primeira mensalidade
            e R$ 99,90 da taxa única de adesão.
            Após esse pagamento, as demais mensalidades
            serão recorrentes no valor de
            <strong> R$ 39,90 por mês</strong>.
          </>
        ) : (
          <>
            No Plano Plus, o valor total da contratação é
            de <strong>R$ 958,80</strong>, dividido em
            <strong> 12 parcelas de R$ 79,90 </strong>
            no cartão de crédito.
          </>
        )}
      </p>
    </div>

    <div className="planos-aviso-seguranca">
      <LockKeyhole size={20} />

      <p>
        <strong>Pagamento seguro</strong>
        O pagamento será realizado pelo checkout
        integrado ao Pagar.me, dentro do fluxo
        de contratação do site.
      </p>
    </div>

  </div>
)}

{/* AVISO DA CONTA DE ENERGIA */}
{pagamentoSelecionado === 'energia' && (
  <p className="planos-aviso">
    Após preencher seus dados, sua contratação
    seguirá para análise de disponibilidade e
    elegibilidade da modalidade de conta de energia.
  </p>
)}

</section>


        {/* VOLTAR */}

        {onVoltar && (
          <button
            type="button"
            className="planos-voltar"
            onClick={onVoltar}
          >
            <ArrowLeft size={16} />
            Voltar para a apresentação
          </button>
        )}

      </div>
    </main>
  )
}
