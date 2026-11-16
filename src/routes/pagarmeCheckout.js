
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const pagarmeService = require('../services/pagarmeService');
const { obterPlano } = require('../services/planosService');
const { db } = require('../config/firebase');
const { buscarCadastroInterno } = require('./cadastroRoutes');

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function texto(valor) {
  return String(valor ?? '').trim();
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '');
}

function separarTelefone(valor) {
  const numero = somenteNumeros(valor);

  const nacional = numero.startsWith('55')
    ? numero.slice(2)
    : numero;

  if (nacional.length < 10 || nacional.length > 11) {
    throw new Error('Telefone ou celular inválido.');
  }

  return {
    country_code: '55',
    area_code: nacional.slice(0, 2),
    number: nacional.slice(2),
  };
}

function validarCliente(cliente) {
  if (
    !cliente ||
    typeof cliente !== 'object' ||
    Array.isArray(cliente)
  ) {
    throw new Error('Dados do cliente não recebidos.');
  }

  const obrigatorios = [
    'nome',
    'cpf',
    'email',
    'celular',
  ];

  const ausentes = obrigatorios.filter(
    campo => !texto(cliente[campo])
  );

  if (ausentes.length) {
    const erro = new Error(
      'Existem dados obrigatórios ausentes no cadastro.'
    );

    erro.campos = ausentes;
    erro.status = 400;

    throw erro;
  }

  const cpf = somenteNumeros(cliente.cpf);

  if (cpf.length !== 11) {
    throw new Error('CPF inválido.');
  }

  const email = texto(cliente.email).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail inválido.');
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
  };
}

// ==========================================
// CONSULTAR PEDIDO EXISTENTE
// ==========================================

async function consultarPedidoExistente(cadastro, metodo) {
  const pedidoId = cadastro.pedidoPagarme;

  if (!pedidoId) return null;

  const metodoAnterior = cadastro.metodoPagamento;

  // Não reutiliza pedido de outra forma de pagamento.
  if (metodoAnterior && metodoAnterior !== metodo) {
    return null;
  }

  try {
    const pedido = await pagarmeService.consultarPedido(pedidoId);

    if (!pedido || !pedido.id) {
      return null;
    }

    const status = texto(pedido.status).toLowerCase();

    // Pedidos já pagos, pendentes ou em processamento
    // não devem gerar uma nova cobrança.
    if (
      ['paid', 'pending', 'processing', 'waiting_payment'].includes(status)
    ) {
      return pedido;
    }

    return null;

  } catch (error) {
    console.error(
      'Não foi possível consultar pedido anterior:',
      error.message
    );

    throw new Error(
      'Não foi possível verificar o pedido anterior. Tente novamente.'
    );
  }
}

// ==========================================
// SALVAR PEDIDO NO FIRESTORE
// ==========================================

async function salvarPedidoNoCadastro(
  cadastroId,
  pedido,
  metodo,
  produto
) {
  const referencia = db.collection('cadastrosSite')
    .doc(String(cadastroId));

  await db.runTransaction(async transaction => {
    const documento = await transaction.get(referencia);

    if (!documento.exists) {
      throw new Error('Cadastro não encontrado no Firebase.');
    }

    const cadastroAtual = documento.data();

    if (cadastroAtual.statusPagamento === 'pago') {
      throw new Error('Este cadastro já possui pagamento confirmado.');
    }

    transaction.update(referencia, {
      gatewayPagamento: 'pagarme',
      pedidoPagamento: String(pedido.id),
      pedidoPagarme: String(pedido.id),
      chargePagarme: pedido.charges?.[0]?.id || null,
      metodoPagamento: metodo,
      planoPagamento: produto.id,
      valorPagamentoCentavos: produto.valorCentavos,
      statusPedidoPagarme: texto(pedido.status),
      atualizadoEm: new Date().toISOString(),
    });
  });
}

// ==========================================
// MONTAR RESPOSTA DO CHECKOUT
// ==========================================

