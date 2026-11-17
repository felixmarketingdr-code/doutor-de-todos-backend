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



   EXTRAÇÃO DA COBRANÇA E TRANSAÇÃO



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



  return valores.find(valor =>



    valor !== undefined &&



    valor !== null &&



    String(valor).trim() !== ''



  ) ?? null;



}



/* =====================================================



   SOMAR UM MÊS DE CALENDÁRIO



   Exemplo:



   15/01 -> 15/02



   31/01 -> último dia de fevereiro



===================================================== */



function adicionarUmMes(dataBase = new Date()) {



  const ano = dataBase.getFullYear();



  const mes = dataBase.getMonth();



  const dia = dataBase.getDate();



  const ultimoDia = new Date(



    ano,



    mes + 2,



    0



  ).getDate();



  const diaDestino = Math.min(dia, ultimoDia);



  const proxima = new Date(dataBase);



  proxima.setDate(1);



  proxima.setMonth(mes + 1);



  proxima.setDate(diaDestino);



  proxima.setHours(0, 0, 0, 0);



  return proxima;



}



/* =====================================================



   CÁLCULO DOS VALORES



   LIGHT:



   Primeira cobrança = R$ 139,80



   Próximas mensalidades = R$ 39,90



   PLUS:



   Total anual = R$ 958,80



   Cartão = 12 parcelas de R$ 79,90



===================================================== */



function calcularCobranca(



  produto,



  metodo,



  parcelasSolicitadas



) {



  if (produto.id === 'light') {



    if (metodo !== 'credit_card') {



      throw erroHttp(



        'O plano Light possui mensalidade automática e aceita somente cartão de crédito.'



      );



    }



    if (



      !produto.valorPrimeiraCobrancaCentavos ||



      !produto.valorMensalCentavos



    ) {



      throw erroHttp(



        'Valores do plano Light não configurados.',



        500



      );



    }



    return {



      valorCentavos:



        produto.valorPrimeiraCobrancaCentavos,



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



      const parcelas = Number(



        parcelasSolicitadas || 12



      );



      if (parcelas !== 12) {



        throw erroHttp(



          'O plano Plus deve ser contratado em 12 parcelas.'



        );



      }



      return {



        valorCentavos:



          produto.valorTotalAnualCentavos,



        parcelas: 12,



        descricao:



          'Plano Plus - contratação anual em 12 parcelas',



        tipoCobranca: 'anual_parcelado',



      };



    }



    if (!['pix', 'boleto'].includes(metodo)) {



      throw erroHttp(



        'Forma de pagamento inválida para o plano Plus.'



      );



    }



    return {



      valorCentavos:



        produto.valorTotalAnualCentavos,



      parcelas: 1,



      descricao:



        'Plano Plus - contratação anual',



      tipoCobranca: 'anual_integral',



    };



  }



  throw erroHttp('Plano não reconhecido.');



}



/* =====================================================



   CONSULTAR PEDIDO ANTERIOR



===================================================== */



/* =====================================================

   VALIDAR PLANO LIGHT ANTES DE QUALQUER COBRANÇA

===================================================== */



