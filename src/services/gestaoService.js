
const axios = require("axios");

// ======================================================
// CONFIGURAÇÃO DA API
// ======================================================

const API_URL = (
  process.env.GESTAO_API_URL ||
  "https://hml-gestao.drdetodos.com.br"
).replace(/\/+$/, "");

const API_TOKEN = process.env.GESTAO_API_TOKEN;

// SKUs oficiais dos planos
const SKUS_PLANOS = {
  light: "8Z2UCNMBJ",
  plus: "49223CFKN",
};

// ======================================================
// CLIENTE HTTP
// ======================================================

function obterClienteApi() {
  if (!API_TOKEN) {
    throw new Error(
      "GESTAO_API_TOKEN não configurado."
    );
  }

  return axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ======================================================
// TRATAMENTO DE ERROS
// ======================================================

function tratarErroApi(error) {
  if (error.response) {
    const erro = new Error(
      error.response.data?.msg ||
      error.response.data?.message ||
      "Erro na API Gestão Doutor de Todos."
    );

    erro.status = error.response.status;
    erro.resposta = error.response.data;

    throw erro;
  }

  if (error.code === "ECONNABORTED") {
    throw new Error(
      "Tempo de conexão esgotado com a Gestão."
    );
  }

  throw error;
}

// ======================================================
// IDENTIFICAR GATEWAY DE PAGAMENTO
// ======================================================

function identificarGateway(dados = {}) {
  const gatewayInformado = String(
    dados.gatewayPagamento ||
    dados.gateway ||
    ""
  ).trim().toLowerCase();

  const idYampi =
    dados.idPedidoYampi ||
    dados.yampi_order_id ||
    dados.pedidoYampi?.id ||
    null;

  const idPagarme =
    dados.idPedidoPagarme ||
    dados.pagarme_order_id ||
    dados.pedidoPagarme?.id ||
    dados.pedidoPagarme?.order_id ||
    null;

  if (gatewayInformado === "yampi" || gatewayInformado === "yamp") {
    if (!idYampi && !dados.idPedido) {
      throw new Error("ID do pedido Yampi não informado.");
    }

    return {
      gateway: "yampi",
      idPedido: String(idYampi || dados.idPedido),
    };
  }

  if (
    gatewayInformado === "pagarme" ||
    gatewayInformado === "pagar.me"
  ) {
    if (!idPagarme && !dados.idPedido) {
      throw new Error("ID do pedido Pagar.me não informado.");
    }

    return {
      gateway: "pagarme",
      idPedido: String(idPagarme || dados.idPedido),
    };
  }

  // Identificação automática pelo identificador recebido
  if (idYampi) {
    return {
      gateway: "yampi",
      idPedido: String(idYampi),
    };
  }

  if (idPagarme) {
    return {
      gateway: "pagarme",
      idPedido: String(idPagarme),
    };
  }

  throw new Error(
    "Não foi possível identificar o gateway ou o pedido de pagamento."
  );
}

// ======================================================
// VALIDAR PLANO
// ======================================================

function validarPlano(plano) {
  const planoNormalizado = String(
    plano || ""
  ).trim().toLowerCase();

  if (!SKUS_PLANOS[planoNormalizado]) {
    throw new Error(
      "Plano inválido. Utilize light ou plus."
    );
  }

  return planoNormalizado;
}

// ======================================================
// PREPARAR DADOS DO CONTRATO
// ======================================================

function prepararDadosContrato(dados) {
  if (!dados || typeof dados !== "object") {
    throw new Error("Dados do cliente não informados.");
  }

  const plano = validarPlano(dados.plano);

  const camposObrigatorios = [
    "nome",
    "cpf",
    "data_nascimento",
    "email",
    "celular",
    "cep",
    "uf",
    "cidade",
    "bairro",
    "logradouro",
    "numero",
  ];

  for (const campo of camposObrigatorios) {
    if (
      dados[campo] === undefined ||
      dados[campo] === null ||
      String(dados[campo]).trim() === ""
    ) {
      throw new Error(
        `Campo obrigatório ausente: ${campo}`
      );
    }
  }

  const cpf = String(dados.cpf).replace(/\D/g, "");
  const celular = String(dados.celular).replace(/\D/g, "");
  const cep = String(dados.cep).replace(/\D/g, "");
  const valor = Number(dados.valor);

  if (cpf.length !== 11) {
    throw new Error("CPF inválido.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor do plano inválido.");
  }

  const contrato = {
    nome: String(dados.nome).trim(),
    cpf,
    data_nascimento: dados.data_nascimento,
    email: String(dados.email).trim().toLowerCase(),
    celular,
    whatsapp: String(
      dados.whatsapp || dados.celular
    ).replace(/\D/g, ""),
    cep,
    uf: String(dados.uf).trim().toUpperCase(),
    cidade: String(dados.cidade).trim(),
    bairro: String(dados.bairro).trim(),
    logradouro: String(dados.logradouro).trim(),
    numero: String(dados.numero).trim(),
    plano,
    yampi_sku: SKUS_PLANOS[plano],
    valor,
  };

  const opcionais = [
    "sexo",
    "complemento",
    "profissao",
    "estado_civil",
    "escolaridade",
    "nacionalidade",
    "nome_mae",
    "nome_pai",
  ];

  for (const campo of opcionais) {
    if (
      dados[campo] !== undefined &&
      dados[campo] !== null &&
      dados[campo] !== ""
    ) {
      contrato[campo] = dados[campo];
    }
  }

  return contrato;
}

// ======================================================
// CRIAR CONTRATO NA GESTÃO
// ======================================================

async function criarContratoGestao(dados) {
  try {
    const api = obterClienteApi();

    const contrato = prepararDadosContrato(dados);

    const resposta = await api.post(
      "/api/v1/contratos",
      contrato
    );

    const resultado = resposta.data;

    if (!resultado?.cod_contrato) {
      throw new Error(
        "A Gestão não retornou o código do contrato."
      );
    }

    return {
      sucesso: true,
      cod_contrato: resultado.cod_contrato,
      cod_cadastro: resultado.cod_cadastro,
      cod_status: resultado.cod_status,
      status: resultado.status,
      resposta: resultado,
    };

  } catch (error) {
    tratarErroApi(error);
  }
}

// ======================================================
// INFORMAR PAGAMENTO NA GESTÃO
// ACEITA YAMPI E PAGAR.ME
// ======================================================

async function informarPagamentoGestao(dados) {
  try {
    const api = obterClienteApi();

    const {
      codContrato,
      status,
      plano,
      valor,
    } = dados;

    if (!codContrato) {
      throw new Error("Código do contrato não informado.");
    }

    const statusPermitidos = [
      "pago",
      "pendente",
      "recusado",
      "cancelado",
    ];

    if (!statusPermitidos.includes(status)) {
      throw new Error("Status de pagamento inválido.");
    }

    const planoNormalizado = validarPlano(plano);

    const valorPagamento = Number(valor);

    if (
      !Number.isFinite(valorPagamento) ||
      valorPagamento <= 0
    ) {
      throw new Error("Valor do pagamento inválido.");
    }

    // Reconhece automaticamente Yampi ou Pagar.me
    const identificacao = identificarGateway(dados);

    // A API externa documentada exige yampi_order_id.
    // O identificador de qualquer gateway é encaminhado
    // nesse campo até que o fornecedor confirme a adaptação.

    const pagamento = {
      status,
      yampi_order_id: identificacao.idPedido,
      plano: planoNormalizado,
      yampi_sku: SKUS_PLANOS[planoNormalizado],
      valor: valorPagamento,
    };

    const resposta = await api.post(
      `/api/v1/contratos/${encodeURIComponent(codContrato)}/pagamento`,
      pagamento
    );

    return {
      sucesso: true,
      gateway: identificacao.gateway,
      idPedido: identificacao.idPedido,
      cod_contrato: resposta.data.cod_contrato,
      cod_cadastro: resposta.data.cod_cadastro,
      cod_status: resposta.data.cod_status,
      status: resposta.data.status,
      resposta: resposta.data,
    };

  } catch (error) {
    tratarErroApi(error);
  }
}

// ======================================================
// EXPORTAÇÕES
// ======================================================

module.exports = {
  criarContratoGestao,
  informarPagamentoGestao,
  identificarGateway,
  prepararDadosContrato,
  validarPlano,
  SKUS_PLANOS,
};
