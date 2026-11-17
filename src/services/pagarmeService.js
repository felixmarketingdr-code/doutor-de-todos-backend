const axios = require("axios");

const pagarmeConfig = require("../config/pagarme");



const { baseURL, secretKey } = pagarmeConfig;



// ======================================================

// CONFIGURAÇÃO DA API PAGAR.ME

// ======================================================



if (!baseURL) {

  throw new Error("URL da API Pagar.me não configurada.");

}



if (!secretKey) {

  throw new Error("PAGARME_SECRET_KEY não configurada.");

}



const api = axios.create({

  baseURL: baseURL.replace(/\/+$/, ""),

  timeout: 30000,



  auth: {

    username: secretKey,

    password: "",

  },



  headers: {

    "Content-Type": "application/json",

    Accept: "application/json",

    "User-Agent": "pagarme-skill-generated/1.0",

  },

});



// ======================================================

// TRATAMENTO DE ERROS

// ======================================================



function tratarErroPagarme(error) {

  const status = error.response?.status || 502;

  const resposta = error.response?.data;



  const mensagem =

    resposta?.message ||

    resposta?.error ||

    error.message ||

    "Não foi possível comunicar com a Pagar.me.";



  // Diagnóstico seguro: rota e método, sem dados do cartão ou tokens.
  console.error("Erro na API Pagar.me:", {
    endpoint: error.config?.url || null,
    metodo: error.config?.method?.toUpperCase() || null,
    status,
    mensagem,
    detalhes: resposta?.errors || null,
    codigo: resposta?.code || null,
  });



  const erro = new Error(mensagem);



  erro.status = status >= 400 && status < 600 ? status : 502;

  erro.detalhes = resposta?.errors || null;

  erro.codigo = resposta?.code || null;



  return erro;

}



// ======================================================

// VALIDAÇÕES GERAIS

// ======================================================



function validarResposta(resposta, operacao) {

  if (

    !resposta ||

    typeof resposta !== "object" ||

    Array.isArray(resposta)

  ) {

    throw new Error(

      `A Pagar.me retornou uma resposta inválida em ${operacao}.`

    );

  }



  return resposta;

}



function validarIdentificador(valor, campo) {

  if (typeof valor !== "string" || !valor.trim()) {

    throw new Error(

      `Informe um identificador válido para ${campo}.`

    );

  }



  return valor.trim();

}



function validarChaveIdempotencia(valor) {

  if (typeof valor !== "string" || !valor.trim()) {

    throw new Error("Chave de idempotência não informada.");

  }



  const chave = valor.trim();



  if (chave.length > 255) {

    throw new Error(

      "A chave de idempotência ultrapassa o limite permitido."

    );

  }



  return chave;

}



function validarObjeto(dados, mensagem) {

  if (

    !dados ||

    typeof dados !== "object" ||

    Array.isArray(dados)

  ) {

    throw new Error(mensagem);

  }

}



// ======================================================

// VALIDAÇÃO DE PEDIDOS

// ======================================================



function validarPedido(dados) {

  validarObjeto(

    dados,

    "Dados do pedido não informados ou inválidos."

  );



  if (!Array.isArray(dados.items) || !dados.items.length) {

    throw new Error(

      "O pedido precisa possuir pelo menos um item."

    );

  }



  if (

    !Array.isArray(dados.payments) ||

    !dados.payments.length

  ) {

    throw new Error(

      "Informe pelo menos uma forma de pagamento."

    );

  }



  validarObjeto(

    dados.customer,

    "Informe os dados do cliente para criar o pedido."

  );



  for (const item of dados.items) {

    if (

      !Number.isInteger(item?.amount) ||

      item.amount <= 0

    ) {

      throw new Error(

        "O valor de cada item deve ser informado em centavos e ser maior que zero."

      );

    }



    if (

      !Number.isInteger(item?.quantity) ||

      item.quantity < 1

    ) {

      throw new Error(

        "A quantidade do item deve ser um número inteiro positivo."

      );

    }



    if (

      typeof item.description !== "string" ||

      !item.description.trim()

    ) {

      throw new Error(

        "Informe a descrição de cada item do pedido."

      );

    }

  }



  for (const pagamento of dados.payments) {

    if (

      !pagamento ||

      typeof pagamento !== "object" ||

      Array.isArray(pagamento) ||

      !pagamento.payment_method

    ) {

      throw new Error(

        "Cada pagamento precisa informar payment_method."

      );

    }

  }



  return true;

}



