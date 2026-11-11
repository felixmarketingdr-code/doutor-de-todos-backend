
const express = require('express')

const router = express.Router()

const {
  gerarCheckout,
} = require('../services/yampiService')

// ==========================================
// CRIAÇÃO DO CHECKOUT
// POST /api/yampi/checkout
// ==========================================

router.post('/checkout', async (req, res) => {
  try {
    const {
      cadastroId,
      plano,
      cliente,
    } = req.body || {}

    // --------------------------------------
    // VALIDAÇÃO DOS DADOS
    // --------------------------------------

    if (!cadastroId) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do cadastro não informado.',
      })
    }

    if (!plano) {
      return res.status(400).json({
        success: false,
        error: 'Plano não informado.',
      })
    }

    if (!cliente || typeof cliente !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dados do cliente não recebidos.',
      })
    }

    // --------------------------------------
    // VALIDAÇÃO DO CLIENTE
    // --------------------------------------

    const camposObrigatorios = [
      'nome',
      'cpf',
      'email',
      'telefone',
    ]

    const camposAusentes = camposObrigatorios.filter(
      (campo) => !String(cliente[campo] ?? '').trim()
    )

    if (camposAusentes.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Existem dados obrigatórios ausentes.',
        campos: camposAusentes,
      })
    }

    // --------------------------------------
    // GERAÇÃO DO LINK
    // --------------------------------------

    const checkout = gerarCheckout({
      cadastroId,
      plano,
    })

    console.log('-----------------------------------')
    console.log('CHECKOUT YAMPI PREPARADO')
    console.log('Cadastro:', cadastroId)
    console.log('Plano:', checkout.plano)
    console.log('Produto:', checkout.produto)
    console.log('-----------------------------------')

    // --------------------------------------
    // RESPOSTA AO FRONTEND
    // --------------------------------------

    return res.status(200).json({
      success: true,
      message: 'Checkout preparado com sucesso.',
      cadastroId: checkout.cadastroId,
      plano: checkout.plano,
      checkoutUrl: checkout.checkoutUrl,
    })

  } catch (error) {
    console.error(
      'Erro ao preparar checkout Yampi:',
      error.message
    )

    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao preparar checkout.',
    })
  }
})

module.exports = router
