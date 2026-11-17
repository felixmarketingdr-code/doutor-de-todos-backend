
const ambiente = String(
  process.env.PAGARME_ENV || 'test'
)
  .trim()
  .toLowerCase();

if (!['test', 'production'].includes(ambiente)) {
  throw new Error(
    'PAGARME_ENV deve ser test ou production.'
  );
}

const secretKey = String(
  process.env.PAGARME_SECRET_KEY || ''
).trim();

const publicKey = String(
  process.env.PAGARME_PUBLIC_KEY || ''
).trim();

if (!secretKey) {
  throw new Error(
    'PAGARME_SECRET_KEY não configurada.'
  );
}

if (
  ambiente === 'test' &&
  !secretKey.startsWith('sk_test_')
) {
  throw new Error(
    'PAGARME_ENV está como test, mas a chave não parece ser uma chave de teste.'
  );
}

if (
  ambiente === 'production' &&
  secretKey.startsWith('sk_test_')
) {
  throw new Error(
    'PAGARME_ENV está como production, mas foi informada uma chave de teste.'
  );
}

const baseURL = 'https://api.pagar.me/core/v5';

module.exports = {
  ambiente,
  baseURL,
  secretKey,
  publicKey,
};
