const express = require('express')

const crypto = require('crypto')

const router = express.Router()

// ==========================================

// ARMAZENAMENTO TEMPORÁRIO

// SOMENTE PARA DESENVOLVIMENTO LOCAL

// ==========================================

const cadastrosTemporarios = new Map()

// ==========================================

// FUNÇÕES AUXILIARES

// ==========================================

function texto(valor) {

  return String(valor ?? '').trim()

}

function numeros(valor) {

  return String(valor ?? '').replace(/\D/g, '')

}

function validarCPF(valor) {

  const cpf = numeros(valor)

  if (

    cpf.length !== 11 ||

    /^(\d)\1{10}$/.test(cpf)

  ) {

    return false

  }

  let soma = 0

  for (let i = 0; i < 9; i++) {

    soma += Number(cpf[i]) * (10 - i)

  }

  let digito = (soma * 10) % 11

  if (digito === 10) digito = 0

  if (digito !== Number(cpf[9])) {

    return false

  }

  soma = 0

  for (let i = 0; i < 10; i++) {

    soma += Number(cpf[i]) * (11 - i)

  }

  digito = (soma * 10) % 11

  if (digito === 10) digito = 0

  return digito === Number(cpf[10])

}

function gerarRespostaCadastro(cadastro) {

  return {

    sucesso: true,

    cadastroId: cadastro.cadastroId,

    statusCadastro: cadastro.statusCadastro,

    statusPagamento: cadastro.statusPagamento,

    plano: cadastro.dados.plano,

    message: 'Cadastro recebido com sucesso.',

  }

}

// ==========================================

// CRIAR CADASTRO

// POST /api/cadastros

// ==========================================

router.post('/', (req, res) => {

  try {

    const dados = req.body

    if (

      !dados ||

      typeof dados !== 'object' ||

      Array.isArray(dados)

    ) {

      return res.status(400).json({

        error: 'Dados do cadastro não recebidos.',

      })

    }

    // --------------------------------------

    // CAMPOS OBRIGATÓRIOS

    // --------------------------------------

    const camposObrigatorios = [
        'nome',
        'cpf',
        'dataNascimento',
        'email',
        'celular',
        'telefone',
        'cidade',
        'estado',
        'plano',
        'pagamento',
    ]

    const camposAusentes = camposObrigatorios.filter(

      (campo) => !texto(dados[campo])

    )

    if (camposAusentes.length > 0) {

      return res.status(400).json({

        error: 'Preencha todos os campos obrigatórios.',

        campos: camposAusentes,

      })

    }

    // --------------------------------------

    // NORMALIZAÇÃO DOS DADOS

    // --------------------------------------

    const cliente = {
        nome: texto(dados.nome),
        cpf: numeros(dados.cpf),
        dataNascimento: texto(dados.dataNascimento),
        email: texto(dados.email).toLowerCase(),
        celular: numeros(dados.celular),
        telefone: numeros(dados.telefone),
        cidade: texto(dados.cidade),
        estado: texto(dados.estado).toUpperCase(),

        plano: texto(dados.plano).toLowerCase(),
        pagamento: texto(dados.pagamento).toLowerCase(),

        origem: 'site_doutor_de_todos',
        consentimentoPrivacidade:
          dados.consentimentoPrivacidade === true,
        dataConsentimento: texto(dados.dataConsentimento),
    }

    // --------------------------------------

    // VALIDAÇÃO DO NOME

    // --------------------------------------

    if (cliente.nome.split(/\s+/).length < 2) {

      return res.status(400).json({

        error: 'Informe o nome completo do titular.',

        campos: ['nome'],

      })

    }

    // --------------------------------------

    // VALIDAÇÃO DO CPF

    // --------------------------------------

    if (!validarCPF(cliente.cpf)) {

      return res.status(400).json({

        error: 'CPF inválido.',

        campos: ['cpf'],

      })

    }

    // --------------------------------------

    // VALIDAÇÃO DA DATA

    // --------------------------------------

    const nascimento = new Date(

      `${cliente.dataNascimento}T00:00:00`

    )

    if (

      Number.isNaN(nascimento.getTime()) ||

      nascimento > new Date()

    ) {

      return res.status(400).json({

        error: 'Data de nascimento inválida.',

        campos: ['dataNascimento'],

      })

    }

    // --------------------------------------
    // VALIDAÇÃO DOS TELEFONES
    // --------------------------------------

    if (
      cliente.telefone.length < 10 ||
      cliente.celular.length < 10
    ) {
      return res.status(400).json({
        error: 'Informe telefone e celular válidos com DDD.',
        campos: ['telefone', 'celular'],
      })
    }

    // --------------------------------------

    // VALIDAÇÃO DO E-MAIL

    // --------------------------------------

    const emailValido =

      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)

    if (!emailValido) {

      return res.status(400).json({

        error: 'E-mail inválido.',

        campos: ['email'],

      })

    }

    // --------------------------------------

    // VALIDAÇÃO DO PLANO

    // --------------------------------------

    if (!['light', 'plus'].includes(cliente.plano)) {

      return res.status(400).json({

        error: 'Plano não reconhecido.',

        campos: ['plano'],

      })

    }

    // --------------------------------------

    // VALIDAÇÃO DO PAGAMENTO

    // --------------------------------------

    if (!['cartao', 'energia'].includes(cliente.pagamento)) {

      return res.status(400).json({

        error: 'Forma de pagamento não reconhecida.',

        campos: ['pagamento'],

      })

    }

    // --------------------------------------

    // VALIDAÇÃO DO CONSENTIMENTO

    // --------------------------------------

    if (!cliente.consentimentoPrivacidade) {

      return res.status(400).json({

        error: 'O consentimento para tratamento dos dados é necessário.',

        campos: ['consentimentoPrivacidade'],

      })

    }

    // --------------------------------------

    // GERAÇÃO DO IDENTIFICADOR

    // --------------------------------------

    const cadastroId = crypto.randomUUID()

    // --------------------------------------

    // REGISTRO DO CADASTRO

    // --------------------------------------

    const cadastro = {

      cadastroId,

      dados: cliente,

      statusCadastro: 'aguardando_pagamento',

      statusPagamento: 'pendente',

      pedidoYampi: null,

      criadoEm: new Date().toISOString(),

      atualizadoEm: new Date().toISOString(),

    }

    cadastrosTemporarios.set(cadastroId, cadastro)

    // --------------------------------------

    // LOGS SEM EXPOR DADOS PESSOAIS

    // --------------------------------------

    console.log('-----------------------------------')

    console.log('NOVO CADASTRO RECEBIDO')

    console.log('Cadastro:', cadastroId)

    console.log('Plano:', cliente.plano)

    console.log('Pagamento:', cliente.pagamento)

    console.log('Status:', cadastro.statusCadastro)

    console.log('-----------------------------------')

    return res.status(201).json(

      gerarRespostaCadastro(cadastro)

    )

  } catch (error) {

    console.error(

      'Erro ao receber cadastro:',

      error.message

    )

    return res.status(500).json({

      error: 'Erro interno ao receber o cadastro.',

    })

  }

})

