
const numeroCentavos = (variavel, valorPadrao = 0) => {
  const valor = Number(process.env[variavel] ?? valorPadrao);

  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`A variável ${variavel} possui um valor inválido.`);
  }

  return valor;
};

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

    parcelas: 12,
  },

  plus: {
    id: 'plus',
    nome: 'Doutor de Todos Plus',

    valorParcelaCentavos: numeroCentavos(
      'PAGARME_VALOR_PLUS_CENTAVOS'
    ),

    parcelas: numeroCentavos(
      'PAGARME_PLUS_PARCELAS',
      12
    ),
  },
};

function obterPlano(plano) {
  const planoNormalizado = String(plano || '')
    .trim()
    .toLowerCase();

  const produto = PLANOS[planoNormalizado];

  if (!produto) {
    throw new Error('Plano não encontrado.');
  }

  if (produto.id === 'light') {
    if (
      !Number.isInteger(produto.valorMensalCentavos) ||
      produto.valorMensalCentavos <= 0
    ) {
      throw new Error(
        'Valor mensal do plano Doutor de Todos Light não configurado corretamente no backend.'
      );
    }

    if (
      !Number.isInteger(produto.adesaoCentavos) ||
      produto.adesaoCentavos <= 0
    ) {
      throw new Error(
        'Taxa de adesão do plano Doutor de Todos Light não configurada corretamente no backend.'
      );
    }

    return {
      ...produto,
      valorPrimeiraCobrancaCentavos:
        produto.valorMensalCentavos + produto.adesaoCentavos,

      valorTotalAnualCentavos:
        produto.valorMensalCentavos * 12 +
        produto.adesaoCentavos,
    };
  }

  if (produto.id === 'plus') {
    if (
      !Number.isInteger(produto.valorParcelaCentavos) ||
      produto.valorParcelaCentavos <= 0
    ) {
      throw new Error(
        'Valor da parcela do plano Doutor de Todos Plus não configurado corretamente no backend.'
      );
    }

    if (
      !Number.isInteger(produto.parcelas) ||
      produto.parcelas !== 12
    ) {
      throw new Error(
        'O plano Doutor de Todos Plus deve possuir 12 parcelas.'
      );
    }

    return {
      ...produto,

      valorTotalAnualCentavos:
        produto.valorParcelaCentavos * produto.parcelas,
    };
  }

  throw new Error('Configuração de plano inválida.');
}

module.exports = {
  PLANOS,
  obterPlano,
};
