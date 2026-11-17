

const express = require("express");

const crypto = require("crypto");



const { db } = require("../config/firebase");



const {

  criarContratoGestao,

  informarPagamentoGestao,

} = require("../services/gestaoService");



const router = express.Router();



// ======================================================

// COLEÇÕES

// ======================================================



const COLECAO = "cadastrosSite";

const COLECAO_LEADS = "leads";

const COLECAO_CLIENTES = "clientes";

const COLECAO_CONTRATOS = "contratos";



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



  if (digito !== Number(cpf[9])) {

    return false;

  }



  soma = 0;



  for (let i = 0; i < 10; i++) {

    soma += Number(cpf[i]) * (11 - i);

  }



  digito = (soma * 10) % 11;

  if (digito === 10) digito = 0;



  return digito === Number(cpf[10]);

}



function valorPlanoAnual(plano) {

  if (plano === "light") return 578.70;

  if (plano === "plus") return 958.80;

  return 0;

}



function valorPrimeiraCobranca(plano) {

  if (plano === "light") return 139.80;

  if (plano === "plus") return 958.80;

  return 0;

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



function enderecoCompletoParaGestao(dados) {

  const endereco = dados?.endereco || {};



  return Boolean(

    numeros(endereco.cep).length === 8 &&

    texto(endereco.uf).length === 2 &&

    texto(endereco.cidade) &&

    texto(endereco.bairro) &&

    texto(endereco.logradouro) &&

    texto(endereco.numero)

  );

}



function montarDadosContrato(cadastro) {

  const dados = cadastro.dados || {};

  const endereco = dados.endereco || {};



  return {

    nome: dados.nome,

    cpf: dados.cpf,

    data_nascimento: dados.dataNascimento,

    email: dados.email,

    celular: dados.celular,

    whatsapp: dados.celular,

    sexo: dados.sexo || undefined,



    cep: endereco.cep,

    uf: endereco.uf || dados.estado,

    cidade: endereco.cidade || dados.cidade,

    bairro: endereco.bairro,

    logradouro: endereco.logradouro,

    numero: endereco.numero,

    complemento: endereco.complemento,



    plano: dados.plano,

    valor: valorPlanoAnual(dados.plano),

  };

}



function registrarErroIntegracao(error) {

  return {

    mensagem: texto(

      error?.message || "Erro desconhecido na integração."

    ),

    statusHttp: error?.status || error?.response?.status || null,

    codigoContrato: error?.cod_contrato || null,

    codigoCadastro: error?.cod_cadastro || null,

    atualizadoEm: new Date().toISOString(),

  };

}



// ======================================================

// BUSCAR CADASTRO INTERNAMENTE

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

// ESPELHAR LEAD NO FIRESTORE

// ======================================================



async function salvarLead(cadastro) {

  const agora = new Date().toISOString();



  const lead = {

    cadastroId: cadastro.cadastroId,

    origem: "site_doutor_de_todos",



    dados: cadastro.dados,



    nome: cadastro.dados.nome,

    cpf: cadastro.dados.cpf,

    email: cadastro.dados.email,

    celular: cadastro.dados.celular,

    telefone: cadastro.dados.telefone,



    plano: cadastro.dados.plano,

    formaPagamento: cadastro.dados.pagamento,



    status: cadastro.statusCadastro,

    statusCadastro: cadastro.statusCadastro,

    statusPagamento: cadastro.statusPagamento,



    convertido: false,

    clienteAtivo: false,



    criadoEm: cadastro.criadoEm,

    atualizadoEm: agora,

  };



  await db

    .collection(COLECAO_LEADS)

    .doc(String(cadastro.cadastroId))

    .set(lead, { merge: true });

}



// ======================================================

// CRIAR OU ATUALIZAR ESPELHO DO CONTRATO

// ======================================================



async function salvarEspelhoContrato(cadastroId) {

  const cadastro = await buscarCadastroInterno(cadastroId);



  if (!cadastro || !cadastro.gestao?.codContrato) {

    return;

  }



  const agora = new Date().toISOString();



  await db

    .collection(COLECAO_CONTRATOS)

    .doc(String(cadastroId))

    .set(

      {

        cadastroId,

        codContrato: cadastro.gestao.codContrato,

        codCadastro: cadastro.gestao.codCadastro || null,



        nome: cadastro.dados?.nome || null,

        cpf: cadastro.dados?.cpf || null,

        plano: cadastro.dados?.plano || null,



        status: cadastro.gestao.status || "Em cadastramento",

        statusPagamento: cadastro.statusPagamento,



        gatewayPagamento: cadastro.gatewayPagamento || null,

        pedidoPagamento: cadastro.pedidoPagamento || null,



        origem: "site_doutor_de_todos",

        criadoEm: cadastro.criadoEm,

        atualizadoEm: agora,

      },

      { merge: true }

    );

}



// ======================================================

// SINCRONIZAR CONTRATO COM A API DE GESTÃO

// ======================================================



async function sincronizarContratoGestao(cadastroId) {

  const referencia = db

    .collection(COLECAO)

    .doc(String(cadastroId));



  const documento = await referencia.get();



  if (!documento.exists) {

    throw new Error(

      "Cadastro não encontrado para integração com a Gestão."

    );

  }



  const cadastro = documento.data();



  if (cadastro.gestao?.codContrato) {

    await salvarEspelhoContrato(cadastroId);



    return {

      sucesso: true,

      jaExistia: true,

      codContrato: cadastro.gestao.codContrato,

      codCadastro: cadastro.gestao.codCadastro || null,

    };

  }



  if (!enderecoCompletoParaGestao(cadastro.dados)) {

    await referencia.set(

      {

        gestao: {

          status: "pendente",

          motivo: "Endereço incompleto para criação do contrato.",

          atualizadoEm: new Date().toISOString(),

        },



        integracoes: {

          gestaoDoutorDeTodos: "pendente",

        },



        atualizadoEm: new Date().toISOString(),

      },

      { merge: true }

    );



    return {

      sucesso: false,

      pendente: true,

      motivo: "Endereço incompleto.",

    };

  }



  try {

    const resultado = await criarContratoGestao(

      montarDadosContrato(cadastro)

    );



    const codContrato =

      resultado?.cod_contrato ||

      resultado?.codContrato ||

      null;



    const codCadastro =

      resultado?.cod_cadastro ||

      resultado?.codCadastro ||

      null;



    if (!codContrato) {

      throw new Error(

        "A API da Gestão não retornou o código do contrato."

      );

    }



    const agora = new Date().toISOString();



    await referencia.set(

      {

        gestao: {

          codContrato: String(codContrato),

          codCadastro: codCadastro

            ? String(codCadastro)

            : null,



          status: resultado?.status || "Em cadastramento",

          sincronizado: true,

          atualizadoEm: agora,

          erro: null,

        },



        integracoes: {

          gestaoDoutorDeTodos: "contrato_criado",

        },



        atualizadoEm: agora,

      },

      { merge: true }

    );



    await salvarEspelhoContrato(cadastroId);



    return {

      sucesso: true,

      codContrato: String(codContrato),

      codCadastro: codCadastro

        ? String(codCadastro)

        : null,

    };

  } catch (error) {

    const erro = registrarErroIntegracao(error);



    await referencia.set(

      {

        gestao: {

          status: "erro",

          sincronizado: false,

          erro,

          atualizadoEm: new Date().toISOString(),

        },



        integracoes: {

          gestaoDoutorDeTodos: "erro",

        },



        atualizadoEm: new Date().toISOString(),

      },

      { merge: true }

    );



    console.error(

      "Falha ao sincronizar contrato com Gestão:",

      erro

    );



    return {

      sucesso: false,

      erro: erro.mensagem,

    };

  }

}



// ======================================================

// SINCRONIZAR CLIENTE APÓS PAGAMENTO CONFIRMADO

// ======================================================



async function salvarClienteConfirmado(cadastroId) {

  const cadastro = await buscarCadastroInterno(cadastroId);



  if (!cadastro) {

    throw new Error("Cadastro não encontrado.");

  }



  if (cadastro.statusPagamento !== "pago") {

    throw new Error(

      "Não é possível criar cliente sem pagamento confirmado."

    );

  }



  const agora = new Date().toISOString();



  await db

    .collection(COLECAO_CLIENTES)

    .doc(String(cadastroId))

    .set(

      {

        cadastroId,

        dados: cadastro.dados,



        nome: cadastro.dados.nome,

        cpf: cadastro.dados.cpf,

        email: cadastro.dados.email,

        celular: cadastro.dados.celular,

        telefone: cadastro.dados.telefone,



        plano: cadastro.dados.plano,



        status: "cliente",

        statusPagamento: "pago",

        clienteAtivo: true,



        gatewayPagamento: cadastro.gatewayPagamento || null,

        pedidoPagamento: cadastro.pedidoPagamento || null,



        origem: "site_doutor_de_todos",

        criadoEm: cadastro.criadoEm,

        atualizadoEm: agora,

      },

      { merge: true }

    );



  // Mantém o lead como histórico da conversão.

  await db

    .collection(COLECAO_LEADS)

    .doc(String(cadastroId))

    .set(

      {

        convertido: true,

        clienteAtivo: true,



        status: "convertido",

        statusCadastro: "pagamento_confirmado",

        statusPagamento: "pago",



        convertidoEm: agora,

        atualizadoEm: agora,

      },

      { merge: true }

    );

}



// ======================================================

// ATUALIZAR STATUS DE PAGAMENTO

// USADO PARA RECUSAS E CANCELAMENTOS

// ======================================================



async function atualizarStatusPagamentoInterno(

  cadastroId,

  status,

  pedidoPagamento,

  gateway = "pagarme"

) {

  if (!cadastroId) {

    throw new Error("Cadastro não informado.");

  }



  const statusNormalizado = texto(status).toLowerCase();



  const statusPermitidos = {

    pendente: "pendente",

    falhou: "falhou",

    recusado: "falhou",

    cancelado: "cancelado",

  };



  const statusFinal = statusPermitidos[statusNormalizado];



  if (!statusFinal) {

    throw new Error("Status de pagamento não reconhecido.");

  }



  const referencia = db

    .collection(COLECAO)

    .doc(String(cadastroId));



  const cadastro = await buscarCadastroInterno(cadastroId);



  if (!cadastro) {

    throw new Error("Cadastro não encontrado.");

  }



  // Um pagamento já confirmado não pode ser rebaixado.

  if (cadastro.statusPagamento === "pago") {

    return {

      sucesso: true,

      ignorado: true,

      motivo: "O pagamento já está confirmado.",

    };

  }



  const agora = new Date().toISOString();



  const pedidoId =

    typeof pedidoPagamento === "object"

      ? String(

          pedidoPagamento?.idPedido ||

          pedidoPagamento?.id ||

          pedidoPagamento?.order_id ||

          ""

        ).trim()

      : String(pedidoPagamento || "").trim();



  const gatewayFinal =

    texto(gateway).toLowerCase() === "yampi"

      ? "yampi"

      : "pagarme";



  const atualizacao = {

    statusPagamento: statusFinal,

    statusCadastro:

      statusFinal === "falhou"

        ? "pagamento_recusado"

        : statusFinal === "cancelado"

          ? "pagamento_cancelado"

          : cadastro.statusCadastro,



    gatewayPagamento: gatewayFinal,

    atualizadoEm: agora,

  };



  if (pedidoId) {

    atualizacao.pedidoPagamento = pedidoId;



    if (gatewayFinal === "yampi") {

      atualizacao.pedidoYampi = pedidoId;

    } else {

      atualizacao.pedidoPagarme = pedidoId;

    }

  }



  await referencia.set(atualizacao, { merge: true });



  await db

    .collection(COLECAO_LEADS)

    .doc(String(cadastroId))

    .set(

      {

        status: atualizacao.statusCadastro,

        statusCadastro: atualizacao.statusCadastro,

        statusPagamento: statusFinal,

        atualizadoEm: agora,

      },

      { merge: true }

    );



  return {

    sucesso: true,

    cadastroId,

    statusPagamento: statusFinal,

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

      "cep",

      "endereco",

      "numero",

      "bairro",

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



      sexo: texto(dados.sexo),



      consentimentoPrivacidade:

        dados.consentimentoPrivacidade === true,



      dataConsentimento: texto(dados.dataConsentimento),

    };



    if (cliente.nome.split(/\s+/).length < 2) {

      return res.status(400).json({

        error: "Informe o nome completo do titular.",

        campos: ["nome"],

      });

    }



    if (!validarCPF(cliente.cpf)) {

      return res.status(400).json({

        error: "CPF inválido.",

        campos: ["cpf"],

      });

    }



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



    const emailValido =

      /^[^\s@]+@[^\s@]+**\\.**[^\s@]+$/.test(cliente.email);



    if (!emailValido) {

      return res.status(400).json({

        error: "E-mail inválido.",

        campos: ["email"],

      });

    }



    if (!["light", "plus"].includes(cliente.plano)) {

      return res.status(400).json({

        error: "Plano não reconhecido.",

        campos: ["plano"],

      });

    }



    if (!["cartao", "energia"].includes(cliente.pagamento)) {

      return res.status(400).json({

        error: "Forma de pagamento não reconhecida.",

        campos: ["pagamento"],

      });

    }



    if (!cliente.consentimentoPrivacidade) {

      return res.status(400).json({

        error: "O consentimento para tratamento dos dados é necessário.",

        campos: ["consentimentoPrivacidade"],

      });

    }



    // ======================================

    // ENDEREÇO

    // ======================================



    cliente.endereco = {

      cep: numeros(dados.cep),

      uf: texto(dados.uf || dados.estado).toUpperCase(),

      cidade: texto(dados.cidade),

      bairro: texto(dados.bairro),

      logradouro: texto(dados.logradouro || dados.endereco),

      numero: texto(dados.numero),

      complemento: texto(dados.complemento),

    };



    if (

      cliente.endereco.cep.length !== 8 ||

      cliente.endereco.uf.length !== 2 ||

      !cliente.endereco.cidade ||

      !cliente.endereco.bairro ||

      !cliente.endereco.logradouro ||

      !cliente.endereco.numero

    ) {

      return res.status(400).json({

        error: "Informe o endereço completo do titular.",

        campos: ["cep", "endereco", "numero", "bairro", "cidade", "estado"],

      });

    }



    // ======================================

    // DADOS ENEL

    // ======================================



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



    // ======================================

    // CRIAR CADASTRO PRINCIPAL

    // ======================================



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



      gestao: {

        status: "pendente",

        sincronizado: false,

        codContrato: null,

        codCadastro: null,

      },



      integracoes: {

        firebase: "concluida",

        leads: "pendente",

        clientes: "aguardando_pagamento",

        contratos: "pendente",

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



    // ======================================

    // CRIAR LEAD

    // ======================================



    try {

      await salvarLead(cadastro);



      await db

        .collection(COLECAO)

        .doc(cadastroId)

        .set(

          {

            "integracoes.leads": "concluida",

            atualizadoEm: new Date().toISOString(),

          },

          { merge: true }

        );

    } catch (error) {

      console.error(

        "Erro ao espelhar lead:",

        error.message

      );

    }



    // ======================================

    // CRIAR CONTRATO NA GESTÃO

    //

    // A API recebe o contrato sem pagamento.

    // O pagamento só será informado depois

    // da confirmação real do gateway.

    // ======================================



    if (enderecoCompletoParaGestao(cliente)) {

      await sincronizarContratoGestao(cadastroId);

    }



    const cadastroFinal =

      await buscarCadastroInterno(cadastroId);



    console.log("-----------------------------------");

    console.log("NOVO CADASTRO SALVO");

    console.log("Cadastro:", cadastroId);

    console.log("Plano:", cliente.plano);

    console.log("Pagamento:", cliente.pagamento);

    console.log("Status:", cadastro.statusCadastro);

    console.log("-----------------------------------");



    return res.status(201).json(

      gerarRespostaCadastro(cadastroFinal || cadastro)

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



      plano: cadastro.dados?.plano,



      gatewayPagamento: cadastro.gatewayPagamento || null,

      pedidoPagamento: cadastro.pedidoPagamento || null,



      gestao: {

        status: cadastro.gestao?.status || "pendente",

        codContrato: cadastro.gestao?.codContrato || null,

      },



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

// ATUALIZAR PAGAMENTO CONFIRMADO

// SOMENTE APÓS CONFIRMAÇÃO REAL DO GATEWAY

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



  if (

    !["pagarme", "pagar.me", "yampi"].includes(

      gatewayNormalizado

    )

  ) {

    throw new Error("Gateway de pagamento não reconhecido.");

  }



  const gatewayFinal =

    gatewayNormalizado === "yampi"

      ? "yampi"

      : "pagarme";



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



  // ======================================

  // ATUALIZAÇÃO TRANSACIONAL

  // ======================================



  const resultado = await db.runTransaction(

    async (transaction) => {

      const documento = await transaction.get(referencia);



      if (!documento.exists) {

        throw new Error(

          "Cadastro não encontrado no Firebase."

        );

      }



      const cadastro = documento.data();



      const pedidoAnterior =

        gatewayFinal === "yampi"

          ? cadastro.pedidoYampi

          : cadastro.pedidoPagarme;



      // Mesmo pedido já confirmado.

      // As rotinas abaixo ainda serão executadas

      // para permitir nova tentativa de sincronização.

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

    }

  );



  // ======================================

  // IMPORTANTE:

  // MESMO EM WEBHOOK REPETIDO, TENTAMOS

  // NOVAMENTE AS SINCRONIZAÇÕES PENDENTES.

  // ======================================



  await salvarClienteConfirmado(cadastroId);



  // ======================================

  // GARANTIR CONTRATO NA GESTÃO

  // ======================================



  let contratoGestao = await sincronizarContratoGestao(

    cadastroId

  );



  let cadastroAtualizado =

    await buscarCadastroInterno(cadastroId);



  const codContrato =

    cadastroAtualizado?.gestao?.codContrato;



  // ======================================

  // INFORMAR PAGAMENTO À GESTÃO

  // ======================================



  if (codContrato) {

    try {

      const plano = cadastroAtualizado.dados.plano;



      let valorPago = valorPrimeiraCobranca(plano);



      if (

        typeof pedidoPagamento === "object" &&

        Number(pedidoPagamento.valor) > 0

      ) {

        valorPago = Number(pedidoPagamento.valor);

      }



      const pagamentoGestao = await informarPagamentoGestao({

        codContrato,

        status: "pago",

        idPedido: pedidoId,

        gateway: gatewayFinal,

        plano,

        valor: valorPago,

      });



      const agora = new Date().toISOString();



      await referencia.set(

        {

          gestao: {

            pagamentoSincronizado: true,

            pagamentoStatus: "pago",

            pagamentoAtualizadoEm: agora,

            pagamentoErro: null,

            respostaPagamento: pagamentoGestao || null,

          },



          integracoes: {

            gestaoDoutorDeTodos: "pagamento_sincronizado",

          },



          atualizadoEm: agora,

        },

        { merge: true }

      );



    } catch (error) {

      const erro = registrarErroIntegracao(error);



      await referencia.set(

        {

          gestao: {

            pagamentoSincronizado: false,

            pagamentoStatus: "pendente",

            pagamentoErro: erro,

            pagamentoAtualizadoEm: new Date().toISOString(),

          },



          integracoes: {

            gestaoDoutorDeTodos: "pagamento_pendente",

          },



          atualizadoEm: new Date().toISOString(),

        },

        { merge: true }

      );



      console.error(

        "Pagamento confirmado, mas não sincronizado com Gestão:",

        erro

      );

    }

  }



  // ======================================

  // ATUALIZAR ESPELHO DO CONTRATO

  // ======================================



  cadastroAtualizado =

    await buscarCadastroInterno(cadastroId);



  if (cadastroAtualizado?.gestao?.codContrato) {

    await salvarEspelhoContrato(cadastroId);

  }



  return {

    ...resultado,

    contratoGestao,

  };

}



// ======================================================

// EXPORTAÇÕES

// ======================================================



module.exports = router;



module.exports.buscarCadastroInterno =

  buscarCadastroInterno;



module.exports.atualizarPagamentoInterno =

  atualizarPagamentoInterno;



module.exports.atualizarStatusPagamentoInterno =

  atualizarStatusPagamentoInterno;



module.exports.sincronizarContratoGestao =

  sincronizarContratoGestao;



module.exports.salvarClienteConfirmado =

  salvarClienteConfirmado;



module.exports.salvarEspelhoContrato =

  salvarEspelhoContrato;
