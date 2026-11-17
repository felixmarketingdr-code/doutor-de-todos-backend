
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const pagarmeService = require("../services/pagarmeService");
const { obterPlano } = require("../services/planosService");

const {
  buscarCadastroInterno,
  atualizarPagamentoInterno,
  atualizarStatusPagamentoInterno,
} = require("./cadastroRoutes");

// ======================================================
// AUTENTICAÇÃO DO WEBHOOK
// ======================================================

function validarTokenWebhook(tokenRecebido) {
  const tokenConfigurado = String(
    process.env.PAGARME_WEBHOOK_TOKEN || ""
  ).trim();

  if (!tokenConfigurado || tokenConfigurado.length < 32) {
    console.error(
      "PAGARME_WEBHOOK_TOKEN não configurado corretamente."
    );

    return false;
  }

  if (
    typeof tokenRecebido !== "string" ||
    !tokenRecebido
  ) {
    return false;
  }

  const recebido = Buffer.from(tokenRecebido);
  const configurado = Buffer.from(tokenConfigurado);

  if (recebido.length !== configurado.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    recebido,
    configurado
  );
}

// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalizarStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function texto(valor) {
  return String(valor ?? "").trim();
}

// ======================================================
// EXTRAÇÃO DO EVENTO
// ======================================================

function extrairEvento(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Payload do webhook inválido.");
  }

  const evento = texto(body.type || body.event);

  const pedidoId = texto(
    body.data?.id ||
    body.data?.order?.id ||
    body.order?.id
  );

  if (!evento) {
    throw new Error(
      "Evento não identificado no webhook."
    );
  }

  if (!pedidoId) {
    throw new Error(
      "Identificador do pedido não encontrado."
    );
  }

  return {
    evento,
    pedidoId,
    eventoId: texto(body.id),
  };
}

// ======================================================
// CALCULAR VALOR ESPERADO DO PEDIDO
// ======================================================

function obterValorEsperado(plano, metadata = {}) {
  const tipoCobranca = texto(
    metadata.tipo_cobranca
  );

  if (plano.id === "light") {
    return {
      valorCentavos: Number(
        plano.valorPrimeiraCobrancaCentavos
      ),
      tipoCobranca: "primeira_cobranca",
    };
  }

  if (plano.id === "plus") {
    return {
      valorCentavos: Number(
        plano.valorTotalAnualCentavos
      ),
      tipoCobranca:
        tipoCobranca || "anual_parcelado",
    };
  }

  throw new Error("Plano não reconhecido.");
}

// ======================================================
// VALIDAR PEDIDO CONSULTADO NA PAGAR.ME
// ======================================================

function validarDadosPedido(pedido) {
  if (!pedido || typeof pedido !== "object") {
    throw new Error(
      "Pedido não encontrado na Pagar.me."
    );
  }

  const metadata = pedido.metadata || {};

  const cadastroId = texto(metadata.cadastro_id);
  const planoId = texto(metadata.plano).toLowerCase();

  if (!cadastroId) {
    throw new Error(
      "O pedido não possui cadastro_id nos metadados."
    );
  }

  if (!planoId) {
    throw new Error(
      "O pedido não possui plano nos metadados."
    );
  }

  const plano = obterPlano(planoId);

  if (!plano) {
    throw new Error("Plano não reconhecido.");
  }

  const esperado = obterValorEsperado(
    plano,
    metadata
  );

  const valorPedido = Number(pedido.amount);

  if (
    !Number.isInteger(valorPedido) ||
    !Number.isInteger(esperado.valorCentavos) ||
    valorPedido !== esperado.valorCentavos
  ) {
    console.error(
      "Divergência no valor do pedido:",
      {
        pedidoId: pedido.id,
        plano: plano.id,
        valorRecebido: valorPedido,
        valorEsperado: esperado.valorCentavos,
      }
    );

    throw new Error(
      "O valor confirmado na Pagar.me não corresponde ao valor esperado do plano."
    );
  }

  if (
    metadata.valor_cobranca_centavos !== undefined
  ) {
    const valorMetadata = Number(
      metadata.valor_cobranca_centavos
    );

    if (
      valorMetadata !== esperado.valorCentavos
    ) {
      throw new Error(
        "O valor informado nos metadados não corresponde ao pedido."
      );
    }
  }

  return {
    cadastroId,
    plano,
    valorCentavos: valorPedido,
    tipoCobranca: esperado.tipoCobranca,
  };
}

// ======================================================
// RECUPERAR IDENTIFICADOR DO PEDIDO SALVO
// ======================================================

function normalizarIdentificadorPedido(valor) {
  if (!valor) return "";

  if (typeof valor === "object") {
    return texto(
      valor.idPedido ||
      valor.id ||
      valor.order_id ||
      valor.orderId ||
      valor.pedido_id
    );
  }

  return texto(valor);
}

