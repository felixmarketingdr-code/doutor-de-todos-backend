
import logo from '../assets/logotipo.jpg'

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-container">

        <a
          href="/"
          className="site-header-logo"
          aria-label="Doutor Saúde - Página inicial"
        >
          <img
            src={logo}
            alt="Doutor Saúde"
            className="site-logo"
          />
        </a>

        <span className="header-mensagem">
          Cuidado, acolhimento e assistência para você e sua família.
        </span>

      </div>
    </header>
  )
}
