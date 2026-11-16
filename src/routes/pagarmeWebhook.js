
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const pagarmeService = require("../services/pagarmeService");
const { obterPlano } = require("../services/planosService");

const {
  buscarCadastroInterno,
  atualizarPagamentoInterno,
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

  return crypto.timingSafeEqual(recebido, configurado);
}

// ======================================================
// NORMALIZAÇÃO
// ======================================================

function normalizarStatus(status) {
  return String(status || "").trim().toLowerCase();
}

// ======================================================
// EXTRAÇÃO DO EVENTO
// ======================================================

function extrairEvento(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Payload do webhook inválido.");
  }

  const evento = String(
    body.type || body.event || ""
  ).trim();

  const pedidoId = String(
    body.data?.id ||
    body.data?.order?.id ||
    body.order?.id ||
    ""
  ).trim();

  if (!evento) {
    throw new Error("Evento não identificado no webhook.");
  }

  if (!pedidoId) {
    throw new Error("Identificador do pedido não encontrado.");
  }

  return {
    evento,
    pedidoId,
    eventoId: String(body.id || "").trim(),
  };
}

// ======================================================
// VALIDAR PEDIDO CONSULTADO NA PAGAR.ME
// ======================================================

function validarDadosPedido(pedido) {
  if (!pedido || typeof pedido !== "object") {
    throw new Error("Pedido não encontrado na Pagar.me.");
  }

  const metadata = pedido.metadata || {};

  const cadastroId = String(
    metadata.cadastro_id || ""
  ).trim();

  const planoId = String(
    metadata.plano || ""
  ).trim().toLowerCase();

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

  if (Number(pedido.amount) !== Number(plano.valorCentavos)) {
    throw new Error(
      "O valor confirmado na Pagar.me não corresponde ao plano."
    );
  }

  return {
    cadastroId,
    plano,
  };
}

// ======================================================
// RECEBIMENTO DO WEBHOOK
//
// POST /webhooks/pagarme/:token
// ======================================================

router.post("/:token", async (req, res) => {
  try {
    // 1. AUTENTICAR

    if (!validarTokenWebhook(req.params.token)) {
      console.warn(
        "Webhook Pagar.me recebido com token inválido."
      );

      return res.status(401).json({
        success: false,
        error: "Webhook não autorizado.",
      });
    }

    // 2. IDENTIFICAR EVENTO E PEDIDO

    const {
      evento,
      pedidoId,
      eventoId,
    } = extrairEvento(req.body);

    console.log("-----------------------------------");
    console.log("WEBHOOK PAGAR.ME RECEBIDO");
    console.log("Evento:", evento);
    console.log("Pedido:", pedidoId);
    console.log("Evento ID:", eventoId || "Não informado");
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

    // 3. CONSULTAR PEDIDO DIRETAMENTE NA PAGAR.ME

    const pedido = await pagarmeService.consultarPedido(
      pedidoId
    );

    if (String(pedido.id) !== pedidoId) {
      return res.status(400).json({
        success: false,
        error: "O pedido consultado não corresponde à notificação.",
      });
    }

    // 4. VALIDAR CADASTRO, PLANO E VALOR

    const {
      cadastroId,
      plano,
    } = validarDadosPedido(pedido);

    const statusPedido = normalizarStatus(pedido.status);

    // 5. LOCALIZAR CADASTRO NO FIRESTORE

    const cadastro = await buscarCadastroInterno(cadastroId);

    if (!cadastro) {
      console.error(
        "Cadastro não encontrado:",
        cadastroId
      );

      return res.status(404).json({
        success: false,
        error: "Cadastro vinculado ao pagamento não encontrado.",
      });
    }

    // Conferir se o plano do cadastro corresponde ao pedido
    const planoCadastro = String(
      cadastro.dados?.plano || cadastro.plano || ""
    ).toLowerCase();

    if (planoCadastro && planoCadastro !== plano.id) {
      throw new Error(
        "O plano do cadastro não corresponde ao plano do pedido."
      );
    }

    // 6. PAGAMENTO CONFIRMADO

    if (evento === "order.paid") {
      if (statusPedido !== "paid") {
        return res.status(202).json({
          success: true,
          confirmado: false,
          message: "Pedido ainda não confirmado como pago.",
          status: statusPedido,
        });
      }

      // Impedir reprocessamento de pagamento já confirmado
      const pagamentoJaRegistrado =
        normalizarStatus(cadastro.statusPagamento) === "pago" &&
        String(
          cadastro.pedidoPagarme?.id ||
          cadastro.pedidoPagarme?.order_id ||
          cadastro.pedidoPagarme ||
          ""
        ) === pedidoId;

      if (pagamentoJaRegistrado) {
        return res.status(200).json({
          success: true,
          confirmado: true,
          duplicado: true,
          message: "Este pagamento já foi processado.",
          cadastroId,
          pedidoId,
        });
      }

      console.log("===================================");
      console.log("PAGAMENTO CONFIRMADO NA PAGAR.ME");
      console.log("Pedido:", pedido.id);
      console.log("Cadastro:", cadastroId);
      console.log("Plano:", plano.nome);
      console.log("Valor em centavos:", pedido.amount);
      console.log("===================================");

      // 7. ATUALIZAR CADASTRO INTERNO

      await atualizarPagamentoInterno(
        cadastroId,
        {
          gateway: "pagarme",
          idPedido: pedidoId,
          status: "pago",
          valor: Number(pedido.amount),
          plano: plano.id,
        },
        "pagarme"
      );

      // 8. INTEGRAÇÕES DE GESTÃO
      //
      // A criação do contrato na Gestão Doutor de Todos
      // e a gravação do contrato na Gestão Saúde Familiar
      // precisam ser conectadas após validar:
      //
      // - Estrutura real dos dados do cadastro.
      // - Endereço completo exigido pela API.
      // - Estrutura do contrato no Firestore.
      // - Aceitação do ID Pagar.me pela API externa.
      //
      // Não marcar integração como concluída sem resposta real.

      console.log(
        "Pagamento registrado internamente.",
        cadastroId
      );

      return res.status(200).json({
        success: true,
        confirmado: true,
        message: "Pagamento confirmado e registrado internamente.",
        pedidoId,
        cadastroId,
        gateway: "pagarme",
        plano: plano.id,
        status: "pago",
        integracoes: {
          firebase: "pagamento_registrado",
          gestaoSaudeFamiliar: "pendente_de_integracao",
          gestaoDoutorDeTodos: "pendente_de_integracao",
        },
      });
    }

    // 9. PAGAMENTO RECUSADO

    if (evento === "order.payment_failed") {
      console.log(
        "Pagamento não aprovado:",
        pedido.id,
        statusPedido
      );

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: "Pagamento não aprovado.",
        pedidoId,
        cadastroId,
        status: statusPedido,
      });
    }

    // 10. PEDIDO CANCELADO

    if (evento === "order.canceled") {
      console.log(
        "Pedido cancelado:",
        pedido.id,
        statusPedido
      );

      return res.status(200).json({
        success: true,
        confirmado: false,
        message: "Pedido cancelado.",
        pedidoId,
        cadastroId,
        status: statusPedido,
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
      error: "Não foi possível processar o webhook.",
    });
  }
});

module.exports = router;