async function validarPlanoLightConfigurado(produto) {
  if (produto.id !== 'light') return null;

  const planId = texto(process.env.PAGARME_PLANO_LIGHT_ID);

  if (!planId) {
    throw erroHttp(
      'PAGARME_PLANO_LIGHT_ID não está configurado no servidor.',
      500
    );
  }

  let plano;

  try {
    plano = await pagarmeService.consultarPlano(planId);
  } catch (error) {
    console.error('Falha ao consultar plano Light na Pagar.me:', {
      mensagem: error.message,
      status: error.response?.status || error.status || null,
      codigo: error.code || null
    });

    throw erroHttp(
      'Não foi possível consultar o plano recorrente Light na Pagar.me. Verifique as credenciais e os logs do servidor.',
      502
    );
  }

  const itens = Array.isArray(plano?.items) ? plano.items : [];
  const item = itens[0] || {};

  const precoBruto =
    item?.pricing_scheme?.price ??
    item?.pricing_scheme?.price_in_cents ??
    item?.price ??
    plano?.pricing_scheme?.price ??
    null;

  const precoPlano = precoBruto === null ? null : Number(precoBruto);
  const mensalidadeSistema = Number(produto.valorMensalCentavos);

  const status = texto(plano?.status).toLowerCase();
  const intervalo = texto(plano?.interval).toLowerCase();
  const quantidadeIntervalo = Number(plano?.interval_count);

  const verificacoes = {
    idCorreto: String(plano?.id || '') === planId,
    ativo: status === 'active',
    intervaloMensal: intervalo === 'month' || intervalo === 'months',
    intervaloDeUmMes: quantidadeIntervalo === 1,
    precoEncontrado: Number.isFinite(precoPlano),
    precoCorreto:
      Number.isFinite(precoPlano) &&
      Number.isFinite(mensalidadeSistema) &&
      precoPlano === mensalidadeSistema
  };

  console.info('Validação do plano Light Pagar.me:', {
    planIdConfigurado: planId,
    planIdRetornado: plano?.id || null,
    status,
    intervalo,
    quantidadeIntervalo,
    precoPlanoCentavos: Number.isFinite(precoPlano) ? precoPlano : null,
    mensalidadeSistemaCentavos: Number.isFinite(mensalidadeSistema)
      ? mensalidadeSistema
      : null,
    quantidadeItens: itens.length,
    verificacoes
  });

  if (!Object.values(verificacoes).every(Boolean)) {
    throw erroHttp(
      'O plano Light foi localizado, mas os dados retornados pela Pagar.me não correspondem à configuração do sistema. Consulte os logs do servidor para verificar status, periodicidade e valor. Nenhuma nova cobrança foi criada por esta validação.',
      409
    );
  }

  return planId;
}



async function consultarPedidoExistente(



  cadastro,



  metodo,



  calculada



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



  if (



    metodoAnterior &&



    metodoAnterior !== metodo



  ) {



    return null;



  }



  const valorAnterior = Number(



    cadastro.valorPagamentoCentavos || 0



  );



  if (



    valorAnterior &&



    valorAnterior !== calculada.valorCentavos



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



      Number(calculada.valorCentavos)



    ) {



      return null;



    }



    return pedido;



  } catch (error) {



    console.error(



      'Falha ao consultar pedido anterior:',



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



  calculada,



  assinatura = null



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



    const atualizacao = {



      gatewayPagamento: 'pagarme',



      pedidoPagamento: String(pedido.id),



      pedidoPagarme: String(pedido.id),



      chargePagarme:



        pedido.charges?.[0]?.id || null,



      metodoPagamento: metodo,



      planoPagamento: produto.id,



      valorPagamentoCentavos:



        calculada.valorCentavos,



      valorMensalCentavos:



        produto.valorMensalCentavos || null,



      valorAdesaoCentavos:



        produto.adesaoCentavos || null,



      valorTotalAnualCentavos:



        produto.valorTotalAnualCentavos || null,



      parcelasPagamento:



        calculada.parcelas,



      tipoCobranca:



        calculada.tipoCobranca,



      statusPedidoPagarme:



        texto(pedido.status),



      atualizadoEm: new Date().toISOString(),



    };



    if (assinatura) {



      atualizacao.pagarmeSubscriptionId =



        String(assinatura.id);



      atualizacao.statusAssinatura =



        texto(assinatura.status || 'pending');



      atualizacao.proximaCobranca =



        assinatura.start_at || null;



      atualizacao.recorrenciaMensalCentavos =



        produto.valorMensalCentavos;



      atualizacao.recorrenciaIntervalo = 'month';



      atualizacao.recorrenciaIntervaloQuantidade = 1;



    }



    transaction.update(referencia, atualizacao);



  });



}



/* =====================================================



   MONTAR RESPOSTA DO CHECKOUT



===================================================== */



