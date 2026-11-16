const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const pagarmeService = require('../services/pagarmeService');
const { obterPlano } = require('../services/planosService');
const { db } = require('../config/firebase');
const { buscarCadastroInterno } = require('./cadastroRoutes');

/* =====================================================
   FUNÇÕES BÁSICAS
===================================================== */

function texto(valor) {
  return String(valor ?? '').trim();
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '');
}

function erroHttp(mensagem, status = 400) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function separarTelefone(valor) {
  const numero = somenteNumeros(valor);

  const nacional = numero.startsWith('55')
    ? numero.slice(2)
    : numero;

  if (nacional.length < 10 || nacional.length > 11) {
    throw erroHttp('Telefone ou celular inválido.');
  }

  return {
    country_code: '55',
    area_code: nacional.slice(0, 2),
    number: nacional.slice(2),
  };
}

/* =====================================================
   VALIDAÇÃO DO CLIENTE
===================================================== */

function validarCliente(cliente) {
  if (
    !cliente ||
    typeof cliente !== 'object' ||
    Array.isArray(cliente)
  ) {
    throw erroHttp('Dados do cliente não recebidos.');
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
    const erro = erroHttp(
      'Existem dados obrigatórios ausentes no cadastro.'
    );

    erro.campos = ausentes;
    throw erro;
  }

  const cpf = somenteNumeros(cliente.cpf);

  if (cpf.length !== 11) {
    throw erroHttp('CPF inválido.');
  }

  const email = texto(cliente.email).toLowerCase();

  // Expressão corrigida para validação do e-mail.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw erroHttp('E-mail inválido.');
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

/* =====================================================
   EXTRAÇÃO DA COBRANÇA E DA TRANSAÇÃO
===================================================== */

function extrairTransacao(pedido) {
  const cobranca = pedido?.charges?.[0] || {};

  const transacao =
    cobranca.last_transaction ||
    cobranca.lastTransaction ||
    cobranca.transaction ||
    {};

  return {
    cobranca,
    transacao,
  };
}

function primeiroValor(...valores) {
  for (const valor of valores) {
    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ''
    ) {
      return valor;
    }
  }

  return null;
}

/* =====================================================
   CÁLCULO DOS VALORES

   LIGHT:
   Primeira cobrança = mensalidade + adesão.
   Mensalidade posterior = R$ 39,90.

   PLUS:
   Total anual = 12 parcelas de R$ 79,90.
===================================================== */

function calcularCobranca(produto, metodo, parcelasSolicitadas) {
  if (produto.id === 'light') {
    if (!produto.valorPrimeiraCobrancaCentavos) {
      throw erroHttp(
        'Valor da primeira cobrança do plano Light não configurado.',
        500
      );
    }

    return {
      valorCentavos: produto.valorPrimeiraCobrancaCentavos,
      parcelas: 1,
      descricao:
        'Plano Light - primeira mensalidade e taxa de adesão',
      tipoCobranca: 'primeira_cobranca',
    };
  }

  if (produto.id === 'plus') {
    if (!produto.valorTotalAnualCentavos) {
      throw erroHttp(
        'Valor anual do plano Plus não configurado.',
        500
      );
    }

    if (metodo === 'credit_card') {
      const parcelas = Number(parcelasSolicitadas || 12);

      if (parcelas !== 12) {
        throw erroHttp(
          'O plano Plus deve ser contratado em 12 parcelas.'
        );
      }

      return {
        valorCentavos: produto.valorTotalAnualCentavos,
        parcelas: 12,
        descricao: 'Plano Plus - contratação anual em 12 parcelas',
        tipoCobranca: 'anual_parcelado',
      };
    }

    return {
      valorCentavos: produto.valorTotalAnualCentavos,
      parcelas: 1,
      descricao: 'Plano Plus - contratação anual',
      tipoCobranca: 'anual_integral',
    };
  }

  throw erroHttp('Plano não reconhecido.');
}

/* =====================================================
   CONSULTAR PEDIDO ANTERIOR

   Evita criar outro pedido quando já existe uma cobrança
   pendente para o mesmo cadastro, método e valor.
===================================================== */

