const PLANOS_YAMPI = {
  light: {
    nome: 'Doutor de Todos Light',
    sku: '8Z2UCNMBJ',
    checkoutUrl: 'https://doutor-de-todos2.pay.yampi.com.br/r/IC2CLHV6AH',
  },

  plus: {
    nome: 'Doutor de Todos Plus',
    sku: '49223CFKN',
    checkoutUrl: 'https://doutor-de-todos2.pay.yampi.com.br/r/1LMPRA45AC',
  },
}

// ==========================================
// PREPARAÇÃO DO CHECKOUT
// ==========================================

function gerarCheckout({ cadastroId, plano }) {
  if (!cadastroId) {
    throw new Error('Identificador do cadastro não informado.')
  }

  const planoNormalizado = String(plano || '').toLowerCase()
  const produto = PLANOS_YAMPI[planoNormalizado]

  if (!produto) {
    throw new Error('Plano não encontrado na configuração da Yampi.')
  }

  // Usa somente o identificador interno do cadastro na URL.
  // Não incluir CPF, telefone, e-mail ou endereço nos parâmetros.
  const url = new URL(produto.checkoutUrl)

  url.searchParams.set('metadata[cadastro_id]', String(cadastroId))
  url.searchParams.set('metadata[origem]', 'site_doutor_de_todos')
  url.searchParams.set('metadata[plano]', planoNormalizado)

  return {
    checkoutUrl: url.toString(),
    cadastroId,
    plano: planoNormalizado,
    produto: produto.nome,
    sku: produto.sku,
  }
}

// ==========================================
// EXPORTAÇÃO
// ==========================================

module.exports = {
  gerarCheckout,
  PLANOS_YAMPI,
}
