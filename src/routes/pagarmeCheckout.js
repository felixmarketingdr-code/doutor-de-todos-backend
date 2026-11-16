
const express = require('express')
const crypto = require('crypto')

const router = express.Router()

const pagarmeService = require('../services/pagarmeService')
const { obterPlano } = require('../services/planosService')

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function texto(valor) {
  return String(valor ?? '').trim()
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '')
}

function separarTelefone(valor) {
  const numero = somenteNumeros(valor)

  // Remove o código do Brasil, caso tenha sido informado.
  const nacional = numero.startsWith('55')
    ? numero.slice(2)
    : numero

  if (nacional.length < 10 || nacional.length > 11) {
    throw new Error('Telefone ou celular inválido.')
  }

  return {
    country_code: '55',
    area_code: nacional.slice(0, 2),
    number: nacional.slice(2),
  }
}

function validarCliente(cliente) {
  if (
    !cliente ||
    typeof cliente !== 'object' ||
    Array.isArray(cliente)
  ) {
    throw new Error('Dados do cliente não recebidos.')
  }

  const obrigatorios = [
    'nome',
    'cpf',
    'email',
    'celular',
  ]

  const ausentes = obrigatorios.filter(
    campo => !texto(cliente[campo])
  )

  if (ausentes.length) {
    const erro = new Error(
      'Existem dados obrigatórios ausentes no cadastro.'
    )

    erro.campos = ausentes
    erro.status = 400

    throw erro
  }

  const cpf = somenteNumeros(cliente.cpf)

  if (cpf.length !== 11) {
    throw new Error('CPF inválido.')
  }

  const email = texto(cliente.email).toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail inválido.')
  }

  return {
    name: texto(cliente.nome),
    email,
    document: cpf,
    type: 'individual',
    document_type: 'CPF',
    phones: {
      mobile_phone: separarTelefone(cliente.celular),
    },
  }
}

// ==========================================
// CRIAÇÃO DO CHECKOUT PAGAR.ME
// POST /api/pagarme/checkout
// ==========================================

router.post('/checkout', async (req, res) => {
  try {
    const {
      cadastroId,
      plano,
      cliente,
      paymentMethod,
      cardToken,
      installments,
    } = req.body || {}

    // --------------------------------------
    // VALIDAÇÃO DO CADASTRO
    // --------------------------------------

    if (!texto(cadastroId)) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do cadastro não informado.',
      })
    }

    // --------------------------------------
    // IDENTIFICAÇÃO DO PLANO
    // O valor vem exclusivamente do backend.
    // --------------------------------------

    let produto

    try {
      produto = obterPlano(plano)
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    // --------------------------------------
    // VALIDAÇÃO DO CLIENTE
    // --------------------------------------

    let customer

    try {
      customer = validarCliente(cliente)
    } catch (error) {
      return res.status(error.status || 400).json({
        success: false,
        error: error.message,
        campos: error.campos || undefined,
      })
    }

    // --------------------------------------
    // MÉTODO DE PAGAMENTO
    // --------------------------------------

    const metodo = texto(paymentMethod).toLowerCase()

    if (!['pix', 'credit_card', 'boleto'].includes(metodo)) {
      return res.status(400).json({
        success: false,
        error: 'Forma de pagamento inválida. Informe pix, credit_card ou boleto.',
      })
    }

    const payment = {
      payment_method: metodo,
    }

    if (metodo === 'pix') {
      payment.pix = {
        expires_in: 1800,
      }
    }

    if (metodo === 'credit_card') {
      const token = texto(cardToken)

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token do cartão não informado.',
        })
      }

      const quantidadeParcelas = Number(installments || 1)

      if (
        !Number.isInteger(quantidadeParcelas) ||
        quantidadeParcelas < 1 ||
        quantidadeParcelas > 12
      ) {
        return res.status(400).json({
          success: false,
          error: 'Quantidade de parcelas inválida.',
        })
      }

      payment.credit_card = {
        card_token: token,
        installments: quantidadeParcelas,
        statement_descriptor: 'DR DE TODOS',
      }
    }

    if (metodo === 'boleto') {
      payment.boleto = {
        instructions: 'Pagamento referente ao plano Doutor de Todos.',
        due_at: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
      }
    }

    // --------------------------------------
    // PEDIDO PAGAR.ME
    // --------------------------------------

    const chaveIdempotencia = crypto
      .createHash('sha256')
      .update(
        `${cadastroId}:${produto.id}:${metodo}:${texto(cardToken)}`
      )
      .digest('hex')

    const dadosPedido = {
      items: [
        {
          amount: produto.valorCentavos,
          description: produto.nome,
          quantity: 1,
          code: produto.id,
        },
      ],

      customer,

      payments: [payment],

      metadata: {
        cadastro_id: texto(cadastroId),
        plano: produto.id,
        origem: 'site_doutor_de_todos',
        gateway: 'pagarme',
      },
    }

    const pedido = await pagarmeService.criarPedido(
      dadosPedido,
      chaveIdempotencia
    )

    // --------------------------------------
    // DADOS DA COBRANÇA
    // --------------------------------------

    const cobranca = pedido.charges?.[0] || {}
    const transacao = cobranca.last_transaction || {}

    console.log('-----------------------------------')
    console.log('PEDIDO PAGAR.ME CRIADO')
    console.log('Cadastro:', texto(cadastroId))
    console.log('Plano:', produto.nome)
    console.log('Pedido:', pedido.id)
    console.log('Status:', pedido.status)
    console.log('Método:', metodo)
    console.log('-----------------------------------')

    return res.status(201).json({
      success: true,
      message: 'Pedido criado com sucesso.',
      cadastroId: texto(cadastroId),
      plano: produto.id,

      pedido: {
        id: pedido.id,
        status: pedido.status,
        amount: pedido.amount,
        currency: pedido.currency,
      },

      pagamento: {
        metodo,
        status: cobranca.status || pedido.status,
        chargeId: cobranca.id || null,

        pix: metodo === 'pix'
          ? {
              qrCode: transacao.qr_code || null,
              qrCodeUrl: transacao.qr_code_url || null,
              copiaECola: transacao.qr_code || null,
              expiracao: transacao.expires_at || null,
            }
          : null,

        boleto: metodo === 'boleto'
          ? {
              url: transacao.url || transacao.pdf || null,
              linhaDigitavel: transacao.line || null,
              codigoBarras: transacao.barcode || null,
              vencimento: transacao.due_at || null,
            }
          : null,
      },
    })
  } catch (error) {
    console.error(
      'Erro ao criar checkout Pagar.me:',
      error.message
    )

    return res.status(error.status || 502).json({
      success: false,
      error: error.message || 'Não foi possível criar o pedido.',
      detalhes: error.detalhes || undefined,
    })
  }
})

module.exports = router
