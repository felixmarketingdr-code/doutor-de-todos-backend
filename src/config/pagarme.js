
const ambiente = String(
  process.env.PAGARME_ENV || 'test'
)
  .trim()
  .toLowerCase()

if (!['test', 'production'].includes(ambiente)) {
  throw new Error(
    'PAGARME_ENV deve ser test ou production.'
  )
}

const secretKey = String(
  process.env.PAGARME_SECRET_KEY || ''
).trim()

const publicKey = String(
  process.env.PAGARME_PUBLIC_KEY || ''
).trim()

if (!secretKey) {
  throw new Error(
    'PAGARME_SECRET_KEY não configurada.'
  )
}

const baseURL = 'https://api.pagar.me/core/v5'

module.exports = {
  ambiente,
  baseURL,
  secretKey,
  publicKey,
}
