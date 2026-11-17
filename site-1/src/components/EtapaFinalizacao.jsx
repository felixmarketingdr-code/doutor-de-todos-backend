
import {
  CheckCircle2,
  Heart,
  Stethoscope,
  ClipboardCheck,
  MessageCircle,
  Clock3,
  ShieldCheck,
  Zap,
  FileCheck,
} from 'lucide-react'

const WHATSAPP_NUMERO = '5511979944011'

export default function EtapaFinalizacao({ dados = {} }) {
  const pagamentoEnergia = dados.pagamento === 'energia'

  const pagamentoConfirmado = [
    'pago',
    'aprovado',
    'aprovada',
    'paid',
  ].includes(
    String(dados.statusPagamento || '').toLowerCase()
  )

  const cadastroRecebido = Boolean(dados.cadastroId)

  const statusContrato = String(
    dados.statusContrato || ''
  ).toLowerCase()

  const aguardandoAuditoria = [
    'pendente_auditoria',
    'em_analise',
    'pendente',
  ].includes(statusContrato)

  // ==========================================
  // DEFINIÇÃO DO CONTEÚDO
  // ==========================================

  let titulo = 'Cadastro recebido!'
  let descricao =
    'Recebemos seus dados. Nossa equipe dará continuidade ao processo de contratação.'

  let etiqueta = 'CADASTRO REALIZADO'

  if (pagamentoEnergia) {
    titulo = 'Seu cadastro foi recebido!'
    descricao =
      'Recebemos seus dados e as informações da sua conta de energia ENEL. Nossa equipe fará a conferência e dará continuidade ao processo de contratação.'

    etiqueta = 'AGUARDANDO ANÁLISE'
  } else if (pagamentoConfirmado) {
    titulo = 'Pagamento confirmado!'
    descricao =
      'Recebemos a confirmação do seu pagamento. Seu cadastro seguirá para conferência e auditoria contratual pela nossa equipe.'

    etiqueta = 'PAGAMENTO CONFIRMADO'
  } else {
    titulo = 'Cadastro recebido!'
    descricao =
      'Recebemos seus dados. Assim que o pagamento for confirmado, nossa equipe poderá dar continuidade ao processo.'

    etiqueta = 'AGUARDANDO PAGAMENTO'
  }

  // ==========================================
  // MENSAGEM DE STATUS
  // ==========================================

  const mensagemStatus = pagamentoEnergia
    ? 'Sua contratação está aguardando a conferência dos dados da conta ENEL e a análise da nossa equipe.'
    : pagamentoConfirmado
      ? 'Seu pagamento foi confirmado. Agora o contrato seguirá para auditoria administrativa.'
      : 'Aguardamos a confirmação do pagamento para dar continuidade à contratação.'

  // ==========================================
  // WHATSAPP
  // ==========================================

  const mensagemWhatsApp = encodeURIComponent(
    [
      'Olá! Fiz meu cadastro no site do Doutor de Todos.',
      '',
      `Nome: ${dados.nome || ''}`,
      `Protocolo: ${dados.cadastroId || ''}`,
      `Plano: ${(dados.plano || '').toUpperCase()}`,
      `Forma de pagamento: ${
        pagamentoEnergia ? 'ENEL' : 'Cartão'
      }`,
      '',
      'Gostaria de obter informações sobre o andamento da minha contratação.',
    ].join('\n')
  )

  const linkWhatsApp =
    `https://wa.me/${WHATSAPP_NUMERO}?text=${mensagemWhatsApp}`

  return (
    <main className="finalizacao-pagina">
      <section className="finalizacao-card">

        {/* ÍCONE PRINCIPAL */}

        <div className="finalizacao-icone">
          {pagamentoConfirmado ? (
            <CheckCircle2 size={54} />
          ) : (
            <Clock3 size={54} />
          )}
        </div>

        <span className="finalizacao-etiqueta">
          DOUTOR DE TODOS
        </span>

        <span className="finalizacao-status">
          {etiqueta}
        </span>

        <h1>{titulo}</h1>

        <p className="finalizacao-destaque">
          {descricao}
        </p>

        {/* PROTOCOLO */}

        {cadastroRecebido && (
          <div className="finalizacao-protocolo">
            <span>PROTOCOLO DO CADASTRO</span>
            <strong>{dados.cadastroId}</strong>
          </div>
        )}

        {/* RESUMO DA CONTRATAÇÃO */}

        <div className="finalizacao-resumo">
          <div>
            <span>Plano selecionado</span>
            <strong>
              {dados.plano?.toUpperCase() || 'Não informado'}
            </strong>
          </div>

          <div>
            <span>Forma de pagamento</span>
            <strong>
              {pagamentoEnergia
                ? 'Conta de energia ENEL'
                : 'Cartão de crédito'}
            </strong>
          </div>

          <div>
            <span>Status do pagamento</span>
            <strong>
              {pagamentoEnergia
                ? 'Pendente de análise'
                : pagamentoConfirmado
                  ? 'Pago'
                  : 'Pendente'}
            </strong>
          </div>

          <div>
            <span>Status do contrato</span>
            <strong>
              Aguardando auditoria
            </strong>
          </div>
        </div>

        {/* DADOS ENEL */}

        {pagamentoEnergia && (
          <div className="finalizacao-enel">
            <div className="finalizacao-enel-titulo">
              <Zap size={21} />
              <strong>Dados da conta ENEL recebidos</strong>
            </div>

            <div>
              <span>Titular</span>
              <strong>
                {dados.energia?.titular || dados.nome || 'Não informado'}
              </strong>
            </div>

            <div>
              <span>Número de instalação</span>
              <strong>
                {dados.energia?.numeroInstalacao || 'Não informado'}
              </strong>
            </div>

            <div>
              <span>Número do cliente</span>
              <strong>
                {dados.energia?.numeroCliente || 'Não informado'}
              </strong>
            </div>

            <small>
              Os dados serão conferidos pela equipe antes da continuidade
              da contratação.
            </small>
          </div>
        )}

        {/* BENEFÍCIOS */}

        <div className="finalizacao-beneficios">

          <div>
            <Stethoscope size={23} />
            <span>
              Acesso a consultas com valores especiais na rede participante.
            </span>
          </div>

          <div>
            <Heart size={23} />
            <span>
              Mais possibilidades para cuidar de você e da sua família.
            </span>
          </div>

          <div>
            <ClipboardCheck size={23} />
            <span>
              Nossa equipe acompanhará as próximas etapas da contratação.
            </span>
          </div>

        </div>

        {/* STATUS DA CONTRATAÇÃO */}

        <div className="finalizacao-aviso">
          {pagamentoConfirmado ? (
            <ShieldCheck size={21} />
          ) : (
            <FileCheck size={21} />
          )}

          <p>{mensagemStatus}</p>
        </div>

        {/* CONTATO */}

        <a
          className="finalizacao-whatsapp"
          href={linkWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={20} />
          FALAR COM NOSSA EQUIPE
        </a>

        <p className="finalizacao-rodape">
          Obrigado por escolher o Doutor de Todos!
        </p>

        <small className="finalizacao-disclaimer">
          O Doutor de Todos é um cartão de descontos em serviços de saúde.
          A utilização dos benefícios depende da confirmação da contratação,
          da conclusão dos procedimentos internos e das condições da rede participante.
        </small>

      </section>
    </main>
  )
}
