
const express = require("express");
const crypto = require("crypto");
const { db } = require("../config/firebase");

const router = express.Router();

const COLECAO = "cadastrosSite";

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function numeros(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function validarCPF(valor) {
  const cpf = numeros(valor);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let soma = 0;

  for (let i = 0; i < 9; i++) {
    soma += Number(cpf[i]) * (10 - i);
  }

  let digito = (soma * 10) % 11;
  if (digito === 10) digito = 0;

  if (digito !== Number(cpf[9])) return false;

  soma = 0;

  for (let i = 0; i < 10; i++) {
    soma += Number(cpf[i]) * (11 - i);
  }

  digito = (soma * 10) % 11;
  if (digito === 10) digito = 0;

  return digito === Number(cpf[10]);
}

function gerarRespostaCadastro(cadastro) {
  return {
    sucesso: true,
    cadastroId: cadastro.cadastroId,
    statusCadastro: cadastro.statusCadastro,
    statusPagamento: cadastro.statusPagamento,
    plano: cadastro.dados.plano,
    message: "Cadastro recebido com sucesso.",
  };
}

// ======================================================
// CRIAR CADASTRO
// POST /api/cadastros
// ======================================================

router.post("/", async (req, res) => {
  try {
    const dados = req.body;

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      return res.status(400).json({
        error: "Dados do cadastro não recebidos.",
      });
    }

    // CAMPOS OBRIGATÓRIOS

    const camposObrigatorios = [
      "nome",
      "cpf",
      "dataNascimento",
      "email",
      "celular",
      "telefone",
      "cidade",
      "estado",
      "plano",
      "pagamento",
    ];

    const camposAusentes = camposObrigatorios.filter(
      (campo) => !texto(dados[campo])
    );

    if (camposAusentes.length > 0) {
      return res.status(400).json({
        error: "Preencha todos os campos obrigatórios.",
        campos: camposAusentes,
      });
    }

    // NORMALIZAÇÃO

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
      origem: "site_doutor_de_todos",
      consentimentoPrivacidade:
        dados.consentimentoPrivacidade === true,
      dataConsentimento: texto(dados.dataConsentimento),
    };

    // VALIDAÇÃO DO NOME

    if (cliente.nome.split(/\s+/).length < 2) {
      return res.status(400).json({
        error: "Informe o nome completo do titular.",
        campos: ["nome"],
      });
    }

    // VALIDAÇÃO DO CPF

    if (!validarCPF(cliente.cpf)) {
      return res.status(400).json({
        error: "CPF inválido.",
        campos: ["cpf"],
      });
    }

    // DATA DE NASCIMENTO

    const nascimento = new Date(
      `${cliente.dataNascimento}T00:00:00`
    );

    if (
      Number.isNaN(nascimento.getTime()) ||
      nascimento > new Date() ||
      nascimento.toISOString().slice(0, 10) !==
        cliente.dataNascimento
    ) {
      return res.status(400).json({
        error: "Data de nascimento inválida.",
        campos: ["dataNascimento"],
      });
    }

    // TELEFONES

    if (
      cliente.telefone.length < 10 ||
      cliente.telefone.length > 11 ||
      cliente.celular.length < 10 ||
      cliente.celular.length > 11
    ) {
      return res.status(400).json({
        error: "Informe telefone e celular válidos com DDD.",
        campos: ["telefone", "celular"],
      });
    }

    // E-MAIL

    const emailValido =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email);

    if (!emailValido) {
      return res.status(400).json({
        error: "E-mail inválido.",
        campos: ["email"],
      });
    }

    // PLANO

    if (!["light", "plus"].includes(cliente.plano)) {
      return res.status(400).json({
        error: "Plano não reconhecido.",
        campos: ["plano"],
      });
    }

    // PAGAMENTO

    if (!["cartao", "energia"].includes(cliente.pagamento)) {
      return res.status(400).json({
        error: "Forma de pagamento não reconhecida.",
        campos: ["pagamento"],
      });
    }

    // CONSENTIMENTO

    if (!cliente.consentimentoPrivacidade) {
      return res.status(400).json({
        error: "O consentimento para tratamento dos dados é necessário.",
        campos: ["consentimentoPrivacidade"],
      });
    }

    // ==================================================
    // DADOS ENEL
    // ==================================================

    if (cliente.pagamento === "energia") {
      const energiaRecebida = dados.energia;

      if (
        !energiaRecebida ||
        typeof energiaRecebida !== "object" ||
        Array.isArray(energiaRecebida)
      ) {
        return res.status(400).json({
          error: "Informe os dados da conta de energia ENEL.",
          campos: ["energia"],
        });
      }

      const numeroInstalacao = numeros(
        energiaRecebida.numeroInstalacao
      );

      const numeroCliente = numeros(
        energiaRecebida.numeroCliente
      );

      if (
        numeroInstalacao.length < 5 ||
        numeroInstalacao.length > 30
      ) {
        return res.status(400).json({
          error: "Número de instalação ENEL inválido.",
          campos: ["numeroInstalacao"],
        });
      }

      if (
        numeroCliente.length < 5 ||
        numeroCliente.length > 30
      ) {
        return res.status(400).json({
          error: "Número do cliente ENEL inválido.",
          campos: ["numeroClienteEnel"],
        });
      }

      cliente.energia = {
        concessionaria: "ENEL",
        numeroInstalacao,
        numeroCliente,
        titular: cliente.nome,
      };
    }

    // ==================================================
    // DADOS DE ENDEREÇO
    // ==================================================
    // Guardamos os campos se o frontend os enviar.
    // Eles serão necessários para a API de Gestão.
    // Não são obrigatórios neste cadastro atual.

    cliente.endereco = {
      cep: numeros(dados.cep),
      uf: texto(dados.uf || dados.estado).toUpperCase(),
      cidade: texto(dados.cidade),
      bairro: texto(dados.bairro),
      logradouro: texto(dados.logradouro),
      numero: texto(dados.numero),
      complemento: texto(dados.complemento),
    };

    // ==================================================
    // CRIAR DOCUMENTO NO FIRESTORE
    // ==================================================

    const cadastroId = crypto.randomUUID();
    const agora = new Date().toISOString();

    const cadastro = {
      cadastroId,
      dados: cliente,

      statusCadastro:
        cliente.pagamento === "energia"
          ? "aguardando_analise"
          : "aguardando_pagamento",

      statusPagamento: "pendente",

      gatewayPagamento: null,
      pedidoPagamento: null,
      pedidoPagarme: null,
      pedidoYampi: null,

      integracoes: {
        firebase: "concluida",
        gestaoSaudeFamiliar: "pendente",
        gestaoDoutorDeTodos: "pendente",
      },

      criadoEm: agora,
      atualizadoEm: agora,
    };

    await db
      .collection(COLECAO)
      .doc(cadastroId)
      .create(cadastro);

    console.log("-----------------------------------");
    console.log("NOVO CADASTRO SALVO NO FIREBASE");
    console.log("Cadastro:", cadastroId);
    console.log("Plano:", cliente.plano);
    console.log("Pagamento:", cliente.pagamento);
    console.log("Status:", cadastro.statusCadastro);
    console.log("-----------------------------------");

    return res.status(201).json(
      gerarRespostaCadastro(cadastro)
    );

  } catch (error) {
    console.error(
      "Erro ao receber cadastro:",
      error.message
    );

    return res.status(500).json({
      error: "Erro interno ao receber o cadastro.",
    });
  }
});

