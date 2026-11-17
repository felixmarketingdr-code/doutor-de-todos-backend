import logo from '../assets/logotipo.jpg'
import icones from '../assets/icones.png'

import {
  ShieldCheck,
  Headset,
} from 'lucide-react'

export default function Footer() {
  const anoAtual = new Date().getFullYear()

  return (
    <footer className="site-footer">

      {/* ÁREA PRINCIPAL */}
      <div className="footer-principal">

        <div className="footer-identidade">

          <img
            src={logo}
            alt="Doutor Saúde"
          />

          <p>
            Cuidado, acolhimento e assistência
            para você e sua família.
          </p>

        </div>

        <div className="footer-legal">

          <h3>Informações legais</h3>

          <div className="footer-cnpj">
            <span>CNPJ</span>
            <strong>11.948.609/0001-03</strong>
          </div>

          <nav className="footer-links" aria-label="Links legais">

            <a href="/politica-de-privacidade">
              Política de Privacidade
            </a>

            <a href="/politica-de-cookies">
              Política de Cookies
            </a>

            <a href="/termos-de-uso">
              Termos de Uso
            </a>

          </nav>

        </div>

      </div>

      {/* INFORMAÇÕES E SERVIÇOS */}
      <div className="footer-informacoes">

        <div className="footer-seguranca">

          <h4>Segurança</h4>

          <ShieldCheck size={32} />

          <span>Ambiente seguro</span>

        </div>

        <div className="footer-pagamentos">

          <h4>Formas de pagamento</h4>

          <img
            src={icones}
            alt="Bandeiras de pagamento"
            className="footer-bandeiras-imagem"
          />

          <small>

          </small>

        </div>

        <div className="footer-atendimento">

          <h4>Atendimento</h4>

          <Headset size={32} />

          <span>Fale com nossa equipe</span>

        </div>

      </div>

      {/* RODAPÉ FINAL */}
      <div className="footer-final">

        <p>
          © {anoAtual} Doutor Saúde.
          Todos os direitos reservados.
        </p>

        <p>

        </p>

        <p className="footer-aviso">
          O Doutor Saúde é um cartão de descontos
          em serviços de saúde.
        </p>

      </div>

    </footer>
  )
}