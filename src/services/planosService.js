// ======================================================
// SERVIÇO DE PLANOS — DOUTOR DE TODOS
// ======================================================

const numeroCentavos = (variavel, valorPadrao = null) => {
  const valorConfigurado = process.env[variavel];

  const valor = Number(
    valorConfigurado !== undefined && valorConfigurado !== ''
      ? valorConfigurado
      : valorPadrao
  );

  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new Error(
      `A variável ${variavel} possui um valor inválido. Informe o valor em centavos.`
    );
  }

  return valor;
};

// ======================================================
// CONFIGURAÇÃO DOS PLANOS
// ======================================================

const PLANOS = {
  light: {
    id: 'light',
    nome: 'Doutor de Todos Light',

    valorMensalCentavos: numeroCentavos(
      'PAGARME_VALOR_LIGHT_CENTAVOS'
    ),

    adesaoCentavos: numeroCentavos(
      'PAGARME_ADESAO_LIGHT_CENTAVOS'
    ),

    parcelas: 1,
  },

  plus: {
    id: 'plus',
    nome: 'Doutor de Todos Plus',

    valorTotalAnualCentavos: numeroCentavos(
      'PAGARME_VALOR_PLUS_CENTAVOS'
    ),

    parcelas: numeroCentavos(
      'PAGARME_PLUS_PARCELAS',
      12
    ),
  },
};

// ======================================================
// OBTER PLANO E VALIDAR CONFIGURAÇÃO
// ======================================================

function obterPlano(plano) {
  const planoNormalizado = String(plano || '')
    .trim()
    .toLowerCase();

  const produto = PLANOS[planoNormalizado];

  if (!produto) {
    throw new Error('Plano não encontrado.');
  }

  // ----------------------------------------------------
  // PLANO LIGHT
  // ----------------------------------------------------

  if (produto.id === 'light') {
    if (
      !Number.isSafeInteger(produto.valorMensalCentavos) ||
      produto.valorMensalCentavos <= 0
    ) {
      throw new Error(
        'Valor mensal do plano Doutor de Todos Light não configurado corretamente no backend.'
      );
    }

    if (
      !Number.isSafeInteger(produto.adesaoCentavos) ||
      produto.adesaoCentavos <= 0
    ) {
      throw new Error(
        'Taxa de adesão do plano Doutor de Todos Light não configurada corretamente no backend.'
      );
    }

    const valorPrimeiraCobrancaCentavos =
      produto.valorMensalCentavos + produto.adesaoCentavos;

    if (!Number.isSafeInteger(valorPrimeiraCobrancaCentavos)) {
      throw new Error(
        'O valor da primeira cobrança do plano Light ultrapassa o limite permitido.'
      );
    }

    return {
      ...produto,
      valorPrimeiraCobrancaCentavos,

      valorTotalAnualCentavos:
        produto.valorMensalCentavos * 12 +
        produto.adesaoCentavos,
    };
  }

  // ----------------------------------------------------
  // PLANO PLUS
  // ----------------------------------------------------

  if (produto.id === 'plus') {
    if (
      !Number.isSafeInteger(produto.valorTotalAnualCentavos) ||
      produto.valorTotalAnualCentavos <= 0
    ) {
      throw new Error(
        'Valor anual do plano Doutor de Todos Plus não configurado corretamente no backend.'
      );
    }

    if (
      !Number.isInteger(produto.parcelas) ||
      produto.parcelas !== 12
    ) {
      throw new Error(
        'O plano Doutor de Todos Plus deve possuir exatamente 12 parcelas.'
      );
    }

    if (produto.valorTotalAnualCentavos % produto.parcelas !== 0) {
      throw new Error(
        'O valor anual do plano Plus precisa ser divisível em 12 parcelas iguais.'
      );
    }

    return {
      ...produto,
      valorParcelaCentavos:
        produto.valorTotalAnualCentavos / produto.parcelas,
    };
  }

  throw new Error('Configuração de plano inválida.');
}

// ======================================================
// EXPORTAÇÕES
// ======================================================

module.exports = {
  PLANOS,
  obterPlano,
};