// ======================================================
// CONSULTAR CADASTRO
// GET /api/cadastros/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const cadastro = await buscarCadastroInterno(
      req.params.id
    );

    if (!cadastro) {
      return res.status(404).json({
        error: "Cadastro não encontrado.",
      });
    }

    // Não expõe CPF, endereço, telefone ou e-mail.

    return res.status(200).json({
      cadastroId: cadastro.cadastroId,
      statusCadastro: cadastro.statusCadastro,
      statusPagamento: cadastro.statusPagamento,
      plano: cadastro.dados.plano,
      gatewayPagamento: cadastro.gatewayPagamento || null,
      pedidoPagamento: cadastro.pedidoPagamento || null,
      criadoEm: cadastro.criadoEm,
    });

  } catch (error) {
    console.error(
      "Erro ao consultar cadastro:",
      error.message
    );

    return res.status(500).json({
      error: "Erro ao consultar cadastro.",
    });
  }
});

// ======================================================
// CONSULTA INTERNA
// ======================================================

async function buscarCadastroInterno(cadastroId) {
  if (!cadastroId) return null;

  const documento = await db
    .collection(COLECAO)
    .doc(String(cadastroId))
    .get();

  if (!documento.exists) {
    return null;
  }

  return documento.data();
}

// ======================================================
// ATUALIZAR PAGAMENTO
// COMPATÍVEL COM PAGAR.ME E YAMPI
// ======================================================

