
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

require('dotenv').config()

// ==========================================
// IMPORTAÇÃO DAS ROTAS
// ==========================================

const cadastroRoutes = require('./routes/cadastroRoutes')
const pagarmeCheckoutRoutes = require('./routes/pagarmeCheckout')
const pagarmeWebhookRoutes = require('./routes/pagarmeWebhook')

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================

const app = express()

app.disable('x-powered-by')

// ==========================================
// SEGURANÇA
// ==========================================

app.use(helmet())

// ==========================================
// CONFIGURAÇÃO DE CORS
// ==========================================

const origensPermitidas = (
  process.env.FRONTEND_URL ||
  'https://doutordetodos.netlify.app,http://localhost:5173'
)
  .split(',')
  .map((origem) => origem.trim().replace(/\/$/, ''))
  .filter(Boolean)

// Permite ambiente local de desenvolvimento.
if (!origensPermitidas.includes('http://localhost:5173')) {
  origensPermitidas.push('http://localhost:5173')
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite chamadas sem origem, como integrações servidor-servidor.
      if (!origin) {
        return callback(null, true)
      }

      const origem = origin.replace(/\/$/, '')

      if (origensPermitidas.includes(origem)) {
        return callback(null, true)
      }

      console.warn('Origem bloqueada pelo CORS:', origem)

      return callback(
        new Error('Origem não autorizada pelo CORS.')
      )
    },

    methods: ['GET', 'POST', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],

    credentials: false,
    optionsSuccessStatus: 204,
  })
)

// ==========================================
// RECEBIMENTO DO JSON
// Preserva o corpo original para validações
// do webhook, se necessário.
// ==========================================

app.use(
  express.json({
    limit: '1mb',

    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer)
    },
  })
)

// ==========================================
// ROTA DE SAÚDE
// GET /health
// ==========================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Doutor de Todos API',
    gateway: 'Pagar.me',
    version: '2.0.0',
  })
})

// ==========================================
// ROTAS DE CADASTRO
// POST /api/cadastros
// ==========================================

app.use('/api/cadastros', cadastroRoutes)

// ==========================================
// CHECKOUT PAGAR.ME
// POST /api/pagarme/checkout
// ==========================================

app.use('/api/pagarme', pagarmeCheckoutRoutes)

// ==========================================
// WEBHOOK PAGAR.ME
// POST /webhooks/pagarme
// ==========================================

app.use('/webhooks/pagarme', pagarmeWebhookRoutes)

// ==========================================
// ROTA NÃO ENCONTRADA
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada.',
    path: req.originalUrl,
  })
})

// ==========================================
// TRATAMENTO GLOBAL DE ERROS
// ==========================================

app.use((error, req, res, next) => {
  console.error('Erro no servidor:', error.message)

  if (res.headersSent) {
    return next(error)
  }

  if (error.message === 'Origem não autorizada pelo CORS.') {
    return res.status(403).json({
      success: false,
      error: 'Origem não autorizada.',
    })
  }

  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor.',
  })
})

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const PORT = process.env.PORT || 3001

app.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('===================================')
  console.log('       DOUTOR DE TODOS API')
  console.log('===================================')
  console.log(`Servidor ativo na porta ${PORT}`)
  console.log('Saúde: /health')
  console.log('Cadastro: /api/cadastros')
  console.log('Checkout: /api/pagarme/checkout')
  console.log('Webhook: /webhooks/pagarme')
  console.log('Gateway: Pagar.me')
  console.log('===================================')

  console.log('Origens autorizadas:', origensPermitidas)
  console.log(
    'Pagar.me configurado:',
    Boolean(process.env.PAGARME_SECRET_KEY)
  )
  console.log('')
})
