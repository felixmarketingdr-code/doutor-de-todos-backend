
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

const TOTAL_ETAPAS = 6

function App() {
  const [etapa, setEtapa] = useState(1)

  const [dadosCliente, setDadosCliente] = useState({
    plano: '',
    pagamento: '',
    nome: '',
    cpf: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    email: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',

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
    setEtapa(atual => {
      // ENEL: cadastro vai diretamente para finalização
      if (
        atual === 4 &&
        dadosCliente.pagamento === 'energia'
      ) {
        return 6
      }

      // Cartão: cadastro vai para checkout
      return Math.min(atual + 1, TOTAL_ETAPAS)
    })
  }

  // ==========================================
  // VOLTAR
  // ==========================================

  const voltar = () => {
    setEtapa(atual => {
      if (atual === 6) {
        return dadosCliente.pagamento === 'energia' ? 4 : 5
      }

      return Math.max(atual - 1, 1)
    })
  }

  // ==========================================
  // ATUALIZAR DADOS DO CLIENTE
  // ==========================================

  const atualizarDados = novosDados => {
    setDadosCliente(dadosAtuais => ({
      ...dadosAtuais,
      ...novosDados,

      // Preserva os dados ENEL quando houver atualização parcial
      energia: novosDados.energia
        ? {
            ...dadosAtuais.energia,
            ...novosDados.energia,
          }
        : dadosAtuais.energia,
    }))
  }

  // ==========================================
  // PAGAMENTO CONFIRMADO
  // ==========================================

  const pagamentoConfirmado = dadosPagamento => {
    setDadosCliente(dadosAtuais => ({
      ...dadosAtuais,
      ...dadosPagamento,
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
      <Header />

      {etapa !== 6 && (
        <Progresso
          etapa={etapa === 5 ? 5 : etapa}
          total={5}
        />
      )}

      <div className="conteudo-etapa" key={etapa}>

        {/* ETAPA 1 - BOAS-VINDAS */}

        {etapa === 1 && (
          <EtapaBoasVindas {...navegacao} />
        )}

        {/* ETAPA 2 - NECESSIDADE */}

        {etapa === 2 && (
          <EtapaNecessidade {...navegacao} />
        )}

        {/* ETAPA 3 - PLANOS */}

        {etapa === 3 && (
          <EtapaPlanos
            {...navegacao}
            dados={dadosCliente}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ETAPA 4 - CADASTRO */}

        {etapa === 4 && (
          <EtapaCadastro
            {...navegacao}
            dados={dadosCliente}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ETAPA 5 - CHECKOUT TRANSPARENTE */}

        {etapa === 5 && dadosCliente.pagamento === 'cartao' && (
          <CheckoutTransparente
            dados={dadosCliente}
            onVoltar={() => setEtapa(4)}
            onPagamentoConfirmado={pagamentoConfirmado}
            onDadosChange={atualizarDados}
          />
        )}

        {/* ETAPA 6 - FINALIZAÇÃO */}

        {etapa === 6 && (
          <EtapaFinalizacao
            dados={dadosCliente}
          />
        )}

      </div>

      <Footer />

      {etapa !== 6 && (
        <WhatsAppFlutuante />
      )}
    </main>
  )
}

export default App