async function atualizarPagamentoInterno(
  cadastroId,
  pedidoPagamento,
  gateway = "pagarme"
) {
  if (!cadastroId || !pedidoPagamento) {
    throw new Error(
      "Cadastro ou identificador do pedido não informado."
    );
  }

  const gatewayNormalizado = String(gateway)
    .trim()
    .toLowerCase();

  if (!["pagarme", "pagar.me", "yampi"].includes(gatewayNormalizado)) {
    throw new Error("Gateway de pagamento não reconhecido.");
  }

  const gatewayFinal =
    gatewayNormalizado === "yampi" ? "yampi" : "pagarme";

  const pedidoId =
    typeof pedidoPagamento === "object"
      ? String(
          pedidoPagamento.idPedido ||
          pedidoPagamento.id ||
          pedidoPagamento.order_id ||
          ""
        ).trim()
      : String(pedidoPagamento).trim();

  if (!pedidoId) {
    throw new Error("Identificador do pedido inválido.");
  }

  const referencia = db
    .collection(COLECAO)
    .doc(String(cadastroId));

  return db.runTransaction(async (transaction) => {
    const documento = await transaction.get(referencia);

    if (!documento.exists) {
      throw new Error("Cadastro não encontrado no Firebase.");
    }

    const cadastro = documento.data();

    const pedidoAnterior =
      gatewayFinal === "yampi"
        ? cadastro.pedidoYampi
        : cadastro.pedidoPagarme;

    // Idempotência: mesmo gateway e mesmo pedido.
    if (
      cadastro.statusPagamento === "pago" &&
      cadastro.gatewayPagamento === gatewayFinal &&
      String(pedidoAnterior || "") === pedidoId
    ) {
      return {
        sucesso: true,
        duplicado: true,
        cadastroId,
        gateway: gatewayFinal,
        pedidoId,
      };
    }

    // Não permite substituir um pagamento já confirmado
    // por outro pedido ou gateway.
    if (cadastro.statusPagamento === "pago") {
      throw new Error(
        "Este cadastro já possui outro pagamento confirmado."
      );
    }

    const agora = new Date().toISOString();

    const atualizacao = {
      statusPagamento: "pago",
      statusCadastro: "pagamento_confirmado",
      gatewayPagamento: gatewayFinal,
      pedidoPagamento: pedidoId,
      atualizadoEm: agora,
    };

    if (gatewayFinal === "yampi") {
      atualizacao.pedidoYampi = pedidoId;
    } else {
      atualizacao.pedidoPagarme = pedidoId;
    }

    transaction.update(referencia, atualizacao);

    return {
      sucesso: true,
      duplicado: false,
      cadastroId,
      gateway: gatewayFinal,
      pedidoId,
    };
  });
}

// ======================================================
// EXPORTAÇÕES
// ======================================================

module.exports = router;

module.exports.buscarCadastroInterno =
  buscarCadastroInterno;

module.exports.atualizarPagamentoInterno =
  atualizarPagamentoInterno;
