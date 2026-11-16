
const PLANOS = {
  light: {
    id: 'light',
    nome: 'Doutor de Todos Light',
    valorCentavos: Number(
      process.env.PAGARME_VALOR_LIGHT_CENTAVOS || 0
    ),
  },

  plus: {
    id: 'plus',
    nome: 'Doutor de Todos Plus',
    valorCentavos: Number(
      process.env.PAGARME_VALOR_PLUS_CENTAVOS || 0
    ),
  },
}

function obterPlano(plano) {
  const planoNormalizado = String(plano || '')
    .trim()
    .toLowerCase()

  const produto = PLANOS[planoNormalizado]

  if (!produto) {
    throw new Error('Plano não encontrado.')
  }

  if (
    !Number.isInteger(produto.valorCentavos) ||
    produto.valorCentavos <= 0
  ) {
    throw new Error(
      `Valor do plano ${produto.nome} não configurado corretamente no backend.`
    )
  }

  return { ...produto }
}

module.exports = {
  PLANOS,
  obterPlano,
}
