import { MessageCircle } from 'lucide-react'

const WHATSAPP_NUMERO = '5511979944011'

export default function WhatsAppFlutuante() {
  const mensagem = encodeURIComponent(
    'Olá! Estou conhecendo a Doutor de Todos e gostaria de falar com um atendente.'
  )

  const linkWhatsApp = `https://wa.me/${WHATSAPP_NUMERO}?text=${mensagem}`

  return (
    <a
      className="whatsapp-flutuante"
      href={linkWhatsApp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com um atendente pelo WhatsApp"
    >
      <MessageCircle size={25} />
      <span>Falar com atendente</span>
    </a>
  )
}