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

    if (!['light', 'plus'].includes(String(plano || '').toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Plano não informado ou inválido.',
      })
    }

    if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)) {
      return res.status(400).json({
        success: false,
        error: 'Dados do cliente não recebidos.',
      })
    }

    // O cadastro já foi validado em /api/cadastros.
    // Aqui conferimos os dados de contato usados no checkout.
    const camposObrigatorios = [
      'nome',
      'cpf',
      'email',
      'telefone',
      'celular',
      'cidade',
      'estado',
    ]

    const camposAusentes = camposObrigatorios.filter(
      (campo) => !String(cliente[campo] ?? '').trim()
    )

    if (camposAusentes.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Existem dados obrigatórios ausentes para preparar o checkout.',
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
