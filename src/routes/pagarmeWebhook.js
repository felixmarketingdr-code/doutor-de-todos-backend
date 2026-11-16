
const express = require('express')
const crypto = require('crypto')

const router = express.Router()

const pagarmeService = require('../services/pagarmeService')
const { obterPlano } = require('../services/planosService')

// ==========================================
// AUTENTICAÇÃO DO WEBHOOK
// ==========================================

function validarTokenWebhook(tokenRecebido) {
  const tokenConfigurado = String(
    process.env.PAGARME_WEBHOOK_TOKEN || ''
  ).trim()

  if (!tokenConfigurado || tokenConfigurado.length < 32) {
    console.error(
      'PAGARME_WEBHOOK_TOKEN não configurado corretamente.'
    )

    return false
  }

  if (
    typeof tokenRecebido !== 'string' ||
    !tokenRecebido
  ) {
    return false
  }

  const recebido = Buffer.from(tokenRecebido)
  const configurado = Buffer.from(tokenConfigurado)

  if (recebido.length !== configurado.length) {
    return false
  }

  return crypto.timingSafeEqual(recebido, configurado)
}

// ==========================================
// NORMALIZAÇÃO
// ==========================================

function normalizarStatus(status) {
  return String(status || '').trim().toLowerCase()
}

// ==========================================
// EXTRAÇÃO DO EVENTO
// ==========================================

function extrairEvento(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Payload do webhook inválido.')
  }

  const evento = String(
    body.type || body.event || ''
  ).trim()

  const pedidoId = String(
    body.data?.id ||
    body.data?.order?.id ||
    body.order?.id ||
    ''
  ).trim()

  if (!evento) {
    throw new Error('Evento não identificado no webhook.')
  }

  if (!pedidoId) {
    throw new Error('Identificador do pedido não encontrado.')
  }

  return {
    evento,
    pedidoId,
    eventoId: String(body.id || '').trim(),
  }
}

// ==========================================
// VALIDAÇÃO DOS DADOS DO PEDIDO
// ==========================================

function validarDadosPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') {
    throw new Error('Pedido não encontrado na Pagar.me.')
  }

  const metadata = pedido.metadata || {}

  const cadastroId = String(
    metadata.cadastro_id || ''
  ).trim()

  const planoId = String(
    metadata.plano || ''
  ).trim().toLowerCase()

  if (!cadastroId) {
    throw new Error(
      'O pedido não possui cadastro_id nos metadados.'
    )
  }

  if (!planoId) {
    throw new Error(
      'O pedido não possui plano nos metadados.'
    )
  }

  const plano = obterPlano(planoId)

  if (Number(pedido.amount) !== plano.valorCentavos) {
    throw new Error(
      'O valor confirmado na Pagar.me não corresponde ao valor configurado para o plano.'
    )
  }

  return {
    cadastroId,
    plano,
  }
}

// ==========================================
// RECEBIMENTO DO WEBHOOK
//
// POST /webhooks/pagarme/:token
// ==========================================

router.post('/:token', async (req, res) => {
  try {
    // --------------------------------------
    // 1. AUTENTICAR A NOTIFICAÇÃO
    // --------------------------------------

    const token = req.params.token

    if (!validarTokenWebhook(token)) {
      console.warn(
        'Webhook Pagar.me recebido com token inválido.'
      )

      return res.status(401).json({
        success: false,
        error: 'Webhook não autorizado.',
      })
    }

    // --------------------------------------
    // 2. IDENTIFICAR O EVENTO E O PEDIDO
    // --------------------------------------

    const {
      evento,
      pedidoId,
      eventoId,
    } = extrairEvento(req.body)

    console.log('-----------------------------------')
    console.log('WEBHOOK PAGAR.ME RECEBIDO')
    console.log('Evento:', evento)
    console.log('Pedido:', pedidoId)
    console.log('Evento ID:', eventoId || 'Não informado')
    console.log('-----------------------------------')

    // --------------------------------------
    // 3. IGNORAR EVENTOS NÃO TRATADOS
    // --------------------------------------

    const eventosPermitidos = [
      'order.paid',
      'order.payment_failed',
      'order.canceled',
    ]

    if (!eventosPermitidos.includes(evento)) {
      return res.status(200).json({
        success: true,
        message: 'Evento recebido, sem ação necessária.',
        evento,
      })
    }

    // --------------------------------------
    // 4. CONSULTAR PEDIDO DIRETAMENTE
    // NA API OFICIAL DA PAGAR.ME
    // --------------------------------------

    const pedido = await pagarmeService.consultarPedido(
      pedidoId
    )

    if (String(pedido.id) !== pedidoId) {
      return res.status(400).json({
        success: false,
        error: 'O pedido consultado não corresponde à notificação.',
      })
    }

    // --------------------------------------
    // 5. CONFERIR METADADOS E VALOR
    // --------------------------------------

    const {
      cadastroId,
      plano,
    } = validarDadosPedido(pedido)

    const statusPedido = normalizarStatus(
      pedido.status
    )

    // --------------------------------------
    // 6. CONFIRMAR PAGAMENTO
    // --------------------------------------

    if (evento === 'order.paid') {
      if (statusPedido !== 'paid') {
        console.warn(
          'Evento order.paid recebido, mas o pedido ainda não está pago.',
          {
            pedidoId,
            statusPedido,
          }
        )

        return res.status(202).json({
          success: true,
          confirmado: false,
          message: 'Pedido ainda não confirmado como pago.',
          status: statusPedido,
        })
      }

      console.log('===================================')
      console.log('PAGAMENTO CONFIRMADO NA PAGAR.ME')
      console.log('Pedido:', pedido.id)
      console.log('Cadastro:', cadastroId)
      console.log('Plano:', plano.nome)
      console.log('Valor:', pedido.amount)
      console.log('Status:', statusPedido)
      console.log('===================================')

      // IMPORTANTE:
      // Neste ponto o pagamento foi consultado e
      // confirmado diretamente na Pagar.me.
      //
      // A próxima etapa será integrar este pedido
      // ao Firebase do site e às duas Gestões,
      // usando controle de idempotência próprio.
      //
      // Não criar contratos diretamente aqui
      // antes de implementar essa integração.

      return res.status(200).json({
        success: true,
        confirmado: true,
        message: 'Pagamento confirmado na Pagar.me.',
        pedidoId: pedido.id,
        cadastroId,
        plano: plano.id,
        status: statusPedido,
        integracaoGestões: 'Pendente de implementação',
      })
    }

    // --------------------------------------
    // 7. PAGAMENTO RECUSADO OU CANCELADO
    // --------------------------------------

    if (evento === 'order.payment_failed') {
      console.log(
        'Pagamento não aprovado:',
        pedido.id,
        statusPedido
      )

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: 'Evento de pagamento não aprovado recebido.',
        pedidoId: pedido.id,
        status: statusPedido,
      })
    }

    if (evento === 'order.canceled') {
      console.log(
        'Pedido cancelado:',
        pedido.id,
        statusPedido
      )

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: 'Evento de cancelamento recebido.',
        pedidoId: pedido.id,
        status: statusPedido,
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processado.',
    })

  } catch (error) {
    console.error(
      'Erro ao processar webhook Pagar.me:',
      error.message
    )

    return res.status(500).json({
      success: false,
      error: 'Não foi possível processar o webhook.',
    })
  }
})

module.exports = router