function obterPedidoSalvo(cadastro) {
  return (
    normalizarIdentificadorPedido(
      cadastro.pedidoPagarme
    ) ||
    normalizarIdentificadorPedido(
      cadastro.pedidoPagamento
    )
  );
}

// ======================================================
// VALIDAR VÍNCULO DO PEDIDO COM O CADASTRO
// ======================================================

function validarVinculoPedido(cadastro, pedidoId, cadastroIdMetadata) {
  const pedidoSalvo = obterPedidoSalvo(cadastro);
  const cadastroIdSalvo = texto(
    cadastro.id ||
    cadastro.cadastroId ||
    cadastro._id
  );

  // O pedido é consultado diretamente na Pagar.me e seu metadata
  // já foi validado em validarDadosPedido(). Se o webhook chegar
  // antes de o checkout gravar o pedido no cadastro, aceitamos o
  // vínculo provisório somente quando o cadastro do metadata
  // corresponde ao cadastro que foi localizado no Firebase.
  if (!pedidoSalvo) {
    if (
      !cadastroIdMetadata ||
      (cadastroIdSalvo && cadastroIdSalvo !== String(cadastroIdMetadata))
    ) {
      throw new Error(
        "Não foi possível confirmar o vínculo do pedido com o cadastro."
      );
    }

    console.warn(
      "Webhook recebido antes da gravação do pedido no cadastro. " +
      "Vínculo validado pelo metadata do pedido:",
      {
        pedidoId,
        cadastroId: cadastroIdMetadata,
      }
    );

    return {
      vinculoPendente: true,
      pedidoSalvo: null,
    };
  }

  if (String(pedidoSalvo) !== String(pedidoId)) {
    throw new Error(
      "O pedido recebido não corresponde ao pedido vinculado ao cadastro."
    );
  }

  return {
    vinculoPendente: false,
    pedidoSalvo,
  };
}

// ======================================================
// RECEBIMENTO DO WEBHOOK
// POST /webhooks/pagarme/:token
// ======================================================