// ==========================================

// CONSULTAR CADASTRO

// GET /api/cadastros/:id

//

// SOMENTE PARA TESTES LOCAIS.

// NÃO EXPOR DADOS PESSOAIS PUBLICAMENTE.

// ==========================================

router.get('/:id', (req, res) => {

  try {

    const cadastro = cadastrosTemporarios.get(

      req.params.id

    )

    if (!cadastro) {

      return res.status(404).json({

        error: 'Cadastro não encontrado.',

      })

    }

    // Não devolve CPF, endereço, telefone ou e-mail.

    return res.status(200).json({

      cadastroId: cadastro.cadastroId,

      statusCadastro: cadastro.statusCadastro,

      statusPagamento: cadastro.statusPagamento,

      plano: cadastro.dados.plano,

      pedidoYampi: cadastro.pedidoYampi,

      criadoEm: cadastro.criadoEm,

    })

  } catch (error) {

    console.error(

      'Erro ao consultar cadastro:',

      error.message

    )

    return res.status(500).json({

      error: 'Erro ao consultar cadastro.',

    })

  }

})

// ==========================================

// CONSULTA INTERNA PARA OUTROS SERVIÇOS

// Não é uma rota HTTP pública.

// ==========================================

function buscarCadastroInterno(cadastroId) {

  return cadastrosTemporarios.get(cadastroId) || null

}

// ==========================================

// ATUALIZAÇÃO INTERNA DO PAGAMENTO

// ==========================================

function atualizarPagamentoInterno(

  cadastroId,

  pedidoYampi

) {

  const cadastro = cadastrosTemporarios.get(cadastroId)

  if (!cadastro) {

    return false

  }

  cadastro.statusPagamento = 'pago'

  cadastro.statusCadastro = 'pagamento_confirmado'

  cadastro.pedidoYampi = String(pedidoYampi || '')

  cadastro.atualizadoEm = new Date().toISOString()

  cadastrosTemporarios.set(cadastroId, cadastro)

  console.log(

    'Pagamento associado ao cadastro:',

    cadastroId

  )

  return true

}

// ==========================================

// EXPORTAÇÕES

// ==========================================

module.exports = router

module.exports.buscarCadastroInterno = buscarCadastroInterno

module.exports.atualizarPagamentoInterno =

  atualizarPagamentoInterno

module.exports.cadastrosTemporarios =

  cadastrosTemporarios