async function consultarPedidoExistente(
  cadastro,
  metodo,
  cobrancaCalculada
) {
  const pedidoId =
    cadastro.pedidoPagarme ||
    cadastro.pedidoPagamento;

  if (!pedidoId) {
    return null;
  }

  const metodoAnterior = texto(
    cadastro.metodoPagamento
  ).toLowerCase();

  if (metodoAnterior && metodoAnterior !== metodo) {
    return null;
  }

  const valorAnterior = Number(
    cadastro.valorPagamentoCentavos || 0
  );

  if (
    valorAnterior &&
    valorAnterior !== cobrancaCalculada.valorCentavos
  ) {
    return null;
  }

  try {
    const pedido = await pagarmeService.consultarPedido(
      String(pedidoId)
    );

    if (!pedido?.id) {
      return null;
    }

    const status = texto(pedido.status).toLowerCase();

    const statusReutilizaveis = [
      'paid',
      'pending',
      'processing',
      'waiting_payment',
    ];

    if (!statusReutilizaveis.includes(status)) {
      return null;
    }

    if (
      Number(pedido.amount) !==
      Number(cobrancaCalculada.valorCentavos)
    ) {
      return null;
    }

    return pedido;
  } catch (error) {
    console.error(
      'Não foi possível consultar pedido anterior:',
      error.message
    );

    throw erroHttp(
      'Não foi possível verificar o pedido anterior. Tente novamente.',
      502
    );
  }
}

/* =====================================================
   SALVAR PEDIDO NO FIREBASE
===================================================== */

async function salvarPedidoNoCadastro(
  cadastroId,
  pedido,
  metodo,
  produto,
  cobrancaCalculada
) {
  const referencia = db
    .collection('cadastrosSite')
    .doc(String(cadastroId));

  await db.runTransaction(async transaction => {
    const documento = await transaction.get(referencia);

    if (!documento.exists) {
      throw erroHttp(
        'Cadastro não encontrado no Firebase.',
        404
      );
    }

    const cadastroAtual = documento.data();

    if (cadastroAtual.statusPagamento === 'pago') {
      throw erroHttp(
        'Este cadastro já possui pagamento confirmado.',
        409
      );
    }

    transaction.update(referencia, {
      gatewayPagamento: 'pagarme',

      pedidoPagamento: String(pedido.id),
      pedidoPagarme: String(pedido.id),

      chargePagarme:
        pedido.charges?.[0]?.id || null,

      metodoPagamento: metodo,
      planoPagamento: produto.id,

      valorPagamentoCentavos:
        cobrancaCalculada.valorCentavos,

      valorMensalCentavos:
        produto.valorMensalCentavos || null,

      valorAdesaoCentavos:
        produto.adesaoCentavos || null,

      valorTotalAnualCentavos:
        produto.valorTotalAnualCentavos || null,

      parcelasPagamento:
        cobrancaCalculada.parcelas,

      tipoCobranca:
        cobrancaCalculada.tipoCobranca,

      statusPedidoPagarme: texto(pedido.status),

      atualizadoEm: new Date().toISOString(),
    });
  });
}

/* =====================================================
   MONTAR RESPOSTA DO CHECKOUT
===================================================== */

function gerarRespostaCheckout(
  pedido,
  metodo,
  cadastroId,
  produto,
  cobrancaCalculada
) {
  const { cobranca, transacao } = extrairTransacao(pedido);

  let pix = null;
  let boleto = null;

  if (metodo === 'pix') {
    const qrCode = primeiroValor(
      transacao.qr_code,
      transacao.qrCode,
      transacao.copy_paste,
      transacao.copyPaste
    );

    const qrCodeUrl = primeiroValor(
      transacao.qr_code_url,
      transacao.qrCodeUrl,
      transacao.qr_code_image,
      transacao.qrCodeImage,
      transacao.url
    );

    const copiaECola = primeiroValor(
      transacao.copy_paste,
      transacao.copyPaste,
      transacao.qr_code,
      transacao.qrCode
    );

    pix = {
      qrCode,
      qrCodeUrl,
      copiaECola,

      expiracao: primeiroValor(
        transacao.expires_at,
        transacao.expiresAt
      ),

      status: transacao.status || cobranca.status || pedido.status,
    };
  }

  if (metodo === 'boleto') {
    boleto = {
      url: primeiroValor(
        transacao.url,
        transacao.pdf,
        transacao.boleto_url,
        transacao.boletoUrl
      ),

      linhaDigitavel: primeiroValor(
        transacao.line,
        transacao.line_code,
        transacao.linha_digitavel,
        transacao.lineCode
      ),

      codigoBarras: primeiroValor(
        transacao.barcode,
        transacao.bar_code,
        transacao.codigo_barras,
        transacao.barCode
      ),

      vencimento: primeiroValor(
        transacao.due_at,
        transacao.dueAt
      ),

      status: transacao.status || cobranca.status || pedido.status,
    };
  }

  return {
    success: true,
    message: 'Pedido criado com sucesso.',

    cadastroId,
    plano: produto.id,

    valores: {
      cobrancaCentavos: cobrancaCalculada.valorCentavos,

      mensalidadeCentavos:
        produto.valorMensalCentavos || null,

      adesaoCentavos:
        produto.adesaoCentavos || null,

      totalAnualCentavos:
        produto.valorTotalAnualCentavos || null,

      parcelas: cobrancaCalculada.parcelas,
    },

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

      pix,
      boleto,

      qr_code: pix?.qrCode || null,
      qr_code_url: pix?.qrCodeUrl || null,
      copia_e_cola: pix?.copiaECola || null,

      boleto_url: boleto?.url || null,
      boleto_barcode: boleto?.codigoBarras || null,
      linha_digitavel: boleto?.linhaDigitavel || null,
    },

    pix,
    boleto,
  };
}