function gerarRespostaCheckout(
  pedido,
  metodo,
  cadastroId,
  produto
) {
  const cobranca = pedido.charges?.[0] || {};
  const transacao = cobranca.last_transaction || {};

  return {
    success: true,
    message: 'Pedido criado com sucesso.',
    cadastroId,
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
  };
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
      paymentMethod,
      cardToken,
      installments,
    } = req.body || {};

    // --------------------------------------
    // 1. VALIDAR IDENTIFICADOR
    // --------------------------------------

    if (!texto(cadastroId)) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do cadastro não informado.',
      });
    }

    // --------------------------------------
    // 2. BUSCAR CADASTRO NO FIREBASE
    // --------------------------------------

    const cadastro = await buscarCadastroInterno(cadastroId);

    if (!cadastro) {
      return res.status(404).json({
        success: false,
        error: 'Cadastro não encontrado.',
      });
    }

    if (!cadastro.dados) {
      return res.status(400).json({
        success: false,
        error: 'Dados do cadastro incompletos.',
      });
    }

    if (cadastro.statusPagamento === 'pago') {
      return res.status(409).json({
        success: false,
        error: 'Este cadastro já possui pagamento confirmado.',
      });
    }

    // --------------------------------------
    // 3. VALIDAR FORMA DE PAGAMENTO
    // --------------------------------------

    if (cadastro.dados.pagamento !== 'cartao') {
      return res.status(400).json({
        success: false,
        error: 'Este cadastro não está habilitado para checkout por cartão.',
      });
    }

    // --------------------------------------
    // 4. CONFERIR PLANO
    // --------------------------------------

    const planoCadastro = texto(
      cadastro.dados.plano
    ).toLowerCase();

    const planoRecebido = texto(plano).toLowerCase();

    if (!planoCadastro || planoRecebido !== planoCadastro) {
      return res.status(400).json({
        success: false,
        error: 'O plano informado não corresponde ao cadastro.',
      });
    }

    const produto = obterPlano(planoCadastro);

    // --------------------------------------
    // 5. UTILIZAR DADOS DO FIREBASE
    // --------------------------------------

    const cliente = cadastro.dados;

    const customer = validarCliente({
      nome: cliente.nome,
      cpf: cliente.cpf,
      email: cliente.email,
      celular: cliente.celular,
    });

    // --------------------------------------
    // 6. MÉTODO DE PAGAMENTO
    // --------------------------------------

    const metodo = texto(paymentMethod).toLowerCase();

    if (!['pix', 'credit_card', 'boleto'].includes(metodo)) {
      return res.status(400).json({
        success: false,
        error: 'Forma de pagamento inválida. Informe pix, credit_card ou boleto.',
      });
    }

    // --------------------------------------
    // 7. VERIFICAR PEDIDO ANTERIOR
    // --------------------------------------

    const pedidoExistente = await consultarPedidoExistente(
      cadastro,
      metodo
    );

    if (pedidoExistente) {
      return res.status(200).json(
        gerarRespostaCheckout(
          pedidoExistente,
          metodo,
          cadastroId,
          produto
        )
      );
    }

    // --------------------------------------
    // 8. CONFIGURAR PAGAMENTO
    // --------------------------------------

    const payment = {
      payment_method: metodo,
    };

    if (metodo === 'pix') {
      payment.pix = {
        expires_in: 1800,
      };
    }

    if (metodo === 'credit_card') {
      const token = texto(cardToken);

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token do cartão não informado.',
        });
      }

      const quantidadeParcelas = Number(installments || 1);

      if (
        !Number.isInteger(quantidadeParcelas) ||
        quantidadeParcelas < 1 ||
        quantidadeParcelas > 12
      ) {
        return res.status(400).json({
          success: false,
          error: 'Quantidade de parcelas inválida.',
        });
      }

      payment.credit_card = {
        card_token: token,
        installments: quantidadeParcelas,
        statement_descriptor: 'DR DE TODOS',
      };
    }

    if (metodo === 'boleto') {
      payment.boleto = {
        instructions: 'Pagamento referente ao plano Doutor de Todos.',
        due_at: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };
    }

    // --------------------------------------
    // 9. CHAVE DE IDEMPOTÊNCIA
    // --------------------------------------

    const identificadorPagamento = metodo === 'credit_card'
      ? texto(cardToken)
      : cadastroId;

    const chaveIdempotencia = crypto
      .createHash('sha256')
      .update(
        `${cadastroId}:${produto.id}:${metodo}:${identificadorPagamento}`
      )
      .digest('hex');

    // --------------------------------------
    // 10. MONTAR PEDIDO
    // --------------------------------------

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
        cadastro_id: String(cadastroId),
        plano: produto.id,
        origem: 'site_doutor_de_todos',
        gateway: 'pagarme',
      },
    };

    // --------------------------------------
    // 11. CRIAR PEDIDO NA PAGAR.ME
    // --------------------------------------

    const pedido = await pagarmeService.criarPedido(
      dadosPedido,
      chaveIdempotencia
    );

    if (!pedido || !pedido.id) {
      throw new Error(
        'A Pagar.me não retornou o identificador do pedido.'
      );
    }

    // --------------------------------------
    // 12. SALVAR PEDIDO NO FIREBASE
    // --------------------------------------

    await salvarPedidoNoCadastro(
      cadastroId,
      pedido,
      metodo,
      produto
    );

    // --------------------------------------
    // 13. LOGS
    // --------------------------------------

    console.log('-----------------------------------');
    console.log('PEDIDO PAGAR.ME CRIADO');
    console.log('Cadastro:', cadastroId);
    console.log('Plano:', produto.nome);
    console.log('Pedido:', pedido.id);
    console.log('Status:', pedido.status);
    console.log('Método:', metodo);
    console.log('-----------------------------------');

    // --------------------------------------
    // 14. RESPOSTA
    // --------------------------------------

    return res.status(201).json(
      gerarRespostaCheckout(
        pedido,
        metodo,
        cadastroId,
        produto
      )
    );

  } catch (error) {
    console.error(
      'Erro ao criar checkout Pagar.me:',
      error.message
    );

    return res.status(error.status || 502).json({
      success: false,
      error: error.message || 'Não foi possível criar o pedido.',
    });
  }
});

module.exports = router;