router.post("/:token", async (req, res) => {
  try {
    // ======================================
    // 1. AUTENTICAR
    // ======================================

    if (!validarTokenWebhook(req.params.token)) {
      console.warn(
        "Webhook Pagar.me recebido com token inválido."
      );

      return res.status(401).json({
        success: false,
        error: "Webhook não autorizado.",
      });
    }

    // ======================================
    // 2. IDENTIFICAR EVENTO E PEDIDO
    // ======================================

    const {
      evento,
      pedidoId,
      eventoId,
    } = extrairEvento(req.body);

    console.log("-----------------------------------");
    console.log("WEBHOOK PAGAR.ME RECEBIDO");
    console.log("Evento:", evento);
    console.log("Pedido:", pedidoId);
    console.log(
      "Evento ID:",
      eventoId || "Não informado"
    );
    console.log("-----------------------------------");

    const eventosPermitidos = [
      "order.paid",
      "order.payment_failed",
      "order.canceled",
    ];

    if (!eventosPermitidos.includes(evento)) {
      return res.status(200).json({
        success: true,
        message: "Evento recebido, sem ação necessária.",
        evento,
      });
    }

    // ======================================
    // 3. CONSULTAR PEDIDO NA PAGAR.ME
    // ======================================

    const pedido =
      await pagarmeService.consultarPedido(pedidoId);

    if (
      !pedido?.id ||
      String(pedido.id) !== String(pedidoId)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "O pedido consultado não corresponde à notificação.",
      });
    }

    const statusPedido = normalizarStatus(
      pedido.status
    );

    // ======================================
    // 4. VALIDAR CADASTRO, PLANO E VALOR
    // ======================================

    const {
      cadastroId,
      plano,
      valorCentavos,
      tipoCobranca,
    } = validarDadosPedido(pedido);

    // ======================================
    // 5. LOCALIZAR CADASTRO NO FIREBASE
    // ======================================

    const cadastro =
      await buscarCadastroInterno(cadastroId);

    if (!cadastro) {
      console.error(
        "Cadastro não encontrado:",
        cadastroId
      );

      return res.status(404).json({
        success: false,
        error:
          "Cadastro vinculado ao pagamento não encontrado.",
      });
    }

    // ======================================
    // 6. VALIDAR PLANO E PEDIDO VINCULADO
    // ======================================

    const planoCadastro = texto(
      cadastro.dados?.plano ||
      cadastro.plano
    ).toLowerCase();

    if (
      !planoCadastro ||
      planoCadastro !== plano.id
    ) {
      throw new Error(
        "O plano do cadastro não corresponde ao plano do pedido."
      );
    }

    const validacaoVinculo = validarVinculoPedido(
      cadastro,
      pedidoId,
      cadastroId
    );

    // ======================================
    // 7. PAGAMENTO CONFIRMADO
    // ======================================

    if (evento === "order.paid") {
      if (statusPedido !== "paid") {
        return res.status(202).json({
          success: true,
          confirmado: false,
          message:
            "Pedido ainda não confirmado como pago na Pagar.me.",
          status: statusPedido,
        });
      }

      console.log("===================================");
      console.log("PAGAMENTO CONFIRMADO NA PAGAR.ME");
      console.log("Pedido:", pedido.id);
      console.log("Cadastro:", cadastroId);
      console.log("Plano:", plano.nome);
      console.log(
        "Tipo de cobrança:",
        tipoCobranca
      );
      console.log(
        "Valor em centavos:",
        valorCentavos
      );
      console.log(
        "Valor em reais:",
        (valorCentavos / 100).toFixed(2)
      );
      console.log("===================================");

      // A função central:
      // 1. Atualiza o pagamento no cadastro.
      // 2. Cria/atualiza o cliente.
      // 3. Converte o lead.
      // 4. Tenta sincronizar contrato e pagamento
      //    com a Gestão.
      //
      // O valor é convertido de centavos para reais
      // antes de ser enviado à integração da Gestão.

      const resultadoPagamentoInterno =
        await atualizarPagamentoInterno(
          cadastroId,
          {
            gateway: "pagarme",
            idPedido: pedidoId,
            status: "pago",
            valor: valorCentavos / 100,
            plano: plano.id,
            tipoCobranca,
          },
          "pagarme"
        );

      const cadastroFinal =
        await buscarCadastroInterno(cadastroId);

      console.log(
        "Pagamento processado internamente:",
        cadastroId
      );

      return res.status(200).json({
        success: true,
        confirmado: true,
        duplicado:
          resultadoPagamentoInterno?.duplicado || false,

        message:
          "Pagamento confirmado e processado.",

        pedidoId,
        cadastroId,

        gateway: "pagarme",
        plano: plano.id,
        status: "pago",

        valorCentavos,
        valorReais: valorCentavos / 100,
        tipoCobranca,

        resultadoPagamentoInterno,

        integracoes: {
          firebase: "pagamento_registrado",
          lead: "convertido",
          cliente: "registrado",

          gestaoDoutorDeTodos:
            cadastroFinal?.integracoes
              ?.gestaoDoutorDeTodos || "pendente",

          detalheGestao:
            cadastroFinal?.gestao || null,
        },
      });
    }

    // ======================================
    // 8. PAGAMENTO RECUSADO
    // ======================================

    if (evento === "order.payment_failed") {
      // Uma tentativa de pagamento pode falhar
      // enquanto o pedido continua pendente.
      // Nesse caso, não encerramos o pedido.

      if (
        statusPedido !== "failed" &&
        statusPedido !== "payment_failed"
      ) {
        return res.status(202).json({
          success: true,
          confirmado: false,
          message:
            "A tentativa de pagamento falhou, mas o pedido ainda não está encerrado na Pagar.me.",
          pedidoId,
          cadastroId,
          status: statusPedido,
        });
      }

      const resultado =
        await atualizarStatusPagamentoInterno(
          cadastroId,
          "falhou",
          pedidoId,
          "pagarme"
        );

      console.log(
        "Pagamento recusado e atualizado:",
        pedidoId,
        cadastroId
      );

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: "Pagamento não aprovado.",
        pedidoId,
        cadastroId,
        status: "falhou",
        resultado,
      });
    }

    // ======================================
    // 9. PEDIDO CANCELADO
    // ======================================

    if (evento === "order.canceled") {
      if (
        statusPedido !== "canceled" &&
        statusPedido !== "cancelled"
      ) {
        return res.status(202).json({
          success: true,
          confirmado: false,
          message:
            "A Pagar.me ainda não confirma o cancelamento do pedido.",
          pedidoId,
          cadastroId,
          status: statusPedido,
        });
      }

      const resultado =
        await atualizarStatusPagamentoInterno(
          cadastroId,
          "cancelado",
          pedidoId,
          "pagarme"
        );

      console.log(
        "Pedido cancelado e atualizado:",
        pedidoId,
        cadastroId
      );

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: "Pedido cancelado.",
        pedidoId,
        cadastroId,
        status: "cancelado",
        resultado,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processado.",
    });

  } catch (error) {
    console.error(
      "Erro ao processar webhook Pagar.me:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error:
        "Não foi possível processar o webhook.",
    });
  }
});

// ======================================================
// EXPORTAÇÃO
// ======================================================

module.exports = router;
