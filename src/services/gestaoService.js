
const axios = require("axios");

// ======================================================
// CONFIGURAÇÃO DA API GESTÃO DOUTOR DE TODOS
// ======================================================

const API_URL = (
  process.env.GESTAO_API_URL ||
  "https://hml-gestao.drdetodos.com.br"
).replace(/\/+$/, "");

const API_TOKEN = process.env.GESTAO_API_TOKEN;

// Por segurança, só habilite após a Gestão confirmar
// que aceita o ID Pagar.me no campo yampi_order_id.
const PAGARME_ACEITO_PELA_GESTAO =
  String(process.env.GESTAO_ACEITA_PEDIDO_PAGARME || "")
    .toLowerCase() === "true";

// SKUs oficiais
const SKUS_PLANOS = {
  light: "8Z2UCNMBJ",
  plus: "49223CFKN",
};

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, "");
}

function primeiroValor(...valores) {
  return valores.find(
    valor =>
      valor !== undefined &&
      valor !== null &&
      texto(valor) !== ""
  );
}

function normalizarPlano(plano) {
  return texto(plano).toLowerCase();
}

function validarPlano(plano) {
  const planoNormalizado = normalizarPlano(plano);

  if (!SKUS_PLANOS[planoNormalizado]) {
    throw new Error(
      "Plano inválido. Utilize light ou plus."
    );
  }

  return planoNormalizado;
}

// ======================================================
// CLIENTE HTTP
// ======================================================

function obterClienteApi() {
  if (!API_TOKEN) {
    throw new Error(
      "GESTAO_API_TOKEN não configurado no ambiente."
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
    const resposta = error.response.data || {};

    const erro = new Error(
      resposta.msg ||
      resposta.message ||
      "Erro na API Gestão Doutor de Todos."
    );

    erro.status = error.response.status;
    erro.resposta = resposta;

    // A Gestão pode devolver o contrato existente
    // quando identifica uma duplicidade.
    erro.cod_contrato =
      resposta.cod_contrato ||
      resposta.contrato?.cod_contrato ||
      resposta.contrato_existente?.cod_contrato ||
      null;

    erro.cod_cadastro =
      resposta.cod_cadastro ||
      resposta.contrato?.cod_cadastro ||
      null;

    erro.jaExiste = erro.status === 409;

    throw erro;
  }

  if (
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT"
  ) {
    const erro = new Error(
      "Tempo de conexão esgotado com a Gestão Doutor de Todos."
    );

    erro.status = 504;
    throw erro;
  }

  if (error.code === "ECONNREFUSED") {
    const erro = new Error(
      "Não foi possível estabelecer conexão com a API da Gestão."
    );

    erro.status = 502;
    throw erro;
  }

  throw error;
}

// ======================================================
// IDENTIFICAR GATEWAY DE PAGAMENTO
// ======================================================

function identificarGateway(dados = {}) {
  const gatewayInformado = texto(
    dados.gatewayPagamento ||
    dados.gateway
  ).toLowerCase();

  const idYampi = primeiroValor(
    dados.idPedidoYampi,
    dados.yampi_order_id,
    dados.pedidoYampi?.id
  );

  const idPagarme = primeiroValor(
    dados.idPedidoPagarme,
    dados.pagarme_order_id,
    dados.pedidoPagarme?.id,
    dados.pedidoPagarme?.order_id,
    dados.pedidoPagamento
  );

  if (
    gatewayInformado === "yampi" ||
    gatewayInformado === "yamp"
  ) {
    const id = idYampi || dados.idPedido;

    if (!id) {
      throw new Error(
        "ID do pedido Yampi não informado."
      );
    }

    return {
      gateway: "yampi",
      idPedido: String(id),
    };
  }

  if (
    gatewayInformado === "pagarme" ||
    gatewayInformado === "pagar.me"
  ) {
    const id = idPagarme || dados.idPedido;

    if (!id) {
      throw new Error(
        "ID do pedido Pagar.me não informado."
      );
    }

    return {
      gateway: "pagarme",
      idPedido: String(id),
    };
  }

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
// PREPARAR DADOS DO CONTRATO
// ======================================================

function prepararDadosContrato(dados = {}) {
  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new Error(
      "Dados do cliente não informados."
    );
  }

  const plano = validarPlano(
    primeiroValor(
      dados.plano,
      dados.planoId,
      dados.planoNome
    )
  );

  const nome = primeiroValor(
    dados.nome,
    dados.nomeCompleto,
    dados.name
  );

  const cpf = somenteNumeros(
    primeiroValor(
      dados.cpf,
      dados.documento
    )
  );

  const dataNascimento = primeiroValor(
    dados.data_nascimento,
    dados.dataNascimento,
    dados.nascimento
  );

  const email = texto(dados.email).toLowerCase();

  const celular = somenteNumeros(
    primeiroValor(
      dados.celular,
      dados.telefone,
      dados.whatsapp
    )
  );

  const cep = somenteNumeros(dados.cep);

  const uf = texto(
    primeiroValor(
      dados.uf,
      dados.estado
    )
  ).toUpperCase();

  const cidade = texto(dados.cidade);
  const bairro = texto(dados.bairro);

  const logradouro = texto(
    primeiroValor(
      dados.logradouro,
      dados.endereco,
      dados.rua
    )
  );

  const numero = texto(
    primeiroValor(
      dados.numero,
      dados.numeroEndereco
    )
  );

  const obrigatorios = {
    nome,
    cpf,
    data_nascimento: dataNascimento,
    email,
    celular,
    cep,
    uf,
    cidade,
    bairro,
    logradouro,
    numero,
  };

  for (const [campo, valor] of Object.entries(obrigatorios)) {
    if (!texto(valor)) {
      throw new Error(
        `Campo obrigatório ausente: ${campo}`
      );
    }
  }

  if (cpf.length !== 11) {
    throw new Error("CPF inválido.");
  }

  if (celular.length < 10 || celular.length > 11) {
    throw new Error("Celular inválido.");
  }

  if (cep.length !== 8) {
    throw new Error("CEP inválido.");
  }

  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new Error("UF inválida.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }

  // Valor informado em reais.
  const valor = Number(
    primeiroValor(
      dados.valor,
      dados.valorTotal,
      dados.valorPlano
    )
  );

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      "Valor do plano inválido."
    );
  }

  const contrato = {
    nome: texto(nome),
    cpf,
    data_nascimento: texto(dataNascimento),
    email,
    celular,

    whatsapp: somenteNumeros(
      primeiroValor(
        dados.whatsapp,
        dados.celular,
        dados.telefone
      )
    ),

    cep,
    uf,
    cidade,
    bairro,
    logradouro,
    numero,

    plano,
    yampi_sku: SKUS_PLANOS[plano],
    valor,
  };

  const opcionais = {
    sexo: dados.sexo,
    complemento: dados.complemento,
    profissao: dados.profissao,
    estado_civil:
      dados.estado_civil || dados.estadoCivil,
    escolaridade: dados.escolaridade,
    nacionalidade: dados.nacionalidade,
    nome_mae: dados.nome_mae || dados.nomeMae,
    nome_pai: dados.nome_pai || dados.nomePai,
  };

  for (const [campo, valorOpcional] of Object.entries(opcionais)) {
    if (
      valorOpcional !== undefined &&
      valorOpcional !== null &&
      texto(valorOpcional) !== ""
    ) {
      contrato[campo] = valorOpcional;
    }
  }

  if (
    contrato.sexo &&
    !["M", "F"].includes(
      texto(contrato.sexo).toUpperCase()
    )
  ) {
    throw new Error(
      "Sexo inválido. Utilize M ou F."
    );
  }

  return contrato;
}