/* =====================================================
   ROTA PRINCIPAL DO CHECKOUT
===================================================== */

router.post('/checkout', async (req, res) => {
  try {
    const {
      cadastroId,
      plano,
      paymentMethod,
      cardToken,
      installments,
    } = req.body || {};

    /* -----------------------------------------------
       1. VALIDAR IDENTIFICADOR
    ----------------------------------------------- */

    if (!texto(cadastroId)) {
      return res.status(400).json({
        success: false,
        error: 'Identificador do cadastro não informado.',
      });
    }

    /* -----------------------------------------------
       2. BUSCAR CADASTRO
    ----------------------------------------------- */

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

    /* -----------------------------------------------
       3. VALIDAR FORMA DE ADESÃO
    ----------------------------------------------- */

    if (cadastro.dados.pagamento !== 'cartao') {
      return res.status(400).json({
        success: false,
        error: 'Este cadastro não está habilitado para checkout pela Pagar.me.',
      });
    }

    /* -----------------------------------------------
       4. CONFERIR PLANO
    ----------------------------------------------- */

    const planoCadastro = texto(
      cadastro.dados.plano
    ).toLowerCase();

    const planoRecebido = texto(plano).toLowerCase();

    if (
      !planoCadastro ||
      planoRecebido !== planoCadastro
    ) {
      return res.status(400).json({
        success: false,
        error: 'O plano informado não corresponde ao cadastro.',
      });
    }

    const produto = obterPlano(planoCadastro);

    /* -----------------------------------------------
       5. VALIDAR CLIENTE
    ----------------------------------------------- */

    const customer = validarCliente(cadastro.dados);

    /* -----------------------------------------------
       6. VALIDAR MÉTODO DE PAGAMENTO
    ----------------------------------------------- */

    const metodo = texto(paymentMethod).toLowerCase();

    const metodosPermitidos = [
      'pix',
      'credit_card',
      'boleto',
    ];

    if (!metodosPermitidos.includes(metodo)) {
      return res.status(400).json({
        success: false,
        error: 'Forma de pagamento inválida. Informe pix, credit_card ou boleto.',
      });
    }

    /* -----------------------------------------------
       7. CALCULAR VALOR NO BACKEND
    ----------------------------------------------- */

    const cobrancaCalculada = calcularCobranca(
      produto,
      metodo,
      installments
    );

    /* -----------------------------------------------
       8. VERIFICAR PEDIDO EXISTENTE
    ----------------------------------------------- */

    const pedidoExistente = await consultarPedidoExistente(
      cadastro,
      metodo,
      cobrancaCalculada
    );

    if (pedidoExistente) {
      return res.status(200).json(
        gerarRespostaCheckout(
          pedidoExistente,
          metodo,
          cadastroId,
          produto,
          cobrancaCalculada
        )
      );
    }

    /* -----------------------------------------------
       9. CONFIGURAR PAGAMENTO
    ----------------------------------------------- */

    const payment = {
      payment_method: metodo,
    };

    // PIX
    if (metodo === 'pix') {
      payment.pix = {
        expires_in: 1800,
      };
    }

    // CARTÃO DE CRÉDITO
    if (metodo === 'credit_card') {
      const token = texto(cardToken);

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token do cartão não informado.',
        });
      }

      payment.credit_card = {
        card_token: token,
        installments: cobrancaCalculada.parcelas,
        statement_descriptor: 'DR DE TODOS',
      };
    }

    // BOLETO
    if (metodo === 'boleto') {
      payment.boleto = {
        instructions:
          'Pagamento referente ao plano Doutor de Todos.',

        due_at: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString(),
      };
    }

    /* -----------------------------------------------
       10. CHAVE DE IDEMPOTÊNCIA
    ----------------------------------------------- */

    const chaveIdempotencia = crypto
      .createHash('sha256')
      .update([
        cadastroId,
        produto.id,
        metodo,
        cobrancaCalculada.valorCentavos,
        cobrancaCalculada.parcelas,
      ].join(':'))
      .digest('hex');

    /* -----------------------------------------------
       11. MONTAR PEDIDO
    ----------------------------------------------- */

    const dadosPedido = {
      items: [
        {
          amount: cobrancaCalculada.valorCentavos,
          description: cobrancaCalculada.descricao,
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

        tipo_cobranca:
          cobrancaCalculada.tipoCobranca,

        valor_cobranca_centavos:
          String(cobrancaCalculada.valorCentavos),

        parcelas:
          String(cobrancaCalculada.parcelas),
      },
    };

    /* -----------------------------------------------
       12. CRIAR PEDIDO NA PAGAR.ME
    ----------------------------------------------- */

    const pedido = await pagarmeService.criarPedido(
      dadosPedido,
      chaveIdempotencia
    );

    if (!pedido?.id) {
      throw erroHttp(
        'A Pagar.me não retornou o identificador do pedido.',
        502
      );
    }

    /* -----------------------------------------------
       13. CONFERIR VALOR RETORNADO
    ----------------------------------------------- */

    if (
      pedido.amount !== undefined &&
      Number(pedido.amount) !==
      Number(cobrancaCalculada.valorCentavos)
    ) {
      console.error('Valor divergente no pedido Pagar.me:', {
        pedidoId: pedido.id,
        valorEsperado: cobrancaCalculada.valorCentavos,
        valorRetornado: pedido.amount,
      });

      throw erroHttp(
        'O valor retornado pela Pagar.me é diferente do valor calculado. Entre em contato com o atendimento.',
        502
      );
    }

    /* -----------------------------------------------
       14. SALVAR PEDIDO NO FIREBASE
    ----------------------------------------------- */

    await salvarPedidoNoCadastro(
      cadastroId,
      pedido,
      metodo,
      produto,
      cobrancaCalculada
    );

    /* -----------------------------------------------
       15. DIAGNÓSTICO DA RESPOSTA PIX
    ----------------------------------------------- */

    const { cobranca, transacao } = extrairTransacao(pedido);

    if (metodo === 'pix') {
      console.log('DIAGNÓSTICO PIX PAGAR.ME:', {
        pedidoId: pedido.id,
        statusPedido: pedido.status,

        chargeId: cobranca.id || null,
        statusCobranca: cobranca.status || null,

        possuiTransacao: Boolean(
          cobranca.last_transaction ||
          cobranca.lastTransaction ||
          cobranca.transaction
        ),

        possuiQrCode: Boolean(
          transacao.qr_code ||
          transacao.qrCode
        ),

        possuiQrCodeUrl: Boolean(
          transacao.qr_code_url ||
          transacao.qrCodeUrl ||
          transacao.qr_code_image
        ),

        possuiCopiaECola: Boolean(
          transacao.copy_paste ||
          transacao.copyPaste
        ),

        statusTransacao: transacao.status || null,
      });
    }

    /* -----------------------------------------------
       16. REGISTRAR PEDIDO
    ----------------------------------------------- */

    console.log('Pedido Pagar.me criado:', {
      cadastroId,
      plano: produto.id,
      pedidoId: pedido.id,
      status: pedido.status,
      metodo,
      valorCentavos: cobrancaCalculada.valorCentavos,
      parcelas: cobrancaCalculada.parcelas,
      chargeId: cobranca.id || null,
    });

    /* -----------------------------------------------
       17. DEVOLVER DADOS AO FRONTEND
    ----------------------------------------------- */

    return res.status(201).json(
      gerarRespostaCheckout(
        pedido,
        metodo,
        cadastroId,
        produto,
        cobrancaCalculada
      )
    );

  } catch (error) {
    console.error('Erro ao criar checkout Pagar.me:', {
      mensagem: error.message,
      status: error.status || 502,
      codigo: error.codigo || null,
      detalhes: error.detalhes || null,
    });

    return res.status(error.status || 502).json({
      success: false,

      error:
        error.message ||
        'Não foi possível criar o pedido.',

      campos: error.campos || undefined,
    });
  }
});

module.exports = router;