function montarResposta(



  pedido,



  metodo,



  cadastroId,



  produto,



  calculada,



  assinatura = null



) {



  const { cobranca, transacao } =



    extrairTransacao(pedido);



  let pix = null;



  let boleto = null;



  if (metodo === 'pix') {



    pix = {



      qrCode: primeiroValor(



        transacao.qr_code,



        transacao.qrCode



      ),



      qrCodeUrl: primeiroValor(



        transacao.qr_code_url,



        transacao.qrCodeUrl,



        transacao.qr_code_image



      ),



      copiaECola: primeiroValor(



        transacao.copy_paste,



        transacao.copyPaste,



        transacao.qr_code



      ),



      expiracao: primeiroValor(



        transacao.expires_at,



        transacao.expiresAt



      ),



      status:



        transacao.status ||



        cobranca.status ||



        pedido.status,



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



        transacao.linha_digitavel



      ),



      codigoBarras: primeiroValor(



        transacao.barcode,



        transacao.bar_code,



        transacao.codigo_barras



      ),



      vencimento: primeiroValor(



        transacao.due_at,



        transacao.dueAt



      ),



      status:



        transacao.status ||



        cobranca.status ||



        pedido.status,



    };



  }



  return {



    success: true,



    message: 'Pedido criado com sucesso.',



    cadastroId,



    plano: produto.id,



    valores: {



      cobrancaCentavos:



        calculada.valorCentavos,



      mensalidadeCentavos:



        produto.valorMensalCentavos || null,



      adesaoCentavos:



        produto.adesaoCentavos || null,



      totalAnualCentavos:



        produto.valorTotalAnualCentavos || null,



      parcelas: calculada.parcelas,



    },



    pedido: {



      id: pedido.id,



      status: pedido.status,



      amount: pedido.amount,



      currency: pedido.currency,



    },



    assinatura: assinatura ? {



      id: assinatura.id,



      status: assinatura.status,



      inicio: assinatura.start_at || null,



      proximaCobranca: assinatura.start_at || null,



      valorMensalCentavos:



        produto.valorMensalCentavos,



      intervalo: 'mensal',



    } : null,



    pagamento: {



      metodo,



      status:



        cobranca.status || pedido.status,



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



    if (!texto(cadastroId)) {



      return res.status(400).json({



        success: false,



        error: 'Identificador do cadastro não informado.',



      });



    }



    const cadastro =



      await buscarCadastroInterno(cadastroId);



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



    if (cadastro.dados.pagamento !== 'cartao') {



      return res.status(400).json({



        success: false,



        error: 'Este cadastro não está habilitado para checkout pela Pagar.me.',



      });



    }



    const planoCadastro = texto(



      cadastro.dados.plano



    ).toLowerCase();



    const planoRecebido = texto(



      plano



    ).toLowerCase();



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



    const customer = validarCliente(



      cadastro.dados



    );



    const metodo = texto(



      paymentMethod



    ).toLowerCase();



    if (!['pix', 'credit_card', 'boleto'].includes(metodo)) {



      return res.status(400).json({



        success: false,



        error: 'Forma de pagamento inválida.',



      });



    }



    const calculada = calcularCobranca(



      produto,



      metodo,



      installments



    );



    const planIdLight = await validarPlanoLightConfigurado(produto);



    const token = texto(cardToken);



    if (metodo === 'credit_card' && !token) {



      return res.status(400).json({



        success: false,



        error: 'Token do cartão não informado.',



      });



    }



    const pedidoExistente =



      await consultarPedidoExistente(



        cadastro,



        metodo,



        calculada



      );



    // Pedido anterior será reutilizado para evitar uma nova cobrança.



    const payment = {



      payment_method: metodo,



    };



    if (metodo === 'pix') {



      payment.pix = {



        expires_in: 1800,



      };



    }



    if (metodo === 'credit_card') {



      payment.credit_card = {



        card_token: token,



        installments: calculada.parcelas,



        statement_descriptor: 'DR DE TODOS',



      };



    }



    if (metodo === 'boleto') {



      payment.boleto = {



        instructions:



          'Pagamento referente ao plano Doutor de Todos.',



        due_at: new Date(



          Date.now() + 3 * 24 * 60 * 60 * 1000



        ).toISOString(),



      };



    }



    const chaveIdempotencia = crypto



      .createHash('sha256')



      .update([



        cadastroId,



        produto.id,



        metodo,



        calculada.valorCentavos,



        calculada.parcelas,



      ].join(':'))



      .digest('hex');



    const dadosPedido = {



      items: [



        {



          amount: calculada.valorCentavos,



          description: calculada.descricao,



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



          calculada.tipoCobranca,



        valor_cobranca_centavos:



          String(calculada.valorCentavos),



        parcelas:



          String(calculada.parcelas),



      },



    };



    /* CRIAR PEDIDO INICIAL */



    const pedido = pedidoExistente || await pagarmeService.criarPedido(

      dadosPedido,

      chaveIdempotencia

    );



    if (!pedido?.id) {



      throw erroHttp(



        'A Pagar.me não retornou o identificador do pedido.',



        502



      );



    }



    if (



      pedido.amount !== undefined &&



      Number(pedido.amount) !==



      calculada.valorCentavos



    ) {



      throw erroHttp(



        'O valor retornado pela Pagar.me diverge do valor calculado.',



        502



      );



    }



    /* =================================================



       CRIAR ASSINATURA MENSAL DO LIGHT



       Primeira cobrança: R$ 139,80.



       Próxima cobrança: R$ 39,90 após um mês.



    ================================================= */



    let assinatura = null;



    if (produto.id === 'light') {



      const planId = planIdLight;

      const dataCriacaoPedido = pedido.created_at

        ? new Date(pedido.created_at)

        : new Date();



      if (Number.isNaN(dataCriacaoPedido.getTime())) {

        throw erroHttp(

          'Não foi possível determinar a data do pedido para agendar a recorrência. Não gere outro pagamento; solicite conferência do atendimento.',

          502

        );

      }



      const proximaData = adicionarUmMes(dataCriacaoPedido);



      const startAt = [



        proximaData.getFullYear(),



        String(proximaData.getMonth() + 1).padStart(2, '0'),



        String(proximaData.getDate()).padStart(2, '0'),



      ].join('-');



      if (cadastro.pagarmeSubscriptionId) {

        assinatura = await pagarmeService.consultarAssinatura(

          String(cadastro.pagarmeSubscriptionId)

        );

      } else {

        const chaveAssinatura = crypto

          .createHash('sha256')

          .update(`${cadastroId}:light:subscription:${pedido.id}`)

          .digest('hex');



        assinatura = await pagarmeService.criarAssinatura(

          {

            plan_id: planId,

            payment_method: 'credit_card',

            start_at: startAt,

            customer,

            card: {

              card_token: token,

            },

            installments: 1,

            metadata: {

              cadastro_id: String(cadastroId),

              plano: 'light',

              origem: 'site_doutor_de_todos',

              pedido_inicial_id: String(pedido.id),

              tipo_cobranca: 'mensalidade_recorrente',

            },

          },

          chaveAssinatura

        );

      }



      if (!assinatura?.id) {



        throw erroHttp(



          'A cobrança inicial foi criada, mas a assinatura mensal não foi confirmada pela Pagar.me. Não tente pagar novamente; contate o atendimento.',



          502



        );



      }



    }



    /* SALVAR PEDIDO E ASSINATURA */



    await salvarPedidoNoCadastro(



      cadastroId,



      pedido,



      metodo,



      produto,



      calculada,



      assinatura



    );



    console.log('Checkout Pagar.me criado:', {



      cadastroId,



      plano: produto.id,



      pedidoId: pedido.id,



      pedidoStatus: pedido.status,



      assinaturaId: assinatura?.id || null,



      proximaCobranca: assinatura?.start_at || null,



    });



    return res.status(201).json(



      montarResposta(



        pedido,



        metodo,



        cadastroId,



        produto,



        calculada,



        assinatura



      )



    );



  } catch (error) {



    console.error('Erro no checkout Pagar.me:', {



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