// ======================================================
// CRIAR CONTRATO NA GESTÃO
// ======================================================

async function criarContratoGestao(dados) {
  const api = obterClienteApi();

  const contrato = prepararDadosContrato(dados);

  try {
    const resposta = await api.post(
      "/api/v1/contratos",
      contrato
    );

    const resultado = resposta.data || {};

    if (!resultado.cod_contrato) {
      throw new Error(
        "A Gestão não retornou o código do contrato."
      );
    }

    return {
      sucesso: true,
      jaExistia: false,

      cod_contrato: resultado.cod_contrato,
      cod_cadastro: resultado.cod_cadastro || null,
      cod_status: resultado.cod_status ?? null,
      status: resultado.status || null,

      resposta: resultado,
    };

  } catch (error) {
    try {
      tratarErroApi(error);
    } catch (erroTratado) {
      // Não cria outro contrato quando a Gestão
      // informa que já existe um cadastro/contrato.
      if (
        erroTratado.status === 409 &&
        erroTratado.cod_contrato
      ) {
        return {
          sucesso: true,
          jaExistia: true,

          cod_contrato: erroTratado.cod_contrato,
          cod_cadastro: erroTratado.cod_cadastro,
          cod_status: null,
          status: "Contrato já existente",

          resposta: erroTratado.resposta,
        };
      }

      throw erroTratado;
    }
  }
}

// ======================================================
// INFORMAR PAGAMENTO NA GESTÃO
// ======================================================

async function informarPagamentoGestao(dados = {}) {
  const api = obterClienteApi();

  const codContrato = primeiroValor(
    dados.codContrato,
    dados.cod_contrato,
    dados.gestaoCodContrato
  );

  if (!codContrato) {
    throw new Error(
      "Código do contrato da Gestão não informado."
    );
  }

  const status = texto(dados.status).toLowerCase();

  const statusPermitidos = [
    "pago",
    "pendente",
    "recusado",
    "cancelado",
  ];

  if (!statusPermitidos.includes(status)) {
    throw new Error(
      "Status inválido. Utilize pago, pendente, recusado ou cancelado."
    );
  }

  const plano = validarPlano(dados.plano);

  const valor = Number(dados.valor);

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      "Valor do pagamento inválido."
    );
  }

  const identificacao = identificarGateway(dados);

  // A documentação atual da Gestão exige
  // o campo yampi_order_id.
  //
  // Não presumimos que esse campo aceita Pagar.me.
  // A integração só será liberada quando o fornecedor
  // confirmar essa compatibilidade.

  if (
    identificacao.gateway === "pagarme" &&
    !PAGARME_ACEITO_PELA_GESTAO
  ) {
    const erro = new Error(
      "A Gestão ainda precisa confirmar que aceita o ID Pagar.me no campo yampi_order_id. Configure GESTAO_ACEITA_PEDIDO_PAGARME=true somente após essa confirmação."
    );

    erro.status = 409;
    erro.codigo = "PAGARME_NAO_HABILITADO_NA_GESTAO";

    throw erro;
  }

  const pagamento = {
    status,

    yampi_order_id: identificacao.idPedido,

    plano,

    yampi_sku: SKUS_PLANOS[plano],

    valor,
  };

  try {
    const resposta = await api.post(
      `/api/v1/contratos/${encodeURIComponent(String(codContrato))}/pagamento`,
      pagamento
    );

    const resultado = resposta.data || {};

    return {
      sucesso: true,

      gateway: identificacao.gateway,
      idPedido: identificacao.idPedido,

      cod_contrato:
        resultado.cod_contrato || codContrato,

      cod_cadastro:
        resultado.cod_cadastro || null,

      cod_status:
        resultado.cod_status ?? null,

      status:
        resultado.status || null,

      resposta: resultado,
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
