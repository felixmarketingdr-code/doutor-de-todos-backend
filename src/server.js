
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const crypto = require('crypto')

require('dotenv').config()

// ==========================================
// IMPORTAÇÃO DAS ROTAS E SERVIÇOS
// ==========================================

const cadastroRoutes = require('./routes/cadastroRoutes')
const yampiCheckoutRoutes = require('./routes/yampiCheckout')

// ==========================================
// CONFIGURAÇÃO DOS PRODUTOS YAMPI
// ==========================================

const PLANOS_YAMPI = {
  '8Z2UCNMBJ': {
    nome: 'Doutor de Todos Light',
    plano: 'LIGHT',
  },

  '49223CFKN': {
    nome: 'Doutor de Todos Plus',
    plano: 'PLUS',
  },
}

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================

const app = express()

// ==========================================
// CONFIGURAÇÕES DE SEGURANÇA
// ==========================================

app.use(helmet())

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Yampi-Hmac-SHA256',
  ],
}))

// ==========================================
// RECEBIMENTO DO JSON
// Preserva o corpo original para validar
// a assinatura do webhook da Yampi
// ==========================================

app.use(express.json({
  limit: '1mb',

  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer)
  },
}))

// ==========================================
// ROTA DE SAÚDE
// ==========================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Doutor de Todos API',
    version: '1.0.0',
  })
})

// ==========================================
// ROTA DE CADASTRO
// POST /api/cadastros
// ==========================================

app.use('/api/cadastros', cadastroRoutes)

// ==========================================
// ROTA DE CHECKOUT YAMPI
// POST /api/yampi/checkout
// ==========================================

app.use('/api/yampi', yampiCheckoutRoutes)

// ==========================================
// WEBHOOK YAMPI
// POST /webhooks/yampi
// ==========================================

app.post('/webhooks/yampi', async (req, res) => {
  try {
    const secret = process.env.YAMPI_WEBHOOK_SECRET
    const signature = req.get('X-Yampi-Hmac-SHA256')

    // --------------------------------------
    // VERIFICAÇÃO DA CHAVE
    // --------------------------------------

    if (!secret) {
      console.error(
        'Chave secreta da Yampi não configurada.'
      )

      return res.status(503).json({
        received: false,
        error: 'Webhook não configurado.',
      })
    }

    // --------------------------------------
    // VERIFICAÇÃO DA ASSINATURA
    // --------------------------------------

    if (!signature || !req.rawBody) {
      return res.status(401).json({
        received: false,
        error: 'Assinatura ou conteúdo ausente.',
      })
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('base64')

    const receivedBuffer = Buffer.from(signature, 'base64')
    const expectedBuffer = Buffer.from(expectedSignature, 'base64')

    const assinaturaValida =
      receivedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )

    if (!assinaturaValida) {
      console.warn(
        'Webhook Yampi rejeitado: assinatura inválida.'
      )

      return res.status(401).json({
        received: false,
        error: 'Assinatura inválida.',
      })
    }

    // --------------------------------------
    // IDENTIFICAÇÃO DO EVENTO
    // --------------------------------------

    const { event, resource } = req.body || {}

    console.log('-----------------------------------')
    console.log('WEBHOOK YAMPI RECEBIDO')
    console.log('Evento:', event)
    console.log('-----------------------------------')

    // --------------------------------------
    // EVENTOS DIFERENTES DE PEDIDO PAGO
    // --------------------------------------

    if (event !== 'order.paid') {
      return res.status(200).json({
        received: true,
        processed: false,
        message: 'Evento recebido, sem processamento.',
      })
    }

    // --------------------------------------
    // VERIFICAÇÃO DA TRANSAÇÃO
    // --------------------------------------

    const transacoes = resource?.transactions?.data || []

    const pagamentoConfirmado = transacoes.some(
      (transacao) =>
        String(transacao.status || '').toLowerCase() === 'paid'
    )

    if (!pagamentoConfirmado) {
      console.warn(
        'Pedido recebido sem transação paga identificada.'
      )

      return res.status(200).json({
        received: true,
        processed: false,
        message: 'Pagamento não confirmado.',
      })
    }

    // --------------------------------------
    // IDENTIFICAÇÃO DO PRODUTO
    // --------------------------------------

    const itens = resource?.items?.data || []

    const produtoEncontrado = itens
      .map((item) => PLANOS_YAMPI[item.sku])
      .find(Boolean)

    if (!produtoEncontrado) {
      console.warn(
        'Pagamento aprovado, mas SKU não reconhecido.'
      )

      return res.status(200).json({
        received: true,
        processed: false,
        message: 'Produto não identificado.',
      })
    }

    // --------------------------------------
    // IDENTIFICAÇÃO DO PEDIDO
    // --------------------------------------

    const pedidoId = resource?.id || null

    // --------------------------------------
    // IDENTIFICAÇÃO DO CADASTRO
    // --------------------------------------

    const metadata =
      resource?.metadata?.data ||
      resource?.metadata ||
      {}

    const cadastroId =
      metadata.cadastro_id ||
      metadata['cadastro_id'] ||
      null

    // --------------------------------------
    // REGISTRO DO PAGAMENTO
    // --------------------------------------

    console.log('PAGAMENTO YAMPI APROVADO')
    console.log('Pedido:', pedidoId)
    console.log('Cadastro:', cadastroId || 'Não identificado')
    console.log('Plano:', produtoEncontrado.plano)
    console.log('Produto:', produtoEncontrado.nome)

    // --------------------------------------
    // INTEGRAÇÃO FUTURA COM GESTÃO
    // --------------------------------------

    // Nesta etapa ainda não atualizamos o Gestão.
    // Precisamos implementar o armazenamento permanente
    // dos cadastros e a associação do pedido ao cadastro.
    //
    // Não marcar o cliente como contratado apenas com
    // base neste log. A confirmação e a integração
    // precisam ser persistidas com idempotência.

    return res.status(200).json({
      received: true,
      processed: false,
      message: 'Pagamento validado. Integração com Gestão pendente.',
      pedidoId,
      cadastroId,
      plano: produtoEncontrado.plano,
    })

  } catch (error) {
    console.error(
      'Erro ao processar webhook Yampi:',
      error.message
    )

    return res.status(500).json({
      received: false,
      error: 'Erro interno ao processar webhook.',
    })
  }
})

// ==========================================
// ROTA NÃO ENCONTRADA
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada.',
    path: req.originalUrl,
  })
})

// ==========================================
// TRATAMENTO GLOBAL DE ERROS
// ==========================================

app.use((error, req, res, next) => {
  console.error(
    'Erro no servidor:',
    error.message
  )

  if (res.headersSent) {
    return next(error)
  }

  res.status(500).json({
    error: 'Erro interno do servidor.',
  })
})

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('')
  console.log('===================================')
  console.log('       DOUTOR DE TODOS API')
  console.log('===================================')
  console.log(`Servidor ativo na porta ${PORT}`)
  console.log(`Saúde: http://localhost:${PORT}/health`)
  console.log('Cadastro: /api/cadastros')
  console.log('Checkout: /api/yampi/checkout')
  console.log('Webhook: /webhooks/yampi')
  console.log('===================================')
  console.log(
    'Yampi configurada:',
    Boolean(process.env.YAMPI_WEBHOOK_SECRET)
  )
  console.log('')
})
