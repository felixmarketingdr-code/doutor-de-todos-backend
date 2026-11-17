
import { useState, useEffect } from 'react'

import Header from './components/Header'
import Progresso from './components/Progresso'
import Footer from './components/Footer'
import WhatsAppFlutuante from './components/WhatsAppFlutuante'

import EtapaBoasVindas from './components/EtapaBoasVindas'
import EtapaNecessidade from './components/EtapaNecessidade'
import EtapaPlanos from './components/EtapaPlanos'
import EtapaCadastro from './components/EtapaCadastro'
import CheckoutTransparente from './components/CheckoutTransparente'
import EtapaFinalizacao from './components/EtapaFinalizacao'

import './App.css'

// ==========================================
// CONFIGURAÇÃO DO PLANO BÁSICO
// ==========================================

const PLANO_BASICO = {
  id: 'light',
  nome: 'LIGHT',
  preco: '39,90',
  valor: 39.90,
  valorMensal: 39.90,
  periodicidade: 'mensal',
  dependentes: 4,

  consultas: {
    minimo: 39.90,
    maximo: 99.90,
  },

  descontoExames: 70,
}

// ==========================================
// CONFIGURAÇÃO DAS ETAPAS
// ==========================================

const TOTAL_ETAPAS = 6

function App() {

  // ==========================================
  // CONTROLE DAS ETAPAS
  // ==========================================

  const [etapa, setEtapa] = useState(1)

  // ==========================================
  // DADOS DO CLIENTE
  // ==========================================

  const [dadosCliente, setDadosCliente] = useState({

    // Plano e pagamento
    plano: '',
    pagamento: '',

    // Dados pessoais
    nome: '',
    cpf: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    email: '',

    // Endereço
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',

    // Necessidade do cliente
    necessidade: '',

    // Dados ENEL
    energia: {
      concessionaria: 'ENEL',
      numeroInstalacao: '',
      numeroCliente: '',
      titular: '',
    },

    // Controle do cadastro e pagamento
    cadastroId: '',
    pedidoPagarme: '',
    statusCadastro: 'iniciado',
    statusPagamento: 'pendente',
    statusContrato: 'pendente_auditoria',

    // Detalhes do plano
    planoDetalhes: null,
  })

  // ==========================================
  // ROLAGEM AO MUDAR DE ETAPA
  // ==========================================

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }, [etapa])

  // ==========================================
  // AVANÇAR
  // ==========================================

  const avancar = () => {

    setEtapa((atual) => {

      // ENEL: cadastro segue para finalização
      if (
        atual === 4 &&
        dadosCliente.pagamento === 'energia'
      ) {
        return 6
      }

      // Cartão: cadastro segue para checkout
      return Math.min(atual + 1, TOTAL_ETAPAS)
    })
  }

  // ==========================================
  // VOLTAR
  // ==========================================

  const voltar = () => {

    setEtapa((atual) => {

      // Retorno da finalização
      if (atual === 6) {
        return dadosCliente.pagamento === 'energia' ? 4 : 5
      }

      return Math.max(atual - 1, 1)
    })
  }

  // ==========================================
  // ATUALIZAR DADOS DO CLIENTE
  // ==========================================

  const atualizarDados = (novosDados) => {

    setDadosCliente((dadosAtuais) => {

      const atualizados = {
        ...dadosAtuais,
        ...novosDados,

        // Preserva os dados ENEL
        energia: novosDados.energia
          ? {
              ...dadosAtuais.energia,
              ...novosDados.energia,
            }
          : dadosAtuais.energia,
      }

      // Mantém os detalhes do plano sincronizados
      if (novosDados.plano === 'light') {
        atualizados.planoDetalhes = PLANO_BASICO
      }

      return atualizados
    })
  }

  // ==========================================
  // PAGAMENTO CONFIRMADO
  // ==========================================

  const pagamentoConfirmado = (dadosPagamento) => {

    setDadosCliente((dadosAtuais) => ({
      ...dadosAtuais,
      ...dadosPagamento,

      plano: dadosAtuais.plano || 'light',
      planoDetalhes: PLANO_BASICO,

      statusPagamento: 'pago',
      statusCadastro: 'pagamento_confirmado',
      statusContrato: 'pendente_auditoria',
    }))

    setEtapa(6)
  }

  // ==========================================
  // PROPRIEDADES DE NAVEGAÇÃO
  // ==========================================

  const navegacao = {
    onAvancar: avancar,
    onVoltar: etapa > 1 ? voltar : undefined,
  }

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <main className="pagina">

      {/* CABEÇALHO */}
      <Header />

      {/* PROGRESSO */}
      {etapa !== 6 && (
        <Progresso
          etapa={etapa === 5 ? 5 : etapa}
          total={5}
        />
      )}

      {/* CONTEÚDO DAS ETAPAS */}
      <div
        className="conteudo-etapa"
        key={etapa}
      >

        {/* ==================================
            ETAPA 1 - BOAS-VINDAS
        ================================== */}

        {etapa === 1 && (
          <EtapaBoasVindas
            {...navegacao}
            onContinuar={avancar}
            plano={PLANO_BASICO}
          />
        )}

        {/* ==================================
            ETAPA 2 - NECESSIDADE
        ================================== */}

        {etapa === 2 && (
          <EtapaNecessidade
            {...navegacao}
            dados={dadosCliente}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ==================================
            ETAPA 3 - ESCOLHA DO PLANO
        ================================== */}

        {etapa === 3 && (
          <EtapaPlanos
            {...navegacao}
            dados={dadosCliente}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ==================================
            ETAPA 4 - CADASTRO
        ================================== */}

        {etapa === 4 && (
          <EtapaCadastro
            {...navegacao}
            dados={dadosCliente}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ==================================
            ETAPA 5 - CHECKOUT TRANSPARENTE
        ================================== */}

        {etapa === 5 &&
          dadosCliente.pagamento === 'cartao' && (
            <CheckoutTransparente
              dados={dadosCliente}
              plano={PLANO_BASICO}
              onVoltar={() => setEtapa(4)}
              onPagamentoConfirmado={pagamentoConfirmado}
              onDadosChange={atualizarDados}
            />
          )}

        {/* ==================================
            ETAPA 6 - FINALIZAÇÃO
        ================================== */}

        {etapa === 6 && (
          <EtapaFinalizacao
            dados={dadosCliente}
            plano={PLANO_BASICO}
          />
        )}

      </div>

      {/* RODAPÉ */}
      <Footer />

      {/* WHATSAPP */}
      {etapa !== 6 && (
        <WhatsAppFlutuante />
      )}

    </main>
  )
}

export default App