// ======================================================

// CRIAR PEDIDO

// Utilizado na primeira cobrança e no Plano Plus.

// ======================================================



async function criarPedido(dados, chaveIdempotencia) {

  try {

    validarPedido(dados);



    const chave = validarChaveIdempotencia(

      chaveIdempotencia

    );



    const resposta = await api.post("/orders", dados, {

      headers: {

        "Idempotency-Key": chave,

      },

    });



    const pedido = validarResposta(

      resposta.data,

      "criação do pedido"

    );



    if (!pedido.id) {

      throw new Error(

        "A Pagar.me não retornou o identificador do pedido."

      );

    }



    return pedido;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// CONSULTAR PEDIDO

// ======================================================



async function consultarPedido(orderId) {

  try {

    const id = validarIdentificador(orderId, "pedido");



    const resposta = await api.get(

      `/orders/${encodeURIComponent(id)}`

    );



    const pedido = validarResposta(

      resposta.data,

      "consulta do pedido"

    );



    if (

      !pedido.id ||

      String(pedido.id) !== String(id)

    ) {

      throw new Error(

        "O identificador retornado pela Pagar.me não corresponde ao pedido consultado."

      );

    }



    return pedido;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// CONSULTAR COBRANÇA

// ======================================================



async function consultarCobranca(chargeId) {

  try {

    const id = validarIdentificador(

      chargeId,

      "cobrança"

    );



    const resposta = await api.get(

      `/charges/${encodeURIComponent(id)}`

    );



    const cobranca = validarResposta(

      resposta.data,

      "consulta da cobrança"

    );



    if (

      !cobranca.id ||

      String(cobranca.id) !== String(id)

    ) {

      throw new Error(

        "O identificador retornado pela Pagar.me não corresponde à cobrança consultada."

      );

    }



    return cobranca;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// VALIDAR PLANO DE RECORRÊNCIA

// ======================================================



function validarPlano(dados) {

  validarObjeto(

    dados,

    "Dados do plano não informados ou inválidos."

  );



  if (

    typeof dados.name !== "string" ||

    !dados.name.trim()

  ) {

    throw new Error(

      "Informe o nome do plano de recorrência."

    );

  }



  if (

    dados.interval !== "month" &&

    dados.interval !== "week" &&

    dados.interval !== "day" &&

    dados.interval !== "year"

  ) {

    throw new Error(

      "Intervalo de recorrência inválido."

    );

  }



  if (

    !Number.isInteger(dados.interval_count) ||

    dados.interval_count < 1

  ) {

    throw new Error(

      "Informe um intervalo de recorrência válido."

    );

  }



  if (

    !Array.isArray(dados.items) ||

    !dados.items.length

  ) {

    throw new Error(

      "O plano precisa possuir pelo menos um item."

    );

  }



  if (

    dados.payment_methods &&

    (

      !Array.isArray(dados.payment_methods) ||

      !dados.payment_methods.includes("credit_card")

    )

  ) {

    throw new Error(

      "O plano Light precisa aceitar cartão de crédito."

    );

  }



  for (const item of dados.items) {

    if (

      !item ||

      typeof item !== "object" ||

      !Number.isInteger(item.quantity) ||

      item.quantity < 1 ||

      !item.pricing_scheme ||

      !Number.isInteger(item.pricing_scheme.price) ||

      item.pricing_scheme.price <= 0

    ) {

      throw new Error(

        "Os itens do plano precisam ter quantidade e preço válidos em centavos."

      );

    }

  }



  return true;

}



// ======================================================

// CRIAR PLANO DE RECORRÊNCIA

// Criar uma única vez por ambiente.

// Não criar um novo plano a cada contratação.

// ======================================================



async function criarPlano(dados, chaveIdempotencia) {

  try {

    validarPlano(dados);



    const chave = validarChaveIdempotencia(

      chaveIdempotencia

    );



    const resposta = await api.post(

      "/plans",

      dados,

      {

        headers: {

          "Idempotency-Key": chave,

        },

      }

    );



    const plano = validarResposta(

      resposta.data,

      "criação do plano"

    );



    if (!plano.id) {

      throw new Error(

        "A Pagar.me não retornou o identificador do plano."

      );

    }



    return plano;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// CONSULTAR PLANO

// ======================================================



async function consultarPlano(planId) {

  try {

    const id = validarIdentificador(planId, "plano");



    const resposta = await api.get(

      `/plans/${encodeURIComponent(id)}`

    );



    const plano = validarResposta(

      resposta.data,

      "consulta do plano"

    );



    if (

      !plano.id ||

      String(plano.id) !== String(id)

    ) {

      throw new Error(

        "O identificador retornado pela Pagar.me não corresponde ao plano consultado."

      );

    }



    return plano;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// VALIDAR ASSINATURA

// ======================================================



function validarAssinatura(dados) {

  validarObjeto(

    dados,

    "Dados da assinatura não informados ou inválidos."

  );



  if (

    typeof dados.plan_id !== "string" ||

    !dados.plan_id.trim()

  ) {

    throw new Error(

      "Informe o identificador do plano Pagar.me."

    );

  }



  if (dados.payment_method !== "credit_card") {

    throw new Error(

      "A assinatura do Plano Light deve utilizar cartão de crédito."

    );

  }



  if (

    !dados.customer_id &&

    (

      !dados.customer ||

      typeof dados.customer !== "object" ||

      Array.isArray(dados.customer)

    )

  ) {

    throw new Error(

      "Informe customer_id ou os dados completos do cliente."

    );

  }



  if (
    !dados.card ||
    typeof dados.card !== "object" ||
    Array.isArray(dados.card) ||
    (
      !(typeof dados.card.card_token === "string" && dados.card.card_token.trim()) &&
      !(typeof dados.card.card_id === "string" && dados.card.card_id.trim())
    )
  ) {

    throw new Error(

      "Informe o card_token ou card_id para a assinatura."

    );

  }



  if (

    dados.installments !== undefined &&

    dados.installments !== 1

  ) {

    throw new Error(

      "Assinaturas recorrentes devem utilizar uma parcela."

    );

  }



  return true;

}



// ======================================================

// CRIAR ASSINATURA

// A primeira cobrança de adesão + mensalidade é

// tratada pela rota de checkout antes da recorrência.

// ======================================================



async function criarAssinatura(

  dados,

  chaveIdempotencia

) {

  try {

    validarAssinatura(dados);



    const chave = validarChaveIdempotencia(

      chaveIdempotencia

    );



    const corpo = {
      ...dados,
      card: dados.card.card_id
        ? { card_id: dados.card.card_id }
        : { card_token: dados.card.card_token.trim() },
      installments: 1,
      payment_method: "credit_card",
    };



    const resposta = await api.post(

      "/subscriptions",

      corpo,

      {

        headers: {

          "Idempotency-Key": chave,

        },

      }

    );



    const assinatura = validarResposta(

      resposta.data,

      "criação da assinatura"

    );



    if (!assinatura.id) {

      throw new Error(

        "A Pagar.me não retornou o identificador da assinatura."

      );

    }



    return assinatura;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// CONSULTAR ASSINATURA

// ======================================================



async function consultarAssinatura(subscriptionId) {

  try {

    const id = validarIdentificador(

      subscriptionId,

      "assinatura"

    );



    const resposta = await api.get(

      `/subscriptions/${encodeURIComponent(id)}`

    );



    const assinatura = validarResposta(

      resposta.data,

      "consulta da assinatura"

    );



    if (

      !assinatura.id ||

      String(assinatura.id) !== String(id)

    ) {

      throw new Error(

        "O identificador retornado pela Pagar.me não corresponde à assinatura consultada."

      );

    }



    return assinatura;

  } catch (error) {

    if (error.response) {

      throw tratarErroPagarme(error);

    }



    throw error;

  }

}



// ======================================================

// EXPORTAÇÕES

// ======================================================



module.exports = {

  // Pedidos e cobranças

  criarPedido,

  consultarPedido,

  consultarCobranca,



  // Planos

  criarPlano,

  consultarPlano,



  // Assinaturas

  criarAssinatura,

  consultarAssinatura,
};
