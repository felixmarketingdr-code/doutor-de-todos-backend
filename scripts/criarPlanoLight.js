
require('dotenv').config();

const crypto = require('crypto');

async function executar() {
  try {
    const ambiente = String(
      process.env.PAGARME_ENV || 'test'
    ).trim().toLowerCase();

    const valorMensal = Number(
      process.env.PAGARME_VALOR_LIGHT_CENTAVOS
    );

    const planoExistente = String(
      process.env.PAGARME_PLANO_LIGHT_ID || ''
    ).trim();

    if (planoExistente) {
      console.log(
        'O plano Light já possui um ID configurado:'
      );

      console.log(planoExistente);

      console.log(
        'Nenhum plano novo foi criado.'
      );

      return;
    }

    if (valorMensal !== 3990) {
      throw new Error(
        'O valor mensal Light deve ser 3990 centavos.'
      );
    }

    if (!process.env.PAGARME_SECRET_KEY) {
      throw new Error(
        'PAGARME_SECRET_KEY não configurada.'
      );
    }

    const pagarmeService = require(
      '../src/services/pagarmeService'
    );

    const dadosPlano = {
      name: 'Doutor de Todos Light Mensal',

      description:
        'Mensalidade recorrente do plano Doutor de Todos Light',

      currency: 'BRL',

      interval: 'month',

      interval_count: 1,

      billing_type: 'prepaid',

      payment_methods: [
        'credit_card',
      ],

      installments: [1],

      items: [
        {
          name: 'Mensalidade Doutor de Todos Light',

          quantity: 1,

          pricing_scheme: {
            price: 3990,
          },
        },
      ],
    };

    const chaveIdempotencia = crypto
      .createHash('sha256')
      .update(
        'doutor-de-todos-light-mensal-v1-' +
        ambiente
      )
      .digest('hex');

    console.log(
      'Criando plano Light na Pagar.me...'
    );

    console.log('Ambiente:', ambiente);

    console.log('Mensalidade: R$ 39,90');

    const plano = await pagarmeService.criarPlano(
      dadosPlano,
      chaveIdempotencia
    );

    if (!plano || !plano.id) {
      throw new Error(
        'A Pagar.me não retornou o ID do plano.'
      );
    }

    console.log('\n================================');

    console.log('PLANO LIGHT CRIADO COM SUCESSO');

    console.log('================================');

    console.log('ID DO PLANO:');

    console.log(plano.id);

    console.log('\nAdicione no Render:');

    console.log(
      `PAGARME_PLANO_LIGHT_ID=${plano.id}`
    );

    console.log('\nAmbiente:', ambiente);

    console.log('Status:', plano.status || 'Não informado');

    console.log('================================\n');

  } catch (error) {
    console.error(
      '\nERRO AO CRIAR PLANO LIGHT:'
    );

    console.error(error.message);

    if (error.detalhes) {
      console.error(
        'Detalhes:',
        JSON.stringify(error.detalhes, null, 2)
      );
    }

    process.exitCode = 1;
  }
}

executar();
